// Shared lead utilities: normalization, enhancement and preparation helpers
// Extracted from Members component to allow reuse across the app (Reports, Members, etc.)
const normalizePhone = (value = '') => String(value || '').replace(/\D/g, '');

const toIsoString = (value) => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
};

const toTimestamp = (value) => {
    const ts = new Date(value || '').getTime();
    return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
};

const sortLeadsByCreated = (dataset = []) =>
    [...dataset].sort((a, b) => toTimestamp(b?.createdAt) - toTimestamp(a?.createdAt));

const normalizeMembership = (membership = {}, lead = {}) => {
    const source = membership || {};
    const planLabel = source.planLabel || source.plan || lead.planLabel || lead.plan || lead.interest || null;
    const planCode = source.planCode || source.plan || null;
    const startDate = toIsoString(
        source.startDate || lead.startDate || lead.membershipStartDate,
    );
    const createdAt = toIsoString(source.createdAt || lead.convertedAt);

    if (!planLabel && !startDate) return null;

    return {
        planLabel: planLabel || 'Membership',
        planCode: planCode || null,
        startDate,
        createdAt,
    };
};

const enhanceLead = (lead = {}) => {
    const membership = normalizeMembership(lead.membership, lead);
    const baseStatus = lead.status || lead.originalStatus || 'Pending';
    const isCheckedIn = Boolean(lead.checkedIn);
    let computedStatus = lead.status || baseStatus;

    if (membership && computedStatus !== 'Checked-in') {
        computedStatus = 'Converted';
    }

    return {
        ...lead,
        originalStatus: lead.originalStatus || (membership ? 'Converted' : baseStatus),
        membership,
        status: isCheckedIn ? 'Checked-in' : computedStatus,
        checkedIn: isCheckedIn,
        lastCheckIn: lead.lastCheckIn ? new Date(lead.lastCheckIn).toISOString() : null,
        convertedAt: membership
            ? membership.createdAt || toIsoString(lead.convertedAt)
            : toIsoString(lead.convertedAt),
    };
};

const prepareLeads = (list = []) => sortLeadsByCreated(list.map(enhanceLead));

const PLAN_CODE_DURATION_MONTHS = {
    '1m': 1,
    '3m': 3,
    '6m': 6,
    '12m': 12
};

const parseIso = (v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const computeExpiryDate = (lead = {}, joinDateInput) => {
    const explicit = parseIso(lead.expiryDate || lead.endDate || lead.membership?.endDate || null);
    if (explicit) return explicit;
    const joinDate = parseIso(joinDateInput || lead.membership?.startDate || lead.convertedAt || lead.createdAt);
    if (!joinDate) return null;
    const planCode = (lead.membership?.planCode || lead.plan || '')?.toString().toLowerCase();
    const months = PLAN_CODE_DURATION_MONTHS[planCode] || null;
    if (!months) return null;
    const expiry = new Date(joinDate.getTime());
    expiry.setMonth(expiry.getMonth() + months);
    return expiry;
};
export {
    normalizePhone,
    toIsoString,
    toTimestamp,
    normalizeMembership,
    enhanceLead,
    prepareLeads,
    computeExpiryDate,
};
