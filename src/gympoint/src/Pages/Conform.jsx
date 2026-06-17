import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PLAN_BENEFITS, getPlanDetails } from '../data/membershipPlans';
import { membershipsService } from '../services/modules/memberships';

const PAYMENT_OPTIONS = [
    { value: 'upi', label: 'UPI' },
    { value: 'cash', label: 'Cash' },
    { value: 'credit-card', label: 'Credit Card' }
];

const CheckIcon = ({ className = '' }) => (
    <svg className={`h-4 w-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const Conform = ({
    leadDetails = {},
    onBack = () => { },
    onCreateMembership = () => { }
}) => {
    console.log('Conform rendering with leadDetails:', leadDetails);

    const [backendPlans, setBackendPlans] = useState([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);

    // Fetch backend pricing when component loads
    useEffect(() => {
        const fetchBackendPricing = async () => {
            if (!leadDetails.planCategory) return;

            setIsLoadingPlans(true);
            try {
                const plans = await membershipsService.list(leadDetails.planCategory);
                setBackendPlans(Array.isArray(plans) ? plans : []);
            } catch (error) {
                console.error('Failed to fetch backend pricing:', error);
                setBackendPlans([]);
            } finally {
                setIsLoadingPlans(false);
            }
        };

        fetchBackendPricing();
    }, [leadDetails.planCategory]);

    const planInfo = useMemo(() => {
        // First try to get pricing from backend plans
        const backendPlan = backendPlans.find(plan => {
            const backendLabel = plan.label?.toLowerCase() || '';
            const frontendLabel = leadDetails.planLabel?.toLowerCase() || '';
            const planCode = leadDetails.plan?.toLowerCase() || '';

            // Match by removing "premium" suffix and comparing
            const normalizedBackend = backendLabel.replace(/\s+premium$/, '').trim();
            const normalizedFrontend = frontendLabel.replace(/\s+premium$/, '').trim();

            return normalizedBackend === normalizedFrontend ||
                backendLabel.includes(planCode.replace('m', ' month')) ||
                backendLabel.includes(frontendLabel);
        });

        if (backendPlan) {
            const category = leadDetails.planCategory || 'premium';
            return {
                ...backendPlan,
                label: leadDetails.planLabel || backendPlan.label,
                price: backendPlan.price,
                category,
                benefits: PLAN_BENEFITS[category] || backendPlan.benefits || []
            };
        }

        // Fallback to passed planPrice or static data
        const base = getPlanDetails(leadDetails.plan, leadDetails.planCategory);
        const category = leadDetails.planCategory || base.category;
        return {
            ...base,
            label: leadDetails.planLabel || base.label,
            price: leadDetails.planPrice ?? base.price,
            category,
            benefits: PLAN_BENEFITS[category] || base.benefits
        };
    }, [leadDetails.plan, leadDetails.planCategory, leadDetails.planLabel, leadDetails.planPrice, backendPlans]);
    const today = useMemo(() => new Date().toISOString().split('T')[0], []);
    const isMountedRef = useRef(true);
    const [preferredDate, setPreferredDate] = useState(leadDetails.preferredDate || today);
    const [paymentMode, setPaymentMode] = useState(leadDetails.paymentMode || PAYMENT_OPTIONS[0].value);
    const [amount, setAmount] = useState(() => {
        if (leadDetails.amount) {
            return String(leadDetails.amount);
        }
        if (planInfo.price) {
            return String(planInfo.price);
        }
        return '';
    });
    const [notes, setNotes] = useState(leadDetails.remarks || '');
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    useEffect(() => () => {
        isMountedRef.current = false;
    }, []);

    const clearFieldError = (fieldName) => {
        setValidationErrors((prev) => {
            if (!prev[fieldName]) {
                return prev;
            }
            const next = { ...prev };
            delete next[fieldName];
            return next;
        });
    };

    useEffect(() => {
        setPreferredDate(leadDetails.preferredDate || today);
        setPaymentMode(leadDetails.paymentMode || PAYMENT_OPTIONS[0].value);
        if (leadDetails.amount) {
            setAmount(String(leadDetails.amount));
        } else if (planInfo.price && !isLoadingPlans) {
            setAmount(String(planInfo.price));
        } else {
            setAmount('');
        }
        setNotes(leadDetails.remarks || '');
        setStatusMessage('');
        setErrorMessage('');
        setValidationErrors({});
    }, [leadDetails, planInfo.price, today, isLoadingPlans]);

    const validateForm = () => {
        const errors = {};
        if (!leadDetails.plan && !planInfo.code) {
            errors.plan = 'Plan details are missing. Return to the record page to select a plan.';
        }
        if (!preferredDate) {
            errors.preferredDate = 'Select a preferred start date.';
        }
        if (!paymentMode) {
            errors.paymentMode = 'Choose a payment mode.';
        }
        const numericAmount = Number(amount);
        if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
            errors.amount = 'Enter a valid membership amount.';
        }
        return errors;
    };

    const handleCreateMembership = async (event) => {
        event.preventDefault();

        const errors = validateForm();
        if (Object.keys(errors).length) {
            setValidationErrors(errors);
            setErrorMessage('Please fix the highlighted fields.');
            setStatusMessage('');
            return;
        }

        setErrorMessage('');
        setValidationErrors({});
        setIsSubmitting(true);

        try {
            const payload = {
                name: leadDetails.name,
                phone: leadDetails.phone,
                email: leadDetails.email || '',
                plan: leadDetails.plan || planInfo.code,
                planLabel: planInfo.label,
                planCategory: planInfo.category,
                planPrice: planInfo.price ?? Number(amount),
                amount: Number(amount),
                preferredDate,
                paymentMode,
                remarks: notes.trim(),
                leadSource: leadDetails.leadSource || '',
                interest: leadDetails.interest || '',
                pitchDate: leadDetails.pitchDate || '',
                planBenefits: planInfo.benefits || []
            };

            await Promise.resolve(onCreateMembership(payload));
            // Alert is now handled in onCreateMembership
        } catch (error) {
            setErrorMessage(error?.message || 'Unable to create membership right now.');
        } finally {
            if (isMountedRef.current) {
                setIsSubmitting(false);
            }
        }
    };

    const planCategoryDisplay = planInfo.category === 'premium' ? 'Premium Membership' : 'Normal Membership';

    return (
        <div className="min-h-screen bg-black px-4 py-6 sm:px-6 lg:px-10">
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
                <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-400">Membership Setup</p>
                        <h1 className="mt-2 text-3xl font-semibold text-white">Selected Plan</h1>
                        <p className="mt-1 text-sm text-gray-300/80">Review the plan benefits and capture payment details for {leadDetails.name || 'this member'}.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onBack}
                        className="rounded-full border border-gray-700/80 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-blue-500 hover:text-white"
                    >
                        Back
                    </button>
                </header>

                <section className="rounded-3xl border border-gray-800 bg-gray-900/80 p-6 text-gray-100 shadow-2xl shadow-gray-950/40">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="text-2xl font-semibold text-white">{planInfo.label}</h2>
                            {isLoadingPlans ? (
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                                    <p className="text-sm text-blue-400">Loading pricing...</p>
                                </div>
                            ) : planInfo.price ? (
                                <p className="mt-2 text-lg font-medium text-blue-200">Rs {Number(planInfo.price).toLocaleString('en-IN')}</p>
                            ) : (
                                <p className="mt-2 text-sm text-gray-300">Custom pricing to be confirmed.</p>
                            )}
                        </div>
                        <div className="rounded-2xl border border-blue-400/40 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                            {planCategoryDisplay}
                        </div>
                    </div>

                    {validationErrors.plan && (
                        <p className="mt-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
                            {validationErrors.plan}
                        </p>
                    )}

                    <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-gray-400">Member</dt>
                            <dd className="text-base font-medium text-white">{leadDetails.name || 'Not provided'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-gray-400">Contact</dt>
                            <dd className="text-base font-medium text-gray-200">{leadDetails.phone || 'Not provided'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-gray-400">Email</dt>
                            <dd className="text-base font-medium text-gray-200">{leadDetails.email || 'Not provided'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-gray-400">Interest Level</dt>
                            <dd className="text-base font-medium text-gray-200">{leadDetails.interest || 'Not captured'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-gray-400">Plan Type</dt>
                            <dd className="text-base font-medium text-gray-200">{planInfo.category === 'premium' ? 'Premium' : 'Normal'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-gray-400">Plan Duration</dt>
                            <dd className="text-base font-medium text-gray-200">{planInfo.label || 'Not captured'}</dd>
                        </div>
                    </dl>

                    <div className="mt-6 rounded-2xl border border-gray-800 bg-black/70 p-5">
                        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400">Plan Benefits</h3>
                        <ul className="mt-4 space-y-3 text-sm text-gray-200">
                            {(planInfo.benefits || []).map((benefit) => (
                                <li key={benefit} className="flex items-start gap-3">
                                    <CheckIcon className="mt-1 text-blue-300" />
                                    <span>{benefit}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <form
                    onSubmit={handleCreateMembership}
                    className="space-y-6 rounded-3xl border border-gray-800 bg-gray-900/70 p-6 text-white shadow-2xl shadow-black/30"
                >
                    <div className="grid gap-5 sm:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Preferred Start Date</span>
                            <div className="relative">
                                <input
                                    type="date"
                                    name="preferredDate"
                                    value={preferredDate}
                                    onChange={(event) => {
                                        clearFieldError('preferredDate');
                                        setPreferredDate(event.target.value);
                                    }}
                                    min={today}
                                    className={`w-full rounded-xl border bg-black/80 px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${validationErrors.preferredDate ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/30' : 'border-gray-700 focus:border-blue-500'}`}
                                    required
                                />
                                <svg
                                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                            </div>
                            {validationErrors.preferredDate && (
                                <p className="text-xs text-rose-300">{validationErrors.preferredDate}</p>
                            )}
                        </label>

                        <label className="flex flex-col gap-2 text-sm">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Payment Mode</span>
                            <select
                                name="paymentMode"
                                value={paymentMode}
                                onChange={(event) => {
                                    clearFieldError('paymentMode');
                                    setPaymentMode(event.target.value);
                                }}
                                className={`rounded-xl border bg-black/80 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${validationErrors.paymentMode ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/30' : 'border-gray-700 focus:border-blue-500'}`}
                                required
                            >
                                {PAYMENT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {validationErrors.paymentMode && (
                                <p className="text-xs text-rose-300">{validationErrors.paymentMode}</p>
                            )}
                        </label>
                    </div>

                    <label className="flex flex-col gap-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Membership Amount (Rs)</span>
                        <input
                            type="number"
                            name="amount"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(event) => {
                                clearFieldError('amount');
                                setAmount(event.target.value);
                            }}
                            placeholder="Enter payment amount"
                            className={`rounded-xl border bg-black/80 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${validationErrors.amount ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/30' : 'border-gray-700 focus:border-blue-500'}`}
                            required
                        />
                        {validationErrors.amount && (
                            <p className="text-xs text-rose-300">{validationErrors.amount}</p>
                        )}
                    </label>

                    <label className="flex flex-col gap-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Additional Notes</span>
                        <textarea
                            name="notes"
                            rows={4}
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Add onboarding notes or perks to include"
                            className="rounded-2xl border border-gray-700 bg-black/80 px-4 py-3 text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                    </label>

                    {(statusMessage || errorMessage) && (
                        <div>
                            {statusMessage && (
                                <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                                    {statusMessage}
                                </p>
                            )}
                            {errorMessage && (
                                <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
                                    {errorMessage}
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full rounded-2xl px-6 py-3 text-sm font-semibold shadow-lg shadow-blue-500/30 transition ${isSubmitting ? 'cursor-not-allowed bg-blue-400/60 text-white' : 'bg-blue-500 text-white hover:bg-blue-400'}`}
                    >
                        {isSubmitting ? 'Creating Membership…' : 'Create Membership'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Conform;
