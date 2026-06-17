import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { trainersService } from '../../../services/modules/trainers';

const FALLBACK_TRAINERS = [
    {
        id: 'fallback-1',
        name: 'Aisha Khan',
        specialty: 'General Trainer',
        experienceYears: 6,
        email: 'aisha.khan@gympoint.com',
        phone: '+1 555-0198',
        source: 'fallback'
    },
    {
        id: 'fallback-2',
        name: 'Michael Chen',
        specialty: 'Manager',
        experienceYears: 5,
        email: 'michael.chen@gympoint.com',
        phone: '+1 555-0173',
        source: 'fallback'
    },
    {
        id: 'fallback-3',
        name: 'Priya Patel',
        specialty: 'Personal Trainer',
        experienceYears: 8,
        email: 'priya.patel@gympoint.com',
        phone: '+1 555-0134',
        source: 'fallback'
    }
];

const EMPTY_FORM = {
    name: '',
    specialty: '',
    experienceYears: '',
    email: '',
    phone: ''
};

const EMPLOYEE_TYPES = ['Manager', 'General Trainer', 'Personal Trainer'];

const normalizeTrainer = (trainer) => ({
    id: trainer.id,
    name: trainer.name || 'Unnamed trainer',
    specialty: trainer.specialty || 'General Coach',
    experienceYears:
        typeof trainer.experienceYears === 'number' && Number.isFinite(trainer.experienceYears)
            ? trainer.experienceYears
            : null,
    email: trainer.email || '',
    phone: trainer.phone || '',
    source: 'api'
});

const formatExperience = (value) => {
    if (!Number.isFinite(value) || value < 0) {
        return '—';
    }
    const rounded = Math.round(value * 10) / 10;
    return `${rounded} yr${rounded === 1 ? '' : 's'}`;
};

function Employees() {
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState('all');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formState, setFormState] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [pending, setPending] = useState(false);

    const loadTrainers = useCallback(async () => {
        setLoading(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            const response = await trainersService.list();
            const normalized = Array.isArray(response)
                ? response
                    .map((trainer) => normalizeTrainer(trainer))
                    .filter((trainer) => Boolean(trainer.id))
                : [];

            setTrainers(normalized);
            if (normalized.length === 0) {
                setInfoMessage('No trainers published yet. Add them through Gym Admin to populate this view.');
            }
        } catch (error) {
            console.error('Failed to load trainers', error);
            setErrorMessage(`Unable to reach the trainer directory right now. Showing saved defaults. (${error.message})`);
            setInfoMessage('Connect to the Gym API to view the live trainer roster.');
            setTrainers(FALLBACK_TRAINERS);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTrainers();
    }, [loadTrainers]);

    useEffect(() => {
        window.addEventListener('focus', loadTrainers);
        return () => window.removeEventListener('focus', loadTrainers);
    }, [loadTrainers]);

    useEffect(() => {
        if (!isFormOpen || typeof document === 'undefined') {
            return undefined;
        }
        const { overflow } = document.body.style;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = overflow;
        };
    }, [isFormOpen]);

    const specialtyOptions = useMemo(() => {
        const items = trainers
            .map((trainer) => trainer.specialty)
            .filter((specialty) => Boolean(specialty) && specialty !== 'General Coach');
        return ['all', ...Array.from(new Set(items))];
    }, [trainers]);

    const filteredTrainers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return trainers.filter((trainer) => {
            if (specialtyFilter !== 'all' && trainer.specialty !== specialtyFilter) {
                return false;
            }
            if (!term) {
                return true;
            }
            return (
                trainer.name.toLowerCase().includes(term) ||
                trainer.specialty.toLowerCase().includes(term) ||
                trainer.email.toLowerCase().includes(term) ||
                trainer.phone.toLowerCase().includes(term)
            );
        });
    }, [trainers, searchTerm, specialtyFilter]);

    const stats = useMemo(() => {
        const total = trainers.length;
        const managerCount = trainers.filter((trainer) => {
            if (!trainer.specialty || typeof trainer.specialty !== 'string') {
                return false;
            }
            return trainer.specialty.toLowerCase().includes('manager');
        }).length;
        const generalCount = trainers.filter((trainer) => {
            if (!trainer.specialty || typeof trainer.specialty !== 'string') {
                return false;
            }
            return trainer.specialty.toLowerCase().includes('general');
        }).length;
        const personalCount = trainers.filter((trainer) => {
            if (!trainer.specialty || typeof trainer.specialty !== 'string') {
                return false;
            }
            return trainer.specialty.toLowerCase().includes('personal');
        }).length;

        return {
            total,
            managerCount,
            generalCount,
            personalCount
        };
    }, [trainers]);

    const handleOpenForm = () => {
        setIsFormOpen(true);
        setFormState(EMPTY_FORM);
        setFormError('');
        setEditingId(null);
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormState((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const resetForm = () => {
        setFormState(EMPTY_FORM);
        setFormError('');
        setEditingId(null);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        resetForm();
    };

    const handleEdit = (trainer) => {
        setIsFormOpen(true);
        setEditingId(trainer.id);
        setFormState({
            name: trainer.name || '',
            specialty: trainer.specialty || '',
            experienceYears: trainer.experienceYears ?? '',
            email: trainer.email || '',
            phone: trainer.phone || ''
        });
        setFormError('');
    };

    const handleDelete = async (trainer) => {
        if (trainer.source === 'fallback') {
            setFormError('Cannot delete fallback entries. Connect to the API to manage trainers.');
            return;
        }
        const approved = window.confirm(`Remove trainer "${trainer.name}" from the directory?`);
        if (!approved) {
            return;
        }
        setPending(true);
        setFormError('');
        try {
            await trainersService.remove(trainer.id);
            await loadTrainers();
            if (editingId === trainer.id) {
                handleCloseForm();
            }
        } catch (error) {
            console.error('Failed to remove trainer', error);
            setFormError(error.message || 'Unable to delete trainer. Try again later.');
        } finally {
            setPending(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError('');

        const payload = {
            name: formState.name.trim(),
            specialty: formState.specialty.trim(),
            email: formState.email.trim(),
            phone: formState.phone.trim()
        };

        if (!payload.name || !payload.phone) {
            setFormError('Trainer name and phone number are required.');
            return;
        }

        if (formState.experienceYears !== '') {
            const parsedExperience = Number(formState.experienceYears);
            if (Number.isFinite(parsedExperience) && parsedExperience >= 0) {
                payload.experienceYears = parsedExperience;
            } else {
                setFormError('Experience must be a positive number.');
                return;
            }
        }

        setPending(true);
        try {
            if (editingId) {
                await trainersService.update(editingId, payload);
            } else {
                await trainersService.create(payload);
            }
            await loadTrainers();
            handleCloseForm();
        } catch (error) {
            console.error('Failed to save trainer', error);
            setFormError(error.message || 'Unable to save trainer right now.');
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="space-y-6 px-2 sm:px-0">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">My Employees</h1>
                </div>
                <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
                    <button
                        type="button"
                        onClick={loadTrainers}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 sm:w-auto"
                        disabled={loading}
                    >
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenForm}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-blue-700 sm:w-auto"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        {editingId ? 'Edit Employee' : 'Add Employee'}
                    </button>
                </div>
            </div>

            {errorMessage ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{errorMessage}</p>
            ) : null}
            {infoMessage && !errorMessage ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-600">{infoMessage}</p>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                    <h2 className="text-sm font-medium text-gray-500">Total Employees</h2>
                    <p className="mt-3 text-3xl font-semibold text-gray-900">{stats.total}</p>
                    <p className="mt-1 text-xs text-gray-400">Active profiles synced from the API.</p>
                </article>
                <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                    <h2 className="text-sm font-medium text-gray-500">Managers</h2>
                    <p className="mt-3 text-3xl font-semibold text-gray-900">{stats.managerCount}</p>
                    <p className="mt-1 text-xs text-gray-400">Employees tagged as managers by specialty.</p>
                </article>
                <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                    <h2 className="text-sm font-medium text-gray-500">General Trainers</h2>
                    <p className="mt-3 text-3xl font-semibold text-gray-900">{stats.generalCount}</p>
                    <p className="mt-1 text-xs text-gray-400">Employees listed with a general specialty.</p>
                </article>
                <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                    <h2 className="text-sm font-medium text-gray-500">Personal Trainers</h2>
                    <p className="mt-3 text-3xl font-semibold text-gray-900">{stats.personalCount}</p>
                    <p className="mt-1 text-xs text-gray-400">Employees noted as personal trainers.</p>
                </article>
            </section>

            <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <header className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:gap-6">
                    <div className="w-full md:max-w-[320px]">
                        <label className="flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600 focus-within:border-blue-400">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M5 11a6 6 0 1112 0 6 6 0 01-12 0z" />
                            </svg>
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search trainers"
                                className="w-full border-none bg-transparent focus:outline-none"
                            />
                        </label>
                    </div>
                    <div className="w-full md:w-auto">
                        <select
                            value={specialtyFilter}
                            onChange={(event) => setSpecialtyFilter(event.target.value)}
                            className="w-full rounded-full border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                            {specialtyOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option === 'all' ? 'All employee types' : option}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="rounded-full bg-gray-100 px-4 py-1 text-center text-xs font-medium text-gray-600">
                        {filteredTrainers.length} Showing
                    </div>
                </header>

                <div className="hidden md:block">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100 text-left text-sm text-gray-700">
                            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Employee Type</th>
                                    <th className="px-4 py-3">Experience</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Phone</th>
                                    <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">Loading employees...</td>
                                    </tr>
                                ) : filteredTrainers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                                            {searchTerm || specialtyFilter !== 'all'
                                                ? 'No employees match the current filters.'
                                                : 'No employees available yet. Add them from Gym Admin to populate this table.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTrainers.map((trainer) => (
                                        <tr key={trainer.id} className="transition hover:bg-gray-50">
                                            <td className="px-4 py-4">
                                                <div className="font-medium text-gray-900">{trainer.name}</div>
                                                <p className="text-xs text-gray-500">{trainer.source === 'fallback' ? 'Sample data' : 'Synced'}</p>
                                            </td>
                                            <td className="px-4 py-4 text-gray-700">{trainer.specialty}</td>
                                            <td className="px-4 py-4 text-gray-700">{formatExperience(trainer.experienceYears)}</td>
                                            <td className="px-4 py-4 text-gray-700">{trainer.email || '—'}</td>
                                            <td className="px-4 py-4 text-gray-700">{trainer.phone || '—'}</td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-blue-400 hover:text-blue-600"
                                                        onClick={() => handleEdit(trainer)}
                                                        disabled={trainer.source === 'fallback'}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                                                        onClick={() => handleDelete(trainer)}
                                                        disabled={pending || trainer.source === 'fallback'}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="md:hidden border-t border-gray-100 px-4 py-4">
                    {loading ? (
                        <p className="py-6 text-center text-sm text-gray-500">Loading employees...</p>
                    ) : filteredTrainers.length === 0 ? (
                        <p className="py-6 text-center text-sm text-gray-500">
                            {searchTerm || specialtyFilter !== 'all'
                                ? 'No employees match the current filters.'
                                : 'No employees available yet. Add them from Gym Admin to populate this list.'}
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {filteredTrainers.map((trainer) => (
                                <article
                                    key={trainer.id}
                                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm shadow-gray-200/60"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-base font-semibold text-gray-900">{trainer.name}</h3>
                                            <p className="text-xs uppercase tracking-wide text-gray-400">
                                                {trainer.source === 'fallback' ? 'Sample data' : 'Synced employee'}
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                                            {trainer.specialty || 'General'}
                                        </span>
                                    </div>
                                    <dl className="mt-4 space-y-3 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <span className="w-24 text-xs font-semibold uppercase text-gray-400">Experience</span>
                                            <span>{formatExperience(trainer.experienceYears)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-semibold uppercase text-gray-400">Email</span>
                                            {trainer.email ? (
                                                <a
                                                    href={`mailto:${trainer.email}`}
                                                    className="text-gray-700 underline decoration-dotted underline-offset-4 hover:text-blue-600"
                                                >
                                                    {trainer.email}
                                                </a>
                                            ) : (
                                                <span className="text-gray-500">Not provided</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-semibold uppercase text-gray-400">Phone</span>
                                            {trainer.phone ? (
                                                <a
                                                    href={`tel:${trainer.phone}`}
                                                    className="text-gray-700 underline decoration-dotted underline-offset-4 hover:text-blue-600"
                                                >
                                                    {trainer.phone}
                                                </a>
                                            ) : (
                                                <span className="text-gray-500">Not provided</span>
                                            )}
                                        </div>
                                    </dl>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className="flex-1 min-w-[120px] rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-blue-400 hover:text-blue-600"
                                            onClick={() => handleEdit(trainer)}
                                            disabled={trainer.source === 'fallback'}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="flex-1 min-w-[120px] rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                            onClick={() => handleDelete(trainer)}
                                            disabled={pending || trainer.source === 'fallback'}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {isFormOpen ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                    onClick={handleCloseForm}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="employee-form-title"
                        className="w-full max-w-4xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <form
                            className="relative w-full bg-slate-900/95 border border-slate-800 shadow-2xl shadow-slate-950/60 rounded-3xl p-6 sm:p-8 text-slate-200"
                            onSubmit={handleSubmit}
                        >
                            <button
                                type="button"
                                onClick={handleCloseForm}
                                className="absolute top-4 right-4 text-slate-400 transition hover:text-slate-100"
                                title="Close form"
                                aria-label="Close employee form"
                            >
                                ×
                            </button>
                            <h2 id="employee-form-title" className="text-2xl font-semibold text-white">
                                {editingId ? 'Edit Employee' : 'Add Employee'}
                            </h2>
                            <p className="mt-1 text-xs text-slate-400">
                                Updates sync with the shared Gym API and appear instantly across Gym Admin and GymPoint.
                            </p>
                            {formError ? (
                                <p className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200" role="alert">
                                    {formError}
                                </p>
                            ) : null}
                            <div className="mt-6 grid gap-5 md:grid-cols-2">
                                <label className="flex flex-col text-sm font-medium text-slate-200">
                                    Full name
                                    <input
                                        type="text"
                                        name="name"
                                        value={formState.name}
                                        onChange={handleInputChange}
                                        placeholder="Coach name"
                                        required
                                        autoComplete="off"
                                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </label>
                                <label className="flex flex-col text-sm font-medium text-slate-200">
                                    Employee type
                                    <select
                                        name="specialty"
                                        value={formState.specialty}
                                        onChange={handleInputChange}
                                        required
                                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    >
                                        <option value="" disabled>
                                            Select type
                                        </option>
                                        {EMPLOYEE_TYPES.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                        {formState.specialty && !EMPLOYEE_TYPES.includes(formState.specialty) ? (
                                            <option value={formState.specialty}>{formState.specialty}</option>
                                        ) : null}
                                    </select>
                                </label>
                                <label className="flex flex-col text-sm font-medium text-slate-200">
                                    Experience (years)
                                    <input
                                        type="number"
                                        name="experienceYears"
                                        min="0"
                                        step="1"
                                        value={formState.experienceYears}
                                        onChange={handleInputChange}
                                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </label>
                                <label className="flex flex-col text-sm font-medium text-slate-200">
                                    Email
                                    <input
                                        type="email"
                                        name="email"
                                        value={formState.email}
                                        onChange={handleInputChange}
                                        placeholder="trainer@gympoint.com"
                                        autoComplete="off"
                                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </label>
                                <label className="flex flex-col text-sm font-medium text-slate-200">
                                    Phone
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formState.phone}
                                        onChange={handleInputChange}
                                        placeholder="+1 555-0100"
                                        required
                                        autoComplete="off"
                                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </label>
                            </div>
                            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                                <button
                                    type="button"
                                    onClick={handleCloseForm}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center rounded-xl bg-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
                                    disabled={pending}
                                >
                                    {pending ? 'Saving…' : editingId ? 'Save changes' : 'Add Employee'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default Employees;
