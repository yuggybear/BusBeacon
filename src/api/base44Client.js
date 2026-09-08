import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ── Helper: get current user id ─────────────────────────────────
async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// ── Helper: build filter chain ──────────────────────────────────
function applyFilters(query, filters) {
  if (!filters || typeof filters !== 'object') return query;
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if ('$ne' in value) { query = query.neq(key, value.$ne); continue; }
      if ('$in' in value) { query = query.in(key, value.$in); continue; }
      if ('$gte' in value) { query = query.gte(key, value.$gte); continue; }
      if ('$lte' in value) { query = query.lte(key, value.$lte); continue; }
      if ('$gt' in value) { query = query.gt(key, value.$gt); continue; }
      if ('$lt' in value) { query = query.lt(key, value.$lt); continue; }
      if ('$ilike' in value) { query = query.ilike(key, value.$ilike); continue; }
    }
    if (typeof value === 'string' && value.includes('%') && !value.includes('-')) {
      query = query.ilike(key, value);
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
}

// ── Helper: parse sort string like "-created_date" ──────────────
function applySort(query, sort) {
  if (!sort) return query;
  if (typeof sort === 'string') {
    if (sort.startsWith('-')) {
      return query.order(sort.slice(1), { ascending: false });
    }
    return query.order(sort, { ascending: true });
  }
  return query;
}

// ── Entity factory ──────────────────────────────────────────────
function createEntity(tableName) {
  return {
    async list(filters, sort, limit) {
      let q = supabase.from(tableName).select('*');
      q = applyFilters(q, filters);
      q = applySort(q, sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async filter(filters, sort, limit) {
      return this.list(filters, sort, limit);
    },

    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async create(record) {
      const userId = await getCurrentUserId();
      const enriched = {
        ...record,
        created_by_id: userId || record.created_by_id,
        created_date: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from(tableName)
        .insert(enriched)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },

    async bulkCreate(records) {
      const userId = await getCurrentUserId();
      const enriched = records.map(r => ({
        ...r,
        created_by_id: userId || r.created_by_id,
        created_date: new Date().toISOString(),
      }));
      const { data, error } = await supabase
        .from(tableName)
        .insert(enriched)
        .select('*');
      if (error) throw error;
      return data || [];
    },

    async update(id, record) {
      const enriched = {
        ...record,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from(tableName)
        .update(enriched)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { data, error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },

    subscribe(callback, filters) {
      const channel = supabase.channel(`public.${tableName}`);
      let filterObj = { event: '*', schema: 'public', table: tableName };
      if (filters) {
        if (filters.bus_id) filterObj.filter = `bus_id=eq.${filters.bus_id}`;
        if (filters.school_name) filterObj.filter = `school_name=eq.${filters.school_name}`;
      }
      channel.on('postgres_changes', filterObj, (payload) => {
        const typeMap = { INSERT: 'create', UPDATE: 'update', DELETE: 'delete' };
        callback({
          type: typeMap[payload.eventType] || payload.eventType,
          data: payload.new || payload.old,
        });
      }).subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

// ── Auth module ─────────────────────────────────────────────────
const auth = {
  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw { status: 401, message: 'Not authenticated' };

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!profile) throw { status: 403, message: 'Profile not found' };
    return profile;
  },

  async isAuthenticated() {
    try {
      await this.me();
      return true;
    } catch {
      return false;
    }
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password,
    });
    if (error) throw error;
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();
    if (pErr) throw pErr;
    return { access_token: data.session?.access_token, user: profile };
  },

  async register(payload) {
    const { email, password } = payload;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: payload.full_name || '' },
      },
    });
    if (error) throw error;
    // If email confirmation is off, session is created immediately
    if (data.session) {
      return { access_token: data.session.access_token, user: data.user };
    }
    // No session — need OTP verification
    return { access_token: null, user: data.user };
  },

  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email, token: otpCode, type: 'signup',
    });
    if (error) throw error;
    return { access_token: data.session?.access_token };
  },

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup', email,
    });
    if (error) throw error;
  },

  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async resetPassword({ resetToken, newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  loginWithProvider(provider, fromUrl = '/') {
    supabase.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: window.location.origin + fromUrl },
    });
  },

  redirectToLogin(nextUrl) {
    window.location.href = '/login?from_url=' + encodeURIComponent(nextUrl || window.location.href);
  },

  logout(redirectUrl) {
    supabase.auth.signOut().then(() => {
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    });
  },

  setToken(_token) {
    // Supabase manages tokens internally; no-op
  },

  async updateMe(data) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw { status: 401, message: 'Not authenticated' };
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return updated;
  },
};

// ── Integrations (stubbed — no Base44 backend) ──────────────────
const integrations = {
  Core: {
    UploadFile: async ({ file }) => {
      if (!file) return { file_url: '' };
      const ext = file.name?.split('.').pop() || 'txt';
      const fileName = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('uploads')
        .upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName);
      return { file_url: urlData.publicUrl };
    },
    InvokeLLM: async () => {
      throw new Error('LLM integration not available in standalone mode');
    },
    ExtractDataFromUploadedFile: async () => {
      throw new Error('File extraction not available in standalone mode');
    },
  },
};

// ── Assemble db ─────────────────────────────────────────────────
const db = {
  auth,
  entities: {
    User: createEntity('profiles'),
    Bus: createEntity('buses'),
    Stop: createEntity('stops'),
    Student: createEntity('students'),
    StudentStop: createEntity('student_stops'),
    Broadcast: createEntity('broadcasts'),
    ChatMessage: createEntity('chat_messages'),
    ParentLink: createEntity('parent_links'),
    SafetyIssue: createEntity('safety_issues'),
    ScheduleException: createEntity('schedule_exceptions'),
    DriverCode: createEntity('driver_codes'),
  },
  integrations,
};

export const base44 = db;
export default db;
