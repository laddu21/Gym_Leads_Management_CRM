import React, { useState, useEffect } from 'react';
import { performanceService } from '../../../services/performanceService';

const MyPerfomance = () => {
    const [performanceData, setPerformanceData] = useState({
        achievedRevenue: 0,
        convertedCount: 0,
        averageRevenuePerDay: 0,
        target: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isCurrentMonth, setIsCurrentMonth] = useState(true);

    // Calculate progress percentage
    const progressPercentage = performanceData.target > 0
        ? Math.min((performanceData.achievedRevenue / performanceData.target) * 100, 100)
        : 0;

    // Format month and year for display
    const formatMonth = (date) => {
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    // Get month key for storage (e.g., "2025-10" for October 2025)
    const getMonthKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    // Check if viewing current month
    const checkIsCurrentMonth = (date) => {
        const now = new Date();
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    };

    // Navigate to previous month (clamp to month granularity)
    const handlePreviousMonth = () => {
        setCurrentDate(prevDate => {
            const year = prevDate.getFullYear();
            const month = prevDate.getMonth();
            // Go to first day of the previous month
            return new Date(year, month - 1, 1);
        });
    };

    // Navigate to next month (do not go beyond the current month)
    const handleNextMonth = () => {
        const now = new Date();
        setCurrentDate(prevDate => {
            const next = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 1);
            // If next month is beyond the current month, keep current month
            const isBeyondCurrent =
                next.getFullYear() > now.getFullYear() ||
                (next.getFullYear() === now.getFullYear() && next.getMonth() > now.getMonth());
            return isBeyondCurrent ? new Date(now.getFullYear(), now.getMonth(), 1) : next;
        });
    };

    // Fetch performance data for current or historical month
    const fetchPerformanceData = async (date) => {
        try {
            setLoading(true);
            setError(null);

            const monthKey = getMonthKey(date);
            const isCurrent = checkIsCurrentMonth(date);
            setIsCurrentMonth(isCurrent);

            // Always fetch from API (database) - no localStorage caching
            console.log(`Fetching performance data for ${monthKey}...`);

            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const data = await performanceService.getMonthlyPerformance(year, month);

            console.log('API Response:', data);
            console.log('Converted Count from API:', data.convertedCount);

            // If no target is set, set default target of 50,000
            if (!data.target || data.target === 0) {
                try {
                    await performanceService.setTarget(50000, year, month);
                    const newData = {
                        achievedRevenue: data.achievedRevenue || 0,
                        convertedCount: data.convertedCount || 0,
                        averageRevenuePerDay: data.averageRevenuePerDay || 0,
                        target: 50000
                    };
                    console.log('Setting performance data (with default target):', newData);
                    setPerformanceData(newData);
                } catch (setTargetErr) {
                    console.error('Error setting default target:', setTargetErr);
                    const newData = {
                        achievedRevenue: data.achievedRevenue || 0,
                        convertedCount: data.convertedCount || 0,
                        averageRevenuePerDay: data.averageRevenuePerDay || 0,
                        target: 50000
                    };
                    console.log('Setting performance data (error case):', newData);
                    setPerformanceData(newData);
                }
            } else {
                const newData = {
                    achievedRevenue: data.achievedRevenue || 0,
                    convertedCount: data.convertedCount || 0,
                    averageRevenuePerDay: data.averageRevenuePerDay || 0,
                    target: data.target
                };
                console.log('Setting performance data:', newData);
                setPerformanceData(newData);
            }
        } catch (err) {
            console.error('Error fetching performance data:', err);
            setError('Failed to load performance data');
        } finally {
            setLoading(false);
        }
    };

    // Effect to fetch data when month changes
    useEffect(() => {
        fetchPerformanceData(currentDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate]);

    // Effect to refresh current month data periodically
    useEffect(() => {
        if (isCurrentMonth) {
            const interval = setInterval(() => {
                fetchPerformanceData(currentDate);
            }, 30000); // Refresh every 30 seconds
            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCurrentMonth, currentDate]);

    if (loading && !performanceData.target) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-black text-xl">Loading performance data...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-400">
                            </p>
                            <h1 className="mt-2 text-3xl font-semibold text-black">
                                My Performance
                            </h1>
                            <p className="mt-1 text-sm text-black">
                                Track your monthly sales performance and targets
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handlePreviousMonth}
                                className="rounded-full p-2 hover:bg-gray-100 transition-colors duration-200"
                                aria-label="Previous month"
                            >
                                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="min-w-[160px] text-center">
                                <p className="text-lg font-semibold text-black">
                                    {formatMonth(currentDate)}
                                </p>
                            </div>
                            <button
                                onClick={handleNextMonth}
                                disabled={checkIsCurrentMonth(currentDate)}
                                className={`rounded-full p-2 transition-colors duration-200 ${checkIsCurrentMonth(currentDate)
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-gray-100'
                                    }`}
                                aria-label="Next month"
                            >
                                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                )}

                {/* Performance Stats - 3 blocks in a row */}
                <section className="mb-8">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {/* Revenue Till Date */}
                        <div className="rounded-3xl border border-gray-800 p-6 shadow-2xl shadow-gray-950/40">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-black">
                                        Revenue Till Date
                                    </p>
                                    <h2 className="mt-2 text-4xl font-bold text-black">
                                        ₹{performanceData.achievedRevenue.toLocaleString('en-IN')}
                                    </h2>
                                    <p className="mt-1 text-xs text-black">
                                        Total revenue this month
                                    </p>
                                </div>
                                <div className="rounded-full bg-blue-500/20 p-4">
                                    <svg
                                        className="h-8 w-8 text-blue-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Converted Leads */}
                        <div className="rounded-3xl border border-gray-800 p-6 shadow-2xl shadow-gray-950/40">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-black">
                                        Converted Leads
                                    </p>
                                    <h2 className="mt-2 text-4xl font-bold text-black">
                                        {performanceData.convertedCount}
                                    </h2>
                                    <p className="mt-1 text-xs text-black">
                                        Total conversions this month
                                    </p>
                                </div>
                                <div className="rounded-full bg-green-500/20 p-4">
                                    <svg
                                        className="h-8 w-8 text-green-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Revenue Average per Day */}
                        <div className="rounded-3xl border border-gray-800 p-6 shadow-2xl shadow-gray-950/40">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-black">
                                        Revenue Avg/Day
                                    </p>
                                    <h2 className="mt-2 text-4xl font-bold text-black">
                                        ₹{performanceData.averageRevenuePerDay.toLocaleString('en-IN')}
                                    </h2>
                                    <p className="mt-1 text-xs text-black">
                                        Daily average this month
                                    </p>
                                </div>
                                <div className="rounded-full bg-purple-500/20 p-4">
                                    <svg
                                        className="h-8 w-8 text-purple-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Progress Bar Section */}
                <section className="rounded-3xl border border-gray-800 p-8 shadow-2xl shadow-gray-950/40">
                    <div className="mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-semibold text-black">Monthly Target Progress</h3>
                                <p className="mt-1 text-sm text-black">
                                    Target: ₹{performanceData.target.toLocaleString('en-IN')}
                                    {performanceData.target > 0 && (
                                        <span className="ml-2">
                                            • Remaining: ₹{Math.max(0, performanceData.target - performanceData.achievedRevenue).toLocaleString('en-IN')}
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-bold text-black">
                                    {progressPercentage.toFixed(1)}%
                                </p>
                                <p className="text-xs text-black">Completed</p>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-8 w-full overflow-hidden rounded-full bg-gray-800">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${progressPercentage >= 90
                                ? 'bg-green-500'
                                : progressPercentage >= 70
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                            style={{ width: `${progressPercentage}%` }}
                        >
                            <div className="h-full w-full animate-pulse bg-white/10"></div>
                        </div>
                        {progressPercentage >= 100 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-sm font-bold text-white drop-shadow-lg">
                                    🎉 Target Achieved!
                                </span>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default MyPerfomance;
