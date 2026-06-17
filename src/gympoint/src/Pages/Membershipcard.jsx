import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { leadsService } from '../services/leadsService';
import { membershipsService } from '../services/membershipsService';
import { attendanceService } from '../services/attendanceService';

// Small helpers
const normalizePhone = (val = '') => String(val || '').replace(/\D/g, '').slice(-10);
const formatDate = (d) => {
    if (!d) return '—';
    try {
        const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString();
    } catch {
        return '—';
    }
};

const computeProgress = (start, end) => {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    if (!startDate || !endDate || Number.isNaN(startDate) || Number.isNaN(endDate)) {
        return { pct: 0, label: 'No period', showWarning: false };
    }
    const now = new Date();
    const total = endDate - startDate;
    const used = Math.max(0, Math.min(total, now - startDate));
    const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((used / total) * 100))) : 0;
    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    // Show warning only if membership is expiring within 30 days (1 month)
    const showWarning = daysLeft <= 30 && daysLeft > 0;

    let label;
    if (endDate < now) {
        label = 'Expired';
    } else if (showWarning) {
        label = `${Math.max(0, daysLeft)} days left`;
    } else {
        label = `${pct}% used`;
    }

    return { pct, label, showWarning, daysLeft };
};

const ProgressBar = ({ start, end }) => {
    const { pct } = useMemo(() => computeProgress(start, end), [start, end]);

    // Determine color based on usage percentage
    let barColor = 'bg-green-500'; // Default: Green (0-80%)
    if (pct > 95) {
        barColor = 'bg-red-500'; // Red when usage > 95%
    } else if (pct > 80) {
        barColor = 'bg-yellow-500'; // Yellow when usage > 80%
    }

    return (
        <div className="w-full">
            <div className="h-2 w-full bg-gray-200 rounded">
                <div
                    className={`h-2 rounded transition-all duration-300 ${barColor}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
};

// Removed legacy OrderHistory component. A new Order History section is rendered inline below.

export default function Membershipcard({ filterPhone = '', onDismiss = null, onRenew = null }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [userData, setUserData] = useState(null);
    const [memberships, setMemberships] = useState([]);
    const [history, setHistory] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isCheckedIn, setIsCheckedIn] = useState(false);

    // Check if member is currently checked in
    const checkAttendanceStatus = useCallback(async (phone, membershipId = null) => {
        if (!phone) return false;
        try {
            const records = await attendanceService.listRecords();
            const normalizedPhone = normalizePhone(phone);
            const isPresent = records.some(record =>
                normalizePhone(record.phone) === normalizedPhone ||
                (membershipId && record.membershipId === membershipId)
            );
            setIsCheckedIn(isPresent);
            return isPresent;
        } catch (error) {
            console.error('Error checking attendance status:', error);
            return false;
        }
    }, []);    // Toggle check-in/check-out
    const handleCheckInToggle = async () => {
        const newCheckedInState = !isCheckedIn;
        setIsCheckedIn(newCheckedInState);

        if (newCheckedInState) {
            // Check-in: Save attendance record
            const membershipId = memberships[0]?.id || null;
            const phone = userData?.phone || '';
            const recordKey = membershipId || phone;

            const attendanceRecord = {
                membershipId,
                name: userData?.name || 'Unknown',
                phone,
                email: userData?.email || '',
                avatar: (userData?.name || 'M').charAt(0).toUpperCase(),
                planLabel: memberships[0]?.label || 'N/A',
                planCategory: memberships[0]?.category || 'normal',
                checkedInTime: new Date().toISOString(),
                status: 'checked-in'
            };

            try {
                await attendanceService.createRecord(attendanceRecord);

                // Update attendance history count
                const history = await attendanceService.listHistory();
                const normalizedPhone = normalizePhone(phone);
                const historyKey = recordKey || normalizedPhone;

                const currentHistory = history[historyKey] || { entries: [], totalCount: 0 };
                const newEntry = {
                    checkInTime: attendanceRecord.checkedInTime,
                    checkOutTime: null,
                    date: new Date().toISOString().split('T')[0],
                    membershipId,
                    phone,
                    name: attendanceRecord.name,
                    planLabel: attendanceRecord.planLabel,
                    planCategory: attendanceRecord.planCategory,
                    avatar: attendanceRecord.avatar
                };

                const updatedHistory = {
                    ...history,
                    [historyKey]: {
                        entries: [newEntry, ...currentHistory.entries].slice(0, 5),
                        totalCount: (currentHistory.totalCount || 0) + 1
                    }
                };

                await attendanceService.saveHistory(updatedHistory);

                // Dispatch event to update attendance page and dashboard
                window.dispatchEvent(new CustomEvent('memberships:attendance-updated', {
                    detail: {
                        record: attendanceRecord,
                        history: updatedHistory
                    }
                }));

                console.log('Checked in successfully:', attendanceRecord);
            } catch (error) {
                console.error('Error saving check-in:', error);
                setIsCheckedIn(!newCheckedInState); // Revert on error
            }
        } else {
            // Check-out: Remove attendance record and update history
            const recordKey = memberships[0]?.id || userData?.phone;
            try {
                await attendanceService.removeRecord(recordKey);

                // Update checkout time in history
                const history = await attendanceService.listHistory();
                const normalizedPhone = normalizePhone(userData?.phone || '');
                const historyKey = recordKey || normalizedPhone;

                if (history[historyKey]) {
                    const currentHistory = history[historyKey];
                    const updatedEntries = [...currentHistory.entries];
                    if (updatedEntries.length > 0 && !updatedEntries[0].checkOutTime) {
                        updatedEntries[0].checkOutTime = new Date().toISOString();
                    }

                    const updatedHistory = {
                        ...history,
                        [historyKey]: {
                            ...currentHistory,
                            entries: updatedEntries.slice(0, 5)
                        }
                    };

                    await attendanceService.saveHistory(updatedHistory);

                    // Dispatch event to update attendance page and dashboard
                    window.dispatchEvent(new CustomEvent('memberships:attendance-updated', {
                        detail: {
                            recordKey,
                            history: updatedHistory
                        }
                    }));
                }

                console.log('Checked out successfully');
            } catch (error) {
                console.error('Error removing check-in:', error);
                setIsCheckedIn(!newCheckedInState); // Revert on error
            }
        }
    };

    // Fetch user data when filterPhone changes
    useEffect(() => {
        if (!filterPhone) {
            // No search - show default card
            setUserData(null);
            setMemberships([]);
            setError('');
            return;
        }

        let mounted = true;
        const phoneKey = normalizePhone(filterPhone);

        (async () => {
            try {
                setLoading(true);
                setError('');

                // Parallel fetch for better performance
                const [leadsRes, membershipsRes, historyRes] = await Promise.all([
                    leadsService.list(),
                    membershipsService.list(),
                    membershipsService.historyByPhone(phoneKey, 1000) // Fetch history specific to this member for persistence
                ]);

                if (!mounted) return;

                const leads = Array.isArray(leadsRes) ? leadsRes : leadsRes?.data || [];
                const allMemberships = Array.isArray(membershipsRes) ? membershipsRes : membershipsRes?.data || [];
                const allHistory = Array.isArray(historyRes) ? historyRes : historyRes?.data || [];

                // Find the specific lead by phone number
                const matchedLead = leads.find((l) => {
                    const status = String(l.status || '').toLowerCase();
                    const isConverted = status === 'converted' || !!l.membership;
                    return isConverted && normalizePhone(l.phone) === phoneKey;
                });

                if (!matchedLead) {
                    if (mounted) {
                        setError('No converted membership found for this number.');
                        setUserData(null);
                        setMemberships([]);
                        setHistory([]);
                    }
                    return;
                }

                // Filter memberships for this phone number (optimized with early return)
                const userMemberships = allMemberships.filter((m) => normalizePhone(m.phone) === phoneKey);

                // Fallback to embedded lead.membership if no dedicated membership entry exists
                const embedded = matchedLead.membership ? [{
                    id: `lead-${matchedLead.id || matchedLead.phone}`,
                    label: matchedLead.membership.plan || matchedLead.interest || 'Membership',
                    category: matchedLead.membership.planCategory || matchedLead.membership.category || '',
                    price: matchedLead.membership.amount || matchedLead.membership.price || null,
                    paymentMode: matchedLead.membership.paymentMode || '',
                    preferredDate: matchedLead.membership.preferredDate || null,
                    remarks: matchedLead.membership.remarks || '',
                    phone: matchedLead.phone,
                }] : [];

                const membershipsToShow = userMemberships.length ? userMemberships : embedded;

                // History already fetched by phone; optionally keep filtering by membership ids in case of stray records
                const membershipIdSet = new Set(membershipsToShow.map((m) => String(m.id)));
                const userHistory = allHistory.filter((h) => {
                    const id = h.membershipId ? String(h.membershipId) : null;
                    return id ? membershipIdSet.size === 0 || membershipIdSet.has(id) : false;
                });

                setUserData(matchedLead);
                setMemberships(membershipsToShow);
                setHistory(userHistory);

                // Check if member is already checked in
                if (matchedLead.phone) {
                    await checkAttendanceStatus(matchedLead.phone, membershipsToShow[0]?.id);
                }

            } catch (err) {
                console.error('Failed to load membership card data', err);
                if (mounted) {
                    setError(err?.message || 'Failed to load data');
                    setUserData(null);
                    setMemberships([]);
                    setHistory([]);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [filterPhone, checkAttendanceStatus, refreshKey]);

    // Listen for membership updates
    useEffect(() => {
        const handleMembershipUpdate = () => {
            setRefreshKey(Date.now());
        };

        window.addEventListener('reporting:membership-created', handleMembershipUpdate);
        window.addEventListener('memberships:refresh', handleMembershipUpdate);

        return () => {
            window.removeEventListener('reporting:membership-created', handleMembershipUpdate);
            window.removeEventListener('memberships:refresh', handleMembershipUpdate);
        };
    }, []);

    // (Removed) historyByMembershipId helper no longer needed

    // Calculate start and end dates with dynamic expiry calculation
    const dateRange = useMemo(() => {
        if (!userData) return { start: null, end: null, status: 'Unknown' };

        // Get start date
        const membershipStarts = (memberships || [])
            .map((m) => m.startDate)
            .filter(Boolean)
            .map((d) => new Date(d))
            .filter((d) => !Number.isNaN(d.getTime()));

        const minStart = membershipStarts.length
            ? new Date(Math.min(...membershipStarts.map((d) => d.getTime())))
            : null;

        const startDate = minStart
            || (userData.joinDate ? new Date(userData.joinDate) : null)
            || (userData.membership?.startDate ? new Date(userData.membership.startDate) : null)
            || (userData.convertedAt ? new Date(userData.convertedAt) : null)
            || (userData.createdAt ? new Date(userData.createdAt) : null);

        // Calculate expiry date based on plan duration from order/membership label
        let calculatedEnd = null;

        if (startDate && memberships && memberships.length > 0) {
            const membership = memberships[0];

            // Extract duration from membership label (e.g., "3 Months", "6 Months", "1 Year")
            const label = membership.label || membership.plan || membership.name || '';
            let durationMonths = null;

            // Try to extract months from label
            const monthMatch = label.match(/(\d+)\s*(month|months|mon|mth)/i);
            const yearMatch = label.match(/(\d+)\s*(year|years|yr)/i);

            if (monthMatch) {
                durationMonths = parseInt(monthMatch[1]);
            } else if (yearMatch) {
                durationMonths = parseInt(yearMatch[1]) * 12; // Convert years to months
            }

            // Fallback to explicit duration fields
            if (!durationMonths) {
                durationMonths =
                    membership.durationMonths ||
                    membership.duration ||
                    membership.planDuration ||
                    userData.membership?.durationMonths ||
                    userData.membership?.duration ||
                    userData.membership?.planDuration ||
                    null;
            }

            if (durationMonths && !isNaN(durationMonths)) {
                // Calculate expiry by adding months to start date
                calculatedEnd = new Date(startDate);
                calculatedEnd.setMonth(calculatedEnd.getMonth() + parseInt(durationMonths));
            }
        }

        // Check for explicit expiry dates from memberships
        const membershipEnds = (memberships || [])
            .map((m) => m.expiryDate || m.endDate)
            .filter(Boolean)
            .map((d) => new Date(d))
            .filter((d) => !Number.isNaN(d.getTime()));

        const maxEnd = membershipEnds.length
            ? new Date(Math.max(...membershipEnds.map((d) => d.getTime())))
            : null;

        // Use explicit expiry if available, otherwise use calculated
        const endDate = maxEnd || calculatedEnd || (userData.expiryDate ? new Date(userData.expiryDate) : null);

        // Determine status
        let status = 'Unknown';
        if (startDate && endDate) {
            const now = new Date();
            if (now < startDate) {
                status = 'Not Started';
            } else if (now > endDate) {
                status = 'Expired';
            } else {
                status = 'Active';
            }
        }

        return {
            start: startDate ? startDate.toISOString() : null,
            end: endDate ? endDate.toISOString() : null,
            status
        };
    }, [userData, memberships]);

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse text-gray-500">Loading membership card…</div>
            </div>
        );
    }

    // Default card template (no user data)
    const renderDefaultCard = () => (
        <div className="p-0">
            <div className="w-full md:w-1/2 mx-auto">
                <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-lg shadow-lg p-6 border-2 border-dashed border-gray-300">
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            aria-label="Close"
                            className="absolute right-4 top-4 inline-flex items-center justify-center h-8 w-8 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18" />
                                <path d="M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="flex-1">
                                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        </div>
                        <span className="px-3 py-1 text-xs rounded bg-gray-100 text-gray-400 border border-gray-300">Status</span>
                    </div>

                    <div className="mb-4">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <div className="text-xs text-gray-400 mb-1">Start date</div>
                                <div className="h-4 bg-gray-200 rounded w-full"></div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 mb-1">Expiry date</div>
                                <div className="h-4 bg-gray-200 rounded w-full"></div>
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="h-2 w-full bg-gray-200 rounded"></div>
                            <div className="text-xs text-gray-400 mt-1">Progress</div>
                        </div>
                    </div>

                    <div className="mt-6 text-center">
                        <svg className="mx-auto h-16 w-16 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="text-gray-500 text-sm">Search for a converted member to view details</p>
                    </div>
                </div>
            </div>
        </div>
    );

    // If error and no user data
    if (error && !userData) {
        return (
            <div className="p-0">
                <div className="w-full md:w-1/2 mx-auto">
                    <div className="relative bg-white rounded-lg shadow-lg p-6 border border-gray-200">
                        {onDismiss && (
                            <button
                                onClick={onDismiss}
                                aria-label="Close"
                                className="absolute right-4 top-4 inline-flex items-center justify-center h-8 w-8 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6L6 18" />
                                    <path d="M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                        <div className="mb-4">
                            <div className="font-medium mb-2 text-gray-900">Orders</div>
                            {memberships.length === 0 ? (
                                <div className="text-sm text-gray-500">No orders</div>
                            ) : null}
                        </div>
                        <p className="mt-2 text-red-600 font-medium">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    // If no user data, show default template
    if (!userData) {
        return renderDefaultCard();
    }

    // Render user's card

    return (
        <div className="p-0">
            <div className="w-full md:w-1/2 mx-auto">
                <div className="relative bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                    {/* Back/Close button in its own row at the top */}
                    <div className="flex justify-end items-center p-4 pb-0">
                        {onDismiss && (
                            <button
                                onClick={onDismiss}
                                aria-label="Close"
                                className="inline-flex items-center justify-center h-8 w-8 text-gray-700 hover:text-gray-900"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6L6 18" />
                                    <path d="M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Two-block layout: 30% profile + 70% membership status */}
                    <div className="flex flex-col md:flex-row">
                        {/* Left Block - 30% width - Profile Image & Name */}
                        <div className="w-full md:w-[30%] p-8 md:p-10 flex flex-col items-center justify-center">
                            {/* Profile Image */}
                            <div className="relative mb-4">
                                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border-4 border-indigo-200 flex items-center justify-center overflow-hidden">
                                    {/* Generate dynamic avatar based on name */}
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-200 to-purple-200 flex items-center justify-center">
                                        <span className="text-5xl font-bold text-indigo-700">
                                            {(userData?.name || 'M').charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                {/* Online/Active indicator */}
                                <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-400 border-4 border-white rounded-full"></div>
                            </div>

                            {/* Member Name */}
                            <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">
                                {userData?.name || 'Member'}
                            </h2>

                            {/* Phone Number */}
                            <div className="text-sm text-gray-700 mb-1 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {normalizePhone(userData?.phone)}
                            </div>

                            {/* Email */}
                            {userData?.email && (
                                <div className="text-xs text-gray-600 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    {userData.email}
                                </div>
                            )}
                        </div>

                        {/* Centered Divider Line */}
                        <div className="hidden md:flex items-center">
                            <div className="w-px h-3/4 bg-gray-300"></div>
                        </div>

                        {/* Right Block - 70% width - Membership Status & Details */}
                        <div className="w-full md:w-[70%] p-8">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex-1 flex items-center">
                                    <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center">
                                        {memberships && memberships.length > 0 ? memberships[0]?.label || 'Membership Plan' : 'Membership Plan'}
                                        {onRenew && (() => {
                                            const progress = computeProgress(dateRange.start, dateRange.end);
                                            if (progress.showWarning) {
                                                return (
                                                    <button
                                                        onClick={() => onRenew(filterPhone)}
                                                        aria-label="Renew Membership"
                                                        className="inline-flex items-center justify-center h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors ml-2"
                                                        title="Renew Membership"
                                                    >
                                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                    </button>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3 ml-4">
                                    {/* Status Badge */}
                                    {dateRange.status !== 'Unknown' && dateRange.status !== 'Active' && (
                                        <span className={`px-3 py-1 text-xs rounded-full font-medium border whitespace-nowrap ${dateRange.status === 'Expired'
                                            ? 'bg-red-100 text-red-700 border-red-200'
                                            : dateRange.status === 'Not Started'
                                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                                : ''
                                            }`}>
                                            {dateRange.status}
                                        </span>
                                    )}
                                    {/* Check-in/Check-out Button */}
                                    <button
                                        onClick={handleCheckInToggle}
                                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg whitespace-nowrap ${isCheckedIn
                                            ? 'bg-red-500 text-white hover:bg-red-600'
                                            : 'bg-green-500 text-white hover:bg-green-600'
                                            }`}
                                    >
                                        {isCheckedIn ? 'Check-out' : 'Check-in'}
                                    </button>
                                </div>
                            </div>

                            {/* Membership Timeline */}
                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Start Date</div>
                                        <div className="text-base font-semibold text-gray-900">{formatDate(dateRange.start)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expiry Date</div>
                                        <div className="text-base font-semibold text-gray-900">{formatDate(dateRange.end)}</div>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-medium text-gray-600">Progress</span>
                                        <span className="text-xs text-gray-500">
                                            {(() => {
                                                const progress = computeProgress(dateRange.start, dateRange.end);
                                                return `${progress.pct}% used`;
                                            })()}
                                        </span>
                                    </div>
                                    <ProgressBar start={dateRange.start} end={dateRange.end} />
                                    <div className="text-xs text-gray-500 mt-1">
                                        {(() => {
                                            const progress = computeProgress(dateRange.start, dateRange.end);
                                            if (progress.daysLeft !== undefined && progress.daysLeft !== null && !isNaN(progress.daysLeft)) {
                                                if (progress.daysLeft < 0) {
                                                    return 'Expired';
                                                }
                                                return `${progress.daysLeft} day${progress.daysLeft === 1 ? '' : 's'} left`;
                                            }
                                            return '';
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Separate Order History Section */}
            <div className="w-full md:w-1/2 mx-auto mt-6">
                <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
                    <h2 className="text-xl font-bold mb-4 text-gray-900">Order History</h2>
                    {(() => {
                        const labelById = new Map((memberships || []).map((m) => [String(m.id), m.label || 'Order']));
                        const amountById = new Map((memberships || []).map((m) => [String(m.id), m.price || m.amount || 0]));
                        const paymentModeById = new Map((memberships || []).map((m) => [String(m.id), m.paymentMode || 'N/A']));

                        // Flatten all history items with their membership info
                        const allItems = [];
                        (Array.isArray(history) ? history : []).forEach((h) => {
                            const id = h.membershipId ? String(h.membershipId) : 'unknown';
                            const dateStr = h.occurredAt || h.updatedAt || h.createdAt || null;
                            if (!dateStr) return;
                            const date = new Date(dateStr);
                            const label = h.membershipLabel || labelById.get(id) || (id === 'unknown' ? 'Unassigned' : 'Order');

                            // Use amount and paymentMode directly from history record (already stored at top level)
                            let amount = h.amount || 0;
                            let paymentMode = h.paymentMode || 'N/A';

                            // Fallback to changes object if top-level fields are not available (for backward compatibility)
                            if (!amount && h.changes) {
                                if (h.changes.price !== undefined) {
                                    amount = h.changes.price;
                                } else if (typeof h.changes.price === 'object' && h.changes.price.to !== undefined) {
                                    amount = h.changes.price.to;
                                }
                            }

                            if (paymentMode === 'N/A' && h.changes) {
                                if (h.changes.paymentMode !== undefined) {
                                    paymentMode = h.changes.paymentMode;
                                } else if (typeof h.changes.paymentMode === 'object' && h.changes.paymentMode.to !== undefined) {
                                    paymentMode = h.changes.paymentMode.to;
                                }
                            }

                            // Final fallback to membership data
                            if (!amount) {
                                amount = amountById.get(id) || 0;
                            }
                            if (paymentMode === 'N/A') {
                                paymentMode = paymentModeById.get(id) || 'N/A';
                            }

                            allItems.push({
                                ...h,
                                _date: date,
                                _label: label,
                                _amount: amount,
                                _paymentMode: paymentMode,
                                _id: id
                            });
                        });

                        // Sort by date descending
                        allItems.sort((a, b) => b._date - a._date);

                        if (!allItems.length) {
                            return (
                                <div className="text-center py-8">
                                    <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <div className="text-sm text-gray-500">No order history available</div>
                                </div>
                            );
                        }

                        return (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Order
                                            </th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Action
                                            </th>

                                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Amount
                                            </th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Payment Mode
                                            </th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                Date
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {allItems.map((item, index) => (
                                            <tr key={`${item.membershipId}-${item._date.toISOString()}-${item.action}-${index}`} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{item._label}</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{item.action || 'Updated'}</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">₹{item._amount || 0}</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-600">{item._paymentMode}</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-500">{formatDate(item._date)}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

