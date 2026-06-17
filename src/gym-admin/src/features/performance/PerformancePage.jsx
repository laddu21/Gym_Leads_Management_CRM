
import React, { useEffect, useState } from 'react';
import { performanceApi } from '../../services/apiClient';


function getMonthOptions() {
    // Last 12 months
    const now = new Date();
    const options = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        options.push({
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            label: d.toLocaleString('default', { month: 'long', year: 'numeric' })
        });
    }
    return options;
}


function getMonthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}



function PerformancePage() {
    const monthOptions = getMonthOptions();
    const [selected, setSelected] = useState({
        year: monthOptions[0].year,
        month: monthOptions[0].month
    });
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [targetHistory, setTargetHistory] = useState([]);
    const [historyPage, setHistoryPage] = useState(1);
    const HISTORY_PAGE_SIZE = 12;
    const [showTargetInput, setShowTargetInput] = useState(false);
    const [targetInput, setTargetInput] = useState('');

    // Current month check
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const isCurrentMonth = selected.year === currentYear && selected.month === currentMonth;

    // Fetch target history on mount
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await performanceApi.getTargetHistory();
                // Sort by changedAt descending (most recent first)
                const sorted = (res.history || []).slice().sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
                setTargetHistory(sorted);
            } catch (err) {
                // Optionally handle error
            }
        };
        fetchHistory();
    }, []);

    useEffect(() => {
        const fetchPerformance = async () => {
            setLoading(true);
            setError('');
            try {
                const result = await performanceApi.get(selected.year, selected.month);
                setData(result);
            } catch (err) {
                setError(err.message || 'Failed to fetch performance data');
            } finally {
                setLoading(false);
            }
        };
        fetchPerformance();
        // eslint-disable-next-line
    }, [selected]);


    // Handlers for target input
    const [loading, setLoading] = useState(false);
    const patchedTarget = data ? data.target : 0;

    const handleTargetButton = () => {
        if (!isCurrentMonth) return;
        setShowTargetInput(true);
        setTargetInput('');
    };
    const handleTargetInputChange = (e) => {
        setTargetInput(e.target.value);
    };
    const handleTargetSubmit = async (e) => {
        e.preventDefault();
        const value = parseInt(targetInput, 10);
        if (isNaN(value)) return;
        try {
            setLoading(true);
            await performanceApi.setTarget(selected.year, selected.month, value);
            // Refetch data to update UI
            const result = await performanceApi.get(selected.year, selected.month);
            setData(result);
            // Refetch target history to update history section
            const res = await performanceApi.getTargetHistory();
            const sorted = (res.history || []).slice().sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
            setTargetHistory(sorted);
            setHistoryPage(1); // Reset to first page on new entry
        } catch (err) {
            setError(err.message || 'Failed to set target');
        } finally {
            setShowTargetInput(false);
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto md:max-w-full md:px-8 lg:px-12 md:mx-0">
            <h2 className="text-2xl font-bold mb-6 text-gray-800"></h2>

            {/* Filter */}
            <div className="mb-6 flex items-center gap-2">
                <label htmlFor="monthFilter" className="text-sm font-medium text-gray-700">Select Month:</label>
                <select
                    id="monthFilter"
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={`${selected.year}-${selected.month}`}
                    onChange={e => {
                        const [year, month] = e.target.value.split('-');
                        setSelected({ year: Number(year), month: Number(month) });
                    }}
                >
                    {monthOptions.map(opt => (
                        <option key={opt.year + '-' + opt.month} value={`${opt.year}-${opt.month}`}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Target set button and input */}
            <div className="mb-4">
                <span className="font-semibold">Target for {selected.year}-{String(selected.month).padStart(2, '0')}: </span>
                <span className="text-blue-600 font-bold">
                    {patchedTarget}
                </span>
                <button
                    className={`ml-4 px-3 py-1 rounded ${isCurrentMonth ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-400 text-gray-600 cursor-not-allowed'}`}
                    onClick={handleTargetButton}
                    disabled={!isCurrentMonth}
                >
                    Set Target
                </button>
            </div>
            {showTargetInput && isCurrentMonth && (
                <form onSubmit={handleTargetSubmit} className="mb-4 flex items-center gap-2">
                    <input
                        type="number"
                        value={targetInput}
                        onChange={handleTargetInputChange}
                        className="border px-2 py-1 rounded"
                        placeholder="Enter target"
                        min="0"
                        required
                        autoFocus
                        id="target-input"
                        name="target"
                    />
                    <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Save</button>
                    <button type="button" className="px-3 py-1 bg-gray-300 rounded" onClick={() => setShowTargetInput(false)}>Cancel</button>
                </form>
            )}

            {loading && <p className="text-gray-500">Loading...</p>}
            {error && <p className="text-red-600 font-semibold">{error}</p>}

            {data && (
                <>
                    {/* Section 1: Metrics Row - Responsive for all screens */}
                    <div className="w-full overflow-x-auto min-w-0 mb-8">
                        <div className="bg-white rounded-lg shadow p-6 w-full min-w-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
                                <div className="w-full bg-blue-50 rounded-lg p-2 sm:p-4 flex flex-col items-center">
                                    <div className="text-gray-500 text-xs mb-1">Achieved Revenue</div>
                                    <div className="font-bold text-base sm:text-xl text-green-700">
                                        {typeof data.achievedRevenue === 'number' && !isNaN(data.achievedRevenue) ? data.achievedRevenue : 0}
                                    </div>
                                </div>
                                <div className="w-full bg-green-50 rounded-lg p-2 sm:p-4 flex flex-col items-center">
                                    <div className="text-gray-500 text-xs mb-1">Converted Leads</div>
                                    <div className="font-bold text-base sm:text-xl text-green-700">{data.convertedCount}</div>
                                </div>
                                <div className="w-full bg-yellow-50 rounded-lg p-2 sm:p-4 flex flex-col items-center">
                                    <div className="text-gray-500 text-xs mb-1">Avg Revenue/Day</div>
                                    <div className="font-bold text-base sm:text-xl text-yellow-700">{data.averageRevenuePerDay?.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Progress Bar */}
                    <div className="w-full overflow-x-auto min-w-0 mb-6">
                        <div className="bg-white rounded-lg shadow p-6 w-full min-w-0">
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-blue-700">Progress</span>
                                <span className="text-sm font-medium text-blue-700">
                                    {patchedTarget > 0
                                        ? `${Math.min(100, ((data.achievedRevenue / patchedTarget) * 100).toFixed(1))}%`
                                        : 'N/A'}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-300">
                                <div
                                    className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                                    style={{ width: patchedTarget > 0 ? `${Math.min(100, (data.achievedRevenue / patchedTarget) * 100)}%` : '0%' }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>Achieved: ₹{data.achievedRevenue}</span>
                                <span>Target: ₹{patchedTarget}</span>
                            </div>
                        </div>
                    </div>

                    {/* Target history section below progress bar, with background block and pagination */}
                    <div className="w-full overflow-x-auto min-w-0 mb-6">
                        <div className="bg-gray-50 rounded-lg shadow p-4 w-full min-w-0">
                            <h3 className="text-md font-semibold mb-1">Target History</h3>
                            <ul className="list-disc pl-6">
                                {targetHistory.length === 0 && (
                                    <li className="text-gray-400">No targets set yet.</li>
                                )}
                                {targetHistory
                                    .filter(t => t.target && t.target > 0)
                                    .slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
                                    .map((t, idx) => {
                                        const monthDate = new Date(Number(t.year), Number(t.month) - 1);
                                        const label = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
                                        const changedAt = t.changedAt ? new Date(t.changedAt) : null;
                                        return (
                                            <li key={t.year + '-' + t.month + '-' + (t.changedAt || idx)}>
                                                <span className="font-semibold">{label}</span>
                                                {changedAt && (
                                                    <span className="ml-2 text-xs text-gray-500">({changedAt.toLocaleString()})</span>
                                                )}
                                                : <span className="text-blue-700">Target: {t.target}</span>
                                                {t.achievement !== undefined && (
                                                    <span className="ml-2 text-green-700">Achievement: {t.achievement}</span>
                                                )}
                                            </li>
                                        );
                                    })}
                            </ul>
                            {/* Pagination controls */}
                            {targetHistory.filter(t => t.target && t.target > 0).length > HISTORY_PAGE_SIZE && (
                                <div className="flex justify-center items-center gap-4 mt-4">
                                    <button
                                        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                        disabled={historyPage === 1}
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm">Page {historyPage} of {Math.ceil(targetHistory.filter(t => t.target && t.target > 0).length / HISTORY_PAGE_SIZE)}</span>
                                    <button
                                        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                                        onClick={() => setHistoryPage(p => p + 1)}
                                        disabled={historyPage >= Math.ceil(targetHistory.filter(t => t.target && t.target > 0).length / HISTORY_PAGE_SIZE)}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default PerformancePage;
