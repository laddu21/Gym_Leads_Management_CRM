import React, { useEffect, useMemo, useState } from 'react';
import { leadsService } from '../../services/leadsService';
import { monthlyReportsService } from '../../services/monthlyReportsService';
import { userMembershipsService } from '../../services/userMembershipsService';
import { prepareLeads, computeExpiryDate } from '../../services/modules/leadUtils';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050').replace(/\/$/, '');

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function getDaysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
    return Math.ceil((d2 - d1) / MS_IN_DAY);
}

function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
}

function ReportsPage() {
    // rawLeads holds the raw objects returned from the backend. We prepare
    // them with the shared `prepareLeads` helper and then map into the
    // member-like shape used by this page. Keeping raw leads allows us to
    // update the collection cleanly when new leads are created.
    const [rawLeads, setRawLeads] = useState([]);
    const [now, setNow] = useState(() => new Date());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchLeads = async () => {
            setIsLoading(true);
            try {
                const data = await leadsService.list();
                console.log('API Response - Leads:', data);
                console.log('API Response - Is Array?', Array.isArray(data));
                console.log('API Response - Length:', data?.length);
                if (!mounted) return;
                const leadsArray = Array.isArray(data) ? data : [];
                console.log('Setting rawLeads:', leadsArray.length, 'leads');
                setRawLeads(leadsArray);
            } catch (err) {
                console.error('Failed to load leads for reports', err);
                if (mounted) setRawLeads([]);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        fetchLeads();

        const timer = setInterval(() => setNow(new Date()), 5 * 60 * 1000); // refresh every 5 minutes
        return () => {
            mounted = false;
            clearInterval(timer);
        };
    }, []);

    // Fetch user-memberships to build fallback amount by phone (same logic as MyLead)
    const [userMemberships, setUserMemberships] = useState([]);
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const list = await userMembershipsService.list().catch(() => []);
                if (!mounted) return;
                setUserMemberships(Array.isArray(list) ? list : []);
            } catch (e) {
                console.warn('Reports: failed to fetch user-memberships for amount fallback');
            }
        })();
        return () => { mounted = false; };
    }, []);

    // Keep the reports in sync when a lead is created elsewhere in the app
    useEffect(() => {
        const handleLeadCreated = (event) => {
            const detail = event?.detail;
            if (!detail) return;
            setRawLeads((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                if (list.some((l) => l.id === detail.id)) return list;
                return [detail, ...list];
            });
        };

        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('lead:created', handleLeadCreated);
        }

        return () => {
            if (typeof window !== 'undefined' && window.removeEventListener) {
                window.removeEventListener('lead:created', handleLeadCreated);
            }
        };
    }, []);

    // Keep the reports in sync when a membership is created (lead converted)
    useEffect(() => {
        const handleMembershipCreated = () => {
            // Refetch leads to get updated status
            const fetchLeads = async () => {
                try {
                    const data = await leadsService.list();
                    setRawLeads(Array.isArray(data) ? data : []);
                } catch (err) {
                    console.error('Failed to refetch leads for reports', err);
                }
            };
            fetchLeads();
        };

        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('reporting:membership-created', handleMembershipCreated);
        }

        return () => {
            if (typeof window !== 'undefined' && window.removeEventListener) {
                window.removeEventListener('reporting:membership-created', handleMembershipCreated);
            }
        };
    }, []);

    // Prepare raw leads using the shared helper and map into the
    // member-shaped objects this page expects (plan/joinDate/expiryDate
    // are derived from the normalized membership info when available).
    const preparedLeads = useMemo(() => {
        const prepared = prepareLeads(rawLeads);
        console.log('Raw Leads:', rawLeads.length, 'Prepared Leads:', prepared.length);
        console.log('All lead statuses:', prepared.map(l => ({
            name: l.name,
            status: l.status,
            statusLower: (l.status || '').toLowerCase(),
            statusTrimmed: (l.status || '').toLowerCase().trim()
        })));
        const trialCount = prepared.filter(l => {
            const statusLower = (l.status || '').toLowerCase().trim();
            console.log(`Checking lead ${l.name}: status="${l.status}", lower="${statusLower}", matches="${statusLower === 'trial attended'}"`);
            return statusLower === 'trial attended';
        }).length;
        console.log('Trial Attended count in prepared leads:', trialCount);
        return prepared;
    }, [rawLeads]);

    // Phone normalizer used across lookups (declare before first use)
    const normalizePhone = (phone) => (phone ? String(phone).replace(/\D/g, '').slice(-10) : '');

    // Build a realtime status map from MyLeads (authoritative)
    const statusByPhone = useMemo(() => {
        const map = Object.create(null);
        for (const p of Array.isArray(preparedLeads) ? preparedLeads : []) {
            const key = normalizePhone(p?.phone);
            if (!key) continue;
            map[key] = p.status || '';
        }
        return map;
    }, [preparedLeads]);

    // Build a lookup of latest membership amount by normalized phone
    const amountByPhone = useMemo(() => {
        const map = Object.create(null);
        if (!Array.isArray(userMemberships)) return map;
        for (const m of userMemberships) {
            const key = normalizePhone(m?.phone);
            if (!key) continue;
            const current = map[key];
            const mDate = new Date(m?.date || m?.createdAt || 0).getTime();
            const cDate = current ? new Date(current.__date || 0).getTime() : -1;
            if (!current || (Number.isFinite(mDate) && mDate >= cDate)) {
                map[key] = { amount: m?.amount, __date: m?.date || m?.createdAt };
            }
        }
        return map;
    }, [userMemberships]);

    const members = useMemo(() => {
        if (!Array.isArray(preparedLeads)) return [];
        return preparedLeads.map((p) => {
            // Prefer server-supplied join/expiry fields added by the API. Fall
            // back to nested membership fields when the API hasn't populated them.
            const joinIso = p.joinDate || p.membership?.startDate || p.convertedAt || p.createdAt || null;
            const explicitExpiry = p.expiryDate || p.membership?.endDate || p.endDate || null;
            const inferred = computeExpiryDate(p, joinIso);
            const expiryIso = explicitExpiry || (inferred ? inferred.toISOString() : null);
            // Determine status strictly from MyLeads (no auto-converted fallback)
            const status = p.status || '';
            // Amount: prefer embedded membership amount; fallback to user-memberships by phone
            const fallbackAmount = amountByPhone[normalizePhone(p?.phone)]?.amount;
            const amount = (p.membership?.amount != null) ? p.membership.amount : fallbackAmount || 0;
            return {
                ...p,
                plan: p.membership?.planLabel || p.interest || p.plan || '',
                joinDate: joinIso,
                expiryDate: expiryIso,
                amount,
                status,
            };
        });
    }, [preparedLeads, amountByPhone]);

    const expiringSoon = useMemo(() => {
        if (!members || members.length === 0) return [];
        return members.filter((m) => {
            if (!m.expiryDate) return false;
            const days = getDaysBetween(now, m.expiryDate);
            return days !== null && days > 0 && days <= 30;
        });
    }, [members, now]);

    const expiredMembers = useMemo(() => {
        if (!members || members.length === 0) return [];
        return members.filter((m) => {
            if (!m.expiryDate) return false;
            const expiry = new Date(m.expiryDate);
            return !Number.isNaN(expiry.getTime()) && expiry < now;
        });
    }, [members, now]);

    const totalMembers = members.length;
    // rolling 30-day list was removed in favor of month-based reporting

    const totalAmount = members.reduce((sum, m) => sum + (m.amount || 0), 0);

    // Responsive state - needed before pagination
    const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 640);
        if (typeof window !== 'undefined') window.addEventListener('resize', onResize);
        return () => {
            if (typeof window !== 'undefined') window.removeEventListener('resize', onResize);
        };
    }, []);

    // Pagination constants
    const TRIAL_PAGE_SIZE = isMobile ? 5 : 10;
    const SELECTED_PAGE_SIZE = isMobile ? 5 : 10;
    const EXPIRING_PAGE_SIZE = 5; // Always 5 per page for expiring members

    // Month helpers
    function getCurrentMonthStart(dt) {
        const d = dt instanceof Date ? dt : new Date(dt);
        return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const formatMonthLabel = (dt) => {
        if (!dt) return '—';
        try {
            return dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        } catch (e) {
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        }
    };

    // Month filter state for Trial Attended Leads
    const [trialSelectedMonth, setTrialSelectedMonth] = useState(() => getCurrentMonthStart(new Date()));
    const [trialAttendedLeads, setTrialAttendedLeads] = useState([]);
    const [isLoadingTrialLeads, setIsLoadingTrialLeads] = useState(false);

    // Fetch trial attended leads from API when month changes
    useEffect(() => {
        const fetchTrialAttendedLeads = async () => {
            if (!trialSelectedMonth) return;

            setIsLoadingTrialLeads(true);
            try {
                const year = trialSelectedMonth.getFullYear();
                const month = trialSelectedMonth.getMonth() + 1; // 1-12

                const response = await fetch(
                    `${API_BASE_URL}/api/monthly-reports/trial-attended?year=${year}&month=${month}`
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch trial attended leads');
                }

                const data = await response.json();
                console.log(`Trial Attended Leads for ${year}-${month}:`, data);

                // data.leads contains the archived/current leads for the month
                const leads = Array.isArray(data.leads) ? data.leads : [];
                setTrialAttendedLeads(leads);
            } catch (error) {
                console.error('Error fetching trial attended leads:', error);
                setTrialAttendedLeads([]);
            } finally {
                setIsLoadingTrialLeads(false);
            }
        };

        fetchTrialAttendedLeads();

        // Listen for lead updates to refresh trial attended data
        const handleLeadUpdate = () => {
            console.log('Lead updated, refreshing trial attended data');
            fetchTrialAttendedLeads();
        };

        window.addEventListener('lead:created', handleLeadUpdate);
        window.addEventListener('lead:status-updated', handleLeadUpdate);

        return () => {
            window.removeEventListener('lead:created', handleLeadUpdate);
            window.removeEventListener('lead:status-updated', handleLeadUpdate);
        };
    }, [trialSelectedMonth]); const [trialCurrentPage, setTrialCurrentPage] = useState(1);
    // Pagination for Trial Attended Leads (defined after responsive breakpoint state)

    // Additional month helper functions
    const monthToInputValue = (dt) => {
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    };
    const inputValueToMonth = (val) => {
        if (!val) return null;
        const [y, m] = val.split('-').map(Number);
        if (!y || !m) return null;
        return new Date(y, m - 1, 1);
    };

    // Overview month (previous calendar month) - no longer used in UI
    // const [overviewMonth, setOverviewMonth] = useState(() => getPrevMonthStart(new Date()));
    const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthStart(new Date()));
    const [selectedMonthPage, setSelectedMonthPage] = useState(1);

    // Recompute overviewMonth and selectedMonth precisely on the 1st of each month
    useEffect(() => {
        // Calculate ms until next month's 1st at 00:00
        const nowDate = new Date();
        const nextFirst = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1, 0, 0, 0, 0);
        const ms = nextFirst.getTime() - Date.now();
        const timer = setTimeout(() => {
            const current = getCurrentMonthStart(new Date());
            setSelectedMonth(current);
        }, ms + 50); // small offset to ensure date rolled over
        return () => clearTimeout(timer);
    }, [now]);

    // Members for the selected month (used in the detailed section) - fetched from API
    // We'll later combine API new members (converted) with locally recorded leads for the month
    const [newMembersData, setNewMembersData] = useState({ data: [], totalCount: 0 });

    // Fetch new members for selected month
    useEffect(() => {
        const fetchNewMembersData = async () => {
            if (!selectedMonth) return;
            try {
                const year = selectedMonth.getFullYear();
                const month = selectedMonth.getMonth() + 1;
                const result = await monthlyReportsService.getNewMembers(year, month, selectedMonthPage, SELECTED_PAGE_SIZE);
                setNewMembersData({
                    data: result.data || [],
                    totalCount: result.totalCount || 0,
                    totalPages: result.totalPages || 1
                });
            } catch (error) {
                console.error('Failed to fetch new members data:', error);
                setNewMembersData({ data: [], totalCount: 0, totalPages: 1 });
            }
        };
        fetchNewMembersData();
    }, [selectedMonth, selectedMonthPage, SELECTED_PAGE_SIZE]);

    // Helper to map a lead to the member-like shape used by tables
    const toMemberShape = React.useCallback((lead) => {
        const joinIso = lead.joinDate || lead.membership?.startDate || lead.convertedAt || lead.createdAt || null;
        const explicitExpiry = lead.expiryDate || lead.membership?.endDate || lead.endDate || null;
        const inferred = computeExpiryDate(lead, joinIso);
        const expiryIso = explicitExpiry || (inferred ? inferred.toISOString() : null);
        // Always prefer status from MyLeads via phone lookup
        const status = statusByPhone[normalizePhone(lead?.phone)] || '';
        const fallbackAmount = amountByPhone[normalizePhone(lead?.phone)]?.amount;
        const amount = (lead.membership?.amount != null) ? lead.membership.amount : fallbackAmount || 0;
        return {
            ...lead,
            plan: lead.membership?.planLabel || lead.interest || lead.plan || '',
            joinDate: joinIso,
            expiryDate: expiryIso,
            amount,
            status,
        };
    }, [amountByPhone, statusByPhone]);

    // API-provided new members (converted) already for the selected month
    const apiNewMembersForSelectedMonth = useMemo(() => newMembersData.data.map(toMemberShape), [newMembersData.data, toMemberShape]);

    // Locally compute "recorded leads" for the selected month from the All Members dataset (based on createdAt)
    const recordedMembersForSelectedMonth = useMemo(() => {
        if (!selectedMonth) return [];
        const year = selectedMonth.getFullYear();
        const monthIndex = selectedMonth.getMonth(); // 0-based
        const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

        // preparedLeads contains raw leads enhanced; use createdAt for "recorded" definition
        const recorded = (preparedLeads || []).filter((lead) => {
            const d = new Date(lead.createdAt);
            return !Number.isNaN(d.getTime()) && d >= start && d <= end;
        });
        return recorded.map(toMemberShape);
    }, [preparedLeads, selectedMonth, toMemberShape]);

    // Merge API new members with recorded leads for the month, dedupe by id/phone
    const displayMembersForSelectedMonth = useMemo(() => {
        // Key by normalized phone to ensure we merge API + local records for the same person
        // and prefer local (MyLeads) status by letting local override API entries.
        const map = new Map();
        const add = (item, preferOverride = false) => {
            if (!item) return;
            const phoneKey = normalizePhone(item?.phone);
            const key = phoneKey || item.id || item._id || `${item.name}-${item.createdAt}`;
            if (preferOverride || !map.has(key)) map.set(key, item);
        };
        // Add API first, then override with locally recorded leads to reflect real-time status
        apiNewMembersForSelectedMonth.forEach((it) => add(it, false));
        recordedMembersForSelectedMonth.forEach((it) => add(it, true));
        return Array.from(map.values()).sort((a, b) => new Date(b.joinDate || b.createdAt) - new Date(a.joinDate || a.createdAt));
    }, [apiNewMembersForSelectedMonth, recordedMembersForSelectedMonth]);

    // Monthly (previous calendar month) count for overview - no longer used (replaced by selectedMonth count)
    // const monthlyNewMembersCount = useMemo(() => {
    //     if (!overviewMonth || !Array.isArray(members)) return 0;
    //     const year = overviewMonth.getFullYear();
    //     const month = overviewMonth.getMonth();
    //     return members.reduce((acc, m) => {
    //         if (!m.joinDate) return acc;
    //         const jd = new Date(m.joinDate);
    //         if (Number.isNaN(jd.getTime())) return acc;
    //         if (jd.getFullYear() === year && jd.getMonth() === month) return acc + 1;
    //         return acc;
    //     }, 0);
    // }, [members, overviewMonth]);

    const handleSelectedMonthPrev = () => setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const handleSelectedMonthNext = () => setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

    // Responsive pagination for New Members (Month) table
    // Since we combine local + API data, paginate locally for display
    const displayNewMembersCount = displayMembersForSelectedMonth.length;
    const selectedTotalPages = Math.max(1, Math.ceil(displayNewMembersCount / SELECTED_PAGE_SIZE));
    const currentSelectedMembersPage = useMemo(() => {
        const start = (selectedMonthPage - 1) * SELECTED_PAGE_SIZE;
        return displayMembersForSelectedMonth.slice(start, start + SELECTED_PAGE_SIZE);
    }, [displayMembersForSelectedMonth, selectedMonthPage, SELECTED_PAGE_SIZE]);
    useEffect(() => {
        // Reset page when month, data, or breakpoint changes
        setSelectedMonthPage(1);
    }, [selectedMonth, displayMembersForSelectedMonth.length, isMobile]);

    // Trial pagination helpers
    const trialTotalPages = Math.max(1, Math.ceil(trialAttendedLeads.length / TRIAL_PAGE_SIZE));
    const currentTrialLeadsPage = useMemo(() => {
        const start = (trialCurrentPage - 1) * TRIAL_PAGE_SIZE;
        return Array.isArray(trialAttendedLeads) ? trialAttendedLeads.slice(start, start + TRIAL_PAGE_SIZE) : [];
    }, [trialAttendedLeads, trialCurrentPage, TRIAL_PAGE_SIZE]);

    useEffect(() => {
        // Reset to page 1 when the trial leads data or breakpoint changes
        setTrialCurrentPage(1);
    }, [trialAttendedLeads.length, isMobile]);
    const handleTrialNextPage = () => setTrialCurrentPage((p) => Math.min(trialTotalPages, p + 1));
    const handleTrialPrevPage = () => setTrialCurrentPage((p) => Math.max(1, p - 1));
    const handleTrialMonthPrev = () => {
        setTrialSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        setTrialCurrentPage(1); // Reset to page 1 when changing month
    };
    const handleTrialMonthNext = () => {
        setTrialSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        setTrialCurrentPage(1); // Reset to page 1 when changing month
    };

    // Pagination for Expiring Members section
    const [expiringCurrentPage, setExpiringCurrentPage] = useState(1);
    const expiringTotalPages = Math.max(1, Math.ceil(expiringSoon.length / EXPIRING_PAGE_SIZE));
    const currentExpiringPage = useMemo(() => {
        const start = (expiringCurrentPage - 1) * EXPIRING_PAGE_SIZE;
        return Array.isArray(expiringSoon) ? expiringSoon.slice(start, start + EXPIRING_PAGE_SIZE) : [];
    }, [expiringSoon, expiringCurrentPage, EXPIRING_PAGE_SIZE]);

    useEffect(() => {
        // Reset to page 1 when expiring members data changes
        setExpiringCurrentPage(1);
    }, [expiringSoon.length]);

    const handleExpiringNextPage = () => setExpiringCurrentPage((p) => Math.min(expiringTotalPages, p + 1));
    const handleExpiringPrevPage = () => setExpiringCurrentPage((p) => Math.max(1, p - 1));

    // Pagination for the "All Members" section
    const PAGE_SIZE = 5;
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
    const currentMembersPage = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return Array.isArray(members) ? members.slice(start, start + PAGE_SIZE) : [];
    }, [members, currentPage]);

    useEffect(() => {
        // Reset to page 1 when the members data changes
        setCurrentPage(1);
    }, [members.length]);

    const handleNextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
    const handlePrevPage = () => setCurrentPage((p) => Math.max(1, p - 1));

    const handleExportAllMembers = () => {
        exportMembersAllFields('all_members.csv', members, [
            { key: 'status', label: 'Status', fn: (m) => (m.expiryDate && new Date(m.expiryDate) < now) ? 'Expired' : 'Active' }
        ]);
    };

    const handleExportPageMembers = () => {
        exportMembersAllFields(`members_page_${currentPage}.csv`, currentMembersPage, [
            { key: 'status', label: 'Status', fn: (m) => (m.expiryDate && new Date(m.expiryDate) < now) ? 'Expired' : 'Active' }
        ]);
    };

    // CSV helpers
    const csvEscape = (value) => {
        if (value === null || value === undefined) return '';
        let s;
        if (typeof value === 'object') {
            try {
                s = JSON.stringify(value);
            } catch (err) {
                s = String(value);
            }
        } else {
            s = String(value);
        }
        // Escape double-quotes by doubling them, wrap fields containing comma/newline/quote
        if (/[",\r\n]/.test(s)) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const downloadCsv = (filename, headers, rows) => {
        const headerLine = headers.map(csvEscape).join(',');
        const rowLines = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
        const csvContent = [headerLine, rowLines].filter(Boolean).join('\r\n');
        // Include UTF-8 BOM so Excel reliably detects UTF-8 encoding
        const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    /**
     * Export a list of member-like objects including every available property on each
     * object plus optional computed columns.
     * extraColumns: [{ key, label, fn(item) }]
     */
    const exportMembersAllFields = (filename, items, extraColumns = []) => {
        // Collect union of keys across all items
        const keysSet = new Set();
        items.forEach((it) => {
            if (it && typeof it === 'object') {
                Object.keys(it).forEach((k) => keysSet.add(k));
            }
        });

        const preferredOrder = ['id', 'name', 'phone', 'email', 'plan', 'joinDate', 'expiryDate'];
        const mainKeys = preferredOrder.filter((k) => keysSet.has(k));
        const otherKeys = Array.from(keysSet).filter((k) => !preferredOrder.includes(k));
        const extraKeys = extraColumns.map((c) => c.key).filter((k) => !mainKeys.includes(k) && !otherKeys.includes(k));
        const headerKeys = [...mainKeys, ...otherKeys, ...extraKeys];

        const labelMap = {
            id: 'ID',
            name: 'Name',
            phone: 'Mobile',
            email: 'Email',
            plan: 'Plan',
            joinDate: 'Join Date',
            expiryDate: 'Expiry Date'
        };

        const headerLabels = headerKeys.map((k) => {
            const extra = extraColumns.find((c) => c.key === k);
            if (extra) return extra.label || k;
            if (labelMap[k]) return labelMap[k];
            return String(k).replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
        });

        const rows = items.map((it) => {
            const base = headerKeys.map((key) => {
                if (!it || typeof it !== 'object') return '';
                const val = Object.prototype.hasOwnProperty.call(it, key) ? it[key] : '';
                if (val === null || val === undefined) return '';
                if (typeof val === 'object') {
                    try {
                        return JSON.stringify(val);
                    } catch (e) {
                        return String(val);
                    }
                }
                return String(val);
            });
            // append extra computed columns
            extraColumns.forEach((c) => {
                try {
                    base.push(c && typeof c.fn === 'function' ? String(c.fn(it) ?? '') : '');
                } catch (e) {
                    base.push('');
                }
            });
            return base;
        });

        downloadCsv(filename, headerLabels.concat(extraColumns.map((c) => c.label || c.key)), rows);
    };

    const handleExportSummary = () => {
        downloadCsv('members_summary.csv', ['Metric', 'Value'], [
            ['Total Members', totalMembers],
            [`New Members (${formatMonthLabel(selectedMonth)})`, displayNewMembersCount],
            ['Expiring Soon (30d)', expiringSoon.length],
            ['Expired Members', expiredMembers.length],
            [`Trial Attended (${formatMonthLabel(trialSelectedMonth)})`, trialAttendedLeads.length],
            ['Total Revenue', `₹ ${totalAmount.toLocaleString('en-IN')}`]
        ]);
    };

    const handleExportExpiring = () => {
        exportMembersAllFields('expiring_soon_members.csv', expiringSoon, [
            { key: 'daysLeft', label: 'Days Left', fn: (m) => getDaysBetween(now, m.expiryDate) }
        ]);
    };

    const handleExportExpired = () => {
        exportMembersAllFields('expired_members.csv', expiredMembers, [
            { key: 'status', label: 'Status', fn: () => 'Expired' }
        ]);
    };

    const handleExportNewMembers = () => {
        // Export without extra 'Days Since Joined' column to match table
        exportMembersAllFields(`new_members_${selectedMonth ? monthToInputValue(selectedMonth) : 'selected'}.csv`, displayMembersForSelectedMonth, []);
    };

    const handleExportTrialAttended = () => {
        // Export all trial attended leads for the selected month
        exportMembersAllFields(`trial_attended_${trialSelectedMonth ? monthToInputValue(trialSelectedMonth) : 'selected'}.csv`, trialAttendedLeads, [
            { key: 'status', label: 'Status', fn: () => 'Trial Attended' }
        ]);
    };

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <header className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-gray-900">Gym Membership Reports</h1>
                <p className="text-gray-500">Live dashboard with auto-refresh and expiry tracking.</p>
            </header>

            {/* Summary / Overview with per-section export */}
            <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-gray-100">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Overview</h2>
                    <button onClick={handleExportSummary} className="px-4 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700">Export Summary</button>
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-blue-50 p-3 rounded-xl text-center">
                        <div className="text-xl md:text-2xl font-bold text-blue-700">{totalMembers}</div>
                        <div className="text-xs md:text-sm text-blue-600">Total Members</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-xl text-center">
                        <div className="text-xl md:text-2xl font-bold text-green-700">{displayNewMembersCount}</div>
                        <div className="text-xs md:text-sm text-green-600">New Members ({formatMonthLabel(selectedMonth)})</div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-xl text-center">
                        <div className="text-xl md:text-2xl font-bold text-yellow-700">{expiringSoon.length}</div>
                        <div className="text-xs md:text-sm text-yellow-600">Expiring Soon (30d)</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-xl text-center">
                        <div className="text-xl md:text-2xl font-bold text-red-700">{expiredMembers.length}</div>
                        <div className="text-xs md:text-sm text-red-600">Expired Members</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-xl text-center">
                        <div className="text-xl md:text-2xl font-bold text-purple-700">{trialAttendedLeads.length}</div>
                        <div className="text-xs md:text-sm text-purple-600">Trial Attended ({formatMonthLabel(trialSelectedMonth)})</div>
                    </div>
                </div>
            </section>

            {/* All Members with pagination (5 per page) */}
            <section className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-gray-100">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">All Members</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExportAllMembers} className="px-3 py-1.5 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700">Export All</button>
                        <button onClick={handleExportPageMembers} className="px-3 py-1.5 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700">Export Page</button>
                    </div>
                </div>

                {members.length === 0 ? (
                    <p className="text-gray-500">No members available.</p>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm text-gray-500">Showing {(members.length === 0) ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, members.length)} of {members.length}</p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={currentPage <= 1}
                                    className={`px-3 py-1 rounded ${currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                                <button
                                    onClick={handleNextPage}
                                    disabled={currentPage >= totalPages}
                                    className={`px-3 py-1 rounded ${currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                    Next
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <div className="w-full overflow-x-auto">
                                <table className="min-w-full bg-white rounded-xl">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="px-4 py-2">Name</th>
                                            <th className="px-4 py-2">Mobile</th>
                                            <th className="px-4 py-2">Plan</th>
                                            <th className="px-4 py-2">Join Date</th>
                                            <th className="px-4 py-2">Expiry Date</th>
                                            <th className="px-4 py-2">Amount</th>
                                            <th className="px-4 py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentMembersPage.map((m, index) => (
                                            <tr key={m.id || `member-${index}`} className="border-b">
                                                <td className="px-4 py-2 font-semibold">{m.name}</td>
                                                <td className="px-4 py-2">{m.phone || '—'}</td>
                                                <td className="px-4 py-2">{m.plan}</td>
                                                <td className="px-4 py-2">{formatDate(m.joinDate)}</td>
                                                <td className="px-4 py-2">{formatDate(m.expiryDate)}</td>
                                                <td className="px-4 py-2">{m.amount ? `₹ ${Number(m.amount).toLocaleString('en-IN')}` : '—'}</td>
                                                <td className="px-4 py-2">{m.expiryDate && new Date(m.expiryDate) < now ? <span className="text-red-700 font-bold">Expired</span> : <span className="text-green-700 font-bold">Active</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </section>

            <section className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-gray-100">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-yellow-700 mb-4">Members Expiring in Next 30 Days</h2>
                    <button onClick={handleExportExpiring} className="px-3 py-1.5 bg-yellow-600 text-white rounded-full text-sm font-medium hover:bg-yellow-700">Export CSV</button>
                </div>
                {expiringSoon.length === 0 ? (
                    <p className="text-gray-500">No members expiring soon.</p>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm text-gray-500">
                                Showing {expiringSoon.length === 0 ? 0 : ((expiringCurrentPage - 1) * EXPIRING_PAGE_SIZE) + 1}
                                {' '} - {' '}
                                {Math.min(expiringCurrentPage * EXPIRING_PAGE_SIZE, expiringSoon.length)}
                                {' '} of {' '}
                                {expiringSoon.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExpiringPrevPage}
                                    disabled={expiringCurrentPage <= 1}
                                    className={`px-3 py-1 rounded ${expiringCurrentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">Page {expiringCurrentPage} of {expiringTotalPages}</span>
                                <button
                                    onClick={handleExpiringNextPage}
                                    disabled={expiringCurrentPage >= expiringTotalPages}
                                    className={`px-3 py-1 rounded ${expiringCurrentPage >= expiringTotalPages ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                    Next
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white rounded-xl">
                                <thead>
                                    <tr className="bg-yellow-100">
                                        <th className="px-4 py-2">Name</th>
                                        <th className="px-4 py-2">Number</th>
                                        <th className="px-4 py-2">Plan</th>
                                        <th className="px-4 py-2">Expiry Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentExpiringPage.map((m, index) => (
                                        <tr key={m.id || `expiring-${index}`} className="border-b">
                                            <td className="px-4 py-2 font-semibold">{m.name}</td>
                                            <td className="px-4 py-2">{m.phone || '—'}</td>
                                            <td className="px-4 py-2">{m.plan}</td>
                                            <td className="px-4 py-2">{formatDate(m.expiryDate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                            <p className="text-sm text-gray-500">
                                Showing {expiringSoon.length === 0 ? 0 : ((expiringCurrentPage - 1) * EXPIRING_PAGE_SIZE) + 1}
                                {' '} - {' '}
                                {Math.min(expiringCurrentPage * EXPIRING_PAGE_SIZE, expiringSoon.length)}
                                {' '} of {' '}
                                {expiringSoon.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExpiringPrevPage}
                                    disabled={expiringCurrentPage <= 1}
                                    className={`px-3 py-1 rounded ${expiringCurrentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">Page {expiringCurrentPage} of {expiringTotalPages}</span>
                                <button
                                    onClick={handleExpiringNextPage}
                                    disabled={expiringCurrentPage >= expiringTotalPages}
                                    className={`px-3 py-1 rounded ${expiringCurrentPage >= expiringTotalPages ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </section>

            <section className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-gray-100">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-red-700 mb-4">Expired Members</h2>
                    <button onClick={handleExportExpired} className="px-3 py-1.5 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700">Export CSV</button>
                </div>
                {expiredMembers.length === 0 ? (
                    <p className="text-gray-500">No expired members.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="w-full overflow-x-auto">
                            <table className="min-w-full bg-white rounded-xl">
                                <thead>
                                    <tr className="bg-red-100">
                                        <th className="px-4 py-2">Name</th>
                                        <th className="px-4 py-2">Mobile</th>
                                        <th className="px-4 py-2">Plan</th>
                                        <th className="px-4 py-2">Join Date</th>
                                        <th className="px-4 py-2">Expiry Date</th>
                                        <th className="px-4 py-2">Amount</th>
                                        <th className="px-4 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expiredMembers.map((m, index) => (
                                        <tr key={m.id || `expired-${index}`} className="border-b">
                                            <td className="px-4 py-2 font-semibold">{m.name}</td>
                                            <td className="px-4 py-2">{m.phone || '—'}</td>
                                            <td className="px-4 py-2">{m.plan}</td>
                                            <td className="px-4 py-2">{formatDate(m.joinDate)}</td>
                                            <td className="px-4 py-2">{formatDate(m.expiryDate)}</td>
                                            <td className="px-4 py-2">{m.amount ? `₹ ${Number(m.amount).toLocaleString('en-IN')}` : '—'}</td>
                                            <td className="px-4 py-2 text-red-700 font-bold">Expired</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>

            {/* Trial Attended Leads */}
            <section className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-gray-100">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-purple-700 mb-4">Trial Attended Leads (Month)</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExportTrialAttended} className="px-3 py-1.5 bg-purple-600 text-white rounded-full text-sm font-medium hover:bg-purple-700">Export CSV</button>
                    </div>
                </div>

                {/* Month navigation controls for Trial Attended */}
                <div className="mt-2 flex items-center justify-center gap-2 mb-4">
                    <button onClick={handleTrialMonthPrev} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">◀</button>
                    <input
                        type="month"
                        value={monthToInputValue(trialSelectedMonth)}
                        onChange={(e) => {
                            const dt = inputValueToMonth(e.target.value);
                            if (dt) {
                                setTrialSelectedMonth(dt);
                                setTrialCurrentPage(1);
                            }
                        }}
                        className="px-3 py-1 border rounded text-sm"
                    />
                    <button onClick={handleTrialMonthNext} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">▶</button>
                </div>

                {trialAttendedLeads.length === 0 ? (
                    <p className="text-gray-500">No trial attended leads for {formatMonthLabel(trialSelectedMonth)}.</p>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm text-gray-500">
                                Showing {trialAttendedLeads.length === 0 ? 0 : ((trialCurrentPage - 1) * TRIAL_PAGE_SIZE) + 1}
                                {' '} - {' '}
                                {Math.min(trialCurrentPage * TRIAL_PAGE_SIZE, trialAttendedLeads.length)}
                                {' '} of {' '}
                                {trialAttendedLeads.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleTrialPrevPage}
                                    disabled={trialCurrentPage <= 1}
                                    className={`px-3 py-1 rounded ${trialCurrentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">Page {trialCurrentPage} of {trialTotalPages}</span>
                                <button
                                    onClick={handleTrialNextPage}
                                    disabled={trialCurrentPage >= trialTotalPages}
                                    className={`px-3 py-1 rounded ${trialCurrentPage >= trialTotalPages ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                    Next
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            {isLoadingTrialLeads ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">Loading trial attended leads...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="w-full overflow-x-auto">
                                        <table className="min-w-full bg-white rounded-xl">
                                            <thead>
                                                <tr className="bg-purple-100">
                                                    <th className="px-4 py-2">Name</th>
                                                    <th className="px-4 py-2">Mobile</th>
                                                    <th className="px-4 py-2">Plan</th>
                                                    <th className="px-4 py-2">Trial Date</th>
                                                    <th className="px-4 py-2">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentTrialLeadsPage.length > 0 ? (
                                                    currentTrialLeadsPage.map((lead, index) => (
                                                        <tr key={lead.id || lead.leadId || `trial-${index}`} className="border-b">
                                                            <td className="px-4 py-2 font-semibold">{lead.name}</td>
                                                            <td className="px-4 py-2">{lead.phone || '—'}</td>
                                                            <td className="px-4 py-2">{lead.plan || lead.interest || '—'}</td>
                                                            <td className="px-4 py-2">{formatDate(lead.trialDate || lead.trialAttendedAt || lead.createdAt)}</td>
                                                            <td className="px-4 py-2 text-purple-700 font-bold">Trial Attended</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                                            No trial attended leads for {formatMonthLabel(trialSelectedMonth)}.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                            <div className="flex items-center justify-between mt-3">
                                <p className="text-sm text-gray-500">
                                    Showing {trialAttendedLeads.length === 0 ? 0 : ((trialCurrentPage - 1) * TRIAL_PAGE_SIZE) + 1}
                                    {' '} - {' '}
                                    {Math.min(trialCurrentPage * TRIAL_PAGE_SIZE, trialAttendedLeads.length)}
                                    {' '} of {' '}
                                    {trialAttendedLeads.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleTrialPrevPage}
                                        disabled={trialCurrentPage <= 1}
                                        className={`px-3 py-1 rounded ${trialCurrentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                        Previous
                                    </button>
                                    <span className="text-sm text-gray-600">Page {trialCurrentPage} of {trialTotalPages}</span>
                                    <button
                                        onClick={handleTrialNextPage}
                                        disabled={trialCurrentPage >= trialTotalPages}
                                        className={`px-3 py-1 rounded ${trialCurrentPage >= trialTotalPages ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </section>

            {/* New Members (month view with calendar) */}
            <section className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-gray-100">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-green-700 mb-4">New Members (Month)</h2>
                    <button onClick={handleExportNewMembers} className="px-3 py-1.5 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700">Export CSV</button>
                </div>
                {/* Calendar controls row under title */}
                <div className="mt-2 flex items-center justify-center gap-2">
                    <button onClick={handleSelectedMonthPrev} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">◀</button>
                    <input
                        type="month"
                        value={monthToInputValue(selectedMonth)}
                        onChange={(e) => {
                            const dt = inputValueToMonth(e.target.value);
                            if (dt) setSelectedMonth(dt);
                        }}
                        className="px-3 py-1 border rounded text-sm"
                    />
                    <button onClick={handleSelectedMonthNext} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">▶</button>
                </div>
                {displayMembersForSelectedMonth.length === 0 ? (
                    <p className="text-gray-500">No members for {formatMonthLabel(selectedMonth)}.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm text-gray-500">
                                Showing {displayNewMembersCount === 0 ? 0 : ((selectedMonthPage - 1) * SELECTED_PAGE_SIZE) + 1}
                                {' '} - {' '}
                                {Math.min(selectedMonthPage * SELECTED_PAGE_SIZE, displayNewMembersCount)}
                                {' '} of {' '}
                                {displayNewMembersCount}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedMonthPage((p) => Math.max(1, p - 1))}
                                    disabled={selectedMonthPage <= 1}
                                    className={`px-3 py-1 rounded ${selectedMonthPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">Page {selectedMonthPage} of {selectedTotalPages}</span>
                                <button
                                    onClick={() => setSelectedMonthPage((p) => Math.min(selectedTotalPages, p + 1))}
                                    disabled={selectedMonthPage >= selectedTotalPages}
                                    className={`px-3 py-1 rounded ${selectedMonthPage >= selectedTotalPages ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                        <table className="min-w-full bg-white rounded-xl">
                            <thead>
                                <tr className="bg-green-100">
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Mobile</th>
                                    <th className="px-4 py-2">Plan</th>
                                    <th className="px-4 py-2">Join Date</th>
                                    <th className="px-4 py-2">Expiry Date</th>
                                    <th className="px-4 py-2">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentSelectedMembersPage.map((m, index) => (
                                    <tr key={m.id || `selectedmonth-${index}`} className="border-b">
                                        <td className="px-4 py-2 font-semibold">{m.name}</td>
                                        <td className="px-4 py-2">{m.phone || '—'}</td>
                                        <td className="px-4 py-2">{m.plan}</td>
                                        <td className="px-4 py-2">{formatDate(m.joinDate)}</td>
                                        <td className="px-4 py-2">{formatDate(m.expiryDate)}</td>
                                        <td className="px-4 py-2">{m.amount ? `₹ ${Number(m.amount).toLocaleString('en-IN')}` : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="flex items-center justify-between mt-3">
                            <p className="text-sm text-gray-500">
                                Showing {displayNewMembersCount === 0 ? 0 : ((selectedMonthPage - 1) * SELECTED_PAGE_SIZE) + 1}
                                {' '} - {' '}
                                {Math.min(selectedMonthPage * SELECTED_PAGE_SIZE, displayNewMembersCount)}
                                {' '} of {' '}
                                {displayNewMembersCount}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedMonthPage((p) => Math.max(1, p - 1))}
                                    disabled={selectedMonthPage <= 1}
                                    className={`px-3 py-1 rounded ${selectedMonthPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">Page {selectedMonthPage} of {selectedTotalPages}</span>
                                <button
                                    onClick={() => setSelectedMonthPage((p) => Math.min(selectedTotalPages, p + 1))}
                                    disabled={selectedMonthPage >= selectedTotalPages}
                                    className={`px-3 py-1 rounded ${selectedMonthPage >= selectedTotalPages ? 'opacity-50 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {isLoading && <p className="text-center text-gray-500">Loading data...</p>}
        </div>
    );
}

export default ReportsPage;
