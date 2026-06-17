import React, { useEffect, useMemo, useState } from 'react';

const MembershipActions = ({
    leadEntries = [],
    highlightedNumber = '',
    onAddLeadEntry = () => { },
    onStartTrial = () => { },
    onRecordLead = () => { },
    onDismissLead = () => { },
    onOpenRecordPitch = () => { },
    onClose = () => { },
    isVisible = false,
}) => {
    const primaryEntry = useMemo(() => {
        if (!Array.isArray(leadEntries) || leadEntries.length === 0) {
            return null;
        }
        return leadEntries[0];
    }, [leadEntries]);

    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isVisible) {
            setName('');
            setContact('');
            setError('');
            return;
        }

        if (primaryEntry) {
            setContact(primaryEntry.display || primaryEntry.normalized || '');
            // Auto-fill name if it exists in the lead entry
            if (primaryEntry.name && primaryEntry.name !== 'Unknown') {
                setName(primaryEntry.name);
            }
        } else if (highlightedNumber) {
            setContact(highlightedNumber);
        }
    }, [isVisible, primaryEntry, highlightedNumber]);

    const dismissCurrentEntry = (normalizedValue) => {
        if (normalizedValue) {
            onDismissLead(normalizedValue);
        } else if (primaryEntry?.normalized) {
            onDismissLead(primaryEntry.normalized);
        }
    };

    const capitalizeFirst = (value = '') => {
        if (!value) {
            return '';
        }
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const handleAction = (action) => {
        const trimmedName = name.trim();
        const trimmedContact = contact.trim();

        if (!trimmedName) {
            setError('Please enter the member name.');
            return { success: false };
        }

        if (!trimmedContact) {
            setError('Please enter a contact number.');
            return { success: false };
        }

        setError('');

        const { normalized } = onAddLeadEntry(trimmedContact);

        if (trimmedName && typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(
                new CustomEvent('membership:contact-details', {
                    detail: {
                        phone: trimmedContact,
                        name: trimmedName,
                    },
                }),
            );
        }

        if (action === 'record') {
            // onRecordLead(trimmedContact);
        }

        dismissCurrentEntry(normalized);
        setName('');
        setContact('');
        return {
            success: true,
            payload: {
                name: capitalizeFirst(trimmedName),
                contact: trimmedContact
            }
        };
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAction('record');
        }
    };

    if (!isVisible) {
        return null;
    }

    return (
        <section className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-black p-8 text-gray-100 shadow-2xl shadow-slate-950/40 md:w-2/5">
            <span className="pointer-events-none absolute -top-16 right-10 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" aria-hidden="true" />
            <header className="relative flex flex-col gap-3 text-center">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-0 right-0 text-slate-400 hover:text-white transition"
                    aria-label="Close"
                >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <p className="mx-auto w-fit rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-blue-200">Membership Desk</p>
                <h2 className="text-2xl font-semibold text-white">Create a trial or record a lead</h2>
                <p className="text-sm text-slate-300/80">Log visitor details quickly and choose the next best action for your team.</p>
            </header>

            <form className="mt-8 space-y-7" onSubmit={(event) => event.preventDefault()}>
                <div className="flex flex-col gap-6">
                    <label className="flex w-full flex-col gap-2 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Name</span>
                        <input
                            type="text"
                            value={name}
                            onChange={(event) => setName(capitalizeFirst(event.target.value))}
                            placeholder="Member name"
                            className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/70 px-4 py-3 text-base text-white placeholder-slate-500 shadow-inner shadow-slate-950/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                    </label>
                    <label className="flex w-full flex-col gap-2 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contact Number</span>
                        <input
                            type="tel"
                            inputMode="tel"
                            value={contact}
                            onChange={(event) => setContact(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter mobile number"
                            className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/70 px-4 py-3 text-base text-white placeholder-slate-500 shadow-inner shadow-slate-950/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                    </label>
                </div>

                {error && <p className="text-center text-sm font-medium text-rose-300">{error}</p>}

                <div className="flex flex-wrap justify-center gap-4">
                    <button
                        type="button"
                        onClick={() => {
                            const result = handleAction('record');
                            if (result?.success) {
                                onOpenRecordPitch(result.payload);
                            }
                        }}
                        className="w-full min-w-[150px] rounded-2xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
                    >
                        Record
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const result = handleAction('trial');
                            if (result?.success) {
                                onStartTrial(result.payload);
                            }
                        }}
                        className="w-full min-w-[150px] rounded-2xl border border-blue-400/70 bg-transparent px-6 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/10"
                    >
                        Trial
                    </button>
                    {primaryEntry && (
                        <button
                            type="button"
                            onClick={() => dismissCurrentEntry(primaryEntry.normalized)}
                            className="w-full min-w-[150px] rounded-2xl border border-slate-700/80 bg-transparent px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            </form>
        </section>
    );
};

export default MembershipActions;
