const AUTH_KEY = 'busbeacon_user';
const DATA_KEY = 'busbeacon_data';

const readJson = (key, fallback) => {
	try {
		return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
	} catch {
		return fallback;
	}
};

const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const matches = (record, filters = {}) => Object.entries(filters).every(([key, value]) => record[key] === value);

const createEntity = (name) => ({
	list: async (sortKey, limit) => {
		const records = readJson(DATA_KEY, {})[name] || [];
		const sorted = sortKey?.startsWith('-')
			? records.sort((a, b) => String(b[sortKey.slice(1)] || '').localeCompare(String(a[sortKey.slice(1)] || '')))
			: records;
		return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
	},
	get: async (id) => (readJson(DATA_KEY, {})[name] || []).find((record) => record.id === id) || null,
	filter: async (filters = {}, sortKey, limit) => {
		const records = (readJson(DATA_KEY, {})[name] || []).filter((record) => matches(record, filters));
		const sorted = sortKey?.startsWith('-')
			? records.sort((a, b) => String(b[sortKey.slice(1)] || '').localeCompare(String(a[sortKey.slice(1)] || '')))
			: records;
		return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
	},
	create: async (data) => {
		const all = readJson(DATA_KEY, {});
		const record = { ...data, id: makeId(), created_date: new Date().toISOString() };
		all[name] = [...(all[name] || []), record];
		writeJson(DATA_KEY, all);
		return record;
	},
	update: async (id, data) => {
		const all = readJson(DATA_KEY, {});
		const records = all[name] || [];
		const index = records.findIndex((record) => record.id === id);
		if (index < 0) throw new Error(`${name} record not found`);
		all[name][index] = { ...records[index], ...data };
		writeJson(DATA_KEY, all);
		return all[name][index];
	},
	delete: async (id) => {
		const all = readJson(DATA_KEY, {});
		all[name] = (all[name] || []).filter((record) => record.id !== id);
		writeJson(DATA_KEY, all);
	},
	bulkCreate: async (records) => Promise.all(records.map((record) => createEntity(name).create(record))),
	subscribe: () => () => {},
});

const auth = {
	isAuthenticated: async () => Boolean(localStorage.getItem(AUTH_KEY)),
	me: async () => readJson(AUTH_KEY, null),
	register: async ({ email, password }) => {
		if (!email || !password) throw new Error('Email and password are required');
		const user = { id: makeId(), email, password, app_role: 'parent' };
		writeJson('busbeacon_pending_user', user);
		return { ...user, access_token: makeId() };
	},
	verifyOtp: async ({ otpCode }) => {
		if (!/^\d{6}$/.test(otpCode)) throw new Error('Enter the six-digit verification code');
		const user = readJson('busbeacon_pending_user', null);
		if (!user) throw new Error('Registration session expired');
		delete user.password;
		writeJson(AUTH_KEY, user);
		localStorage.removeItem('busbeacon_pending_user');
		return { access_token: makeId() };
	},
	resendOtp: async () => undefined,
	loginViaEmailPassword: async (email, password) => {
		if (!email || !password) throw new Error('Email and password are required');
		const user = { id: makeId(), email, app_role: 'parent' };
		writeJson(AUTH_KEY, user);
		return user;
	},
	loginWithProvider: async (provider) => {
		writeJson(AUTH_KEY, { id: makeId(), email: `${provider}@local.test`, app_role: 'parent' });
		window.location.href = '/';
	},
	setToken: () => undefined,
	updateMe: async (updates) => {
		const user = { ...(readJson(AUTH_KEY, {}) || {}), ...updates };
		writeJson(AUTH_KEY, user);
		return user;
	},
	resetPasswordRequest: async () => undefined,
	resetPassword: async () => undefined,
	logout: (redirect) => {
		localStorage.removeItem(AUTH_KEY);
		if (redirect) window.location.href = redirect;
	},
	redirectToLogin: () => { window.location.href = '#/login'; },
};

const entityNames = ['User', 'Broadcast', 'Bus', 'ChatMessage', 'DriverCode', 'ParentLink', 'SafetyIssue', 'ScheduleException', 'Stop', 'Student', 'StudentStop'];
const entities = Object.fromEntries(entityNames.map((name) => [name, createEntity(name)]));

export const db = {
	auth,
	entities,
	integrations: { Core: { UploadFile: async ({ file }) => ({ file_url: URL.createObjectURL(file) }), ExtractDataFromUploadedFile: async () => ({ output: [] }), InvokeLLM: async () => ({}) } },
	functions: { invoke: async () => ({}) },
};

globalThis.__B44_DB__ = db;

export const base44 = db;
export default db;