import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { membershipsService } from '../../services/modules/memberships';
import { configService } from '../../services/modules/config';

const FALLBACK_PREMIUM = [
    { label: '12 Months', price: 17499, original: 21999, tag: 'Save 20%' },
    { label: '6 Months', price: 9699, original: 11499 },
    { label: '3 Months', price: 5199, original: 6199 },
    { label: '1 Month', price: 1899, original: 2299 }
];

const CheckIcon = ({ className = '' }) => (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
);


const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `₹ ${n.toLocaleString('en-IN')}`;
};

const getDiscount = (plan) => {
    if (!plan || !plan.original) {
        return 0;
    }
    const discount = Math.max(plan.original - plan.price, 0);
    if (plan.original === 0) {
        return 0;
    }
    return Math.round((discount / plan.original) * 100);
};

const DEFAULT_BENEFITS = [
    'Unlimited access to all Normal Pass features',
    'Daily steam bath and sauna lounge',
    'Weekly recovery therapy session (ice or compression)',
    'Four personal training check-ins every month',
    'Custom nutrition and supplementation plans',
    'Unlimited group classes including HIIT, spin, and yoga'
];

const Packages = ({ onPurchase = () => { }, onRecordPitch = () => { } }) => {
    const [premiumPlans, setPremiumPlans] = useState(FALLBACK_PREMIUM);
    const [selectedPremiumPlan, setSelectedPremiumPlan] = useState(FALLBACK_PREMIUM[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [benefits, setBenefits] = useState(DEFAULT_BENEFITS);

    const loadPlans = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const premium = await membershipsService.list('premium');

            const mapPlan = (plan) => ({
                ...plan,
                original: typeof plan.original === 'number' ? plan.original : null,
                tag: plan.tag || null
            });

            const safePremium = Array.isArray(premium) && premium.length ? premium.map(mapPlan) : FALLBACK_PREMIUM;

            setPremiumPlans(safePremium);
            setSelectedPremiumPlan(safePremium[0]);

            // Load benefits in parallel (non-blocking for pricing)
            try {
                const items = await configService.getBenefits('premium');
                setBenefits(items.length ? items : DEFAULT_BENEFITS);
            } catch (e) {
                setBenefits(DEFAULT_BENEFITS);
            }
        } catch (error) {
            setPremiumPlans(FALLBACK_PREMIUM);
            setSelectedPremiumPlan(FALLBACK_PREMIUM[0]);
            setErrorMessage(`Unable to load latest membership pricing. Showing saved defaults. (${error.message})`);
            console.error('Failed to load memberships', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPlans();
    }, [loadPlans]);

    // Listen for admin changes via localStorage and BroadcastChannel so pricing updates are reflected immediately
    useEffect(() => {
        const handleStorage = (event) => {
            if (event?.key === 'gym-admin-plans-updated') {
                loadPlans();
            }
        };

        let bc = null;
        if (typeof window !== 'undefined' && window.BroadcastChannel) {
            bc = new BroadcastChannel('gym-plans-sync');
            bc.onmessage = (ev) => {
                if (ev?.data?.type === 'plans-updated') loadPlans();
            };
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('storage', handleStorage);
        }

        return () => {
            if (bc) bc.close();
            if (typeof window !== 'undefined') {
                window.removeEventListener('storage', handleStorage);
            }
        };
    }, [loadPlans]);

    useEffect(() => {
        window.addEventListener('focus', loadPlans);
        return () => window.removeEventListener('focus', loadPlans);
    }, [loadPlans]);

    const premiumDiscount = useMemo(() => getDiscount(selectedPremiumPlan), [selectedPremiumPlan]);
    return (
        <div className="min-h-screen bg-slate-950 text-gray-100 py-10 px-4 sm:px-6 lg:px-10">
            <div className="max-w-6xl mx-auto space-y-10">
                <section className="space-y-10">
                    <div className="text-center">
                        <p className="text-sm uppercase tracking-[0.35em] text-blue-400">Memberships</p>
                        <h1 className="mt-3 text-3xl sm:text-4xl font-semibold text-white">Choose your Premium pass and start training today</h1>
                        <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
                            Unlock all-access training with coaching, recovery, and luxury amenities.
                        </p>
                        {errorMessage && (
                            <p className="mt-4 text-sm text-amber-400">{errorMessage}</p>
                        )}
                        {isLoading && (
                            <div className="mt-6 flex justify-center items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                                <p className="text-sm text-blue-400">Refreshing pricing...</p>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-8 lg:grid-cols-1">
                        <div className="relative bg-gradient-to-br from-blue-600/10 via-blue-500/10 to-slate-900/80 rounded-3xl border border-blue-500/40 shadow-xl overflow-hidden lg:w-4/5 lg:mx-auto">
                            <div className="absolute top-6 right-6 text-xs font-semibold tracking-wide text-blue-100 bg-blue-500 px-4 py-1 rounded-full">Premium</div>
                            <div className="absolute inset-0 pointer-events-none opacity-40">
                                <div className="absolute -top-32 -right-20 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl" />
                                <div className="absolute -bottom-20 -left-10 w-52 h-52 rounded-full bg-purple-500/20 blur-3xl" />
                            </div>
                            <div className="relative p-8 sm:p-10 flex flex-col h-full">
                                <div>
                                    <h2 className="text-2xl font-semibold text-white">Premium Pass</h2>
                                    <p className="mt-3 text-gray-200">All-access transformation plan with coaching, recovery, and luxury amenities.</p>
                                    <div className="mt-6 flex flex-wrap items-end gap-3">
                                        <span className="text-4xl font-bold text-white">{formatCurrency(selectedPremiumPlan.price)}</span>
                                        {premiumDiscount > 0 && (
                                            <span className="text-sm text-gray-300 line-through">{formatCurrency(selectedPremiumPlan.original)}</span>
                                        )}
                                        {premiumDiscount > 0 && (
                                            <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full">{premiumDiscount}% OFF</span>
                                        )}
                                    </div>
                                    <p className="mt-2 text-xs text-gray-300">Includes one complimentary personal training session.</p>
                                </div>

                                <div className="mt-8">
                                    <h3 className="text-sm font-semibold uppercase tracking-widest text-blue-100">Duration Packages</h3>
                                    <div className="mt-5 space-y-4">
                                        {(isLoading ? [selectedPremiumPlan] : premiumPlans).map((plan) => {
                                            const discount = getDiscount(plan);
                                            const isSelected = plan.label === selectedPremiumPlan.label;
                                            return (
                                                <button
                                                    key={plan.label}
                                                    onClick={() => setSelectedPremiumPlan(plan)}
                                                    className={`w-full text-left border rounded-2xl p-5 transition-all duration-200 ${isSelected ? 'border-blue-400 bg-blue-500/20 shadow-lg shadow-blue-500/30' : 'border-blue-500/40 bg-blue-500/10 hover:border-blue-300/60'}`}
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs text-blue-100 uppercase tracking-wide">{plan.label}</p>
                                                            <div className="mt-2 flex flex-wrap items-baseline gap-3">
                                                                <span className="text-2xl font-semibold text-white">{formatCurrency(plan.price)}</span>
                                                                {discount > 0 && (
                                                                    <span className="text-sm text-blue-200/70 line-through">{formatCurrency(plan.original)}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {discount > 0 && (
                                                                <span className="inline-flex text-sm font-medium text-emerald-200 bg-emerald-500/20 px-3 py-1 rounded-full">{discount}% OFF</span>
                                                            )}
                                                            {plan.tag && (
                                                                <span className="inline-flex text-[11px] font-medium text-white bg-blue-500 px-3 py-1 rounded-full">
                                                                    {plan.tag}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mt-8">
                                    <h3 className="text-sm font-semibold uppercase tracking-widest text-blue-100">Premium Benefits</h3>
                                    <ul className="mt-4 space-y-3 text-sm text-blue-50">
                                        {benefits.map((benefit) => (
                                            <li key={benefit} className="flex items-start space-x-3">
                                                <CheckIcon className="text-blue-200 mt-1" />
                                                <span>{benefit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="mt-8">
                                    <button
                                        onClick={() => onPurchase('premium', selectedPremiumPlan)}
                                        className="w-full bg-blue-500 hover:bg-blue-400 transition-colors text-sm font-semibold text-white py-3 rounded-xl shadow-lg shadow-blue-500/30"
                                    >
                                        Buy Now
                                    </button>
                                    <p className="mt-3 text-xs text-blue-100/70 text-center">Save more with the 12 month plan and enjoy members-only events.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Packages;
