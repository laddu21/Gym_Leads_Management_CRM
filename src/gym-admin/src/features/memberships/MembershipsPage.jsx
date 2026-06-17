import { useEffect, useMemo, useState } from 'react';
import { membershipsApi, configApi, monthlyReportsApi } from '../../services/apiClient.js';
import Loader from '../../components/common/Loader.jsx';
import InlineMessage from '../../components/common/InlineMessage.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

const emptyForm = {
  category: 'Premium',
  label: '',
  price: '',
  original: '',
  tag: ''
};

function normalizeNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ACTION_LABELS = {
  create: 'Created',
  update: 'Updated',
  delete: 'Removed'
};

function formatActionLabel(action) {
  if (!action) {
    return '—';
  }
  return ACTION_LABELS[action] || action.charAt(0).toUpperCase() + action.slice(1);
}

function formatCurrencyValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  // Use Indian locale by default; fall back to user's locale
  try {
    return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(num) ? 0 : 2 })}`;
  } catch (err) {
    return `₹ ${num.toLocaleString()}`;
  }
}

function formatFieldName(field) {
  if (!field) {
    return '';
  }
  return field.charAt(0).toUpperCase() + field.slice(1);
}

function formatFieldValue(field, value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'number') {
    if (field === 'price' || field === 'original') {
      return formatCurrencyValue(value);
    }
    return value.toLocaleString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

function MembershipsPage() {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pending, setPending] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  // Premium benefits state
  const [benefits, setBenefits] = useState([]);
  const [benefitsText, setBenefitsText] = useState('');
  const [benefitsLoading, setBenefitsLoading] = useState(false);
  const [benefitsError, setBenefitsError] = useState('');
  const [benefitsSuccess, setBenefitsSuccess] = useState('');

  // ...existing code...

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPlans, setBulkPlans] = useState([
    { id: 'premium-1m', category: 'Premium', label: '1 Month Premium', price: 3500, selected: false },
    { id: 'premium-3m', category: 'Premium', label: '3 Months Premium', price: 6500, selected: false },
    { id: 'premium-6m', category: 'Premium', label: '6 Months Premium', price: 10500, selected: false },
    { id: 'premium-12m', category: 'Premium', label: '12 Months Premium', price: 16500, selected: false },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;
  const [historyPage, setHistoryPage] = useState(1);
  const historyItemsPerPage = 5;

  const loadMemberships = async (categoryValue = categoryFilter) => {
    setLoading(true);
    setError('');
    setHistoryError('');
    try {
      const [listResult, historyResult] = await Promise.allSettled([
        membershipsApi.list(categoryValue),
        membershipsApi.history(25)
      ]);

      if (listResult.status === 'fulfilled') {
        const data = Array.isArray(listResult.value) ? listResult.value : [];
        setMemberships(data);
        setLastSyncedAt(new Date().toISOString());
        // Reset to first page after any refresh so newest items are visible
        setCurrentPage(1);
      } else {
        const reason = listResult.reason;
        setMemberships([]);
        setLastSyncedAt(null);
        setError((reason && reason.message) || 'Failed to load membership plans.');
      }

      if (historyResult.status === 'fulfilled') {
        const historyData = Array.isArray(historyResult.value) ? historyResult.value : [];
        setHistory(historyData);
        setHistoryPage(1); // Reset to first page when history is refreshed
        setHistoryError('');
      } else {
        const reason = historyResult.reason;
        setHistory([]);
        setHistoryError((reason && reason.message) || 'Unable to load change history.');
      }
    } catch (err) {
      setMemberships([]);
      setHistory([]);
      setLastSyncedAt(null);
      setError(err.message);
      setHistoryError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCategoryFilter('Premium');
    loadMemberships('Premium');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Premium benefits
  const loadBenefits = async () => {
    setBenefitsLoading(true);
    setBenefitsError('');
    setBenefitsSuccess('');
    try {
      const res = await configApi.getBenefits('premium');
      const items = Array.isArray(res?.items) ? res.items : [];
      setBenefits(items);
      setBenefitsText(items.join('\n'));
    } catch (err) {
      setBenefits([]);
      setBenefitsText('');
      setBenefitsError(err.message || 'Failed to load premium benefits');
    } finally {
      setBenefitsLoading(false);
    }
  };

  useEffect(() => {
    loadBenefits();
  }, []);

  const uniqueCategories = useMemo(() => {
    const categories = memberships
      .map((plan) => plan.category)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return Array.from(new Set(categories));
  }, [memberships]);

  const totalPages = Math.ceil(memberships.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMemberships = memberships.slice(startIndex, endIndex);

  const historyTotalPages = Math.ceil(history.length / historyItemsPerPage);
  const historyStartIndex = (historyPage - 1) * historyItemsPerPage;
  const historyEndIndex = historyStartIndex + historyItemsPerPage;
  const currentHistory = history.slice(historyStartIndex, historyEndIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleHistoryPageChange = (page) => {
    setHistoryPage(page);
  };

  const handleClearHistory = async () => {
    const shouldClear = window.confirm('Are you sure you want to clear all history? This action cannot be undone.');
    if (!shouldClear) {
      return;
    }

    setPending(true);
    try {
      await membershipsApi.clearHistory();
      setHistory([]);
      setHistoryPage(1); // Reset to first page
      setHistoryError('');
    } catch (err) {
      setHistoryError(err.message || 'Failed to clear history.');
    } finally {
      setPending(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingId(null);
    setFormError('');
    setShowModal(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setPending(true);

    const payload = {
      category: 'Premium',
      label: formState.label.trim(),
      price: normalizeNumber(formState.price)
    };

    if (!payload.label || payload.price === null) {
      setFormError('Plan name and price are required.');
      setPending(false);
      return;
    }

    const original = normalizeNumber(formState.original);
    payload.original = original;

    if (formState.tag.trim()) {
      payload.tag = formState.tag.trim();
    }

    try {
      if (editingId) {
        await membershipsApi.update(editingId, payload);
      } else {
        await membershipsApi.create(payload);
      }
      await loadMemberships();
      resetForm();
      setShowModal(false);
      // Notify frontend about plan changes
      console.log('📤 Admin: Setting localStorage notification for plan changes');
      localStorage.setItem('gym-admin-plans-updated', Date.now().toString());

      // Also send BroadcastChannel message for more reliable cross-tab communication
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const channel = new BroadcastChannel('gym-plans-sync');
        channel.postMessage({ type: 'plans-updated', timestamp: Date.now() });
        channel.close();
        console.log('📡 Admin: Sent BroadcastChannel message');
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setPending(false);
    }
  };

  const startEditing = (plan) => {
    setEditingId(plan.id);
    setFormState({
      category: 'Premium',
      label: plan.label || '',
      price: plan.price ?? '',
      original: plan.original ?? '',
      tag: plan.tag || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleDelete = async (plan) => {
    const shouldDelete = window.confirm(`Delete membership "${plan.label}"?`);
    if (!shouldDelete) {
      return;
    }
    // Optimistic UI: remove from local list immediately, restore on failure
    const previous = memberships.slice();
    setMemberships((prev) => prev.filter((m) => m.id !== plan.id));
    if (editingId === plan.id) {
      resetForm();
    }

    setPending(true);
    setError('');
    try {
      await membershipsApi.remove(plan.id);
      // Refresh from server to get canonical ordering and timestamps
      await loadMemberships();

      // Notify frontend about plan changes
      console.log('📤 Admin: Setting localStorage notification for plan deletion');
      localStorage.setItem('gym-admin-plans-updated', Date.now().toString());

      // Also send BroadcastChannel message for more reliable cross-tab communication
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const channel = new BroadcastChannel('gym-plans-sync');
        channel.postMessage({ type: 'plans-updated', timestamp: Date.now() });
        channel.close();
        console.log('📡 Admin: Sent BroadcastChannel message for deletion');
      }
    } catch (err) {
      // Rollback optimistic update
      setMemberships(previous);
      setError(err.message || 'Failed to delete membership');
    } finally {
      setPending(false);
    }
  };

  const applyFilter = async (event) => {
    const value = event.target.value;
    setCategoryFilter(value);
    // Jump to the first page when applying a new filter
    setCurrentPage(1);
    await loadMemberships(value);
  };

  const handleBulkAddPlans = async () => {
    setShowBulkModal(true);
  };

  const handleBulkPlanToggle = (planId) => {
    setBulkPlans(prev => prev.map(plan =>
      plan.id === planId ? { ...plan, selected: !plan.selected } : plan
    ));
  };

  const handleBulkSubmit = async () => {
    const selectedPlans = bulkPlans.filter(plan => plan.selected);
    if (selectedPlans.length === 0) {
      alert('Please select at least one plan to add.');
      return;
    }

    setPending(true);
    let successCount = 0;
    let errorCount = 0;

    for (const plan of selectedPlans) {
      try {
        const { id, selected, ...planData } = plan; // Remove id and selected from payload
        await membershipsApi.create(planData);
        successCount++;
      } catch (error) {
        console.error(`Failed to add ${plan.label}:`, error.message);
        errorCount++;
      }
    }

    await loadMemberships();

    if (errorCount === 0) {
      alert(`Successfully added ${successCount} membership plans!`);
      setShowBulkModal(false);
      // Reset selections
      setBulkPlans(prev => prev.map(plan => ({ ...plan, selected: false })));
    } else {
      alert(`Added ${successCount} plans successfully, but ${errorCount} failed. Check console for details.`);
    }

    // Notify frontend about plan changes
    console.log('📤 Admin: Setting localStorage notification for bulk plan additions');
    localStorage.setItem('gym-admin-plans-updated', Date.now().toString());

    // Also send BroadcastChannel message for more reliable cross-tab communication
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      const channel = new BroadcastChannel('gym-plans-sync');
      channel.postMessage({ type: 'plans-updated', timestamp: Date.now() });
      channel.close();
      console.log('📡 Admin: Sent BroadcastChannel message for bulk additions');
    }

    setPending(false);
  };

  const handleBenefitsSave = async () => {
    setBenefitsError('');
    setBenefitsSuccess('');
    const items = benefitsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) {
      setBenefitsError('Please add at least one benefit.');
      return;
    }
    try {
      await configApi.setBenefits('premium', items);
      setBenefits(items);
      setBenefitsSuccess('Premium benefits updated');
      // Notify site to refresh (reuse existing key/channel)
      localStorage.setItem('gym-admin-plans-updated', Date.now().toString());
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const channel = new BroadcastChannel('gym-plans-sync');
        channel.postMessage({ type: 'plans-updated', timestamp: Date.now() });
        channel.close();
      }
    } catch (err) {
      setBenefitsError(err.message || 'Failed to update premium benefits');
    }
  };

  // ...existing code...

  const hasChangeEntries = (changes) => Boolean(changes && Object.keys(changes).length);

  const renderChangeValue = (field, change) => {
    if (!change) {
      return <span className="history-change-field__values">Updated</span>;
    }
    const hasFrom = Object.prototype.hasOwnProperty.call(change, 'from');
    const hasTo = Object.prototype.hasOwnProperty.call(change, 'to');
    const fromValue = hasFrom ? formatFieldValue(field, change.from) : null;
    const toValue = hasTo ? formatFieldValue(field, change.to) : null;

    if (hasFrom && hasTo) {
      return (
        <span className="history-change-field__values">
          <span>{fromValue}</span>
          <span className="history-change-field__arrow">→</span>
          <span>{toValue}</span>
        </span>
      );
    }

    if (hasTo) {
      return <span className="history-change-field__values">Set to {toValue}</span>;
    }

    if (hasFrom) {
      return <span className="history-change-field__values">Was {fromValue}</span>;
    }

    return <span className="history-change-field__values">Updated</span>;
  };

  return (
    <div className="page">
      <section className="card">
        <div className="card__header">
          <h2>Membership plans</h2>
          <div className="card__header-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={handleBulkAddPlans}
              disabled={pending}
            >
              {pending ? 'Adding...' : 'Add Plans'}
            </button>
            <label className="field field--inline">
              <span>Filter by category</span>
              <select value={categoryFilter} onChange={applyFilter}>
                <option value="Premium">Premium</option>
              </select>
            </label>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => loadMemberships(categoryFilter)}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
        {lastSyncedAt ? (
          <div className="w-full flex justify-center items-center mt-2">
            <span className="section-note">Synced {formatTimestamp(lastSyncedAt)}</span>
          </div>
        ) : null}
        <div className="card__body">
          {error ? <InlineMessage tone="danger">{error}</InlineMessage> : null}
          {loading ? (
            <Loader />
          ) : memberships.length === 0 ? (
            <EmptyState
              title="No plans yet"
              message="Use the form to add your first membership plan."
            />
          ) : (
            <div className="flex justify-center w-full">
              <div className="table-wrapper w-full overflow-x-auto">
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Original</th>
                      <th>Tag</th>
                      <th>Updated</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {currentMemberships.map((plan) => (
                      <tr key={plan.id}>
                        <td>{plan.label}</td>
                        <td>{plan.category}</td>
                        <td>{formatCurrencyValue(plan.price)}</td>
                        <td>{plan.original ? formatCurrencyValue(plan.original) : '-'}</td>
                        <td>{plan.tag || '-'}</td>
                        <td>{formatTimestamp(plan.updatedAt) || '-'}</td>
                        <td className="table-actions">
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => startEditing(plan)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button button--danger"
                            onClick={() => handleDelete(plan)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Premium benefits</h2>
            <p className="card__subtitle">Control the benefits list shown on the website Packages page</p>
          </div>
          <div className="card__header-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={loadBenefits}
              disabled={benefitsLoading}
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="card__body">
          {benefitsError ? <InlineMessage tone="danger">{benefitsError}</InlineMessage> : null}
          {benefitsSuccess ? <InlineMessage tone="success">{benefitsSuccess}</InlineMessage> : null}
          {benefitsLoading ? (
            <Loader />
          ) : (
            <div>
              <label className="field">
                <span>Benefits (one per line)</span>
                <textarea
                  rows={6}
                  value={benefitsText}
                  onChange={(e) => setBenefitsText(e.target.value)}
                  placeholder="Enter each benefit on a new line"
                />
              </label>
              <div className="form__actions">
                <button type="button" className="button" onClick={handleBenefitsSave}>Save benefits</button>
              </div>
              {benefits.length > 0 && (
                <div className="section-note">Preview ({benefits.length}): {benefits.join(' · ')}</div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ...existing code... */}


      {/* History block below all cards */}
      <div className="w-full max-w-3xl mx-auto mt-8 mb-8 bg-gray-50 rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">Price Change History</h2>
            <p className="text-xs text-gray-500">Every adjustment is logged with timestamps and before/after values</p>
          </div>
          <div className="flex gap-2 mt-2 sm:mt-0">
            <button
              type="button"
              className="button button--danger"
              onClick={handleClearHistory}
              disabled={pending || history.length === 0}
            >
              {pending ? 'Clearing...' : 'Clear History'}
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => loadMemberships(categoryFilter)}
              disabled={loading}
            >
              Refresh history
            </button>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          {historyError ? <InlineMessage tone="warning">{historyError}</InlineMessage> : null}
          {loading ? (
            <Loader />
          ) : history.length === 0 ? (
            <EmptyState
              title="No changes recorded"
              message="Plan edits will appear here in chronological order."
            />
          ) : (
            <>
              <table className="data-table data-table--compact min-w-full">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Plan</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {currentHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatTimestamp(entry.occurredAt) || '-'}</td>
                      <td>{entry.membershipLabel || '—'}</td>
                      <td>{formatActionLabel(entry.action)}</td>
                      <td>
                        {hasChangeEntries(entry.changes) ? (
                          <div className="history-changes">
                            {Object.entries(entry.changes).map(([field, change]) => (
                              <div key={field} className="history-change-field">
                                <span className="history-change-field__name">{formatFieldName(field)}</span>
                                {renderChangeValue(field, change)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="history-changes__empty">No field changes recorded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {historyTotalPages > 1 && (
                <div className="pagination mt-2">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => handleHistoryPageChange(historyPage - 1)}
                    disabled={historyPage === 1}
                  >
                    Previous
                  </button>
                  <span>Page {historyPage} of {historyTotalPages}</span>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => handleHistoryPageChange(historyPage + 1)}
                    disabled={historyPage === historyTotalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editingId ? 'Edit plan' : 'Add new plan'}</h2>
              <button type="button" className="modal__close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal__body">
              {formError ? <InlineMessage tone="danger">{formError}</InlineMessage> : null}
              <form className="form" onSubmit={handleSubmit}>
                <label className="field">
                  <span>Category</span>
                  <input
                    type="text"
                    name="category"
                    value="Premium"
                    disabled
                  />
                </label>
                <label className="field">
                  <span>Plan name</span>
                  <input
                    type="text"
                    name="label"
                    value={formState.label}
                    onChange={handleInputChange}
                    placeholder="e.g. Premium Plus"
                  />
                </label>
                <label className="field">
                  <span>Price</span>
                  <input
                    type="number"
                    name="price"
                    value={formState.price}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                  />
                </label>
                <label className="field">
                  <span>Original price (optional)</span>
                  <input
                    type="number"
                    name="original"
                    value={formState.original}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                  />
                </label>
                <label className="field">
                  <span>Tag (optional)</span>
                  <input
                    type="text"
                    name="tag"
                    value={formState.tag}
                    onChange={handleInputChange}
                    placeholder="e.g. Bestseller"
                  />
                </label>
                <div className="form__actions">
                  <button type="button" className="button button--ghost" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="button" disabled={pending}>
                    {editingId ? 'Save changes' : 'Create plan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal modal--large w-full sm:max-w-2xl mx-auto p-0" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>Bulk Add Membership Plans</h2>
              <button type="button" className="modal__close" onClick={() => setShowBulkModal(false)}>×</button>
            </div>
            <div className="modal__body">
              <p className="modal__description">Select the Premium membership plans you want to add.</p>

              <div className="bulk-plans-columns w-full flex flex-col sm:flex-row gap-0">
                <div className="bulk-plans-column w-full sm:w-full">
                  <h3 className="bulk-plans-column-title">Premium Plans</h3>
                  {bulkPlans.map((plan) => (
                    <div key={plan.id} className="bulk-plan-item w-full">
                      <label className="bulk-plan-checkbox">
                        <input
                          type="checkbox"
                          checked={plan.selected}
                          onChange={() => handleBulkPlanToggle(plan.id)}
                        />
                        <div className="bulk-plan-content">
                          <div className="bulk-plan-header">
                            <span className="bulk-plan-label">{plan.label}</span>
                            <span className={`bulk-plan-category ${plan.category.toLowerCase()}`}>
                              {plan.category}
                            </span>
                          </div>
                          <div className="bulk-plan-price">{formatCurrencyValue(plan.price)}</div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bulk-plans-summary">
                <p><strong>Selected: {bulkPlans.filter(p => p.selected).length} plans</strong></p>
              </div>

              <div className="form__actions">
                <button type="button" className="button button--ghost" onClick={() => setShowBulkModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="button"
                  onClick={handleBulkSubmit}
                  disabled={pending || bulkPlans.filter(p => p.selected).length === 0}
                >
                  {pending ? 'Adding Plans...' : `Add Selected Plans (${bulkPlans.filter(p => p.selected).length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MembershipsPage;
