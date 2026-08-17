import { DB, Auth } from './db.js?v=10';
import { suggestNext } from './overload.js?v=10';

const SESSION_TYPES = {
  Upper: { label: 'Upper Body', logsExercises: true },
  Lower: { label: 'Lower Body', logsExercises: true },
  MuayThai: { label: 'Muay Thai', logsExercises: false },
  Run: { label: 'Run', logsExercises: false },
  Custom: { label: 'Custom', logsExercises: true },
};

// unit kg. repLow === repHigh marks a fixed-rep target (e.g. Flat Bench 3x5, Deadlift 3x8) —
// the overload algorithm treats "hit it on every set" as the trigger to add weight either way.
const EXERCISE_DEFS = [
  { name: 'Pull-up', category: 'Upper', unit: 'kg', repLow: 7, repHigh: 10, increment: 1.25 },
  { name: 'Incline DB Press', category: 'Upper', unit: 'kg', repLow: 10, repHigh: 12, increment: 2 },
  { name: 'Seated Cable Row (wide grip)', category: 'Upper', unit: 'kg', repLow: 10, repHigh: 12, increment: 2.5 },
  { name: 'Machine Chest Press', category: 'Upper', unit: 'kg', repLow: 10, repHigh: 12, increment: 2.5 },
  { name: 'Overhead DB Press', category: 'Upper', unit: 'kg', repLow: 10, repHigh: 12, increment: 2 },
  { name: 'DB Lateral Raise', category: 'Upper', unit: 'kg', repLow: 15, repHigh: 15, increment: 1 },
  { name: 'Cable Skull Crusher', category: 'Upper', unit: 'kg', repLow: 12, repHigh: 15, increment: 2.5 },
  { name: 'EZ-Bar Bicep Curl', category: 'Upper', unit: 'kg', repLow: 12, repHigh: 15, increment: 2.5 },
  { name: 'Flat Bench Press', category: 'Upper', unit: 'kg', repLow: 5, repHigh: 5, increment: 2.5 },
  { name: 'Lat Pulldown', category: 'Upper', unit: 'kg', repLow: 10, repHigh: 12, increment: 2.5 },
  { name: 'Chest-Supported Machine Row', category: 'Upper', unit: 'kg', repLow: 10, repHigh: 12, increment: 2.5 },
  { name: 'Pec Dec', category: 'Upper', unit: 'kg', repLow: 10, repHigh: 12, increment: 2.5 },
  { name: 'Cable Close-Grip Row', category: 'Upper', unit: 'kg', repLow: 10, repHigh: 12, increment: 2.5 },
  { name: 'Lateral Cable Raise', category: 'Upper', unit: 'kg', repLow: 15, repHigh: 15, increment: 1 },
  { name: 'Rear Delt Flyes', category: 'Upper', unit: 'kg', repLow: 15, repHigh: 15, increment: 1 },
  { name: 'Hammer Curls', category: 'Upper', unit: 'kg', repLow: 12, repHigh: 12, increment: 2 },
  { name: 'Cable Tricep Kickback', category: 'Upper', unit: 'kg', repLow: 20, repHigh: 20, increment: 1 },
  { name: 'Hack Squat', category: 'Lower', unit: 'kg', repLow: 8, repHigh: 10, increment: 5 },
  { name: 'Glute Raises', category: 'Lower', unit: 'kg', repLow: 12, repHigh: 12, increment: 2.5 },
  // Rep target TBD — flagged with the user, defaulted to 10-12/leg; adjust in Exercises once confirmed.
  { name: 'Walking Lunges', category: 'Lower', unit: 'kg', repLow: 10, repHigh: 12, increment: 2 },
  { name: 'Quad Extensions', category: 'Lower', unit: 'kg', repLow: 12, repHigh: 12, increment: 2.5 },
  { name: 'Calf Raises', category: 'Lower', unit: 'kg', repLow: 15, repHigh: 15, increment: 5 },
  { name: 'Deadlift', category: 'Lower', unit: 'kg', repLow: 8, repHigh: 8, increment: 2.5 },
  { name: 'Goblet Squat', category: 'Lower', unit: 'kg', repLow: 12, repHigh: 12, increment: 2 },
];

const TEMPLATES = {
  Upper1: {
    label: 'Upper 1',
    type: 'Upper',
    items: [
      ['Pull-up', 4], ['Incline DB Press', 3], ['Seated Cable Row (wide grip)', 3],
      ['Machine Chest Press', 3], ['Overhead DB Press', 3], ['DB Lateral Raise', 3],
      ['Cable Skull Crusher', 3], ['EZ-Bar Bicep Curl', 3],
    ],
  },
  Upper2: {
    label: 'Upper 2',
    type: 'Upper',
    items: [
      ['Flat Bench Press', 3], ['Lat Pulldown', 3], ['Chest-Supported Machine Row', 3],
      ['Pec Dec', 3], ['Cable Close-Grip Row', 3], ['Lateral Cable Raise', 3],
      ['Rear Delt Flyes', 3], ['Hammer Curls', 3], ['Cable Tricep Kickback', 3],
    ],
  },
  Lower1: {
    label: 'Lower 1',
    type: 'Lower',
    items: [
      ['Hack Squat', 3], ['Glute Raises', 4], ['Walking Lunges', 3],
      ['Quad Extensions', 3], ['Calf Raises', 3],
    ],
  },
  Lower2: {
    label: 'Lower 2',
    type: 'Lower',
    items: [
      ['Deadlift', 3], ['Goblet Squat', 3], ['Quad Extensions', 3],
      ['Glute Raises', 4], ['Calf Raises', 3],
    ],
  },
};

function sessionLabel(session) {
  return TEMPLATES[session.template]?.label || SESSION_TYPES[session.type]?.label || session.type;
}

const state = {
  view: 'today',
  todayDate: todayISO(),
  weekAnchor: todayISO(),
  historyLoaded: null,
  progressExerciseId: null,
};

const viewEl = document.getElementById('view');
const modalRoot = document.getElementById('modal-root');
const modalContent = document.getElementById('modal-content');

// ---------- date helpers ----------
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
function dayOfWeek(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0 = Sun
}
function startOfWeek(iso) {
  const dow = dayOfWeek(iso);
  const offset = dow === 0 ? -6 : 1 - dow; // Monday-start
  return addDays(iso, offset);
}
function formatDisplay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.toLocaleDateString(undefined, { weekday: 'short' });
  const md = dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return { wd, md };
}
function isToday(iso) { return iso === todayISO(); }

// ---------- init ----------
const authRoot = document.getElementById('auth-root');
const authContent = document.getElementById('auth-content');
let appStarted = false;

async function init() {
  const { data } = await Auth.getSession();
  boot(data.session);
  Auth.onAuthStateChange((_event, session) => boot(session));
}

function boot(session) {
  if (!session) {
    appStarted = false;
    authRoot.classList.remove('hidden');
    renderAuthScreen();
    return;
  }
  authRoot.classList.add('hidden');
  if (!appStarted) startApp();
}

let authMode = 'signin'; // 'signin' | 'signup'

function renderAuthScreen(status) {
  const isSignup = authMode === 'signup';
  authContent.innerHTML = `
    <h1>Gym Tracker</h1>
    <p>${isSignup ? 'Create an account to sync your training across devices.' : 'Sign in to sync your training across devices.'}</p>
    <div class="form-row"><input type="email" id="auth-email" placeholder="you@example.com" autocomplete="username" /></div>
    <div class="form-row"><input type="password" id="auth-password" placeholder="Password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" /></div>
    <button class="btn" id="auth-submit">${isSignup ? 'Create account' : 'Sign in'}</button>
    <button class="link-btn" id="auth-toggle" style="width:100%;text-align:center;margin-top:8px">${isSignup ? 'Already have an account? Sign in' : "First time? Create an account"}</button>
    <div class="auth-status">${status || ''}</div>
  `;
  const submit = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) return;
    renderAuthScreen(isSignup ? 'Creating account…' : 'Signing in…');
    try {
      const { data, error } = isSignup ? await Auth.signUp(email, password) : await Auth.signIn(email, password);
      if (error) { renderAuthScreen(error.message); return; }
      if (isSignup && !data.session) {
        authMode = 'signin';
        renderAuthScreen('Account created but "Confirm email" is still on in Supabase (Authentication -> Providers -> Email) — turn it off, then sign in below.');
        return;
      }
      // on success with a session, onAuthStateChange fires boot() with the new session
    } catch (e) {
      renderAuthScreen(e.message || 'Something went wrong — try again.');
    }
  };
  document.getElementById('auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  document.getElementById('auth-submit').addEventListener('click', submit);
  document.getElementById('auth-toggle').addEventListener('click', () => {
    authMode = isSignup ? 'signin' : 'signup';
    renderAuthScreen();
  });
}

async function startApp() {
  appStarted = true;
  viewEl.innerHTML = '<div class="empty-state">Setting up your account…</div>';
  await seedExercises();
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.nav;
      render();
    });
  });
  viewEl.addEventListener('click', onViewClick);
  viewEl.addEventListener('change', onViewChange);
  modalContent.addEventListener('click', onModalClick);
  modalContent.addEventListener('change', onModalChange);
  modalRoot.addEventListener('click', (e) => { if (e.target === modalRoot) closeModal(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  render();
}

async function seedExercises() {
  const existing = await DB.all('exercises');
  const existingNames = new Set(existing.map((e) => e.name));
  const missing = EXERCISE_DEFS.filter((ex) => !existingNames.has(ex.name));
  await Promise.all(missing.map((ex) => DB.add('exercises', { ...ex })));
}

async function findOrCreateExercise(name) {
  const existing = await DB.all('exercises');
  const found = existing.find((e) => e.name === name);
  if (found) return found.id;
  const def = EXERCISE_DEFS.find((e) => e.name === name) || { name, category: 'Other', unit: 'kg', repLow: 8, repHigh: 12, increment: 2.5 };
  return DB.add('exercises', { ...def });
}

// ---------- render dispatch ----------
async function render() {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.nav === state.view));
  switch (state.view) {
    case 'today': return renderToday();
    case 'session': return renderSessionEditor();
    case 'week': return renderWeek();
    case 'history': return renderHistory();
    case 'exercises': return renderExercises();
    case 'progress': return renderProgress();
    default: return renderToday();
  }
}

// ---------- TODAY ----------
async function renderToday() {
  const date = state.todayDate;
  const sessions = await DB.allByIndex('sessions', 'date', IDBKeyRange.only(date));
  const am = sessions.filter((s) => s.slot === 'AM');
  const pm = sessions.filter((s) => s.slot === 'PM');
  const { wd, md } = formatDisplay(date);

  viewEl.innerHTML = `
    <div class="date-nav">
      <button data-action="day-prev">&#8592;</button>
      <div class="date-label">${wd}, ${md}<span class="sub">${isToday(date) ? 'Today' : ''}</span></div>
      <button data-action="day-next">&#8594;</button>
    </div>
    ${slotCardHtml('AM', am)}
    ${slotCardHtml('PM', pm)}
    ${am.length === 0 && pm.length === 0 ? '<div class="empty-state">Rest day. Add a session above if that changes.</div>' : ''}
  `;
}

function slotCardHtml(slot, sessions) {
  const cards = sessions.map((session) => {
    const type = sessionLabel(session);
    let sub = '';
    if (SESSION_TYPES[session.type]?.logsExercises) {
      const n = (session.entries || []).length;
      sub = n === 0 ? 'No exercises logged yet' : `${n} exercise${n === 1 ? '' : 's'}`;
    } else {
      const parts = [];
      if (session.durationMin) parts.push(`${session.durationMin} min`);
      if (session.distanceKm) parts.push(`${session.distanceKm} km`);
      sub = parts.length ? parts.join(' · ') : 'Tap to add details';
    }
    return `
      <div class="session-card" data-action="open-session" data-id="${session.id}">
        <span class="type-dot type-${session.type}"></span>
        <div>
          <div class="session-title">${type}</div>
          <div class="session-sub">${sub}</div>
        </div>
        <span class="chip ${session.completed ? 'done' : ''}">${session.completed ? 'Done' : 'Planned'}</span>
      </div>`;
  }).join('');

  return `
    <div class="slot-card">
      <div class="slot-label">${slot}</div>
      ${cards}
      <button class="add-btn" data-action="new-session" data-slot="${slot}">+ Add ${slot} session</button>
    </div>`;
}

async function handleNewSession(slot) {
  openModal(`
    <h3>Add ${slot} session</h3>
    <div class="type-picker">
      ${Object.entries(SESSION_TYPES).map(([key, cfg]) => `
        <button data-action="pick-type" data-type="${key}" data-slot="${slot}">${cfg.label}</button>
      `).join('')}
    </div>
    <button class="btn secondary" data-action="close-modal">Cancel</button>
  `);
}

function handlePickType(type, slot) {
  const templateKeys = Object.keys(TEMPLATES).filter((k) => TEMPLATES[k].type === type);
  if (templateKeys.length === 0) return createSession(type, slot, null);
  openModal(`
    <h3>Which ${SESSION_TYPES[type].label} day?</h3>
    <div class="type-picker">
      ${templateKeys.map((k) => `<button data-action="create-session" data-type="${type}" data-slot="${slot}" data-template="${k}">${TEMPLATES[k].label}</button>`).join('')}
    </div>
    <button class="btn secondary" data-action="close-modal">Cancel</button>
  `);
}

async function createSession(type, slot, template) {
  const session = {
    date: state.todayDate,
    slot,
    type,
    template: template || null,
    entries: [],
    durationMin: null,
    distanceKm: null,
    notes: '',
    completed: false,
  };
  if (template && TEMPLATES[template]) {
    for (const [name, setCount] of TEMPLATES[template].items) {
      const exerciseId = await findOrCreateExercise(name);
      session.entries.push({
        exerciseId,
        sets: Array.from({ length: setCount }, () => ({ weight: null, reps: null, rpe: null })),
      });
    }
  }
  const id = await DB.add('sessions', session);
  closeModal();
  state.view = 'session';
  state.editingSessionId = id;
  render();
}

// ---------- SESSION EDITOR ----------
async function renderSessionEditor() {
  const session = await DB.get('sessions', state.editingSessionId);
  if (!session) { state.view = 'today'; return render(); }
  const cfg = SESSION_TYPES[session.type] || { label: session.type, logsExercises: false };
  const label = sessionLabel(session);
  const { wd, md } = formatDisplay(session.date);

  let body;
  if (cfg.logsExercises) {
    const allExercises = await DB.all('exercises');
    const exMap = Object.fromEntries(allExercises.map((e) => [e.id, e]));
    const entryBlocks = await Promise.all((session.entries || []).map((entry, idx) => renderEntryBlock(entry, idx, exMap, session)));
    body = `
      ${entryBlocks.join('')}
      <button class="link-btn" data-action="add-exercise-to-session">+ Add exercise</button>
    `;
  } else {
    body = `
      <div class="form-row">
        <label>Duration (minutes)</label>
        <input type="number" inputmode="numeric" data-field="durationMin" value="${session.durationMin ?? ''}" />
      </div>
      ${session.type === 'Run' ? `
      <div class="form-row">
        <label>Distance (km)</label>
        <input type="number" step="0.01" inputmode="decimal" data-field="distanceKm" value="${session.distanceKm ?? ''}" />
      </div>` : ''}
      <div class="form-row">
        <label>Notes</label>
        <textarea rows="3" data-field="notes">${session.notes || ''}</textarea>
      </div>
    `;
  }

  viewEl.innerHTML = `
    <div class="date-nav">
      <button data-action="back-to-today">&#8592;</button>
      <div class="date-label">${label}<span class="sub">${wd}, ${md} · ${session.slot}</span></div>
      <div style="width:36px"></div>
    </div>
    <div class="card">
      ${body}
    </div>
    <div class="btn-row">
      <button class="btn ${session.completed ? 'secondary' : ''}" data-action="toggle-complete">${session.completed ? 'Mark as not done' : 'Mark as done'}</button>
    </div>
    <div class="btn-row">
      <button class="btn danger" data-action="delete-session">Delete session</button>
    </div>
  `;
}

async function renderEntryBlock(entry, idx, exMap, session) {
  const ex = exMap[entry.exerciseId];
  if (!ex) return '';
  const history = await lastEntryForExercise(ex.id, session.id, session.date);
  const suggestion = suggestNext(ex, history);
  const sets = entry.sets || [];
  return `
    <div class="exercise-entry" data-idx="${idx}">
      <div class="exercise-entry-head">
        <span class="name">${ex.name}</span>
        <button class="link-btn" data-action="remove-exercise" data-idx="${idx}">Remove</button>
      </div>
      <div class="suggestion">
        ${suggestion.weight != null
          ? `Suggested: <strong>${suggestion.weight}${ex.unit} &times; ${suggestion.targetReps}</strong> — ${suggestion.note}`
          : suggestion.note}
      </div>
      <div class="set-headers"><span></span><span>Weight (${ex.unit})</span><span>Reps</span><span>RPE</span><span></span></div>
      ${sets.map((set, si) => `
        <div class="set-row">
          <span class="set-num">${si + 1}</span>
          <input type="number" step="0.5" inputmode="decimal" data-set-field="weight" data-idx="${idx}" data-set-idx="${si}" value="${set.weight ?? ''}" />
          <input type="number" inputmode="numeric" data-set-field="reps" data-idx="${idx}" data-set-idx="${si}" value="${set.reps ?? ''}" />
          <input type="number" step="0.5" inputmode="decimal" data-set-field="rpe" data-idx="${idx}" data-set-idx="${si}" value="${set.rpe ?? ''}" />
          <button class="rm" data-action="remove-set" data-idx="${idx}" data-set-idx="${si}">&times;</button>
        </div>
      `).join('')}
      <button class="link-btn" data-action="add-set" data-idx="${idx}">+ Add set</button>
    </div>
  `;
}

async function lastEntryForExercise(exerciseId, excludeSessionId, beforeDate) {
  const sessions = await DB.all('sessions');
  const candidates = sessions
    .filter((s) => s.id !== excludeSessionId && s.date <= beforeDate && (s.entries || []).some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id - a.id)));
  if (candidates.length === 0) return null;
  return candidates[0].entries.find((e) => e.exerciseId === exerciseId);
}

async function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  await DB.put('sessions', session);
}

async function handleAddExerciseToSession() {
  const session = await DB.get('sessions', state.editingSessionId);
  const category = session.type === 'Custom' ? null : session.type;
  const allExercises = await DB.all('exercises');
  const filtered = category ? allExercises.filter((e) => e.category === category) : allExercises;
  const others = category ? allExercises.filter((e) => e.category !== category) : [];
  openModal(`
    <h3>Add exercise</h3>
    <div class="form-row">
      <select id="pick-exercise">
        <option value="">Select existing…</option>
        ${filtered.map((e) => `<option value="${e.id}">${e.name}</option>`).join('')}
        ${others.length ? `<optgroup label="Other">${others.map((e) => `<option value="${e.id}">${e.name}</option>`).join('')}</optgroup>` : ''}
      </select>
    </div>
    <button class="btn" data-action="confirm-add-exercise">Add selected</button>
    <div style="text-align:center;margin:10px 0;color:var(--text-dim);font-size:0.8rem;">— or —</div>
    <button class="btn secondary" data-action="new-exercise-inline" data-category="${session.type}">+ Create new exercise</button>
  `);
}

// ---------- WEEK ----------
async function renderWeek() {
  const weekStart = startOfWeek(state.weekAnchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const allSessions = await DB.all('sessions');
  const weekSessions = allSessions.filter((s) => days.includes(s.date));

  const counts = { Upper: 0, Lower: 0, MuayThai: 0, Run: 0, Custom: 0 };
  weekSessions.forEach((s) => { counts[s.type] = (counts[s.type] || 0) + 1; });

  const rows = days.map((d) => {
    const { wd, md } = formatDisplay(d);
    const daySessions = weekSessions.filter((s) => s.date === d);
    const badges = daySessions.map((s) => `<span class="badge type-${s.type}" style="background:var(--${badgeVar(s.type)})">${s.slot} · ${sessionLabel(s)}</span>`).join('');
    return `
      <div class="week-day-row" data-action="goto-day" data-date="${d}">
        <div class="wd"><span class="n">${wd}</span><br/>${md}</div>
        <div class="badges">${badges || '<span style="color:var(--text-dim);font-size:0.78rem;">Rest</span>'}</div>
      </div>`;
  }).join('');

  viewEl.innerHTML = `
    <div class="date-nav">
      <button data-action="week-prev">&#8592;</button>
      <div class="date-label">Week of ${formatDisplay(weekStart).md}</div>
      <button data-action="week-next">&#8594;</button>
    </div>
    <div class="week-summary">
      <div class="stat ${counts.Upper >= 2 ? 'ok' : ''}"><div class="n">${counts.Upper}</div><div class="l">Upper</div></div>
      <div class="stat ${counts.Lower >= 2 ? 'ok' : ''}"><div class="n">${counts.Lower}</div><div class="l">Lower</div></div>
      <div class="stat ${counts.MuayThai >= 3 ? 'ok' : 'warn'}"><div class="n">${counts.MuayThai}/3</div><div class="l">Muay Thai</div></div>
      <div class="stat"><div class="n">${counts.Run}</div><div class="l">Runs</div></div>
    </div>
    <div class="card">${rows}</div>
  `;
}

function badgeVar(type) {
  return { Upper: 'upper', Lower: 'lower', MuayThai: 'muaythai', Run: 'run', Custom: 'custom' }[type] || 'custom';
}

// ---------- HISTORY ----------
async function renderHistory() {
  const sessions = await DB.all('sessions');
  sessions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  if (sessions.length === 0) {
    viewEl.innerHTML = '<h2>History</h2><div class="empty-state">No sessions logged yet.</div>';
    return;
  }
  const groups = {};
  sessions.forEach((s) => { (groups[s.date] = groups[s.date] || []).push(s); });

  const html = Object.entries(groups).map(([date, list]) => {
    const { wd, md } = formatDisplay(date);
    const rows = list.map((s) => `
      <div class="session-card" data-action="open-session-history" data-id="${s.id}">
        <span class="type-dot type-${s.type}"></span>
        <div>
          <div class="session-title">${sessionLabel(s)}</div>
          <div class="session-sub">${s.slot}${entrySummary(s)}</div>
        </div>
        <span class="chip ${s.completed ? 'done' : ''}">${s.completed ? 'Done' : 'Planned'}</span>
      </div>
    `).join('');
    return `<div class="history-group"><div class="history-date">${wd}, ${md}</div><div class="card">${rows}</div></div>`;
  }).join('');

  viewEl.innerHTML = `<h2>History</h2>${html}`;
}

function entrySummary(s) {
  if (SESSION_TYPES[s.type]?.logsExercises) {
    const n = (s.entries || []).length;
    return n ? ` · ${n} exercise${n === 1 ? '' : 's'}` : '';
  }
  const parts = [];
  if (s.durationMin) parts.push(`${s.durationMin} min`);
  if (s.distanceKm) parts.push(`${s.distanceKm} km`);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

// ---------- EXERCISES ----------
async function renderExercises() {
  const exercises = await DB.all('exercises');
  exercises.sort((a, b) => a.name.localeCompare(b.name));
  const rows = exercises.map((e) => `
    <div class="exercise-list-item">
      <div>
        <div>${e.name}</div>
        <div class="meta">${e.category} · ${repRangeLabel(e)} · +${e.increment}${e.unit}</div>
      </div>
      <div>
        <button class="link-btn" data-action="edit-exercise" data-id="${e.id}">Edit</button>
        <button class="link-btn" data-action="delete-exercise" data-id="${e.id}">Delete</button>
      </div>
    </div>
  `).join('');

  viewEl.innerHTML = `
    <h2>Exercises</h2>
    <div class="card">${rows || '<div class="empty-state">No exercises yet.</div>'}</div>
    <button class="btn" data-action="new-exercise">+ Add exercise</button>
    <button class="btn secondary" style="margin-top:8px" data-action="sign-out">Sign out</button>
  `;
}

function repRangeLabel(e) {
  return e.repLow === e.repHigh ? `${e.repLow} reps (fixed)` : `${e.repLow}-${e.repHigh} reps`;
}

function exerciseFormHtml(ex) {
  const e = ex || { name: '', category: 'Upper', unit: 'kg', repLow: 6, repHigh: 10, increment: 2.5 };
  return `
    <h3>${ex ? 'Edit exercise' : 'New exercise'}</h3>
    <div class="form-row"><label>Name</label><input type="text" id="f-name" value="${e.name}" /></div>
    <div class="form-row-inline">
      <div class="form-row"><label>Category</label>
        <select id="f-category">
          ${['Upper', 'Lower', 'Other'].map((c) => `<option value="${c}" ${e.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Unit</label>
        <select id="f-unit">
          ${['kg', 'lb'].map((u) => `<option value="${u}" ${e.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row-inline">
      <div class="form-row"><label>Rep range low</label><input type="number" id="f-replow" value="${e.repLow}" /></div>
      <div class="form-row"><label>Rep range high</label><input type="number" id="f-rephigh" value="${e.repHigh}" /></div>
    </div>
    <div class="form-row"><label>Weight increment</label><input type="number" step="0.25" id="f-increment" value="${e.increment}" /></div>
    <button class="btn" data-action="save-exercise" data-id="${ex ? ex.id : ''}">Save</button>
  `;
}

// ---------- PROGRESS ----------
async function renderProgress() {
  const exercises = await DB.all('exercises');
  exercises.sort((a, b) => a.name.localeCompare(b.name));
  if (!state.progressExerciseId && exercises.length) state.progressExerciseId = exercises[0].id;

  const selectHtml = `
    <div class="form-row">
      <select id="progress-exercise-select">
        ${exercises.map((e) => `<option value="${e.id}" ${e.id === state.progressExerciseId ? 'selected' : ''}>${e.name}</option>`).join('')}
      </select>
    </div>`;

  if (!exercises.length) {
    viewEl.innerHTML = `<h2>Progress</h2><div class="empty-state">Add exercises first.</div>`;
    return;
  }

  const sessions = await DB.all('sessions');
  const points = [];
  sessions
    .filter((s) => (s.entries || []).some((e) => e.exerciseId === state.progressExerciseId))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((s) => {
      const entry = s.entries.find((e) => e.exerciseId === state.progressExerciseId);
      const sets = (entry.sets || []).filter((st) => st.weight != null && st.reps != null);
      if (!sets.length) return;
      const top = sets.reduce((a, b) => (b.weight > a.weight ? b : a));
      points.push({ date: s.date, weight: top.weight, reps: top.reps });
    });

  const ex = exercises.find((e) => e.id === state.progressExerciseId);
  const chart = points.length > 1 ? svgChart(points, ex.unit) : `<div class="empty-state">Log this exercise at least twice to see a trend.</div>`;
  const table = points.length ? `
    <table class="progress-table">
      <thead><tr><th>Date</th><th>Top set</th></tr></thead>
      <tbody>
        ${points.slice().reverse().map((p) => `<tr><td>${formatDisplay(p.date).md}</td><td>${p.weight}${ex.unit} × ${p.reps}</td></tr>`).join('')}
      </tbody>
    </table>` : '';

  viewEl.innerHTML = `
    <h2>Progress</h2>
    ${selectHtml}
    <div class="chart-wrap">${chart}</div>
    ${table}
  `;
}

function svgChart(points, unit) {
  const w = 560, h = 180, pad = 28;
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights), max = Math.max(...weights);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p.weight - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const dots = coords.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="var(--accent)"><title>${points[i].weight}${unit} × ${points[i].reps} on ${points[i].date}</title></circle>`).join('');
  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" />
      ${dots}
      <text x="${pad}" y="14" fill="var(--text-dim)" font-size="11">${max}${unit}</text>
      <text x="${pad}" y="${h - 6}" fill="var(--text-dim)" font-size="11">${min}${unit}</text>
    </svg>`;
}

// ---------- MODAL ----------
function openModal(html) {
  modalContent.innerHTML = html;
  modalRoot.classList.remove('hidden');
}
function closeModal() {
  modalRoot.classList.add('hidden');
  modalContent.innerHTML = '';
}

// ---------- EVENT HANDLERS ----------
async function onViewClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'day-prev') { state.todayDate = addDays(state.todayDate, -1); return render(); }
  if (action === 'day-next') { state.todayDate = addDays(state.todayDate, 1); return render(); }
  if (action === 'new-session') return handleNewSession(btn.dataset.slot);
  if (action === 'open-session') { state.view = 'session'; state.editingSessionId = Number(btn.dataset.id); return render(); }
  if (action === 'open-session-history') { state.view = 'session'; state.editingSessionId = Number(btn.dataset.id); return render(); }
  if (action === 'back-to-today') { state.view = 'today'; return render(); }
  if (action === 'delete-session') {
    await DB.delete('sessions', state.editingSessionId);
    state.view = 'today';
    return render();
  }
  if (action === 'toggle-complete') {
    const session = await DB.get('sessions', state.editingSessionId);
    session.completed = !session.completed;
    await saveSession(session);
    return render();
  }
  if (action === 'add-exercise-to-session') return handleAddExerciseToSession();
  if (action === 'add-set') {
    const session = await DB.get('sessions', state.editingSessionId);
    const idx = Number(btn.dataset.idx);
    session.entries[idx].sets.push({ weight: null, reps: null, rpe: null });
    await saveSession(session);
    return render();
  }
  if (action === 'remove-set') {
    const session = await DB.get('sessions', state.editingSessionId);
    const idx = Number(btn.dataset.idx), si = Number(btn.dataset.setIdx);
    session.entries[idx].sets.splice(si, 1);
    await saveSession(session);
    return render();
  }
  if (action === 'remove-exercise') {
    const session = await DB.get('sessions', state.editingSessionId);
    const idx = Number(btn.dataset.idx);
    session.entries.splice(idx, 1);
    await saveSession(session);
    return render();
  }
  if (action === 'week-prev') { state.weekAnchor = addDays(startOfWeek(state.weekAnchor), -7); return render(); }
  if (action === 'week-next') { state.weekAnchor = addDays(startOfWeek(state.weekAnchor), 7); return render(); }
  if (action === 'goto-day') { state.todayDate = btn.dataset.date; state.view = 'today'; return render(); }
  if (action === 'new-exercise') { openModal(exerciseFormHtml(null)); return; }
  if (action === 'edit-exercise') {
    const ex = await DB.get('exercises', Number(btn.dataset.id));
    openModal(exerciseFormHtml(ex));
    return;
  }
  if (action === 'delete-exercise') {
    await DB.delete('exercises', Number(btn.dataset.id));
    return render();
  }
  if (action === 'sign-out') {
    await Auth.signOut();
    return;
  }
}

async function onViewChange(e) {
  const field = e.target.dataset.field;
  if (field && state.view === 'session') {
    const session = await DB.get('sessions', state.editingSessionId);
    let val = e.target.value;
    if (field === 'durationMin' || field === 'distanceKm') val = val === '' ? null : Number(val);
    session[field] = val;
    await saveSession(session);
    return;
  }
  const setField = e.target.dataset.setField;
  if (setField && state.view === 'session') {
    const session = await DB.get('sessions', state.editingSessionId);
    const idx = Number(e.target.dataset.idx), si = Number(e.target.dataset.setIdx);
    const val = e.target.value === '' ? null : Number(e.target.value);
    session.entries[idx].sets[si][setField] = val;
    await saveSession(session);
    return;
  }
  if (e.target.id === 'progress-exercise-select') {
    state.progressExerciseId = Number(e.target.value);
    return render();
  }
}

async function onModalClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'close-modal') return closeModal();
  if (action === 'pick-type') return handlePickType(btn.dataset.type, btn.dataset.slot);
  if (action === 'create-session') return createSession(btn.dataset.type, btn.dataset.slot, btn.dataset.template || null);
  if (action === 'confirm-add-exercise') {
    const select = document.getElementById('pick-exercise');
    const exId = Number(select.value);
    if (!exId) return;
    const session = await DB.get('sessions', state.editingSessionId);
    session.entries = session.entries || [];
    session.entries.push({ exerciseId: exId, sets: [{ weight: null, reps: null, rpe: null }] });
    await saveSession(session);
    closeModal();
    return render();
  }
  if (action === 'new-exercise-inline') {
    openModal(exerciseFormHtml(null));
    return;
  }
  if (action === 'save-exercise') {
    const id = btn.dataset.id;
    const ex = {
      name: document.getElementById('f-name').value.trim(),
      category: document.getElementById('f-category').value,
      unit: document.getElementById('f-unit').value,
      repLow: Number(document.getElementById('f-replow').value),
      repHigh: Number(document.getElementById('f-rephigh').value),
      increment: Number(document.getElementById('f-increment').value),
    };
    if (!ex.name) return;
    if (id) { ex.id = Number(id); await DB.put('exercises', ex); }
    else { await DB.add('exercises', ex); }
    closeModal();
    return render();
  }
}

function onModalChange() {}

init();
