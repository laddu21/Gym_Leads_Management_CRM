const NORMAL_PLAN_BENEFITS = [
    'Full gym floor access from 5 AM to 11 PM',
    'Locker and shower access',
    'Two group training classes every month',
    'Quarterly body composition assessment',
    'Access to cardio, strength, and functional zones'
];

const PREMIUM_PLAN_BENEFITS = [
    'Unlimited access to all Normal Pass features',
    'Daily steam bath and sauna lounge',
    'Weekly recovery therapy session (ice or compression)',
    'Four personal training check-ins every month',
    'Custom nutrition and supplementation plans',
    'Unlimited group classes including HIIT, spin, and yoga'
];

export const PLAN_CATALOG = {
    normal: {
        label: 'Normal Pass',
        defaultCode: '1m',
        pricing: {
            '1m': { label: '1 Month', price: 1399, original: 1599 },
            '3m': { label: '3 Months', price: 3499, original: 3999 },
            '6m': { label: '6 Months', price: 6299, original: 7299 },
            '12m': { label: '12 Months', price: 10999, original: 12999, tag: 'Best value' }
        },
        benefits: NORMAL_PLAN_BENEFITS
    },
    premium: {
        label: 'Premium Pass',
        defaultCode: '1m',
        pricing: {
            '1m': { label: '1 Month', price: 1899, original: 2299 },
            '3m': { label: '3 Months', price: 5199, original: 6199 },
            '6m': { label: '6 Months', price: 9699, original: 11499 },
            '12m': { label: '12 Months', price: 17499, original: 21999, tag: 'Save 20%' }
        },
        benefits: PREMIUM_PLAN_BENEFITS
    }
};

export const PLAN_BENEFITS = {
    normal: NORMAL_PLAN_BENEFITS,
    premium: PREMIUM_PLAN_BENEFITS
};

const CATALOG_KEYS = Object.keys(PLAN_CATALOG);

const findCatalogForCode = (planCode) => {
    const normalized = String(planCode || '').toLowerCase();
    for (const key of CATALOG_KEYS) {
        if (PLAN_CATALOG[key].pricing[normalized]) {
            return key;
        }
    }
    return null;
};

export const getPlanOptions = (category = 'normal') => {
    const catalogKey = PLAN_CATALOG[category] ? category : 'normal';
    const catalog = PLAN_CATALOG[catalogKey];
    return Object.entries(catalog.pricing).map(([code, meta]) => ({
        code,
        label: meta.label,
        price: meta.price,
        original: meta.original ?? null,
        tag: meta.tag ?? null
    }));
};

export const getDefaultPlanCode = (category = 'normal') => {
    const catalogKey = PLAN_CATALOG[category] ? category : 'normal';
    return PLAN_CATALOG[catalogKey].defaultCode;
};

export const getPlanDetails = (planCode = '', preferredCategory) => {
    const normalizedCode = String(planCode || '').toLowerCase();
    const inferredCategory = preferredCategory && PLAN_CATALOG[preferredCategory]
        ? preferredCategory
        : findCatalogForCode(normalizedCode) || 'normal';
    const catalog = PLAN_CATALOG[inferredCategory];
    const fallbackCatalog = inferredCategory === 'normal' ? PLAN_CATALOG.premium : PLAN_CATALOG.normal;
    const pricing = catalog.pricing[normalizedCode] || fallbackCatalog.pricing[normalizedCode] || null;
    const category = pricing && catalog.pricing[normalizedCode] ? inferredCategory : (pricing ? (inferredCategory === 'normal' ? 'premium' : 'normal') : inferredCategory);
    const effectiveCatalog = PLAN_CATALOG[category];
    const effectivePricing = pricing || null;

    return {
        code: normalizedCode || effectiveCatalog.defaultCode,
        category,
        label: effectivePricing?.label || (planCode || 'Custom Plan'),
        price: effectivePricing?.price ?? null,
        original: effectivePricing?.original ?? null,
        tag: effectivePricing?.tag ?? null,
        benefits: effectiveCatalog.benefits,
        catalogLabel: effectiveCatalog.label
    };
};
