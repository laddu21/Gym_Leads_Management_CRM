import React, { useEffect, useMemo, useState } from 'react';
import { leadsService } from '../../services/leadsService';
import { prepareLeads, computeExpiryDate } from '../../services/modules/leadUtils';

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
                if (!mounted) return;
                setRawLeads(Array.isArray(data) ? data : []);
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

    // Prepare raw leads using the shared helper and map into the
    // member-shaped objects this page expects (plan/joinDate/expiryDate
    // are derived from the normalized membership info when available).
    const preparedLeads = useMemo(() => prepareLeads(rawLeads), [rawLeads]);

    const members = useMemo(() => {
        if (!Array.isArray(preparedLeads)) return [];
        return preparedLeads.map((p) => {
            // Prefer server-supplied join/expiry fields added by the API. Fall
            // back to nested membership fields when the API hasn't populated them.
            const joinIso = p.joinDate || p.membership?.startDate || p.convertedAt || p.createdAt || null;
            const explicitExpiry = p.expiryDate || p.membership?.endDate || p.endDate || null;
            const inferred = computeExpiryDate(p, joinIso);
            const expiryIso = explicitExpiry || (inferred ? inferred.toISOString() : null);
            return {
                ...p,
                plan: p.membership?.planLabel || p.interest || p.plan || '',
                joinDate: joinIso,
                expiryDate: expiryIso,
                amount: p.membership?.amount || 0,
            };
        });
    }, [preparedLeads]);

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

    const newJoinedMembersList = useMemo(() => {
        if (!members || members.length === 0) return [];
        return members.filter((m) => {
            if (!m.joinDate) return false;
            const days = getDaysBetween(m.joinDate, now);
            return days !== null && days >= 0 && days <= 7;
        });
    }, [members, now]);

    // Month helpers
    const getPrevMonthStart = (dt) => {
        const d = dt instanceof Date ? dt : new Date(dt);
        return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    };
    const formatMonthLabel = (dt) => {
        if (!dt) return '—';
        try {
            return dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        } catch (e) {
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        }
    };
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

    // Overview month (previous calendar month) - this is the month that should refresh on the 1st
    const [overviewMonth, setOverviewMonth] = useState(() => getPrevMonthStart(new Date()));
    const [selectedMonth, setSelectedMonth] = useState(() => getPrevMonthStart(new Date()));

    // Recompute overviewMonth and selectedMonth precisely on the 1st of each month
    useEffect(() => {
        // Calculate ms until next month's 1st at 00:00
        const nowDate = new Date();
        const nextFirst = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1, 0, 0, 0, 0);
        const ms = nextFirst.getTime() - Date.now();
        const timer = setTimeout(() => {
            const prev = getPrevMonthStart(new Date());
            setOverviewMonth(prev);
            setSelectedMonth(prev);
        }, ms + 50); // small offset to ensure date rolled over
        return () => clearTimeout(timer);
    }, [now]);

    // Members for the selected month (used in the detailed section)
    const membersForSelectedMonth = useMemo(() => {
        if (!selectedMonth || !Array.isArray(members)) return [];
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth();
        return members.filter((m) => {
            if (!m.joinDate) return false;
            const jd = new Date(m.joinDate);
            if (Number.isNaN(jd.getTime())) return false;
            return jd.getFullYear() === year && jd.getMonth() === month;
        });
    }, [members, selectedMonth]);

    // Monthly (previous calendar month) count for overview
    const monthlyNewMembersCount = useMemo(() => {
        if (!overviewMonth || !Array.isArray(members)) return 0;
        const year = overviewMonth.getFullYear();
        const month = overviewMonth.getMonth();
        return members.reduce((acc, m) => {
            if (!m.joinDate) return acc;
            const jd = new Date(m.joinDate);
            if (Number.isNaN(jd.getTime())) return acc;
            if (jd.getFullYear() === year && jd.getMonth() === month) return acc + 1;
            return acc;
        }, 0);
    }, [members, overviewMonth]);

    const handleSelectedMonthPrev = () => setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const handleSelectedMonthNext = () => setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

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
            [`New Members (${formatMonthLabel(overviewMonth)})`, monthlyNewMembersCount],
            ['Expiring Soon (30d)', expiringSoon.length],
            ['Expired Members', expiredMembers.length],
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
        exportMembersAllFields(`new_members_${selectedMonth ? monthToInputValue(selectedMonth) : 'selected'}.csv`, membersForSelectedMonth, [
            { key: 'daysSinceJoined', label: 'Days Since Joined', fn: (m) => getDaysBetween(m.joinDate, now) }
        ]);
    };

    const handleExportNewJoined = () => {
        exportMembersAllFields('new_joined_7d.csv', newJoinedMembersList, [
            { key: 'daysSinceJoined', label: 'Days Since Joined', fn: (m) => getDaysBetween(m.joinDate, now) }
        ]);
    };

    return (
        <div className="w-full p-4 md:p-6 space-y-6 md:space-y-8">
            <header className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-gray-900">Gym Membership Reports</h1>
                <p className="text-gray-500">Live dashboard with auto-refresh and expiry tracking.</p>
            </header>

            {/* Summary / Overview with per-section export */}
            <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 w-full">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Overview</h2>
                    <button onClick={handleExportSummary} className="px-4 py-2 bg-blue-600 text-white rounded-full font-semibold shadow hover:bg-blue-700">Export Summary</button>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-blue-50 p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold text-blue-700">{totalMembers}</div>
                        <div className="text-sm text-blue-600">Total Members</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold text-green-700">{monthlyNewMembersCount}</div>
                        <div className="text-sm text-green-600">New Members ({formatMonthLabel(overviewMonth)})</div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold text-yellow-700">{expiringSoon.length}</div>
                        <div className="text-sm text-yellow-600">Expiring Soon (30d)</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold text-red-700">{expiredMembers.length}</div>
                        <div className="text-sm text-red-600">Expired Members</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold text-purple-700">₹ {totalAmount.toLocaleString('en-IN')}</div>
                        <div className="text-sm text-purple-600">Total Revenue</div>
                    </div>
                </div>
            </section>

            {/* All Members with pagination (5 per page) */}
            <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 w-full">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">All Members</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExportAllMembers} className="px-3 py-1.5 bg-gray-600 text-white rounded-full text-sm font-medium shadow hover:bg-gray-700">Export All</button>
                        <button onClick={handleExportPageMembers} className="px-3 py-1.5 bg-gray-500 text-white rounded-full text-sm font-medium shadow hover:bg-gray-600">Export Page</button>
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
                            <table className="min-w-full bg-white rounded-xl shadow">
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
                                    {currentMembersPage.map((m) => (
                                        <tr key={m.id} className="border-b">
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
                    </>
                )}
            </section>

            <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 w-full">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-yellow-700 mb-4">Members Expiring in Next 30 Days</h2>
                    <button onClick={handleExportExpiring} className="px-3 py-1.5 bg-yellow-600 text-white rounded-full text-sm font-medium shadow hover:bg-yellow-700">Export CSV</button>
                </div>
                {expiringSoon.length === 0 ? (
                    <p className="text-gray-500">No members expiring soon.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white rounded-xl shadow">
                            <thead>
                                <tr className="bg-yellow-100">
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Mobile</th>
                                    <th className="px-4 py-2">Plan</th>
                                    <th className="px-4 py-2">Join Date</th>
                                    <th className="px-4 py-2">Expiry Date</th>
                                    <th className="px-4 py-2">Amount</th>
                                    <th className="px-4 py-2">Days Left</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expiringSoon.map((m) => (
                                    <tr key={m.id} className="border-b">
                                        <td className="px-4 py-2 font-semibold">{m.name}</td>
                                        <td className="px-4 py-2">{m.phone || '—'}</td>
                                        <td className="px-4 py-2">{m.plan}</td>
                                        <td className="px-4 py-2">{formatDate(m.joinDate)}</td>
                                        <td className="px-4 py-2">{formatDate(m.expiryDate)}</td>
                                        <td className="px-4 py-2">{m.amount ? `₹ ${Number(m.amount).toLocaleString('en-IN')}` : '—'}</td>
                                        <td className="px-4 py-2 text-yellow-700 font-bold">{getDaysBetween(now, m.expiryDate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 w-full">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-red-700 mb-4">Expired Members</h2>
                    <button onClick={handleExportExpired} className="px-3 py-1.5 bg-red-600 text-white rounded-full text-sm font-medium shadow hover:bg-red-700">Export CSV</button>
                </div>
                {expiredMembers.length === 0 ? (
                    <p className="text-gray-500">No expired members.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white rounded-xl shadow">
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
                                {expiredMembers.map((m) => (
                                    <tr key={m.id} className="border-b">
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
                )}
            </section>

            {/* New Joined Members (7 days) */}
            <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 w-full">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-indigo-700 mb-4">New Joined Members (7 days)</h2>
                    <button onClick={handleExportNewJoined} className="px-3 py-1.5 bg-indigo-600 text-white rounded-full text-sm font-medium shadow hover:bg-indigo-700">Export CSV</button>
                </div>
                {newJoinedMembersList.length === 0 ? (
                    <p className="text-gray-500">No members joined in the last 7 days.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white rounded-xl shadow">
                            <thead>
                                <tr className="bg-indigo-100">
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Mobile</th>
                                    <th className="px-4 py-2">Plan</th>
                                    <th className="px-4 py-2">Join Date</th>
                                    <th className="px-4 py-2">Amount</th>
                                    <th className="px-4 py-2">Days Since Joined</th>
                                </tr>
                            </thead>
                            <tbody>
                                {newJoinedMembersList.map((m) => (
                                    <tr key={m.id} className="border-b">
                                        <td className="px-4 py-2 font-semibold">{m.name}</td>
                                        <td className="px-4 py-2">{m.phone || '—'}</td>
                                        <td className="px-4 py-2">{m.plan}</td>
                                        <td className="px-4 py-2">{formatDate(m.joinDate)}</td>
                                        <td className="px-4 py-2">{m.amount ? `₹ ${Number(m.amount).toLocaleString('en-IN')}` : '—'}</td>
                                        <td className="px-4 py-2 text-indigo-700 font-bold">{getDaysBetween(m.joinDate, now)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* New Members (month view with calendar) */}
            <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 w-full">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-green-700 mb-4">New Members (Month)</h2>
                    <div className="flex items-center gap-2">
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
                        <button onClick={handleExportNewMembers} className="px-3 py-1.5 bg-green-600 text-white rounded-full text-sm font-medium shadow hover:bg-green-700">Export CSV</button>
                    </div>
                </div>
                {membersForSelectedMonth.length === 0 ? (
                    <p className="text-gray-500">No members for {formatMonthLabel(selectedMonth)}.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white rounded-xl shadow">
                            <thead>
                                <tr className="bg-green-100">
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Mobile</th>
                                    <th className="px-4 py-2">Plan</th>
                                    <th className="px-4 py-2">Join Date</th>
                                    <th className="px-4 py-2">Expiry Date</th>
                                    <th className="px-4 py-2">Amount</th>
                                    <th className="px-4 py-2">Days Since Joined</th>
                                </tr>
                            </thead>
                            <tbody>
                                {membersForSelectedMonth.map((m) => (
                                    <tr key={m.id} className="border-b">
                                        <td className="px-4 py-2 font-semibold">{m.name}</td>
                                        <td className="px-4 py-2">{m.phone || '—'}</td>
                                        <td className="px-4 py-2">{m.plan}</td>
                                        <td className="px-4 py-2">{formatDate(m.joinDate)}</td>
                                        <td className="px-4 py-2">{formatDate(m.expiryDate)}</td>
                                        <td className="px-4 py-2">{m.amount ? `₹ ${Number(m.amount).toLocaleString('en-IN')}` : '—'}</td>
                                        <td className="px-4 py-2 text-green-700 font-bold">{getDaysBetween(m.joinDate, now)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {isLoading && <p className="text-center text-gray-500">Loading data...</p>}
        </div>
    );
}

export default ReportsPage;
