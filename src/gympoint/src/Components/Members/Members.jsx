import React, { useState, useEffect, useCallback } from 'react';
import { attendanceService } from '../../services/attendanceService';

const Members = () => {
    const [checkedInMembers, setCheckedInMembers] = useState([]);
    const [selectedDate, setSelectedDate] = useState(() => {
        const t = new Date();
        const y = t.getFullYear();
        const m = String(t.getMonth() + 1).padStart(2, '0');
        const d = String(t.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`; // Local YYYY-MM-DD
    });
    const [loading, setLoading] = useState(true);
    const [isCurrentDay, setIsCurrentDay] = useState(true);

    // Helper function to get date key in YYYY-MM-DD format
    const getDateKey = (date) => {
        // If already in YYYY-MM-DD, return as-is to avoid timezone shifts
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Helper function to check if date is today
    const checkIsCurrentDay = (dateStr) => {
        const t = new Date();
        const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        return dateStr === today;
    };

    // Helper function to format date for display
    const formatDateDisplay = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Load attendance data based on selected date
    const loadAttendanceData = useCallback(async (dateStr) => {
        const isCurrent = checkIsCurrentDay(dateStr);
        setIsCurrentDay(isCurrent);

        try {
            setLoading(true);

            if (isCurrent) {
                // For current day: fetch live data from database via API
                const records = await attendanceService.listRecords();
                const currentDayMembers = records || [];
                setCheckedInMembers(currentDayMembers);
            } else {
                // For past days: derive from attendance history (real data)
                const dateKey = getDateKey(dateStr);
                const history = await attendanceService.listHistory();
                const membersForDay = [];
                Object.values(history || {}).forEach((h) => {
                    const entries = Array.isArray(h?.entries) ? h.entries : [];
                    entries.forEach((entry) => {
                        // Prefer explicit entry.date; fallback to checkInTime date
                        let entryDate = entry?.date;
                        if (!entryDate && entry?.checkInTime) {
                            try {
                                const d = new Date(entry.checkInTime);
                                entryDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            } catch { }
                        }
                        if (entryDate === dateKey) {
                            membersForDay.push({
                                membershipId: entry.membershipId || null,
                                name: entry.name || 'Unknown',
                                phone: entry.phone || '',
                                email: entry.email || '',
                                avatar: entry.avatar || (entry.name ? entry.name.charAt(0).toUpperCase() : 'M'),
                                planLabel: entry.planLabel || 'N/A',
                                planCategory: entry.planCategory || 'normal',
                                checkedInTime: entry.checkInTime || null,
                                status: 'checked-in'
                            });
                        }
                    });
                });
                setCheckedInMembers(membersForDay);
            }
        } catch (error) {
            console.error('Error loading attendance data:', error);
            setCheckedInMembers([]);
        } finally {
            setLoading(false);
        }
    }, []);    // Initial load and when selected date changes
    useEffect(() => {
        loadAttendanceData(selectedDate);
    }, [selectedDate, loadAttendanceData]);

    // Auto-refresh only for current day
    useEffect(() => {
        if (isCurrentDay) {
            const interval = setInterval(() => {
                loadAttendanceData(selectedDate);
            }, 30000); // Refresh every 30 seconds
            return () => clearInterval(interval);
        }
    }, [isCurrentDay, selectedDate, loadAttendanceData]);

    // Listen for attendance updates (only for current day)
    useEffect(() => {
        if (isCurrentDay) {
            const handleAttendanceUpdate = () => loadAttendanceData(selectedDate);
            window.addEventListener('memberships:attendance-updated', handleAttendanceUpdate);
            window.addEventListener('memberships:attendance-sync', handleAttendanceUpdate);
            return () => {
                window.removeEventListener('memberships:attendance-updated', handleAttendanceUpdate);
                window.removeEventListener('memberships:attendance-sync', handleAttendanceUpdate);
            };
        }
    }, [isCurrentDay, selectedDate, loadAttendanceData]);

    // displayedMembers now is just checkedInMembers (already filtered by date in loadAttendanceData)
    const displayedMembers = checkedInMembers;

    const handleCheckout = async (member, e) => {
        e.stopPropagation();

        // Only allow checkout for current day
        if (!isCurrentDay) {
            alert('Cannot check out members from historical data. Please view today\'s attendance.');
            return;
        }

        const recordKey = member.membershipId || member.phone;
        if (!recordKey) return;

        try {
            await attendanceService.removeRecord(recordKey);
            const history = await attendanceService.listHistory();
            if (history && history[recordKey]) {
                const current = history[recordKey];
                const updatedEntries = Array.isArray(current.entries) ? [...current.entries] : [];
                if (updatedEntries.length > 0 && !updatedEntries[0].checkOutTime) {
                    updatedEntries[0].checkOutTime = new Date().toISOString();
                }
                const updatedHistory = {
                    ...history,
                    [recordKey]: {
                        ...current,
                        entries: updatedEntries.slice(0, 5)
                    }
                };
                await attendanceService.saveHistory(updatedHistory);
                window.dispatchEvent(new CustomEvent('memberships:attendance-updated', { detail: { recordKey, history: updatedHistory } }));
            } else {
                window.dispatchEvent(new CustomEvent('memberships:attendance-updated', { detail: { recordKey } }));
            }
            setCheckedInMembers(prev => prev.filter(m => (m.membershipId || m.phone) !== recordKey));
        } catch (error) {
            console.error('Error checking out member:', error);
        }
    };

    const handleCardClick = (member) => {
        const phone = member.phone || '';
        if (!phone) return;
        window.dispatchEvent(new CustomEvent('members-attendance:open-profile', {
            detail: { phone, normalizedPhone: String(phone).replace(/\D/g, '').slice(-10) }
        }));
    };

    const formatTime = (isoString) => {
        if (!isoString) return '-';
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (error) {
            return '-';
        }
    };

    const formatPhone = (phone) => {
        if (!phone) return '-';
        const cleaned = String(phone).replace(/\D/g, '');
        const last10 = cleaned.slice(-10);
        return last10.length === 10 ? `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}` : phone;
    };

    if (loading) {
        return (
            <div className="bg-white min-h-screen w-full">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">Checked-In Members</h1>
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-pulse text-gray-500">Loading members...</div>
                    </div>
                </div>
            </div>
        );
    }

    // Navigation handlers
    const handlePreviousDay = () => {
        const [year, month, day] = selectedDate.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() - 1);

        const newYear = date.getFullYear();
        const newMonth = String(date.getMonth() + 1).padStart(2, '0');
        const newDay = String(date.getDate()).padStart(2, '0');
        const newDateStr = `${newYear}-${newMonth}-${newDay}`;

        setSelectedDate(newDateStr);
    };

    const handleNextDay = () => {
        const [year, month, day] = selectedDate.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() + 1);

        const newYear = date.getFullYear();
        const newMonth = String(date.getMonth() + 1).padStart(2, '0');
        const newDay = String(date.getDate()).padStart(2, '0');
        const newDateStr = `${newYear}-${newMonth}-${newDay}`;

        // Get today's date string for comparison
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Only update if the new date is not beyond today
        if (newDateStr <= todayStr) {
            setSelectedDate(newDateStr);
        }
    };

    return (
        <div className="min-h-screen w-full bg-white">
            <div className="p-6">
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                Daily Attendance
                            </h1>
                            <p className="text-gray-600 mt-1">
                                {isCurrentDay ? 'Real-time check-ins for today' : 'Viewing saved attendance data'}
                            </p>
                        </div>
                        <div className="bg-gray-100 px-4 py-2 rounded-lg shadow-sm border border-gray-300">
                            <div className="text-sm text-gray-600">Total Checked-In</div>
                            <div className="text-2xl font-bold text-indigo-600">{displayedMembers.length}</div>
                        </div>
                    </div>

                    {/* Date Navigation (responsive, centered on mobile) */}
                    <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end flex-wrap gap-3 sm:gap-4 rounded-lg p-4 w-full">
                        <button
                            onClick={handlePreviousDay}
                            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                        >
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <div className="text-center w-full sm:w-auto">
                            <p className="text-lg font-bold text-gray-900">{formatDateDisplay(selectedDate)}</p>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}
                                className="mt-1 text-xs text-gray-600 border border-gray-300 rounded px-2 py-1 cursor-pointer hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40 sm:w-auto"
                            />
                        </div>

                        <button
                            onClick={handleNextDay}
                            disabled={isCurrentDay}
                            className={`p-2 rounded-lg border transition-colors ${isCurrentDay
                                ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
                                : 'bg-white border-gray-300 hover:bg-gray-100'
                                }`}
                        >
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
                {displayedMembers.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg shadow-md p-12 text-center border border-gray-200">
                        <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Members Checked-In</h3>
                        <p className="text-gray-500">No check-ins for the selected date.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                        {displayedMembers.map((member, index) => (
                            <div key={`${member.membershipId || member.phone}-${index}`} onClick={() => handleCardClick(member)} className="bg-gray-50 rounded-lg shadow-md overflow-hidden border border-gray-300 cursor-pointer">
                                <div className="p-4">
                                    <div className="flex justify-center mb-3">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border-4 border-indigo-200 flex items-center justify-center">
                                            <span className="text-2xl font-bold text-indigo-700">{member.avatar || 'M'}</span>
                                        </div>
                                    </div>
                                    <div className="text-center mb-3">
                                        <h3 className="text-sm font-bold text-gray-900 mb-1 truncate">{member.name || 'Unknown Member'}</h3>
                                        <div className="text-xs text-gray-600 flex items-center justify-center gap-1 mb-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            {formatPhone(member.phone)}
                                        </div>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-2 border border-green-200 mb-2">
                                        <div className="text-[0.7rem] font-bold text-green-800 flex items-center justify-center gap-1">
                                            CHECK-IN: {formatTime(member.checkedInTime)}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleCheckout(member, e)}
                                        disabled={!isCurrentDay}
                                        className={`w-full font-semibold py-1.5 px-3 rounded-lg transition-all duration-200 shadow-md flex items-center justify-center gap-1.5 text-sm ${isCurrentDay
                                            ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:shadow-lg text-white cursor-pointer'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        {isCurrentDay ? 'Check Out' : 'View Only'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Members;