import { useEffect, useState } from 'react';
import { trainersApi } from '../../services/apiClient.js';
import Loader from '../../components/common/Loader.jsx';
import InlineMessage from '../../components/common/InlineMessage.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

const blankForm = {
    name: '',
    specialty: '',
    experienceYears: '',
    email: '',
    phone: ''
};

function TrainersPage() {
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [formState, setFormState] = useState(blankForm);
    const [editingId, setEditingId] = useState(null);
    const [pending, setPending] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 7;

    const totalPages = Math.ceil(trainers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentTrainers = trainers.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    const loadTrainers = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await trainersApi.list();
            setTrainers(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTrainers();
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
        setEditingId(null);
        setFormError('');
        setShowModal(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError('');

        if (!formState.name.trim()) {
            setFormError('Name is required.');
            return;
        }

        setPending(true);

        const payload = {
            name: formState.name.trim(),
            specialty: formState.specialty.trim(),
            email: formState.email.trim(),
            phone: formState.phone.trim()
        };

        if (formState.experienceYears !== '') {
            const parsed = Number(formState.experienceYears);
            if (Number.isFinite(parsed)) {
                payload.experienceYears = parsed;
            }
        }

        try {
            if (editingId) {
                await trainersApi.update(editingId, payload);
            } else {
                await trainersApi.create(payload);
            }
            await loadTrainers();
            resetForm();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setPending(false);
        }
    };

    const startEditing = (trainer) => {
        setEditingId(trainer.id);
        setFormState({
            name: trainer.name || '',
            specialty: trainer.specialty || '',
            experienceYears: trainer.experienceYears ?? '',
            email: trainer.email || '',
            phone: trainer.phone || ''
        });
        setFormError('');
        setShowModal(true);
    };

    const handleDelete = async (trainer) => {
        const approved = window.confirm(`Remove trainer "${trainer.name}"?`);
        if (!approved) {
            return;
        }
        setPending(true);
        try {
            await trainersApi.remove(trainer.id);
            await loadTrainers();
            if (editingId === trainer.id) {
                resetForm();
            }
        } catch (err) {
            setFormError(err.message);
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="page">
            <section className="card">
                <div className="card__header">
                    <h2>Trainer directory</h2>
                    <div className="card__header-actions">
                        <button
                            type="button"
                            className="button"
                            onClick={() => {
                                setEditingId(null);
                                setFormState(blankForm);
                                setFormError('');
                                setShowModal(true);
                            }}
                        >
                            Add
                        </button>
                        <button
                            type="button"
                            className="button button--ghost"
                            onClick={loadTrainers}
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
                    ) : trainers.length === 0 ? (
                        <EmptyState
                            title="No trainers listed"
                            message="Add a trainer to populate the staff directory."
                        />
                    ) : (
                        <div>
                            <div className="table-wrapper w-full overflow-x-auto">
                                <table className="data-table min-w-full">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Specialty</th>
                                            <th>Experience</th>
                                            <th>Email</th>
                                            <th>Phone</th>
                                            <th aria-label="Actions" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentTrainers.map((trainer) => (
                                            <tr key={trainer.id}>
                                                <td>{trainer.name}</td>
                                                <td>{trainer.specialty || '-'}</td>
                                                <td>{trainer.experienceYears ? `${trainer.experienceYears} yrs` : '-'}</td>
                                                <td>{trainer.email || '-'}</td>
                                                <td>{trainer.phone || '-'}</td>
                                                <td className="table-actions">
                                                    <button
                                                        type="button"
                                                        className="button button--ghost"
                                                        onClick={() => startEditing(trainer)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="button button--danger"
                                                        onClick={() => handleDelete(trainer)}
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
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2>{editingId ? 'Edit trainer' : 'Add trainer'}</h2>
                            <button type="button" className="modal__close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="modal__body">
                            {formError ? <InlineMessage tone="danger">{formError}</InlineMessage> : null}
                            <form className="form" onSubmit={handleSubmit}>
                                <label className="field">
                                    <span>Name</span>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formState.name}
                                        onChange={handleChange}
                                        placeholder="Full name"
                                        required
                                    />
                                </label>
                                <label className="field">
                                    <span>Specialty</span>
                                    <input
                                        type="text"
                                        name="specialty"
                                        value={formState.specialty}
                                        onChange={handleChange}
                                        placeholder="e.g. Strength coach"
                                    />
                                </label>
                                <label className="field">
                                    <span>Experience (years)</span>
                                    <input
                                        type="number"
                                        name="experienceYears"
                                        value={formState.experienceYears}
                                        onChange={handleChange}
                                        min="0"
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
                                    <span>Phone</span>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formState.phone}
                                        onChange={handleChange}
                                        placeholder="123-456-7890"
                                    />
                                </label>
                                <div className="form__actions">
                                    <button type="button" className="button button--ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="button" disabled={pending}>
                                        {editingId ? 'Save changes' : 'Add trainer'}
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

export default TrainersPage;
