import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { leadsService } from '../../../services/leadsService';
import { userMembershipsService } from '../../../services/userMembershipsService';

function MyLead() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [memberships, setMemberships] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | converted | trial
    const [leadTypeFilter, setLeadTypeFilter] = useState('all'); // all | hot | warm | cold
    const [fromDate, setFromDate] = useState(''); // YYYY-MM-DD
    const [toDate, setToDate] = useState(''); // YYYY-MM-DD
    // Removed real-time new lead alert indicator
    const [currentPage, setCurrentPage] = useState(1); // Pagination
    const leadsPerPage = 10;

    // Edit modal state
    const [editingLead, setEditingLead] = useState(null);
    const [leadType, setLeadType] = useState('');
    const [editComments, setEditComments] = useState('');
    const [editError, setEditError] = useState('');

    // Normalize phone number to last 10 digits for consistent matching
    const normalizePhone = (phone) => {
        if (!phone) return '';
        const digits = String(phone).replace(/\D/g, '');
        return digits.slice(-10);
    };

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [leadsData, membershipsData] = await Promise.all([
                leadsService.list(),
                userMembershipsService.list().catch((err) => {
                    console.warn('Fetching user memberships failed, continuing without amounts fallback:', err);
                    return [];
                })
            ]);
            setLeads(leadsData || []);
            setMemberships(Array.isArray(membershipsData) ? membershipsData : []);
            setError('');
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('Failed to load leads');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Listen for lead creation events
        const handleLeadCreated = () => {
            console.log('Lead created event received, refreshing data...');
            fetchData();
        };

        const handleLeadStatusUpdated = () => {
            console.log('Lead status updated event received, refreshing data...');
            fetchData();
        };

        const handleMembershipRefresh = () => {
            console.log('Membership refresh event received, refreshing data...');
            fetchData();
        };

        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('lead:created', handleLeadCreated);
            window.addEventListener('lead:status-updated', handleLeadStatusUpdated);
            window.addEventListener('memberships:refresh', handleMembershipRefresh);
        }

        return () => {
            if (typeof window !== 'undefined' && window.removeEventListener) {
                window.removeEventListener('lead:created', handleLeadCreated);
                window.removeEventListener('lead:status-updated', handleLeadStatusUpdated);
                window.removeEventListener('memberships:refresh', handleMembershipRefresh);
            }
        };
    }, [fetchData]);

    const toDateKey = (value) => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        // Return local date key (YYYY-MM-DD) to match date inputs and avoid UTC offset issues
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const filteredLeads = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return (Array.isArray(leads) ? leads : []).filter((lead) => {
            // Status filter
            const status = (lead?.status || '').toLowerCase();
            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'converted' && status === 'converted') ||
                (statusFilter === 'trial' && (status === 'trial attended' || status.includes('trial')));

            if (!matchesStatus) return false;

            // Lead type filter
            const lt = (lead?.leadType || '').toLowerCase();
            const matchesLeadType =
                leadTypeFilter === 'all' ||
                (leadTypeFilter === 'hot' && lt === 'hot') ||
                (leadTypeFilter === 'warm' && lt === 'warm') ||
                (leadTypeFilter === 'cold' && lt === 'cold');

            if (!matchesLeadType) return false;

            // Date range filter (inclusive)
            if (fromDate || toDate) {
                const createdKey = toDateKey(lead?.createdAt);
                if (fromDate && (!createdKey || createdKey < fromDate)) return false;
                if (toDate && (!createdKey || createdKey > toDate)) return false;
            }

            if (!q) return true;

            // Text search across common fields
            const haystack = [
                lead?.name,
                lead?.phone,
                lead?.email,
                lead?.interest,
                lead?.leadSource,
                lead?.notes
            ]
                .map((v) => (v == null ? '' : String(v).toLowerCase()))
                .join(' ');

            return haystack.includes(q);
        });
    }, [leads, searchQuery, statusFilter, leadTypeFilter, fromDate, toDate]);

    // Build a lookup of latest membership amount by normalized phone
    const amountByPhone = useMemo(() => {
        const map = Object.create(null);
        if (!Array.isArray(memberships)) return map;
        for (const m of memberships) {
            const key = normalizePhone(m?.phone);
            if (!key) continue;
            // pick the most recent by date/endDate/createdAt
            const current = map[key];
            const mDate = new Date(m?.date || m?.createdAt || 0).getTime();
            const cDate = current ? new Date(current.__date || 0).getTime() : -1;
            if (!current || (Number.isFinite(mDate) && mDate >= cDate)) {
                map[key] = { amount: m?.amount, __date: m?.date || m?.createdAt };
            }
        }
        return map;
    }, [memberships]);

    // Pagination calculations
    const totalLeads = filteredLeads.length;
    const totalPages = Math.ceil(totalLeads / leadsPerPage);
    const startIndex = (currentPage - 1) * leadsPerPage;
    const endIndex = startIndex + leadsPerPage;
    const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, leadTypeFilter, fromDate, toDate]);

    const handlePreviousPage = () => {
        setCurrentPage((prev) => Math.max(1, prev - 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
    };

    // Edit handlers
    const handleEditClick = (lead) => {
        setEditingLead(lead);
        setLeadType(lead.leadType || '');
        setEditComments(lead.notes || '');
        setEditError('');
    };

    const handleCloseModal = () => {
        setEditingLead(null);
        setLeadType('');
        setEditComments('');
        setEditError('');
    };

    const handleUpdateLead = async () => {
        if (!editingLead) return;
        // Validation: require at least one change
        const hasLeadTypeChange = (leadType || '') !== (editingLead.leadType || '');
        const hasCommentsChange = (editComments || '').trim() !== (editingLead.notes || '').trim();
        if (!hasLeadTypeChange && !hasCommentsChange) {
            setEditError('No changes to update');
            return;
        }

        try {
            const payload = {
                phone: editingLead.phone,
                leadType: leadType,
                notes: editComments
            };

            await leadsService.update(payload);

            // Dispatch event to notify other components
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('lead:updated', {
                    detail: { ...payload, phone: editingLead.phone }
                }));
            }

            // Refresh data (leads + memberships)
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error('Failed to update lead:', err);
            alert('Failed to update lead. Please try again.');
        }
    };

    // Actions (edit/WhatsApp) are now always rendered but disabled for converted leads.

    const handleWhatsAppClick = (phone) => {
        if (!phone) return;
        // Format phone number for WhatsApp (remove any non-digit characters)
        const cleanPhone = phone.replace(/\D/g, '');
        // Open WhatsApp with the phone number
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-white">Loading leads...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-400">{error}</div>
            </div>
        );
    }

    const formatAmount = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return '—';
        try { return `Rs ${num.toLocaleString('en-IN')}`; } catch { return `Rs ${num}`; }
    };

    // Date/Time formatting for createdAt display in the table
    const formatLocalDateTime = (value) => {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        try {
            const date = d.toLocaleDateString();
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${date} ${time}`;
        } catch {
            return d.toISOString();
        }
    };

    // Real-time 'time ago' display removed

    return (
        <div className="min-h-screen p-3 sm:p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">My Leads</h1>

                {leads.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No leads found</p>
                    </div>
                ) : (
                    <div className="space-y-3 sm:space-y-4">
                        {/* Filters - separate section */}
                        <div className="rounded-lg sm:rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
                            <div className="flex flex-col gap-3">
                                {/* Search bar - full width on mobile */}
                                <div className="w-full">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search by name, phone, source…"
                                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                        <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="11" cy="11" r="8" />
                                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Date filters - side by side on mobile */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <label className="text-xs font-medium text-gray-600 whitespace-nowrap">From</label>
                                        <input
                                            type="date"
                                            value={fromDate}
                                            onChange={(e) => setFromDate(e.target.value)}
                                            className="flex-1 rounded-lg border border-gray-300 bg-white px-1.5 sm:px-2 py-2 text-xs sm:text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <label className="text-xs font-medium text-gray-600 whitespace-nowrap">To</label>
                                        <input
                                            type="date"
                                            value={toDate}
                                            onChange={(e) => setToDate(e.target.value)}
                                            className="flex-1 rounded-lg border border-gray-300 bg-white px-1.5 sm:px-2 py-2 text-xs sm:text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="flex-1 rounded-lg border border-gray-300 bg-white px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        >
                                            <option value="all">All Statuses</option>
                                            <option value="converted">Converted</option>
                                            <option value="trial">Trial</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={leadTypeFilter}
                                            onChange={(e) => setLeadTypeFilter(e.target.value)}
                                            className="flex-1 rounded-lg border border-gray-300 bg-white px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        >
                                            <option value="all">All Lead Types</option>
                                            <option value="hot">Hot</option>
                                            <option value="warm">Warm</option>
                                            <option value="cold">Cold</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Desktop Table - hidden on mobile */}
                        <div className="hidden md:block space-y-3">
                            {/* Leads count */}
                            <div className="flex items-center justify-between px-2">
                                <p className="text-sm text-gray-600">
                                    Showing <span className="font-semibold text-gray-900">{totalLeads === 0 ? 0 : startIndex + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(endIndex, totalLeads)}</span> of <span className="font-semibold text-gray-900">{totalLeads}</span> leads
                                </p>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                                <table className="min-w-full text-left text-sm text-gray-700">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                        <tr>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Phone</th>
                                            <th className="px-4 py-3">Amount</th>
                                            <th className="px-4 py-3">Interest</th>
                                            <th className="px-4 py-3">Source</th>
                                            <th className="px-4 py-3">Comments</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Date/Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 text-gray-900">
                                        {paginatedLeads.map((lead) => {
                                            // Prefer embedded amount; fallback to user-memberships by phone
                                            const normPhone = normalizePhone(lead?.phone);
                                            const fallbackAmount = amountByPhone[normPhone]?.amount;
                                            const amount = (lead.membership?.amount != null) ? lead.membership.amount : fallbackAmount;
                                            const hasConvertedAt = lead.convertedAt || lead.membership?.startDate;
                                            const statusLower = (lead?.status || '').toLowerCase();
                                            const isConverted = statusLower === 'converted' || !!lead?.membership;
                                            return (
                                                <tr key={lead.id || `${lead.phone}-${lead.createdAt || ''}`} className="text-xs hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="text-sm font-semibold text-gray-900 truncate max-w-[10rem]">{lead.name || '—'}</span>
                                                            {!isConverted && (
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => handleEditClick(lead)}
                                                                        className="text-blue-600 hover:text-blue-800 transition-colors"
                                                                        title="Edit lead"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                        </svg>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleWhatsAppClick(lead.phone)}
                                                                        className="text-green-600 hover:text-green-800 transition-colors"
                                                                        title="Chat on WhatsApp"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">{lead.phone || '—'}</td>
                                                    <td className="px-4 py-3 text-green-600 font-semibold">{formatAmount(amount)}</td>
                                                    <td className="px-4 py-3">{lead.leadType || lead.interest || '—'}</td>
                                                    <td className="px-4 py-3 truncate max-w-[12rem]">{lead.leadSource || '—'}</td>
                                                    <td className="px-4 py-3 truncate max-w-[20rem]">{hasConvertedAt ? 'Membership Created' : (lead.notes || '—')}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1">
                                                            <span
                                                                className={`text-[11px] font-medium ${lead.status === 'New'
                                                                    ? 'text-blue-600'
                                                                    : lead.status === 'Converted'
                                                                        ? 'text-red-600'
                                                                        : (lead.status && lead.status.toLowerCase().includes('trial'))
                                                                            ? 'text-yellow-600'
                                                                            : 'text-gray-600'
                                                                    }`}
                                                            >
                                                                {(lead.status && lead.status.toLowerCase().includes('trial')) ? 'Trial' : (lead.status || '—')}
                                                            </span>
                                                            {/* Real-time removed */}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">{formatLocalDateTime(lead.createdAt)}</td>

                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex items-center justify-between px-2 py-3 bg-white rounded-lg border border-gray-200">
                                <button
                                    onClick={handlePreviousPage}
                                    disabled={currentPage === 1}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${currentPage === 1
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    Previous
                                </button>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">
                                        Page <span className="font-semibold text-gray-900">{currentPage}</span> of <span className="font-semibold text-gray-900">{totalPages || 1}</span>
                                    </span>
                                </div>

                                <button
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${currentPage === totalPages || totalPages === 0
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>

                        {/* Mobile Cards - shown only on mobile */}
                        <div className="md:hidden space-y-3">
                            {/* Mobile leads count */}
                            <div className="flex items-center justify-center px-2">
                                <p className="text-sm text-gray-600">
                                    Showing <span className="font-semibold text-gray-900">{totalLeads === 0 ? 0 : startIndex + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(endIndex, totalLeads)}</span> of <span className="font-semibold text-gray-900">{totalLeads}</span> leads
                                </p>
                            </div>

                            {paginatedLeads.map((lead) => {
                                // Prefer embedded amount; fallback to user-memberships by phone
                                const normPhone = normalizePhone(lead?.phone);
                                const fallbackAmount = amountByPhone[normPhone]?.amount;
                                const amount = (lead.membership?.amount != null) ? lead.membership.amount : fallbackAmount;
                                const hasConvertedAt = lead.convertedAt || lead.membership?.startDate;
                                const statusLower = (lead?.status || '').toLowerCase();
                                const isConverted = statusLower === 'converted' || !!lead?.membership;
                                return (
                                    <div
                                        key={lead.id || `${lead.phone}-${lead.createdAt || ''}`}
                                        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                                    >
                                        <div className="space-y-3">
                                            {/* Header: Name and Status */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center justify-between gap-3 flex-1">
                                                    <h3 className="text-base font-semibold text-gray-900">
                                                        {lead.name || '—'}
                                                    </h3>
                                                    {!isConverted && (
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <button
                                                                onClick={() => handleEditClick(lead)}
                                                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                                                title="Edit lead"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleWhatsAppClick(lead.phone)}
                                                                className="text-green-600 hover:text-green-800 transition-colors"
                                                                title="Chat on WhatsApp"
                                                            >
                                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span
                                                        className={`text-xs font-medium whitespace-nowrap ${lead.status === 'New'
                                                            ? 'text-blue-600'
                                                            : lead.status === 'Converted'
                                                                ? 'text-red-600'
                                                                : (lead.status && lead.status.toLowerCase().includes('trial'))
                                                                    ? 'text-yellow-600'
                                                                    : 'text-gray-600'
                                                            }`}
                                                    >
                                                        {(lead.status && lead.status.toLowerCase().includes('trial')) ? 'Trial' : (lead.status || '—')}
                                                    </span>
                                                    {/* Real-time removed */}
                                                </div>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <div className="text-xs text-gray-500 mb-0.5">Phone</div>
                                                    <div className="text-gray-900 font-medium">{lead.phone || '—'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-500">Amount</div>
                                                    <div className="text-green-600 font-semibold">
                                                        {formatAmount(amount)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500 mb-0.5">Interest</div>
                                                    <div className="text-gray-900">{lead.leadType || lead.interest || '—'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500 mb-0.5">Source</div>
                                                    <div className="text-gray-900 truncate">{lead.leadSource || '—'}</div>
                                                </div>
                                                <div className="col-span-2">
                                                    <div className="text-xs text-gray-500 mb-0.5">Comments</div>
                                                    <div className="text-gray-900 text-sm break-words">
                                                        {hasConvertedAt ? 'Membership Created' : (lead.notes || '—')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}


                            {/* Mobile Pagination Controls */}
                            <div className="flex flex-row items-center justify-between gap-2 px-2 py-3 bg-white rounded-lg border border-gray-200">
                                <button
                                    onClick={handlePreviousPage}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${currentPage === 1
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    Previous
                                </button>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                                        Page <span className="font-semibold text-gray-900">{currentPage}</span> of <span className="font-semibold text-gray-900">{totalPages || 1}</span>
                                    </span>
                                </div>

                                <button
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${currentPage === totalPages || totalPages === 0
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingLead && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-5">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">Edit Lead</h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Lead Info */}
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                            <p className="text-sm text-gray-600">Name: <span className="font-semibold text-gray-900">{editingLead.name}</span></p>
                            <p className="text-sm text-gray-600">Phone: <span className="font-semibold text-gray-900">{editingLead.phone}</span></p>
                        </div>

                        {/* Lead Type Buttons */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Lead Type</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setLeadType('Hot'); setEditError(''); }}
                                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${leadType === 'Hot'
                                        ? 'bg-red-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Hot
                                </button>
                                <button
                                    onClick={() => { setLeadType('Warm'); setEditError(''); }}
                                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${leadType === 'Warm'
                                        ? 'bg-orange-500 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Warm
                                </button>
                                <button
                                    onClick={() => { setLeadType('Cold'); setEditError(''); }}
                                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${leadType === 'Cold'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Cold
                                </button>
                            </div>
                            {editError && (
                                <p className="mt-2 text-sm text-red-600">{editError}</p>
                            )}
                        </div>

                        {/* Comments Textarea */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Comments</label>
                            <textarea
                                value={editComments}
                                onChange={(e) => { setEditComments(e.target.value); setEditError(''); }}
                                rows={4}
                                placeholder="Add comments about this lead..."
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleCloseModal}
                                className="flex-1 py-2.5 px-4 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateLead}
                                className="flex-1 py-2.5 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md"
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyLead;
