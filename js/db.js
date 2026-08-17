import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://wtvtmxjhtmhwoieybhyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KBfX4H-LhDeY6fc5U_UZXg_mFgNEzTF';

// Browsers will happily serve a cached response for an identical GET request
// (e.g. re-fetching the same session by id) unless told not to — without this,
// re-opening a session after editing it can show stale data.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
});

export const Auth = {
  getSession: () => supabase.auth.getSession(),
  onAuthStateChange: (cb) => supabase.auth.onAuthStateChange(cb),
  // Email+password, no confirmation email involved (must be disabled in
  // Supabase: Authentication -> Sign In / Providers -> Email -> "Confirm email" off).
  signUp: (email, password) => supabase.auth.signUp({ email, password }),
  signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
  signOut: () => supabase.auth.signOut(),
};

// app.js works in camelCase; these tables use snake_case for the columns that differ.
const FIELD_MAP = {
  exercises: { repLow: 'rep_low', repHigh: 'rep_high' },
  sessions: { durationMin: 'duration_min', distanceKm: 'distance_km', createdAt: 'created_at', updatedAt: 'updated_at' },
};

function toRow(store, obj) {
  const map = FIELD_MAP[store] || {};
  const row = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id') continue;
    row[map[k] || k] = v;
  }
  return row;
}

function fromRow(store, row) {
  const map = FIELD_MAP[store] || {};
  const inverse = Object.fromEntries(Object.entries(map).map(([a, b]) => [b, a]));
  const obj = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue;
    obj[inverse[k] || k] = v;
  }
  return obj;
}

function check(error) {
  if (error) throw new Error(error.message);
}

export const DB = {
  async add(store, obj) {
    const { data, error } = await supabase.from(store).insert(toRow(store, obj)).select('id').single();
    check(error);
    return data.id;
  },
  async put(store, obj) {
    const { id, ...rest } = obj;
    const { error } = await supabase.from(store).update(toRow(store, rest)).eq('id', id);
    check(error);
    return id;
  },
  async get(store, id) {
    const { data, error } = await supabase.from(store).select('*').eq('id', id).maybeSingle();
    check(error);
    return data ? fromRow(store, data) : null;
  },
  async delete(store, id) {
    const { error } = await supabase.from(store).delete().eq('id', id);
    check(error);
  },
  async all(store) {
    const { data, error } = await supabase.from(store).select('*');
    check(error);
    return data.map((r) => fromRow(store, r));
  },
  async allByIndex(store, indexName, range) {
    const value = range.lower;
    const { data, error } = await supabase.from(store).select('*').eq(indexName, value);
    check(error);
    return data.map((r) => fromRow(store, r));
  },
};
