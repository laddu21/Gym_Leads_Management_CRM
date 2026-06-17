import { useEffect, useState } from 'react';
import { pitchesApi } from '../../services/apiClient.js';
import Loader from '../../components/common/Loader.jsx';
import InlineMessage from '../../components/common/InlineMessage.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

const blankForm = {
    name: '',
    phone: '',
    email: '',
    leadSource: '',
    plan: '',
    interest: '',
    remarks: '',
    pitchDate: ''
};

function formatDateTime(isoString) {
    if (!isoString) {
        return '-';
    }
    try {
        const date = new Date(isoString);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch (error) {
        return isoString;
    }
}

function PitchesPage() {
    const [pitches, setPitches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [formState, setFormState] = useState(blankForm);
    const [filterDate, setFilterDate] = useState('');
    const [pending, setPending] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 7;

    const totalPages = Math.ceil(pitches.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPitches = pitches.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    const loadPitches = async (dateValue = filterDate) => {
        setLoading(true);
        setError('');
        try {
            const data = await pitchesApi.list(dateValue);
            setPitches(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPitches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormState((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const resetForm = () => {
        setFormState(blankForm);
        setFormError('');
        setShowModal(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError('');

        if (!formState.name.trim() || !formState.phone.trim()) {
            setFormError('Lead name and phone number are required.');
            return;
        }

        setPending(true);

        const payload = {
            name: formState.name.trim(),
            phone: formState.phone.trim(),
            email: formState.email.trim(),
            leadSource: formState.leadSource.trim(),
            plan: formState.plan.trim(),
            interest: formState.interest.trim(),
            remarks: formState.remarks.trim()
        };

        if (formState.pitchDate) {
            payload.pitchDate = formState.pitchDate;
        }

        try {
            await pitchesApi.create(payload);
            await loadPitches();
            resetForm();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setPending(false);
        }
    };

    const applyFilter = async (event) => {
        const value = event.target.value;
        setFilterDate(value);
        await loadPitches(value);
    };

    return (
        <div className="page">
            <section className="card">
                <div className="card__header">
                    <div>
                        <h2>Recorded pitches</h2>
                        <p className="card__subtitle">Log and review outreach touchpoints</p>
                    </div>
                    <div className="card__header-actions">
                        <button
                            type="button"
                            className="button"
                            onClick={() => {
                                setFormState(blankForm);
                                setFormError('');
                                setShowModal(true);
                            }}
                        >
                            Add
                        </button>
                        <label className="field field--inline">
                            <span>Filter by date</span>
                            <input type="date" value={filterDate} onChange={applyFilter} />
                        </label>
                        <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => loadPitches(filterDate)}
                            disabled={loading}
                        >
                            Refresh
                        </button>
                    </div>
                </div>
                <div className="card__body">
                    {error ? <InlineMessage tone="danger">{error}</InlineMessage> : null}
                    {loading ? (
                        <Loader />
                    ) : pitches.length === 0 ? (
                        <EmptyState
                            title="No pitches yet"
                            message="Use the form below to add your first pitch record."
                        />
                    ) : (
                        <div>
                            <div className="table-wrapper w-full overflow-x-auto">
                                <table className="data-table min-w-full">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Phone</th>
                                            <th>Email</th>
                                            <th>Lead source</th>
                                            <th>Plan</th>
                                            <th>Interest</th>
                                            <th>Date</th>
                                            <th>Recorded at</th>
                                            <th>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentPitches.map((pitch) => (
                                            <tr key={pitch.id}>
                                                <td>{pitch.name}</td>
                                                <td>{pitch.phone}</td>
                                                <td>{pitch.email || '-'}</td>
                                                <td>{pitch.leadSource || '-'}</td>
                                                <td>{pitch.plan || '-'}</td>
                                                <td>{pitch.interest || '-'}</td>
                                                <td>{pitch.pitchDate || '-'}</td>
                                                <td>{formatDateTime(pitch.recordedAt)}</td>
                                                <td>{pitch.remarks || '-'}</td>
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
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2>Log a pitch</h2>
                            <button type="button" className="modal__close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="modal__body">
                            {formError ? <InlineMessage tone="danger">{formError}</InlineMessage> : null}
                            <form className="form form--grid" onSubmit={handleSubmit}>
                                <label className="field">
                                    <span>Lead name</span>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formState.name}
                                        onChange={handleChange}
                                        placeholder="Prospect name"
                                        required
                                    />
                                </label>
                                <label className="field">
                                    <span>Phone</span>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formState.phone}
                                        onChange={handleChange}
                                        placeholder="123-456-7890"
                                        required
                                    />
                                </label>
                                <label className="field">
                                    <span>Email</span>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formState.email}
                                        onChange={handleChange}
                                        placeholder="email@example.com"
                                    />
                                </label>
                                <label className="field">
                                    <span>Lead source</span>
                                    <input
                                        type="text"
                                        name="leadSource"
                                        value={formState.leadSource}
                                        onChange={handleChange}
                                        placeholder="Referral, Google Ads, ..."
                                    />
                                </label>
                                <label className="field">
                                    <span>Plan discussed</span>
                                    <input
                                        type="text"
                                        name="plan"
                                        value={formState.plan}
                                        onChange={handleChange}
                                        placeholder="Premium"
                                    />
                                </label>
                                <label className="field">
                                    <span>Interest level</span>
                                    <input
                                        type="text"
                                        name="interest"
                                        value={formState.interest}
                                        onChange={handleChange}
                                        placeholder="Hot, Warm, Cold"
                                    />
                                </label>
                                <label className="field">
                                    <span>Pitch date</span>
                                    <input
                                        type="date"
                                        name="pitchDate"
                                        value={formState.pitchDate}
                                        onChange={handleChange}
                                    />
                                </label>
                                <label className="field field--full">
                                    <span>Remarks</span>
                                    <textarea
                                        name="remarks"
                                        rows="3"
                                        value={formState.remarks}
                                        onChange={handleChange}
                                        placeholder="Notes from the conversation"
                                    />
                                </label>
                                <div className="form__actions">
                                    <button type="button" className="button button--ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="button" disabled={pending}>
                                        Save pitch
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PitchesPage;
