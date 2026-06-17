const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const DEFAULT_CONTENT = {
    gyms: [],
    memberships: [],
    trainers: [],
    pitches: [],
    leads: [],
    membershipHistory: [],
    userMemberships: [],
    metrics: {}
};

const ensureDbFile = () => {
    if (!fs.existsSync(DB_PATH)) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_CONTENT, null, 2), 'utf8');
        return;
    }

    const stats = fs.statSync(DB_PATH);
    if (stats.size === 0) {
        fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_CONTENT, null, 2), 'utf8');
    }
};

const readDb = () => {
    try {
        ensureDbFile();
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        if (!raw) {
            return { ...DEFAULT_CONTENT };
        }
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_CONTENT,
            ...parsed,
            gyms: Array.isArray(parsed.gyms) ? parsed.gyms : DEFAULT_CONTENT.gyms,
            memberships: Array.isArray(parsed.memberships) ? parsed.memberships : DEFAULT_CONTENT.memberships,
            trainers: Array.isArray(parsed.trainers) ? parsed.trainers : DEFAULT_CONTENT.trainers,
            pitches: Array.isArray(parsed.pitches) ? parsed.pitches : DEFAULT_CONTENT.pitches,
            leads: Array.isArray(parsed.leads) ? parsed.leads : DEFAULT_CONTENT.leads,
            membershipHistory: Array.isArray(parsed.membershipHistory) ? parsed.membershipHistory : DEFAULT_CONTENT.membershipHistory,
            metrics: parsed.metrics && typeof parsed.metrics === 'object' ? parsed.metrics : { ...DEFAULT_CONTENT.metrics }
        };
    } catch (error) {
        console.error('Failed to read db.json', error);
        return { ...DEFAULT_CONTENT };
    }
};

const writeDb = (content) => {
    const next = {
        ...DEFAULT_CONTENT,
        ...content
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(next, null, 2), 'utf8');
    return next;
};

const updateDb = (updater) => {
    if (typeof updater !== 'function') {
        throw new TypeError('updater must be a function');
    }
    const current = readDb();
    const next = updater(current) || current;
    return writeDb(next);
};

module.exports = {
    readDb,
    updateDb
};
