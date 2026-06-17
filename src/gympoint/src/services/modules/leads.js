const STORAGE_KEY = 'gym-dashboard:leads';
let inMemoryLeads = [];

const hasWindow = typeof window !== 'undefined';
const nowIsoString = () => new Date().toISOString();

const normalizeContact = (value = '') => {
    if (!value) {
        return '';
    }
    const digits = value.toString().replace(/\D/g, '');
    if (digits.length >= 10) {
        return digits.slice(-10);
    }
    return digits || value.toString().trim();
};

const loadFromStorage = () => {
    if (hasWindow && window.localStorage) {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return [...inMemoryLeads];
            }
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                inMemoryLeads = parsed;
                return [...parsed];
            }
        } catch (error) {
            console.warn('Unable to read stored leads, falling back to memory cache.', error);
        }
    }
    return [...inMemoryLeads];
};

const persistLeads = (leads) => {
    const safeLeads = Array.isArray(leads) ? leads : [];
    inMemoryLeads = [...safeLeads];
    if (hasWindow && window.localStorage) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryLeads));
        } catch (error) {
            console.warn('Unable to persist leads, continuing with in-memory cache.', error);
        }
    }
    return inMemoryLeads;
};

const deriveLeadStatus = (payload = {}) => {
    const mode = payload.mode?.toString().toLowerCase() || '';
    const rawStatus = payload.status?.toString().trim() || '';
    if (mode === 'trial' || rawStatus.toLowerCase().includes('trial')) {
        return 'Trial Attended';
    }
    if (mode === 'converted' || rawStatus.toLowerCase().includes('converted')) {
        return 'Converted';
    }
    return rawStatus || 'New';
};

const sanitizeLeadPayload = (payload = {}) => {
    const timestamp = nowIsoString();
    const trimmedName = payload.name?.toString().trim() || '';
    const phone = payload.phone?.toString().trim() || '';
    const normalizedPhone = normalizeContact(phone);
    const base = {
        id: payload.id || `lead-${Date.now()}`,
        name: trimmedName || 'Guest Lead',
        phone,
        normalizedPhone,
        email: payload.email?.toString().trim() || '',
        source: payload.source || payload.leadSource || 'Unspecified',
        leadSource: payload.leadSource || payload.source || 'Unspecified',
        interest: payload.interest || 'HOT',
        status: deriveLeadStatus(payload),
        followUpDate: payload.followUpDate || null,
        notes: payload.notes || payload.remarks || '',
        plan: payload.plan || '',
        planCategory: payload.planCategory || '',
        pitchDate: payload.pitchDate || null,
        createdAt: payload.createdAt || timestamp,
        updatedAt: timestamp,
        membership: payload.membership || null,
        mode: payload.mode || 'lead'
    };
    if (!base.followUpDate && payload.preferredDate) {
        base.followUpDate = payload.preferredDate;
    }
    return base;
};

export const leadsService = {
    async list() {
        const stored = loadFromStorage();
        const normalized = stored.map((lead) => {
            const status = deriveLeadStatus(lead);
            if (status === lead.status) {
                return lead;
            }
            return { ...lead, status };
        });
        if (normalized.length && normalized.some((lead, index) => lead !== stored[index])) {
            persistLeads(normalized);
        }
        return normalized;
    },
    async create(payload) {
        const nextLead = sanitizeLeadPayload(payload);
        const existing = loadFromStorage();
        const withoutDuplicate = nextLead.normalizedPhone
            ? existing.filter((lead) => normalizeContact(lead.phone) !== nextLead.normalizedPhone)
            : existing;
        const stored = persistLeads([nextLead, ...withoutDuplicate]);
        return { data: nextLead, stored };
    },
    async update(payload = {}) {
        const { phone } = payload;
        if (!phone) {
            throw new Error('phone is required for update');
        }
        const normalized = normalizeContact(phone);
        const current = loadFromStorage();
        const timestamp = nowIsoString();
        const updatedLeads = current.map((lead) => {
            const matches = normalizeContact(lead.phone) === normalized;
            if (!matches) {
                return lead;
            }
            return {
                ...lead,
                ...payload,
                phone: payload.phone || lead.phone,
                updatedAt: timestamp
            };
        });
        const normalizedLeads = updatedLeads.map((lead) => {
            const status = deriveLeadStatus(lead);
            return status === lead.status ? lead : { ...lead, status };
        });
        persistLeads(normalizedLeads);
        const next = normalizedLeads.find((lead) => normalizeContact(lead.phone) === normalized);
        if (!next) {
            throw new Error('Lead not found for update');
        }
        return { data: next };
    }
};
