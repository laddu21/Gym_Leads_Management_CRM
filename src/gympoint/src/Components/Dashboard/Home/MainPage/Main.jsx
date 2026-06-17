import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './SideNavbar/Sidebar';
import MobileHeader from '../../../../MobileView/MobileHeader';
import DesktopNavbar from './DesktopNavbar';
import DashboardHeader from './DashboardHeader';
import MembershipActions from '../../../../Pages/MembershipActions';
import Membershipcard from '../../../../Pages/Membershipcard';
import Packages from '../../../Packages/Packages';
import Employees from '../../../Employees/MyEmployees/Employees';
import MyPerfomance from '../../Perfomance/MyPerfomance';
import MyLead from '../../Leads/MyLead';
import RecordPitch from '../../../../Pages/RecordPitch';
import Conform from '../../../../Pages/Conform';
import ReportsPage from '../../../Reports/ReportsPage';
import Members from '../../../Members/Members';
import AttendanceHistoryPage from '../../../AttendanceHistory/AttendanceHistoryPage';
import { userMembershipsService } from '../../../../services/userMembershipsService';
import { getPlanDetails } from '../../../../data/membershipPlans';
import { attendanceService } from '../../../../services/attendanceService';
import { leadsService } from '../../../../services/leadsService';
import apiClient from '../../../../services/apiClient';

const formatDateKey = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDisplayDate = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

// Removed unused helpers isNumericPhoneMatch and loadMembershipCardEntries to reduce lint warnings

const formatDateTimeLabel = (value) => {
    if (!value) {
        return '—';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '—';
    }
    return parsed.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Time-only formatter for local display (HH:MM)
const formatLocalTime = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    try {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '—';
    }
};

// Removed relative time formatter as Pitch Date now shows exact time and date

const VIEW_TITLES = {
    dashboard: 'Dashboard',
    memberships: 'Memberships',
    employees: 'My Employees',
    performance: 'My Performance',
    leads: 'My Leads',
    reports: 'Reports',
    'record-pitch': 'Record Pitch',
    'confirm-membership': 'Create Membership',
    'membership-card': 'Membership Details',
    'members-attendance': 'Members Attendance'
};

const CHECKED_IN_BLOCKS = [
    {
        key: 'trial',
        label: 'Trial',
        description: 'Guests evaluating the club experience',
        highlight: 'bg-blue-500'
    },
    {
        key: 'new-members',
        label: 'New Members',
        description: 'Recently onboarded members today',
        highlight: 'bg-emerald-500'
    },
    {
        key: 'existing-members',
        label: 'Existing Members',
        description: 'Returning members keeping the streak alive',
        highlight: 'bg-indigo-500'
    }
];

const TRIAL_SLOT_COUNT = 24;
const TRIAL_SLOT_DURATION_MINUTES = 60;
const TRIAL_SLOT_LABEL = 'Trial slot';
const TRIAL_REFRESH_INTERVAL_MS = 60 * 1000;
const VISIBLE_TRIAL_SLOT_COUNT = 5;
const TRIAL_LEADS_STORAGE_KEY = 'gym-dashboard:trial-leads';
const TRIAL_LEAD_EXPIRY_MS = 2 * 60 * 60 * 1000;

const formatTrialSlotLabel = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '';
    }
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const pruneExpiredTrialLeads = (leads = [], reference = Date.now()) => {
    if (!Array.isArray(leads) || leads.length === 0) {
        return [];
    }
    return leads.filter((lead) => {
        const createdAt = typeof lead?.createdAt === 'number'
            ? lead.createdAt
            : Date.parse(lead?.createdAt);
        if (!Number.isFinite(createdAt)) {
            return false;
        }
        return reference - createdAt <= TRIAL_LEAD_EXPIRY_MS;
    });
};

const loadTrialLeads = () => {
    if (typeof window === 'undefined' || !window?.localStorage) {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(TRIAL_LEADS_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return pruneExpiredTrialLeads(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
        console.error('Unable to load cached trial leads', error);
        return [];
    }
};

const persistTrialLeads = (leads) => {
    if (typeof window === 'undefined' || !window?.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(TRIAL_LEADS_STORAGE_KEY, JSON.stringify(leads));
    } catch (error) {
        console.error('Unable to persist trial leads', error);
    }
};

const calculateTrialSlot = (referenceDate = new Date()) => {
    const validReference = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
        ? referenceDate
        : new Date();

    const slotDurationMs = TRIAL_SLOT_DURATION_MINUTES * 60 * 1000;
    const start = new Date(validReference.getTime());
    start.setSeconds(0, 0);

    const minutes = start.getMinutes();
    const remainder = minutes % TRIAL_SLOT_DURATION_MINUTES;
    if (remainder !== 0) {
        start.setMinutes(minutes + (TRIAL_SLOT_DURATION_MINUTES - remainder));
    }
    if (start < validReference) {
        start.setTime(start.getTime() + slotDurationMs);
    }

    const end = new Date(start.getTime() + slotDurationMs);
    return {
        start,
        end,
        label: `${formatTrialSlotLabel(start)} – ${formatTrialSlotLabel(end)}`
    };
};

const generateTrialBookingWindows = (referenceDate = new Date()) => {
    const slots = [];
    const validReference = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
        ? referenceDate
        : new Date();

    const slotDurationMs = TRIAL_SLOT_DURATION_MINUTES * 60 * 1000;
    const start = new Date(validReference.getTime());
    start.setSeconds(0, 0);

    const minutes = start.getMinutes();
    const remainder = minutes % TRIAL_SLOT_DURATION_MINUTES;
    if (remainder !== 0) {
        start.setMinutes(minutes + (TRIAL_SLOT_DURATION_MINUTES - remainder));
    }
    if (start < validReference) {
        start.setTime(start.getTime() + slotDurationMs);
    }

    for (let index = 0; index < TRIAL_SLOT_COUNT; index += 1) {
        const slotStart = new Date(start.getTime() + index * slotDurationMs);
        const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
        slots.push({
            time: `${formatTrialSlotLabel(slotStart)} – ${formatTrialSlotLabel(slotEnd)}`,
            booking: TRIAL_SLOT_LABEL
        });
    }

    return slots;
};

const normalizeContactNumber = (value = '') => {
    if (!value) {
        return '';
    }
    const raw = value.toString();
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 10) {
        return digits.slice(-10);
    }
    return digits || raw.trim();
};

const PLAN_CODE_DURATION_MONTHS = {
    '1m': 1,
    '3m': 3,
    '6m': 6,
    '12m': 12
};

const MEMBERSHIP_CARD_STORAGE_KEY = 'gym-dashboard:memberships';
const MAX_MEMBERSHIP_CARD_ENTRIES = 12;

const persistMembershipCardEntry = (entry) => {
    if (!entry) {
        return;
    }
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }

    try {
        const raw = window.localStorage.getItem(MEMBERSHIP_CARD_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const current = Array.isArray(parsed) ? parsed : [];

        const normalizedPhone = normalizeContactNumber(entry.phone);
        const fullEntry = { ...entry, normalizedPhone };
        const next = [...current];

        if (normalizedPhone) {
            const existingIndex = next.findIndex((item) => normalizeContactNumber(item.normalizedPhone || item.phone) === normalizedPhone);
            if (existingIndex !== -1) {
                next[existingIndex] = { ...next[existingIndex], ...fullEntry };
            } else {
                next.unshift(fullEntry);
            }
        } else {
            next.unshift(fullEntry);
        }

        if (next.length > MAX_MEMBERSHIP_CARD_ENTRIES) {
            next.length = MAX_MEMBERSHIP_CARD_ENTRIES;
        }

        window.localStorage.setItem(MEMBERSHIP_CARD_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
        console.error('Unable to cache membership card entry', error);
    }
};

const normalizePitchDateValue = (value, fallbackKey = '') => {
    if (!value) {
        return fallbackKey;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        const [day, month, year] = value.split('/');
        return `${year}-${month}-${day}`;
    }

    return fallbackKey || value;
};

// Accept gymName as a prop
const Main = (props) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
    const [isReportsDropdownOpen, setIsReportsDropdownOpen] = useState(false);
    const [isDashboardDropdownOpen, setIsDashboardDropdownOpen] = useState(false);
    const [isEmployeesDropdownOpen, setIsEmployeesDropdownOpen] = useState(false);
    const [activeView, setActiveView] = useState('dashboard');
    const [reportSection, setReportSection] = useState(null);
    const [pitches, setPitches] = useState([]);
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [isPitchesLoading, setIsPitchesLoading] = useState(false);
    const [pitchesError, setPitchesError] = useState('');
    const [leadEntries, setLeadEntries] = useState([]);
    const [highlightedNumber, setHighlightedNumber] = useState('');
    const [showMembershipActions, setShowMembershipActions] = useState(false);
    const [recordPitchNumber, setRecordPitchNumber] = useState('');
    const [recordPitchName, setRecordPitchName] = useState('');
    const [, setRecordPitchReturnView] = useState('dashboard');
    const [membershipDraft, setMembershipDraft] = useState(null);
    const [showMembershipCard, setShowMembershipCard] = useState(false);
    const [membershipCardFilter, setMembershipCardFilter] = useState('');
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [attendanceHistory, setAttendanceHistory] = useState({});
    const [preSelectedPlan, setPreSelectedPlan] = useState('');
    const [preSelectedCategory, setPreSelectedCategory] = useState('');
    const [preSelectedPlanPrice, setPreSelectedPlanPrice] = useState('');
    const [trialBookingWindows, setTrialBookingWindows] = useState(() => generateTrialBookingWindows());
    const [trialWindowStartIndex, setTrialWindowStartIndex] = useState(0);
    const [trialLeads, setTrialLeads] = useState(() => loadTrialLeads());
    const [recordPitchMode, setRecordPitchMode] = useState('lead');
    const [memberships, setMemberships] = useState([]);
    const [leads, setLeads] = useState([]);
    const [isCurrentPitchDay, setIsCurrentPitchDay] = useState(true);
    // Removed unused dailyPitches state
    const [preSelectedPhone, setPreSelectedPhone] = useState('');
    const [pitchesPage, setPitchesPage] = useState(1);

    useEffect(() => {
        // Clear stored data for a clean app start, but preserve authentication
        if (typeof window !== 'undefined' && window.localStorage) {
            const keysToClear = [
                'gym-dashboard:trial-leads',
                'gym-dashboard:memberships',
                'dailyPitches',
                'gym-dashboard:last-attendance-date'
            ];
            keysToClear.forEach(key => localStorage.removeItem(key));
        }
    }, []);

    useEffect(() => {
        const updateTrialSlots = () => {
            const nextSlots = generateTrialBookingWindows();
            setTrialBookingWindows(nextSlots);
        };
        updateTrialSlots();
        const interval = setInterval(updateTrialSlots, TRIAL_REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    const decoratedTrialBookingWindows = useMemo(() => {
        if (!trialBookingWindows.length) {
            return [];
        }
        if (!trialLeads.length) {
            return trialBookingWindows;
        }
        const slotLeadMap = trialLeads.reduce((accumulator, lead) => {
            const key = lead?.slotLabel;
            if (!key) {
                return accumulator;
            }
            if (!accumulator[key]) {
                accumulator[key] = [];
            }
            accumulator[key].push(lead);
            return accumulator;
        }, {});

        return trialBookingWindows.map((slot) => {
            const leadsForSlot = slotLeadMap[slot.time] || [];
            const bookingLabel = leadsForSlot.length
                ? leadsForSlot.length.toString()
                : slot.booking;
            return {
                ...slot,
                booking: bookingLabel,
                leads: leadsForSlot
            };
        });
    }, [trialBookingWindows, trialLeads]);

    useEffect(() => {
        setTrialWindowStartIndex((current) => {
            const maxStart = Math.max(decoratedTrialBookingWindows.length - VISIBLE_TRIAL_SLOT_COUNT, 0);
            return Math.min(current, maxStart);
        });
    }, [decoratedTrialBookingWindows.length]);

    const visibleTrialBookingWindows = useMemo(() => (
        decoratedTrialBookingWindows.slice(
            trialWindowStartIndex,
            trialWindowStartIndex + VISIBLE_TRIAL_SLOT_COUNT
        )
    ), [decoratedTrialBookingWindows, trialWindowStartIndex]);

    const canPageBackward = trialWindowStartIndex > 0;
    const canPageForward = trialWindowStartIndex + VISIBLE_TRIAL_SLOT_COUNT < decoratedTrialBookingWindows.length;

    const handlePreviousTrialWindow = useCallback(() => {
        setTrialWindowStartIndex((current) => Math.max(current - VISIBLE_TRIAL_SLOT_COUNT, 0));
    }, []);

    const handleNextTrialWindow = useCallback(() => {
        setTrialWindowStartIndex((current) => {
            const maxStart = Math.max(decoratedTrialBookingWindows.length - VISIBLE_TRIAL_SLOT_COUNT, 0);
            return Math.min(current + VISIBLE_TRIAL_SLOT_COUNT, maxStart);
        });
    }, [decoratedTrialBookingWindows.length]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const handleAttendanceUpdate = async (event) => {
            const nextRecords = event?.detail?.records;
            if (Array.isArray(nextRecords)) {
                setAttendanceRecords(nextRecords);
            } else {
                // If recordKey provided for removal
                const recordKey = event?.detail?.recordKey;
                if (recordKey) {
                    setAttendanceRecords((prev) => prev.filter(rec => (rec.membershipId || rec.phone) !== recordKey));
                    return;
                }
                // If single record provided, prepend it
                const record = event?.detail?.record;
                if (record) {
                    setAttendanceRecords((prev) => [record, ...prev]);
                    return;
                }
                try {
                    const records = await attendanceService.listRecords();
                    setAttendanceRecords(records);
                } catch (e) {
                    console.error('Failed to reload attendance records', e);
                }
            }
            const historyDetail = event?.detail?.history;
            if (historyDetail && typeof historyDetail === 'object') {
                setAttendanceHistory(historyDetail);
            }
        };

        const handleHistoryUpdate = async (event) => {
            const nextHistory = event?.detail?.history;
            if (nextHistory && typeof nextHistory === 'object') {
                setAttendanceHistory(nextHistory);
            } else {
                try {
                    const history = await attendanceService.listHistory();
                    setAttendanceHistory(history);
                } catch (e) {
                    console.error('Failed to reload attendance history', e);
                }
            }
        };

        window.addEventListener('memberships:attendance-updated', handleAttendanceUpdate);
        window.addEventListener('memberships:attendance-sync', handleAttendanceUpdate);
        window.addEventListener('memberships:attendance-history-updated', handleHistoryUpdate);

        return () => {
            window.removeEventListener('memberships:attendance-updated', handleAttendanceUpdate);
            window.removeEventListener('memberships:attendance-sync', handleAttendanceUpdate);
            window.removeEventListener('memberships:attendance-history-updated', handleHistoryUpdate);
        };
    }, []);

    // Auto-purge expired attendance every minute and perform daily reset of current attendance
    useEffect(() => {
        let mounted = true;
        const LAST_DATE_KEY = 'gym-dashboard:last-attendance-date';

        const ensureDailyReset = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const last = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_DATE_KEY) : null;
                if (last !== today) {
                    await attendanceService.clearRecords();
                    if (typeof window !== 'undefined') window.localStorage.setItem(LAST_DATE_KEY, today);
                    // refresh local state and notify listeners
                    const records = await attendanceService.listRecords();
                    if (!mounted) return;
                    setAttendanceRecords(records);
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('memberships:attendance-updated', { detail: {} }));
                    }
                }
            } catch (e) {
                console.error('Daily reset failed', e);
            }
        };

        const purgeExpired = async () => {
            try {
                const result = await attendanceService.purgeExpiredRecords();
                if (!mounted) return;
                if (result?.removedKeys?.length) {
                    // update local state
                    setAttendanceRecords(result.updatedRecords || []);
                    if (result.updatedHistory) setAttendanceHistory(result.updatedHistory);
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('memberships:attendance-updated', { detail: { history: result.updatedHistory } }));
                    }
                }
            } catch (e) {
                console.error('Failed to purge expired attendance', e);
            }
        };

        // Run immediately, then on interval
        ensureDailyReset();
        purgeExpired();
        const interval = setInterval(() => {
            ensureDailyReset();
            purgeExpired();
        }, 60 * 1000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const handleOpenMemberProfile = (event) => {
            const detail = event?.detail || {};
            const normalized = normalizeContactNumber(detail.normalizedPhone || detail.phone || '');

            const nextFilter = normalized || '';
            setShowMembershipActions(false);
            setMembershipCardFilter(nextFilter);
            setShowMembershipCard(false);
            setActiveView('membership-card');
            setIsMobileMenuOpen(false);

            const lookupPhone = detail.phone || normalized;
            if (lookupPhone && typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('lead:search', { detail: { phone: lookupPhone } }));
            }
        };

        window.addEventListener('members-attendance:open-profile', handleOpenMemberProfile);
        return () => window.removeEventListener('members-attendance:open-profile', handleOpenMemberProfile);
    }, []);

    const selectedDateKey = formatDateKey(selectedDate);

    // Helper functions for daily pitch tracking
    const getDateKey = (date) => {
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const checkIsCurrentPitchDay = useCallback((dateStr) => {
        const today = getDateKey(new Date());
        return dateStr === today;
    }, []);

    const saveDailyPitches = (dateKey, pitchData) => {
        try {
            const existingData = localStorage.getItem('dailyPitches');
            const allDaysData = existingData ? JSON.parse(existingData) : {};
            allDaysData[dateKey] = {
                pitches: pitchData,
                savedAt: new Date().toISOString(),
                totalCount: pitchData.length
            };
            localStorage.setItem('dailyPitches', JSON.stringify(allDaysData));
            console.log(`Saved ${pitchData.length} pitches for ${dateKey}`);
        } catch (err) {
            console.error('Error saving daily pitches:', err);
        }
    };

    const loadDailyPitches = (dateKey) => {
        try {
            const existingData = localStorage.getItem('dailyPitches');
            if (existingData) {
                const allDaysData = JSON.parse(existingData);
                return allDaysData[dateKey]?.pitches || [];
            }
        } catch (err) {
            console.error('Error loading daily pitches:', err);
        }
        return [];
    };

    useEffect(() => {
        if (!selectedDateKey) {
            return;
        }

        const dateKey = getDateKey(selectedDate);
        const isCurrent = checkIsCurrentPitchDay(dateKey);
        setIsCurrentPitchDay(isCurrent);

        let isMounted = true;

        const fetchPitchesData = async () => {
            setIsPitchesLoading(true);
            setPitchesError('');

            try {
                if (isCurrent) {
                    // For current day, fetch ALL leads with Trial Scheduled/Trial Attended/Converted status
                    console.log('Fetching live pitches for current day...');
                    const [allLeads, allUserMemberships] = await Promise.all([
                        leadsService.list(),
                        userMembershipsService.list()
                    ]);

                    const leadsArray = Array.isArray(allLeads) ? allLeads : (allLeads?.data || []);
                    const membershipsArray = Array.isArray(allUserMemberships) ? allUserMemberships : (allUserMemberships?.data || []);

                    // Create a phone-to-membership map for quick lookup (normalize phone numbers)
                    const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');
                    const membershipsByPhone = {};
                    membershipsArray.forEach(membership => {
                        const normalizedPhone = normalizePhone(membership.phone);
                        if (normalizedPhone) {
                            // Store the most recent membership for each phone
                            if (!membershipsByPhone[normalizedPhone] ||
                                new Date(membership.date) > new Date(membershipsByPhone[normalizedPhone].date)) {
                                membershipsByPhone[normalizedPhone] = membership;
                            }
                        }
                    });

                    // Show ALL leads for the current day
                    const todayPitches = leadsArray.filter(lead => {
                        // Check if the lead was created or updated today
                        const leadDate = lead.updatedAt || lead.createdAt;
                        if (!leadDate) return false;

                        const leadDateKey = getDateKey(new Date(leadDate));
                        return leadDateKey === dateKey;
                    }).map(lead => {
                        const normalizedPhone = normalizePhone(lead.phone);
                        const userMembership = membershipsByPhone[normalizedPhone];

                        // Get plan from user membership if available, otherwise from lead data
                        let planDetails = '';
                        if (userMembership) {
                            // Format: "Premium - 6 Months" or "Normal - 1 Month"
                            const type = userMembership.type ? userMembership.type.charAt(0).toUpperCase() + userMembership.type.slice(1) : '';
                            const duration = userMembership.duration || '';
                            planDetails = type && duration ? `${type} - ${duration}` : '';
                        } else {
                            planDetails = lead.membership?.plan || '';
                        }

                        return {
                            id: lead._id || lead.id,
                            name: lead.name,
                            phone: lead.phone,
                            email: lead.email || '',
                            leadSource: lead.source || lead.leadSource || '',
                            plan: planDetails,
                            interest: lead.interest || lead.leadType || '',
                            remarks: lead.notes || lead.membership?.remarks || '',
                            pitchDate: dateKey,
                            recordedAt: lead.updatedAt || lead.createdAt,
                            status: lead.status
                        };
                    });

                    if (!isMounted) return;

                    setPitches(todayPitches);

                    // Auto-save current day data
                    saveDailyPitches(dateKey, todayPitches);
                } else {
                    // For past days, load from localStorage
                    console.log('Loading historical pitches from storage...');
                    const historicalPitches = loadDailyPitches(dateKey);

                    if (!isMounted) return;

                    setPitches(historicalPitches);
                }
            } catch (error) {
                if (!isMounted) return;

                console.error('Failed to load pitches', error);
                setPitchesError('Unable to load recorded pitches right now.');
                setPitches([]);
            } finally {
                if (isMounted) {
                    setIsPitchesLoading(false);
                }
            }
        };

        fetchPitchesData();

        // Auto-refresh for current day only
        let refreshInterval;
        if (isCurrent) {
            refreshInterval = setInterval(fetchPitchesData, 30000); // Refresh every 30 seconds
        }

        return () => {
            isMounted = false;
            if (refreshInterval) clearInterval(refreshInterval);
        };
    }, [selectedDateKey, selectedDate, checkIsCurrentPitchDay]);

    // Removed relative time tick since Pitch Date now shows exact time and date

    // Refresh pitches when leads are updated (for current day only)
    useEffect(() => {
        if (!isCurrentPitchDay) return;

        const handleLeadUpdate = () => {
            // Trigger a re-fetch by updating the selected date key
            setSelectedDate(new Date(selectedDate));
        };

        window.addEventListener('lead:created', handleLeadUpdate);
        window.addEventListener('lead:status-updated', handleLeadUpdate);
        window.addEventListener('reporting:membership-created', handleLeadUpdate);

        return () => {
            window.removeEventListener('lead:created', handleLeadUpdate);
            window.removeEventListener('lead:status-updated', handleLeadUpdate);
            window.removeEventListener('reporting:membership-created', handleLeadUpdate);
        };
    }, [isCurrentPitchDay, selectedDate]);

    useEffect(() => {
        const fetchMemberships = async () => {
            try {
                const data = await userMembershipsService.list();
                setMemberships(data);
            } catch (error) {
                console.error('Failed to fetch memberships:', error);
            }
        };
        fetchMemberships();

        const handleRefresh = () => {
            fetchMemberships();
        };

        window.addEventListener('memberships:refresh', handleRefresh);
        window.addEventListener('reporting:membership-created', handleRefresh);

        return () => {
            window.removeEventListener('memberships:refresh', handleRefresh);
            window.removeEventListener('reporting:membership-created', handleRefresh);
        };
    }, []);

    // Keep leads cached so search can detect converted leads and open Membership Card
    useEffect(() => {
        const fetchLeads = async () => {
            try {
                const res = await leadsService.list();
                setLeads(Array.isArray(res) ? res : (res?.data || []));
            } catch (e) {
                console.error('Failed to fetch leads:', e);
            }
        };

        fetchLeads();

        const refresh = () => fetchLeads();
        window.addEventListener('lead:created', refresh);
        window.addEventListener('lead:status-updated', refresh);
        window.addEventListener('lead:deleted', refresh);

        return () => {
            window.removeEventListener('lead:created', refresh);
            window.removeEventListener('lead:status-updated', refresh);
            window.removeEventListener('lead:deleted', refresh);
        };
    }, []);

    const pitchesForSelectedDate = useMemo(() => {
        const PITCHES_PER_PAGE = 5;
        const allPitches = pitches.map((pitch) => {
            const recorded = pitch.recordedAt || pitch.pitchDate;
            let timeStr = formatLocalTime(recorded);
            let dateStr = '—';
            const d = new Date(recorded);
            if (d instanceof Date && !Number.isNaN(d.getTime())) {
                dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
            const label = [timeStr, dateStr].filter((s) => s && s !== '—').join(' — ');
            return {
                ...pitch,
                interest: (pitch.interest || '—').toUpperCase(),
                pitchDateLabel: label || '—',
                dateKey: pitch.pitchDate || selectedDateKey
            };
        });

        // Calculate pagination
        const startIndex = (pitchesPage - 1) * PITCHES_PER_PAGE;
        const endIndex = startIndex + PITCHES_PER_PAGE;

        return allPitches.slice(startIndex, endIndex);
    }, [pitches, selectedDateKey, pitchesPage]);

    const totalPitchesPages = useMemo(() => {
        const PITCHES_PER_PAGE = 5;
        return Math.ceil(pitches.length / PITCHES_PER_PAGE);
    }, [pitches.length]);

    const handlePitchesPreviousPage = useCallback(() => {
        setPitchesPage(prev => Math.max(1, prev - 1));
    }, []);

    const handlePitchesNextPage = useCallback(() => {
        setPitchesPage(prev => Math.min(totalPitchesPages, prev + 1));
    }, [totalPitchesPages]);

    // Reset to page 1 when date changes
    useEffect(() => {
        setPitchesPage(1);
    }, [selectedDateKey]);

    const attendanceHistoryMap = useMemo(() => {
        const history = new Map();
        const source = attendanceHistory || {};
        Object.entries(source).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                history.set(key, {
                    entries: value.slice(0, 5),
                    totalCount: value.length
                });
                return;
            }
            const entries = Array.isArray(value?.entries) ? value.entries.slice(0, 5) : [];
            const totalCount = Number.isFinite(value?.totalCount) ? value.totalCount : entries.length;
            history.set(key, {
                entries,
                totalCount: Math.max(totalCount, entries.length)
            });
        });
        return history;
    }, [attendanceHistory]);

    const checkedInCounts = useMemo(() => {
        const counts = {
            trial: 0,
            newMembers: 0,
            existingMembers: 0
        };

        attendanceRecords.forEach((record) => {
            if (!record) {
                return;
            }

            const normalized = normalizeContactNumber(record.phone);
            const historyEntry = attendanceHistoryMap.get(record.membershipId) || attendanceHistoryMap.get(normalized);
            const totalCheckIns = historyEntry?.totalCount ?? (record.checkInAt ? 1 : 0);

            if (record.planCategory === 'trial' || (record.planLabel && record.planLabel.toLowerCase().includes('trial'))) {
                counts.trial += 1;
            } else if (totalCheckIns <= 5) {
                counts.newMembers += 1;
            } else {
                counts.existingMembers += 1;
            }
        });

        counts.trial += trialLeads.length;
        return counts;
    }, [attendanceHistoryMap, attendanceRecords, trialLeads]);

    const checkedInBlockCounts = useMemo(() => ({
        trial: checkedInCounts.trial,
        'new-members': checkedInCounts.newMembers,
        'existing-members': checkedInCounts.existingMembers
    }), [checkedInCounts]);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const toggleDesktopSidebar = () => {
        setIsDesktopSidebarOpen(!isDesktopSidebarOpen);
    };

    const toggleReportsDropdown = () => {
        setIsReportsDropdownOpen((prev) => !prev);
    };

    const toggleDashboardDropdown = () => {
        setIsDashboardDropdownOpen(!isDashboardDropdownOpen);
    };

    const toggleEmployeesDropdown = () => {
        setIsEmployeesDropdownOpen(!isEmployeesDropdownOpen);
    };

    // Removed Members dropdown; now a single Members nav item opens members-attendance

    const handleAddLeadEntry = useCallback(async (rawNumber, existingName) => {
        const displayValue = rawNumber?.toString().trim() || '';
        const normalized = normalizeContactNumber(rawNumber);
        if (!displayValue || !normalized) {
            return { normalized: '', isDuplicate: false };
        }

        let isDuplicate = false;
        let createdNewEntry = false;
        const timestamp = Date.now();
        setLeadEntries((prev) => {
            const existing = prev.find((entry) => entry.normalized === normalized);
            if (existing) {
                isDuplicate = true;
                return prev.map((entry) => (
                    entry.normalized === normalized
                        ? { ...entry, display: displayValue, updatedAt: timestamp, name: existingName || entry.name }
                        : entry
                ));
            }
            const nextEntry = {
                id: `${timestamp}-${normalized}`,
                normalized,
                display: displayValue,
                name: existingName || 'Unknown',
                createdAt: timestamp,
                updatedAt: timestamp,
                lastAction: null
            };
            createdNewEntry = true;
            return [nextEntry, ...prev];
        });

        if (createdNewEntry && !existingName) {
            // Only create a new lead in DB if name wasn't found (meaning lead doesn't exist)
            try {
                const savedLead = await leadsService.create({
                    name: 'Unknown',
                    phone: displayValue,
                    status: 'New',
                    leadSource: 'Search',
                    followUpDate: new Date().toISOString().slice(0, 10)
                });
                // Update local entry with DB id
                setLeadEntries((prev) => prev.map((entry) =>
                    entry.normalized === normalized ? { ...entry, id: savedLead.id } : entry
                ));
            } catch (error) {
                console.error('Failed to save lead to database:', error);
                // Continue with local entry
            }
        }

        setHighlightedNumber(normalized);
        if (createdNewEntry) {
            setShowMembershipActions(true);
            setShowMembershipCard(false);
            setMembershipCardFilter('');
        }
        return { normalized, isDuplicate };
    }, [setShowMembershipActions]);

    const handleDismissLeadEntry = useCallback((number) => {
        const normalized = normalizeContactNumber(number);
        if (!normalized) {
            return;
        }
        let nextLength = 0;
        setLeadEntries((prev) => {
            const next = prev.filter((entry) => entry.normalized !== normalized);
            nextLength = next.length;
            return next;
        });
        if (nextLength === 0) {
            setShowMembershipActions(false);
        }
        setActiveView('dashboard');
        setIsMobileMenuOpen(false);
        setShowMembershipCard(false);
        setMembershipCardFilter('');
    }, [setShowMembershipActions, setIsMobileMenuOpen, setActiveView]);

    const handleMembershipStartTrial = useCallback((details) => {
        const payload = typeof details === 'string'
            ? { contact: details, name: '' }
            : (details || {});
        const contactValue = payload.contact?.toString().trim() || '';
        const normalized = normalizeContactNumber(contactValue);
        if (!normalized) {
            return;
        }

        const providedName = payload.name?.toString().trim() || '';
        let matchedEntry = null;
        const timestamp = Date.now();
        setLeadEntries((prev) => {
            matchedEntry = prev.find((entry) => entry.normalized === normalized) || null;
            return prev.map((entry) => (
                entry.normalized === normalized
                    ? { ...entry, lastAction: 'trial', updatedAt: timestamp }
                    : entry
            ));
        });

        const displayValue = matchedEntry?.display || contactValue || normalized;
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('membership:start-trial', { detail: { phone: displayValue, normalized } }));
        }
        setRecordPitchMode('trial');
        setRecordPitchNumber(contactValue || normalized);
        setRecordPitchName(providedName);
        setShowMembershipCard(false);
        setMembershipCardFilter('');
        setRecordPitchReturnView('leads');
        setMembershipDraft(null);
        setActiveView('record-pitch');
        setIsMobileMenuOpen(false);
        if (contactValue && typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('lead:search', { detail: { phone: contactValue } }));
        }
    }, []);

    const handleMembershipRecordLead = useCallback((number) => {
        const normalized = normalizeContactNumber(number);
        if (!normalized) {
            return;
        }

        let matchedEntry = null;
        const timestamp = Date.now();
        setLeadEntries((prev) => {
            matchedEntry = prev.find((entry) => entry.normalized === normalized) || null;
            return prev.map((entry) => (
                entry.normalized === normalized
                    ? { ...entry, lastAction: 'record', updatedAt: timestamp }
                    : entry
            ));
        });

        const displayValue = matchedEntry?.display || number?.toString().trim() || normalized;
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('lead:search', { detail: { phone: displayValue } }));
        }
        setActiveView('leads');
        setIsMobileMenuOpen(false);
        setShowMembershipCard(false);
        setMembershipCardFilter('');
    }, []);

    const handleHideMembershipCard = useCallback(() => {
        setShowMembershipCard(false);
        setMembershipCardFilter('');
    }, []);

    const handleOpenRecordPitch = useCallback((details, mode = 'lead') => {
        const payload = typeof details === 'string'
            ? { contact: details, name: '' }
            : (details || {});

        const trimmed = payload.contact?.toString().trim() || '';
        const trimmedName = payload.name?.toString().trim() || '';
        setRecordPitchNumber(trimmed);
        setRecordPitchName(trimmedName);
        setRecordPitchMode(mode);
        setShowMembershipCard(false);
        setMembershipCardFilter('');
        setRecordPitchReturnView((prev) => (activeView === 'record-pitch' ? prev : activeView));
        setMembershipDraft(null);
        setActiveView('record-pitch');
        setIsMobileMenuOpen(false);
        if (trimmed && typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('lead:search', { detail: { phone: trimmed } }));
        }
    }, [activeView]);

    const handleCloseRecordPitch = useCallback(() => {
        setActiveView('dashboard');
        setShowMembershipActions(false);
        setRecordPitchReturnView('dashboard');
        setRecordPitchNumber('');
        setRecordPitchName('');
        setPreSelectedPlan('');
        setPreSelectedCategory('');
        setPreSelectedPlanPrice('');
        setRecordPitchMode('lead');
        setIsMobileMenuOpen(false);
        setShowMembershipCard(false);
        setMembershipCardFilter('');
    }, []);

    const handleTrialLeadComplete = useCallback(async (detail) => {
        const createdAt = typeof detail?.createdAt === 'number' ? detail.createdAt : Date.now();
        const slotInfo = calculateTrialSlot(new Date(createdAt));
        const slotLabel = detail?.slotLabel || slotInfo.label;
        const normalizedPhone = normalizeContactNumber(detail?.phone);
        const trialEntry = {
            id: detail?.id || `trial-${createdAt}`,
            name: detail?.name || detail?.phone || 'Trial Guest',
            phone: detail?.phone || '',
            normalizedPhone,
            interest: detail?.interest || '',
            status: detail?.status || 'Trial Attended',
            slotLabel,
            createdAt,
            remarks: detail?.remarks || ''
        };

        // Update the lead status in the database
        try {
            await leadsService.update({
                phone: detail?.phone,
                status: 'Trial Attended',
                notes: detail?.remarks || 'Trial attended'
            });
        } catch (error) {
            console.error('Failed to update lead status for trial:', error);
        }

        setTrialLeads((prev) => {
            const current = pruneExpiredTrialLeads(Array.isArray(prev) ? prev : []);
            const withoutDuplicate = normalizedPhone
                ? current.filter((lead) => normalizeContactNumber(lead.phone) !== normalizedPhone)
                : current;
            const next = [trialEntry, ...withoutDuplicate];
            persistTrialLeads(next);
            return next;
        });

        if (typeof window !== 'undefined') {
            if (window.dispatchEvent && (detail?.phone || normalizedPhone)) {
                const searchPhone = detail?.phone || normalizedPhone;
                window.dispatchEvent(new CustomEvent('lead:search', { detail: { phone: searchPhone } }));
            }
            if (typeof window.alert === 'function') {
                window.alert('trial checkin success');
            }
        }

        setActiveView('leads');
        setShowMembershipActions(false);
        setRecordPitchReturnView('dashboard');
        setRecordPitchNumber('');
        setRecordPitchName('');
        setPreSelectedPlan('');
        setPreSelectedCategory('');
        setPreSelectedPlanPrice('');
        setRecordPitchMode('lead');
        setIsMobileMenuOpen(false);
        setShowMembershipCard(false);
        setMembershipCardFilter('');
    }, []);

    const handleRecordPitchSuccess = useCallback((payload) => {
        console.log('handleRecordPitchSuccess called with payload:', payload);
        if (!payload) {
            return;
        }
        const planInfo = getPlanDetails(payload.plan, payload.planCategory);
        setMembershipDraft({
            ...payload,
            planLabel: planInfo.label,
            planCategory: planInfo.category,
            // Preserve the backend pricing passed from RecordPitch, don't override with static data
            planPrice: payload.planPrice ?? planInfo.price
        });
        setRecordPitchNumber(payload.phone || '');
        setRecordPitchName(payload.name || '');
        setShowMembershipCard(false);
        setMembershipCardFilter('');
        console.log('Setting activeView to confirm-membership');
        setActiveView('confirm-membership');
        setIsMobileMenuOpen(false);
    }, []);

    const handleBackFromMembershipSetup = useCallback(() => {
        setRecordPitchReturnView('confirm-membership');
        setActiveView('record-pitch');
        setShowMembershipCard(false);
        setMembershipCardFilter('');
    }, []);

    const handleCreateMembership = useCallback(async (details) => {
        setMembershipDraft(details || null);

        if (details) {
            try {
                // Save to membership backend
                const membershipPayload = {
                    name: details.name,
                    phone: details.phone,
                    email: details.email || '',
                    label: details.planLabel || details.plan,
                    category: details.planCategory || 'normal',
                    price: details.planPrice || details.amount,
                    preferredDate: details.preferredDate,
                    paymentMode: details.paymentMode,
                    amount: details.amount,
                    remarks: details.remarks || '',
                    leadSource: details.leadSource || '',
                    interest: details.interest || '',
                    pitchDate: details.pitchDate
                };

                console.log('Membership payload being sent:', membershipPayload);
                await apiClient.post('/memberships', membershipPayload);

                // Check if lead already exists before creating/updating
                const normalizePhone = (phone) => {
                    const digits = String(phone || '').replace(/\D/g, '');
                    return digits.length >= 10 ? digits.slice(-10) : digits;
                };
                const normalizedPhone = normalizePhone(details.phone);
                const existingLead = leads.find(lead => normalizePhone(lead.phone) === normalizedPhone);

                // Update lead status to Converted
                try {
                    await leadsService.update({
                        phone: details.phone,
                        status: 'Converted',
                        // Remove date from comments; keep a simple message or leave empty
                        notes: 'Membership created',
                        membership: {
                            plan: details.planLabel || details.plan,
                            planCategory: details.planCategory || 'normal',
                            amount: details.amount,
                            paymentMode: details.paymentMode
                        }
                    });
                    console.log('Lead status updated to Converted for phone:', details.phone);
                } catch (updateError) {
                    console.error('Failed to update lead status:', updateError);
                    // Only create lead if it doesn't exist in the leads array
                    if (!existingLead) {
                        try {
                            await leadsService.create({
                                name: details.name,
                                phone: details.phone,
                                email: details.email || '',
                                source: details.leadSource || 'Membership Creation',
                                interest: details.interest || 'Converted',
                                status: 'Converted',
                                // Remove date from comments; keep a simple message or leave empty
                                notes: 'Membership created',
                                pitchDate: details.pitchDate || new Date().toISOString().split('T')[0],
                                leadSource: details.leadSource || 'Direct Membership',
                                membership: {
                                    plan: details.planLabel || details.plan,
                                    planCategory: details.planCategory || 'normal',
                                    amount: details.amount,
                                    paymentMode: details.paymentMode
                                }
                            });
                            console.log('Lead created with Converted status for phone:', details.phone);
                        } catch (createError) {
                            console.error('Failed to create lead:', createError);
                        }
                    } else {
                        console.log('Lead already exists, skipping creation for phone:', details.phone);
                    }
                }
            } catch (error) {
                console.error('Failed to create membership:', error);
                // For now, continue with local storage even if backend fails
                // In production, you might want to show an error to the user
            }

            const now = new Date();
            const nowIso = now.toISOString();
            const todayIso = nowIso.split('T')[0];
            const planCode = typeof details.plan === 'string' ? details.plan.toLowerCase() : '';
            const planLabel = details.planLabel || details.plan || '—';
            const normalizedPitchDate = normalizePitchDateValue(details.pitchDate, selectedDateKey);
            const normalizedPhone = normalizeContactNumber(details.phone);
            const normalizedPreferredDate = normalizePitchDateValue(details.preferredDate, todayIso);

            let startDate = normalizedPreferredDate ? new Date(normalizedPreferredDate) : new Date();
            if (Number.isNaN(startDate.getTime())) {
                startDate = new Date();
            }
            const startDateKey = startDate.toISOString().split('T')[0];

            const durationMonths = PLAN_CODE_DURATION_MONTHS[planCode] || 1;
            const expiryDate = new Date(startDate.getTime());
            expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
            const expiryDateKey = expiryDate.toISOString().split('T')[0];

            const membershipId = `membership-${nowIso}`;

            setPitches((prev) => {
                const nextEntry = {
                    id: membershipId,
                    name: details.name || '—',
                    phone: details.phone || '—',
                    email: details.email || '',
                    plan: planLabel,
                    interest: (details.interest || '—').toUpperCase(),
                    leadSource: details.leadSource || '—',
                    pitchDate: normalizedPitchDate,
                    recordedAt: nowIso,
                    remarks: details.remarks || ''
                };

                if (!normalizedPhone) {
                    return [nextEntry, ...prev];
                }

                let updated = false;
                const merged = prev.map((entry) => {
                    const entryNormalized = normalizeContactNumber(entry.phone);
                    if (entryNormalized && entryNormalized === normalizedPhone) {
                        updated = true;
                        return {
                            ...entry,
                            ...nextEntry,
                            id: entry.id || nextEntry.id
                        };
                    }
                    return entry;
                });

                if (updated) {
                    return merged;
                }

                return [nextEntry, ...merged];
            });

            if (typeof window !== 'undefined' && window.dispatchEvent) {
                const numericAmount = Number(details.amount);
                persistMembershipCardEntry({
                    id: membershipId,
                    name: details.name || '—',
                    phone: details.phone || '',
                    planLabel,
                    planCategory: details.planCategory || 'normal',
                    amount: Number.isFinite(numericAmount) && numericAmount > 0 ? Number(numericAmount) : null,
                    createdAt: nowIso,
                    startDate: startDateKey,
                    expiryDate: expiryDateKey
                });
                const membershipDetail = {
                    id: membershipId,
                    createdAt: nowIso,
                    name: details.name || '—',
                    phone: details.phone || '',
                    email: details.email || '',
                    planCode,
                    planLabel,
                    planCategory: details.planCategory || 'normal',
                    startDate: startDateKey,
                    expiryDate: expiryDateKey,
                    amount: Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount : null,
                    paymentMode: details.paymentMode || '',
                    remarks: details.remarks || '',
                    leadSource: details.leadSource || '—'
                };
                window.dispatchEvent(new CustomEvent('reporting:membership-created', { detail: membershipDetail }));
                // Also notify lead creation (converted) so MyLead and ReportsPage update
                window.dispatchEvent(new CustomEvent('lead:created', { detail: { ...membershipDetail, status: 'Converted' } }));
                // Dispatch specific event for lead status update
                window.dispatchEvent(new CustomEvent('lead:status-updated', { detail: { phone: details.phone, status: 'Converted' } }));
                window.dispatchEvent(new CustomEvent('memberships:refresh'));
                window.alert('Membership created successfully');
            }
        } else if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('memberships:refresh'));
        }

        setActiveView('dashboard');
        setIsMobileMenuOpen(false);
        setShowMembershipCard(false);
        setMembershipCardFilter('');
    }, [selectedDateKey, leads]);

    const handleValidSearch = (number) => {
        if (!number) return;
        const trimmed = number.toString().trim();
        if (!trimmed) return;
        const normalized = normalizeContactNumber(trimmed);

        // Match if user has an active membership
        const existingMembership = memberships.find(
            (m) => normalizeContactNumber(m.phone) === normalized
        );

        // Or match if the lead is Converted (or contains embedded membership info)
        const convertedLead = leads.find((l) => {
            const phoneMatch = normalizeContactNumber(l?.phone) === normalized;
            const status = String(l?.status || '').toLowerCase();
            const isConverted = status === 'converted' || !!l?.membership;
            return phoneMatch && isConverted;
        });

        if (existingMembership || convertedLead) {
            // Open Membership Card with phone filter so the card fetches and shows details
            setShowMembershipCard(false);
            setMembershipCardFilter(normalized);
            setActiveView('membership-card');
            setIsMobileMenuOpen(false);
            return;
        }

        // Check if lead exists (any status - Trial, New, etc.)
        const existingLead = leads.find((l) => {
            const phoneMatch = normalizeContactNumber(l?.phone) === normalized;
            return phoneMatch;
        });

        // Otherwise, fall back to membership actions flow
        setHighlightedNumber(trimmed);
        // Pass the existing lead's name if found, otherwise undefined
        handleAddLeadEntry(trimmed, existingLead?.name);
        setShowMembershipActions(true);
        setShowMembershipCard(false);
        setActiveView('memberships');
        setIsMobileMenuOpen(false);
    };

    const handlePreviousDay = () => {
        setSelectedDate((prev) => {
            const base = prev instanceof Date && !Number.isNaN(prev.getTime()) ? prev : new Date();
            return new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1);
        });
    };

    const handleNextDay = () => {
        setSelectedDate((prev) => {
            const base = prev instanceof Date && !Number.isNaN(prev.getTime()) ? prev : new Date();
            return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
        });
    };

    const handleDateInputChange = (event) => {
        const { value } = event.target;
        if (!value) {
            return;
        }
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) {
            return;
        }
        const nextDate = new Date(year, month - 1, day);
        if (Number.isNaN(nextDate.getTime())) {
            return;
        }
        setSelectedDate(nextDate);
    };

    const handleNavigate = (view, options = {}) => {
        setShowMembershipCard(false);
        setMembershipCardFilter('');
        setActiveView(view);
        setIsMobileMenuOpen(false);

        if (view === 'reports') {
            setReportSection(options.section || null);
            if (typeof options.isDropdownOpen === 'boolean') {
                setIsReportsDropdownOpen(options.isDropdownOpen);
            } else {
                setIsReportsDropdownOpen(true);
            }
            return;
        }

        // When navigating to membership-card from sidebar, clear any filters
        // This allows showing all membership cards instead of a filtered view
        if (view === 'membership-card') {
            setMembershipCardFilter('');
        }

        setReportSection(null);
        setIsReportsDropdownOpen(false);
        if (view !== 'record-pitch') {
            setRecordPitchMode('lead');
        }
    };

    const handlePackagePurchase = (category, plan) => {
        const planCode = plan.label.toLowerCase().replace(' months', 'm').replace(' month', 'm');
        setPreSelectedCategory(category);
        setPreSelectedPlan(planCode);
        setPreSelectedPlanPrice(plan.price);
        setRecordPitchReturnView('memberships');
        if (preSelectedPhone) {
            setRecordPitchNumber(preSelectedPhone);
            setPreSelectedPhone(''); // Clear after use
        }
        setActiveView('record-pitch');
        setIsMobileMenuOpen(false);
    };

    const hasLeadEntries = leadEntries.length > 0;
    const shouldShowMembershipActions = showMembershipActions && hasLeadEntries;

    // Accept gymName as a prop for sidebar branding
    // eslint-disable-next-line react/prop-types
    return (
        <div className="flex h-screen bg-white">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
                    onClick={toggleMobileMenu}
                />
            )}

            {/* Desktop Sidebar */}
            <Sidebar
                isDesktopSidebarOpen={isDesktopSidebarOpen}
                isMobileMenuOpen={isMobileMenuOpen}
                isReportsDropdownOpen={isReportsDropdownOpen}
                toggleReportsDropdown={toggleReportsDropdown}
                isDashboardDropdownOpen={isDashboardDropdownOpen}
                toggleDashboardDropdown={toggleDashboardDropdown}
                isEmployeesDropdownOpen={isEmployeesDropdownOpen}
                toggleEmployeesDropdown={toggleEmployeesDropdown}
                onNavigate={handleNavigate}
                activeView={activeView}
                activeReportSection={reportSection}
                gymName={typeof props !== 'undefined' && props.gymName ? props.gymName : undefined}
                onLogout={props.onLogout}
            />

            {/* Main Content Area - Dynamic width */}
            <div className="flex-1 flex flex-col transition-all duration-300 h-screen overflow-hidden">
                {/* Mobile Header */}
                <MobileHeader
                    isMobileMenuOpen={isMobileMenuOpen}
                    toggleMobileMenu={toggleMobileMenu}
                    onValidSearch={handleValidSearch} />

                {/* Main Content Area */}
                <div className={`flex-1 overflow-y-auto ${(activeView === 'memberships' || activeView === 'confirm-membership' || activeView === 'record-pitch' || activeView === 'members-attendance') ? 'bg-slate-950' : 'bg-gray-100'}`}>
                    {/* Desktop Navbar */}
                    {activeView !== 'record-pitch' && (
                        <DesktopNavbar
                            isDesktopSidebarOpen={isDesktopSidebarOpen}
                            toggleDesktopSidebar={toggleDesktopSidebar}
                            onValidSearch={handleValidSearch}
                            title={VIEW_TITLES[activeView] || 'Dashboard'}
                        />
                    )}

                    <div className={`p-2 sm:p-4 md:p-6 lg:p-8 ${activeView === 'record-pitch' ? 'lg:p-6 md:p-5 sm:p-4 p-2' : ''}`}>
                        {activeView === 'memberships' ? (
                            shouldShowMembershipActions ? (
                                <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center">
                                    <MembershipActions
                                        isVisible={shouldShowMembershipActions}
                                        leadEntries={leadEntries}
                                        highlightedNumber={highlightedNumber}
                                        onAddLeadEntry={handleAddLeadEntry}
                                        onStartTrial={handleMembershipStartTrial}
                                        onRecordLead={handleMembershipRecordLead}
                                        onOpenRecordPitch={handleOpenRecordPitch}
                                        onDismissLead={handleDismissLeadEntry}
                                        onClose={() => {
                                            setShowMembershipActions(false);
                                            setActiveView('dashboard');
                                            setShowMembershipCard(false);
                                            setMembershipCardFilter('');
                                        }}
                                    />
                                </div>
                            ) : (
                                <Packages onPurchase={handlePackagePurchase} />
                            )
                        ) : activeView === 'record-pitch' ? (
                            <div className="mx-auto max-w-5xl">
                                <RecordPitch
                                    searchNumber={recordPitchNumber}
                                    searchName={recordPitchName}
                                    preSelectedPlan={preSelectedPlan}
                                    preSelectedCategory={preSelectedCategory}
                                    planPrice={preSelectedPlanPrice}
                                    mode={recordPitchMode}
                                    onClose={handleCloseRecordPitch}
                                    onOpenMembership={handleRecordPitchSuccess}
                                    onCompleteTrial={handleTrialLeadComplete}
                                />
                            </div>
                        ) : activeView === 'confirm-membership' ? (
                            <Conform
                                leadDetails={membershipDraft || {}}
                                onBack={handleBackFromMembershipSetup}
                                onCreateMembership={handleCreateMembership}
                            />
                        ) : activeView === 'employees' ? (
                            <Employees />
                        ) : activeView === 'performance' ? (
                            <MyPerfomance />
                        ) : activeView === 'leads' ? (
                            <MyLead />
                        ) : activeView === 'members-attendance' ? (
                            <Members />
                        ) : activeView === 'attendance-history' ? (
                            <AttendanceHistoryPage />
                        ) : activeView === 'reports' ? (
                            <ReportsPage activeSection={reportSection} />
                        ) : activeView === 'membership-card' ? (
                            <div className="mx-auto w-full max-w-6xl">
                                <Membershipcard
                                    filterPhone={membershipCardFilter}
                                    onDismiss={() => handleNavigate('dashboard')}
                                    onRenew={(phone) => { setPreSelectedPhone(phone); setActiveView('memberships'); }}
                                />
                            </div>
                        ) : (
                            <>
                                {/* Dashboard Header */}
                                <DashboardHeader />

                                {/* Dashboard Statistics Cards */}
                                {/* <StatisticsCards /> */}

                                {/* Quick Actions Section */}
                                {/* <QuickActions /> */}

                                {/* Recent Activity Section */}
                                {/* <RecentActivity /> */}

                                <section className="mt-6 rounded-3xl bg-white p-4 md:p-6 shadow-sm ring-1 ring-gray-100 w-full">
                                    <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold text-gray-900">Checked-in</h2>
                                            <p className="text-sm text-gray-500">Monitor who has arrived today across key segments.</p>
                                        </div>
                                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-600">Live overview</span>
                                    </header>

                                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {CHECKED_IN_BLOCKS.map((block) => (
                                            <article
                                                key={block.key}
                                                className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-white via-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                            >
                                                <span className={`absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-10 ${block.highlight}`} />
                                                <h3 className="text-lg font-semibold text-gray-900">{block.label}</h3>
                                                <p className="mt-1 text-sm text-gray-500">{block.description}</p>
                                                <div className="mt-4 flex items-baseline gap-2">
                                                    <span className="text-4xl font-bold text-gray-900">{checkedInBlockCounts[block.key] ?? 0}</span>
                                                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">people</span>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </section>

                                <section className="mt-6 space-y-4 rounded-3xl bg-white p-4 md:p-6 shadow-sm ring-1 ring-gray-100 w-full">
                                    <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold text-gray-900">Upcoming Trials</h2>
                                            <p className="text-sm text-gray-500">Get ready for trial sessions scheduled in the next few days.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-blue-600">Next 7 days</span>
                                            <div className="inline-flex items-center rounded-full border border-blue-200 bg-white shadow-sm">
                                                <button
                                                    type="button"
                                                    onClick={handlePreviousTrialWindow}
                                                    disabled={!canPageBackward}
                                                    className="rounded-l-full px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    aria-label="Show previous trial windows"
                                                >
                                                    ← Prev
                                                </button>
                                                <span className="h-5 w-px bg-blue-100" aria-hidden="true" />
                                                <button
                                                    type="button"
                                                    onClick={handleNextTrialWindow}
                                                    disabled={!canPageForward}
                                                    className="rounded-r-full px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    aria-label="Show next trial windows"
                                                >
                                                    Next →
                                                </button>
                                            </div>
                                        </div>
                                    </header>

                                    <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5">
                                        <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">Bookings</h3>
                                        <p className="mt-1 text-xs text-blue-600">Trial session windows filling up fast</p>
                                        <div className="mt-4 overflow-x-auto">
                                            <table className="min-w-full border-separate border-spacing-y-2 text-xs text-blue-700">
                                                <tbody>
                                                    <tr className="align-top">
                                                        <th scope="row" className="whitespace-nowrap rounded-l-xl bg-white/80 px-3 py-2 text-left font-semibold uppercase tracking-wide text-blue-600">Time</th>
                                                        {visibleTrialBookingWindows.map((slot) => (
                                                            <td key={`time-${slot.time}`} className="whitespace-nowrap bg-white px-3 py-2 text-[11px] font-medium text-blue-700 shadow-sm">
                                                                {slot.time}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                    <tr className="align-top">
                                                        <th scope="row" className="whitespace-nowrap rounded-l-xl bg-white/80 px-3 py-2 text-left font-semibold uppercase tracking-wide text-blue-600">Bookings</th>
                                                        {visibleTrialBookingWindows.map((slot) => (
                                                            <td key={`booking-${slot.time}`} className="whitespace-nowrap bg-blue-100/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                                                                {slot.booking}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </section>

                                <section className="mt-6 space-y-6 rounded-3xl bg-white p-4 md:p-6 shadow-sm ring-1 ring-gray-100 w-full">
                                    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold text-gray-900">
                                                Recorded Pitches
                                            </h2>
                                            <p className="text-sm text-gray-500">
                                                {isCurrentPitchDay
                                                    ? 'Real-time tracking of all trial and converted leads for today'
                                                    : 'Viewing saved pitch data from a previous day'
                                                }
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                            <button
                                                type="button"
                                                onClick={handlePreviousDay}
                                                className="rounded-full border border-gray-200 px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-800"
                                            >
                                                ← Previous
                                            </button>
                                            <input
                                                type="date"
                                                value={selectedDateKey}
                                                onChange={handleDateInputChange}
                                                max={new Date().toISOString().split('T')[0]}
                                                className="rounded-full border border-gray-200 px-2 md:px-3 py-2 text-xs md:text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleNextDay}
                                                disabled={isCurrentPitchDay}
                                                className={`rounded-full border px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition ${isCurrentPitchDay
                                                    ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'
                                                    }`}
                                            >
                                                Next →
                                            </button>
                                        </div>
                                    </header>                                    {pitchesError && (
                                        <p className="text-sm text-rose-500">{pitchesError}</p>
                                    )}
                                    {isPitchesLoading ? (
                                        <p className="text-sm text-gray-500">Loading pitches...</p>
                                    ) : pitchesForSelectedDate.length ? (
                                        <>
                                            <div className="w-full overflow-x-auto">
                                                <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm text-gray-700">
                                                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                                        <tr>
                                                            <th className="rounded-l-2xl px-2 md:px-4 py-3 whitespace-nowrap">Name</th>
                                                            <th className="px-2 md:px-4 py-3 whitespace-nowrap">Phone</th>
                                                            <th className="px-2 md:px-4 py-3 whitespace-nowrap">Status</th>
                                                            <th className="px-2 md:px-4 py-3 whitespace-nowrap">Plan</th>
                                                            <th className="px-2 md:px-4 py-3 whitespace-nowrap">Interest</th>
                                                            <th className="px-2 md:px-4 py-3 whitespace-nowrap">Lead Source</th>
                                                            <th className="px-2 md:px-4 py-3 whitespace-nowrap">Remarks</th>
                                                            <th className="rounded-r-2xl px-2 md:px-4 py-3 whitespace-nowrap">Pitch Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-gray-900">
                                                        {pitchesForSelectedDate.map((pitch) => (
                                                            <tr key={pitch.id} className="bg-white text-xs transition hover:bg-gray-50">
                                                                <td className="rounded-l-2xl px-2 md:px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{pitch.name}</td>
                                                                <td className="px-2 md:px-4 py-3 whitespace-nowrap">{pitch.phone}</td>
                                                                <td className="px-2 md:px-4 py-3 whitespace-nowrap">
                                                                    <span className={`text-xs font-semibold ${pitch.status === 'Converted' ? 'text-green-600' : 'text-yellow-600'}`}>
                                                                        {pitch.status === 'Converted' ? 'Converted' : 'Trial'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 md:px-4 py-3 whitespace-nowrap">{pitch.plan || '—'}</td>
                                                                <td className="px-2 md:px-4 py-3 whitespace-nowrap">
                                                                    <span className={`text-xs font-semibold ${pitch.interest?.toUpperCase() === 'HOT' ? 'text-red-600' :
                                                                        pitch.interest?.toUpperCase() === 'WARM' ? 'text-orange-600' :
                                                                            pitch.interest?.toUpperCase() === 'COLD' ? 'text-blue-600' :
                                                                                'text-gray-700'
                                                                        }`}>
                                                                        {pitch.interest || '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 md:px-4 py-3 whitespace-nowrap">{pitch.leadSource || '—'}</td>
                                                                <td className="px-2 md:px-4 py-3 whitespace-nowrap">
                                                                    {(() => {
                                                                        const base = (pitch.status === 'Converted')
                                                                            ? 'Membership Created'
                                                                            : ((pitch.status === 'Trial Scheduled' || pitch.status === 'Trial Attended') ? 'Trial User' : '—');
                                                                        // Do not append time/date in remarks; only show base text
                                                                        return base;
                                                                    })()}
                                                                </td>
                                                                <td className="rounded-r-2xl px-2 md:px-4 py-3 whitespace-nowrap" title={formatDateTimeLabel(pitch.recordedAt || pitch.pitchDate)}>
                                                                    {pitch.pitchDateLabel}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Pagination Controls - Only show when more than one page */}
                                            {totalPitchesPages > 1 && (
                                                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                                                    <button
                                                        onClick={handlePitchesPreviousPage}
                                                        disabled={pitchesPage === 1}
                                                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${pitchesPage === 1
                                                            ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                                                            : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'
                                                            }`}
                                                    >
                                                        ← Previous
                                                    </button>

                                                    <span className="text-sm text-gray-600">
                                                        Page {pitchesPage} of {totalPitchesPages}
                                                    </span>

                                                    <button
                                                        onClick={handlePitchesNextPage}
                                                        disabled={pitchesPage === totalPitchesPages}
                                                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${pitchesPage === totalPitchesPages
                                                            ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                                                            : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'
                                                            }`}
                                                    >
                                                        Next →
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-500">
                                            No pitches recorded for {formatDisplayDate(selectedDate)}. Log a new pitch to see it here.
                                        </p>
                                    )}
                                </section>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {
                showMembershipCard && (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm">
                        <div className="w-full max-w-6xl">
                            <Membershipcard
                                filterPhone={membershipCardFilter}
                                onDismiss={handleHideMembershipCard}
                            />
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Main;
