// Helper utilities for plan code parsing and expiry date derivation.
const DEFAULT_PLAN_MAP = {
    // common shorthand -> months
    '1m': 1,
    '3m': 3,
    '6m': 6,
    '12m': 12,
    'monthly': 1,
    'quarterly': 3,
    'semiannual': 6,
    'annual': 12,
    'yearly': 12
};

const parsePlanCodeToMonths = (code) => {
    if (!code) return null;
    const raw = String(code).trim().toLowerCase();
    // direct mapping
    if (Object.prototype.hasOwnProperty.call(DEFAULT_PLAN_MAP, raw)) {
        return DEFAULT_PLAN_MAP[raw];
    }
    // numeric months like '3m' or '12m'
    const mMatch = raw.match(/^(\d+)\s*m(?:onth)?s?$/);
    if (mMatch) return Number.parseInt(mMatch[1], 10);
    // numeric years like '1y' or '2y'
    const yMatch = raw.match(/^(\d+)\s*y(?:ear)?s?$/);
    if (yMatch) return Number.parseInt(yMatch[1], 10) * 12;
    // unknown code
    return null;
};

const addMonthsToIso = (isoDate, months) => {
    if (!isoDate || !months) return null;
    const base = new Date(isoDate);
    if (Number.isNaN(base.getTime())) return null;
    const result = new Date(base.getTime());
    result.setMonth(result.getMonth() + months);
    return result.toISOString();
};

const deriveExpiryIso = (lead = {}) => {
    // prefer explicit fields
    const explicit = lead.expiryDate || lead.endDate || lead.membership?.endDate || null;
    if (explicit) return explicit;
    // determine join date
    const joinIso = lead.membership?.startDate || lead.convertedAt || lead.createdAt || null;
    if (!joinIso) return null;
    // determine plan code from membership or lead fields
    const planCode = (lead.membership?.planCode || lead.plan || lead.planCode || '')?.toString() || '';
    const months = parsePlanCodeToMonths(planCode);
    if (!months) return null;
    return addMonthsToIso(joinIso, months);
};

module.exports = {
    parsePlanCodeToMonths,
    deriveExpiryIso,
    addMonthsToIso
};
