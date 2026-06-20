/* ═══════════════════════════════════════════════════════════════
   Mess Refund Tracker — app.js  (v3)
   Zero network calls. All state in localStorage.
   Keys:
     mrt_settings    — { breakfast, lunch, dinner, currency, preset }
     mrt_logs        — [{ date:'YYYY-MM-DD', meal:'Breakfast'|'Lunch'|'Dinner' }]
     mrt_onboarded   — '1' once banner dismissed
     mrt_hist_filter — 'month'|'all'
═══════════════════════════════════════════════════════════════ */

// ── LocalStorage keys ────────────────────────────────────────
const SETTINGS_KEY    = 'mrt_settings';
const LOGS_KEY        = 'mrt_logs';
const ONBOARDED_KEY   = 'mrt_onboarded';
const HIST_FILTER_KEY = 'mrt_hist_filter';
const PRESET_KEY      = 'mrt_preset';

// ── Presets ──────────────────────────────────────────────────
const PRESETS = [
  { id: 'standard',  label: 'Standard',    breakfast: 15, lunch: 25, dinner: 20 },
  { id: 'flat',      label: 'Flat Rate',   breakfast: 20, lunch: 20, dinner: 20 },
  { id: 'light',     label: 'Light Refund',breakfast: 10, lunch: 15, dinner: 12 },
  { id: 'custom',    label: 'Custom',      breakfast: null, lunch: null, dinner: null },
];

// ── Defaults ─────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  breakfast: 15,
  lunch:     25,
  dinner:    20,
  currency:  '₹',
  preset:    'standard',
};

// ── Meal ordering & styling (dark/neon theme) ─────────────────
const MEAL_ORDER = { Breakfast: 0, Lunch: 1, Dinner: 2 };

const MEAL_STYLES = {
  Breakfast: {
    active:   'meal-btn active',
    inactive: 'meal-btn',
    // Inline styles applied separately in renderDayDetail
    activeStyle:   'background:rgba(6,182,212,0.25);border:2px solid rgba(6,182,212,0.7);color:#67e8f9;',
    inactiveStyle: 'background:rgba(255,255,255,0.04);border:2px solid rgba(6,182,212,0.2);color:rgba(103,232,249,0.55);',
    badge:    'badge-b',
    dot:      'dot-b',
  },
  Lunch: {
    active:   'meal-btn active',
    inactive: 'meal-btn',
    activeStyle:   'background:rgba(167,139,250,0.2);border:2px solid rgba(167,139,250,0.6);color:#c4b5fd;',
    inactiveStyle: 'background:rgba(255,255,255,0.04);border:2px solid rgba(167,139,250,0.18);color:rgba(196,181,253,0.5);',
    badge:    'badge-l',
    dot:      'dot-l',
  },
  Dinner: {
    active:   'meal-btn active',
    inactive: 'meal-btn',
    activeStyle:   'background:rgba(99,102,241,0.22);border:2px solid rgba(99,102,241,0.6);color:#a5b4fc;',
    inactiveStyle: 'background:rgba(255,255,255,0.04);border:2px solid rgba(99,102,241,0.18);color:rgba(165,180,252,0.45);',
    badge:    'badge-d',
    dot:      'dot-d',
  },
};

// Badge inline styles for dark theme
const BADGE_STYLES = {
  Breakfast: 'background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.25);color:#67e8f9;',
  Lunch:     'background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);color:#c4b5fd;',
  Dinner:    'background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);color:#a5b4fc;',
};

const DOT_STYLES = {
  Breakfast: 'background:#06b6d4;box-shadow:0 0 4px rgba(6,182,212,0.8);',
  Lunch:     'background:#a78bfa;box-shadow:0 0 4px rgba(167,139,250,0.8);',
  Dinner:    'background:#6366f1;box-shadow:0 0 4px rgba(99,102,241,0.8);',
};

// ── State ────────────────────────────────────────────────────
let settings    = { ...DEFAULT_SETTINGS };
let logs        = [];
let selectedDay = null;
let histFilter  = 'month';

const TODAY      = new Date();
const YEAR       = TODAY.getFullYear();
const MONTH      = TODAY.getMonth();
const TODAY_STR  = toDateStr(TODAY);
const THIS_MONTH_PREFIX = `${YEAR}-${String(MONTH + 1).padStart(2, '0')}`;

// ── Modal state ───────────────────────────────────────────────
let _modalCallback = null;

// ── Util: dates ──────────────────────────────────────────────
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function monthLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

// ── Util: amounts ─────────────────────────────────────────────
function getAmount(meal) {
  switch (meal) {
    case 'Breakfast': return Number(settings.breakfast) || 0;
    case 'Lunch':     return Number(settings.lunch)     || 0;
    case 'Dinner':    return Number(settings.dinner)    || 0;
    default:          return 0;
  }
}

function calcTotalFor(entries) {
  return entries.reduce((s, e) => s + getAmount(e.meal), 0);
}

function logsForFilter() {
  if (histFilter === 'month') return logs.filter(e => e.date.startsWith(THIS_MONTH_PREFIX));
  return logs;
}

// ── Util: skip queries ────────────────────────────────────────
function getSkippedMeals(dateStr) {
  return logs.filter(e => e.date === dateStr).map(e => e.meal)
    .sort((a, b) => MEAL_ORDER[a] - MEAL_ORDER[b]);
}

function isLogged(dateStr, meal) {
  return logs.some(e => e.date === dateStr && e.meal === meal);
}

// ── Stats: derived ────────────────────────────────────────────
function computeStats() {
  const monthLogs = logs.filter(e => e.date.startsWith(THIS_MONTH_PREFIX));

  const counts = { Breakfast: 0, Lunch: 0, Dinner: 0 };
  monthLogs.forEach(e => counts[e.meal]++);
  const topMeal = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const mostSkipped = topMeal && topMeal[1] > 0 ? topMeal[0].slice(0, 1) : '—';

  const skippedDates = [...new Set(monthLogs.map(e => e.date))].sort();
  let maxStreak = 0, curStreak = 0, prevDate = null;
  skippedDates.forEach(d => {
    if (prevDate) {
      const diff = (new Date(d + 'T00:00:00') - new Date(prevDate + 'T00:00:00')) / 86400000;
      curStreak = diff === 1 ? curStreak + 1 : 1;
    } else {
      curStreak = 1;
    }
    if (curStreak > maxStreak) maxStreak = curStreak;
    prevDate = d;
  });

  return { skippedThisMonth: monthLogs.length, longestStreak: maxStreak, mostSkipped };
}

// ── localStorage I/O ──────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (_) {}

  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (raw) { logs = JSON.parse(raw); if (!Array.isArray(logs)) logs = []; }
  } catch (_) { logs = []; }

  try {
    const f = localStorage.getItem(HIST_FILTER_KEY);
    if (f === 'all' || f === 'month') histFilter = f;
  } catch (_) {}
}

function persistLogs()     { localStorage.setItem(LOGS_KEY,        JSON.stringify(logs));     }
function persistSettings() { localStorage.setItem(SETTINGS_KEY,    JSON.stringify(settings)); }
function persistFilter()   { localStorage.setItem(HIST_FILTER_KEY, histFilter);               }

// ── Actions ───────────────────────────────────────────────────
function toggleMeal(dateStr, meal) {
  const idx = logs.findIndex(e => e.date === dateStr && e.meal === meal);
  idx !== -1 ? logs.splice(idx, 1) : logs.push({ date: dateStr, meal });
  persistLogs();
  render();
}

function selectDay(dateStr) {
  selectedDay = (selectedDay === dateStr) ? null : dateStr;
  render();
}

function setHistoryFilter(f) {
  histFilter = f;
  persistFilter();
  render();
}

function onManualRateChange() {
  settings.preset = 'custom';
  renderPresetCards();
}

// ── Modal ─────────────────────────────────────────────────────
function showModal(callback) {
  _modalCallback = callback;
  document.getElementById('confirm-modal').classList.remove('hidden');
  document.getElementById('modal-confirm').focus();
}

function hideModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
  _modalCallback = null;
  // Always restore modal to destructive default appearance after use
  document.getElementById('modal-confirm').style.display = '';
  document.getElementById('modal-cancel').textContent = 'Cancel';
}

// Helper to show info-only modal (no confirm button)
function showInfoModal(title, body) {
  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-body').textContent    = body;
  document.getElementById('modal-confirm').style.display = 'none';
  document.getElementById('modal-cancel').textContent  = 'Got it';
  document.getElementById('confirm-modal').classList.remove('hidden');
  _modalCallback = null;
}

// ── Render: Onboarding ────────────────────────────────────────
function renderOnboarding() {
  const seen = localStorage.getItem(ONBOARDED_KEY);
  const banner = document.getElementById('onboarding-banner');
  if (seen) banner.classList.add('dismissed');
}

// ── Render: Counter ───────────────────────────────────────────
let _prevTotal = null;

function renderTotal() {
  const filtered = logsForFilter();
  const total    = calcTotalFor(filtered);
  const allTotal = calcTotalFor(logs);
  const el       = document.getElementById('total-counter');
  const label    = document.getElementById('counter-label');
  const sub      = document.getElementById('counter-sub');

  el.textContent = `${settings.currency}${total}`;
  label.textContent = histFilter === 'month' ? "This Month's Refund" : 'All-Time Refund';

  if (histFilter === 'month' && logs.length > 0) {
    const diff = allTotal - total;
    sub.textContent = diff > 0
      ? `+${settings.currency}${diff} from previous months`
      : `${logs.length} total meal${logs.length !== 1 ? 's' : ''} skipped all-time`;
  } else {
    sub.textContent = filtered.length > 0
      ? `${filtered.length} meal${filtered.length !== 1 ? 's' : ''} skipped`
      : '';
  }

  if (total !== _prevTotal) {
    el.classList.remove('counter-pulse');
    void el.offsetWidth;
    el.classList.add('counter-pulse');
    _prevTotal = total;
  }
}

// ── Render: Forecast ─────────────────────────────────────────
function renderForecast() {
  const card = document.getElementById('forecast-card');
  if (!card) return;

  // Only show in "This Month" view
  if (histFilter !== 'month') {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';

  const daysInMonth  = new Date(YEAR, MONTH + 1, 0).getDate();
  const dayOfMonth   = TODAY.getDate(); // 1-indexed
  const pct          = Math.min(100, Math.round((dayOfMonth / daysInMonth) * 100));
  const monthLogs    = logs.filter(e => e.date.startsWith(THIS_MONTH_PREFIX));
  const soFar        = calcTotalFor(monthLogs);

  const textEl    = document.getElementById('forecast-text');
  const barEl     = document.getElementById('forecast-bar');
  const daysLabel = document.getElementById('forecast-days-label');
  const pctLabel  = document.getElementById('forecast-pct-label');

  daysLabel.textContent = `Day ${dayOfMonth} of ${daysInMonth}`;
  pctLabel.textContent  = `${pct}% of month elapsed`;
  barEl.style.width     = `${pct}%`;

  if (monthLogs.length === 0) {
    textEl.textContent = 'Log a skip to see your forecast';
    textEl.style.color = 'rgba(148,163,184,0.5)';
  } else {
    const dailyAvg = soFar / dayOfMonth;
    const forecast = Math.round(dailyAvg * daysInMonth);
    textEl.innerHTML = `On pace for <span style="color:#67e8f9;font-family:'JetBrains Mono',monospace;font-weight:700">${settings.currency}${forecast}</span> by month end`;
    textEl.style.color = '';
  }
}

// ── Render: Stats chips ───────────────────────────────────────
function renderStats() {
  const row   = document.getElementById('stats-row');
  const stats = computeStats();

  const chip = (icon, value, label) => `
    <div class="glass-sm p-3 text-center">
      <div class="text-lg leading-none mb-0.5">${icon}</div>
      <div class="text-xl font-extrabold tabular-nums font-mono" style="color:#67e8f9">${value}</div>
      <div class="text-[10px] font-medium mt-0.5 leading-tight" style="color:rgba(148,163,184,0.5)">${label}</div>
    </div>`;

  row.innerHTML =
    chip('🍽️', stats.skippedThisMonth, 'Meals skipped<br/>this month') +
    chip('🔥', stats.longestStreak || '—', 'Longest streak<br/>(days)') +
    chip('🏆', stats.mostSkipped,          'Most skipped<br/>meal');
}

// ── Render: Settings summary ──────────────────────────────────
function renderSettingsSummary() {
  const c    = settings.currency;
  const text = `B: ${c}${settings.breakfast} · L: ${c}${settings.lunch} · D: ${c}${settings.dinner}`;
  document.getElementById('settings-summary').textContent = text;
  ['b', 'l', 'd'].forEach(k => {
    const h = document.getElementById(`currency-hint-${k}`);
    if (h) h.textContent = c;
  });
}

// ── Render: Preset cards ──────────────────────────────────────
function renderPresetCards() {
  const container = document.getElementById('preset-cards');
  if (!container) return;

  container.innerHTML = PRESETS.map(p => {
    const isActive = settings.preset === p.id;
    const rates = p.id !== 'custom'
      ? `<span style="font-size:10px;color:rgba(148,163,184,0.45);margin-top:2px;display:block">B${p.breakfast} · L${p.lunch} · D${p.dinner}</span>`
      : `<span style="font-size:10px;color:rgba(148,163,184,0.45);margin-top:2px;display:block">Edit rates below</span>`;

    const baseStyle = isActive
      ? ''
      : 'background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.07);color:rgba(226,232,240,0.7);';

    return `
      <button
        onclick="applyPreset('${p.id}')"
        class="preset-card flex flex-col items-start px-3 py-2.5 rounded-xl border-2 transition-all duration-150 text-left ${isActive ? 'active' : ''}"
        style="${baseStyle}"
        aria-pressed="${isActive}"
      >
        <span style="font-size:12px;font-weight:700">${p.label}</span>
        ${rates}
      </button>`;
  }).join('');
}

function applyPreset(id) {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return;

  settings.preset = id;

  if (id !== 'custom') {
    settings.breakfast = p.breakfast;
    settings.lunch     = p.lunch;
    settings.dinner    = p.dinner;
    document.getElementById('input-breakfast').value = p.breakfast;
    document.getElementById('input-lunch').value     = p.lunch;
    document.getElementById('input-dinner').value    = p.dinner;
  }

  renderPresetCards();
}

// ── Render: Calendar ─────────────────────────────────────────
function renderCalendar() {
  const monthName = new Date(YEAR, MONTH, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  document.getElementById('calendar-month-heading').textContent = monthName;

  const firstDow    = new Date(YEAR, MONTH, 1).getDay();
  const daysInMonth = new Date(YEAR, MONTH + 1, 0).getDate();
  const DOW_LABELS  = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  let html = `<div class="grid grid-cols-7 gap-1 text-center select-none">`;

  DOW_LABELS.forEach(l => {
    html += `<div style="font-size:10px;font-weight:700;color:rgba(148,163,184,0.4);padding-bottom:6px">${l}</div>`;
  });

  for (let i = 0; i < firstDow; i++) html += `<div></div>`;

  let hasAnySkip = false;

  for (let d = 1; d <= daysInMonth; d++) {
    const date    = `${YEAR}-${String(MONTH+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const skipped = getSkippedMeals(date);
    const hasSk   = skipped.length > 0;
    const isToday = date === TODAY_STR;
    const isSel   = date === selectedDay;
    if (hasSk) hasAnySkip = true;

    let cellStyle;
    let extraClass = '';
    if (isSel) {
      cellStyle = 'background:rgba(6,182,212,0.2);border:2px solid rgba(6,182,212,0.6);color:#cffafe;';
      extraClass = 'day-skip-glow';
    } else if (isToday) {
      cellStyle = 'background:rgba(167,139,250,0.12);border:2px solid rgba(167,139,250,0.45);color:#e9d5ff;';
      extraClass = 'day-today-glow';
    } else if (hasSk) {
      cellStyle = 'background:rgba(6,182,212,0.07);border:1px solid rgba(6,182,212,0.25);color:#94a3b8;';
      extraClass = '';
    } else {
      cellStyle = 'background:transparent;border:1px solid transparent;color:rgba(148,163,184,0.6);';
      extraClass = '';
    }

    const dotsHtml = hasSk
      ? `<div style="display:flex;justify-content:center;gap:2px;margin-top:2px;height:6px">${
          skipped.map(m => `<span style="width:5px;height:5px;border-radius:50%;display:inline-block;${DOT_STYLES[m]}"></span>`).join('')
        }</div>`
      : `<div style="height:6px"></div>`;

    html += `
      <div
        class="rounded-xl cursor-pointer py-1.5 flex flex-col items-center transition-all duration-150 ${extraClass}"
        style="${cellStyle}"
        onclick="selectDay('${date}')"
        role="button"
        aria-label="${formatDate(date)}${hasSk ? ' – ' + skipped.join(', ') + ' skipped' : ''}"
        tabindex="0"
        onkeydown="if(event.key==='Enter'||event.key===' ')selectDay('${date}')"
        onmouseover="if(!this.classList.contains('day-skip-glow')&&!this.classList.contains('day-today-glow'))this.style.background='rgba(255,255,255,0.05)'"
        onmouseout="if(!this.classList.contains('day-skip-glow')&&!this.classList.contains('day-today-glow'))this.style.background='${hasSk ? 'rgba(6,182,212,0.07)' : 'transparent'}'"
      >
        <span style="font-size:12px;font-weight:600;line-height:1">${d}</span>
        ${dotsHtml}
      </div>`;
  }

  html += `</div>`;
  document.getElementById('calendar-grid').innerHTML = html;

  const emptyEl = document.getElementById('calendar-empty');
  if (!hasAnySkip && !selectedDay) {
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
  }
}

// ── Render: Day detail panel ──────────────────────────────────
function renderDayDetail() {
  const panel = document.getElementById('day-detail');
  if (!selectedDay) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');

  const skipped  = getSkippedMeals(selectedDay);
  const dayTotal = skipped.reduce((s, m) => s + getAmount(m), 0);

  const mealsHtml = ['Breakfast', 'Lunch', 'Dinner'].map(meal => {
    const active = isLogged(selectedDay, meal);
    const st     = MEAL_STYLES[meal];
    const style  = active ? st.activeStyle : st.inactiveStyle;
    const labels = { Breakfast: 'B', Lunch: 'L', Dinner: 'D' };
    return `
      <button
        onclick="toggleMeal('${selectedDay}','${meal}')"
        class="flex flex-col items-center rounded-2xl w-full py-3 font-bold transition-all duration-150 meal-btn ${active ? 'active' : ''}"
        style="${style}"
        aria-pressed="${active}"
      >
        <span style="font-size:20px;line-height:1;font-family:'Space Grotesk',sans-serif">${labels[meal]}</span>
        <span style="font-size:11px;font-weight:600;margin-top:4px;opacity:0.8;font-family:'JetBrains Mono',monospace">${settings.currency}${getAmount(meal)}</span>
      </button>`;
  }).join('');

  const statusHtml = skipped.length > 0
    ? `<span style="color:#67e8f9;font-weight:600">${skipped.join(' + ')}</span> skipped — <span style="color:#a78bfa;font-weight:700;font-family:'JetBrains Mono',monospace">${settings.currency}${dayTotal}</span>`
    : `<span style="color:rgba(148,163,184,0.45)">No meals marked — tap to log a skip</span>`;

  panel.innerHTML = `
    <div class="glass-inset p-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <p style="font-weight:700;color:#e2e8f0;font-size:14px">${formatDate(selectedDay)}</p>
          <p style="font-size:12px;margin-top:2px">${statusHtml}</p>
        </div>
        <button onclick="selectDay(null)"
          style="color:rgba(148,163,184,0.5);background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all 0.2s ease;cursor:pointer"
          onmouseover="this.style.color='#e2e8f0';this.style.background='rgba(255,255,255,0.1)'"
          onmouseout="this.style.color='rgba(148,163,184,0.5)';this.style.background='rgba(255,255,255,0.05)'"
          aria-label="Close">✕</button>
      </div>
      <div class="grid grid-cols-3 gap-2">${mealsHtml}</div>
    </div>`;
}

// ── Render: History log ───────────────────────────────────────
function renderHistory() {
  const list     = document.getElementById('history-list');
  const filtered = logsForFilter();

  // Filter toggle styles
  const activeClass   = 'filter-pill-active';
  const inactiveClass = 'filter-pill-inactive';
  document.getElementById('filter-month-btn').className =
    `flex-1 text-xs py-1.5 rounded-lg transition-all duration-200 ${histFilter==='month' ? activeClass : inactiveClass}`;
  document.getElementById('filter-all-btn').className =
    `flex-1 text-xs py-1.5 rounded-lg transition-all duration-200 ${histFilter==='all' ? activeClass : inactiveClass}`;

  if (filtered.length === 0) {
    const msg = histFilter === 'month'
      ? 'No meals skipped this month yet.'
      : 'No skipped meals logged at all yet.';
    list.innerHTML = `
      <div style="text-align:center;padding:32px 0;color:rgba(148,163,184,0.4)">
        <div style="font-size:28px;margin-bottom:8px">🍽️</div>
        <p style="font-size:13px;font-weight:600">${msg}</p>
        ${histFilter === 'month' ? '<p style="font-size:11px;margin-top:4px">Tap a date on the calendar to log one.</p>' : ''}
      </div>`;
    return;
  }

  // Group by month
  const monthGroups = new Map();
  filtered.forEach(e => {
    const mk = monthKey(e.date);
    if (!monthGroups.has(mk)) monthGroups.set(mk, new Map());
    const dmap = monthGroups.get(mk);
    if (!dmap.has(e.date)) dmap.set(e.date, []);
    dmap.get(e.date).push(e.meal);
  });

  const sortedMonths = [...monthGroups.keys()].sort().reverse();

  let html = '';
  sortedMonths.forEach(mk => {
    const dmap       = monthGroups.get(mk);
    const allInMonth = filtered.filter(e => monthKey(e.date) === mk);
    const monthTotal = calcTotalFor(allInMonth);
    const mLabel     = monthLabel(mk + '-01');
    const isOpen     = mk === THIS_MONTH_PREFIX || sortedMonths.length === 1;
    const bodyId     = `month-body-${mk}`;

    const sortedDates = [...dmap.keys()].sort().reverse();
    let dayRows = '';
    sortedDates.forEach(date => {
      const meals    = dmap.get(date).sort((a, b) => MEAL_ORDER[a] - MEAL_ORDER[b]);
      const dayTotal = meals.reduce((s, m) => s + getAmount(m), 0);
      const badges   = meals.map(m =>
        `<span style="font-size:11px;padding:2px 8px;border-radius:9999px;font-weight:600;${BADGE_STYLES[m]}">
          ${m} · ${settings.currency}${getAmount(m)}
        </span>`).join('');

      dayRows += `
        <div class="glass-inset p-3" style="transition:border-color 0.2s ease">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
            <span style="font-weight:600;color:#e2e8f0;font-size:13px">${formatDate(date)}</span>
            <span style="font-weight:700;color:#67e8f9;font-size:13px;white-space:nowrap;font-family:'JetBrains Mono',monospace">${settings.currency}${dayTotal}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${badges}</div>
        </div>`;
    });

    html += `
      <div class="glass-sm overflow-hidden">
        <button
          onclick="toggleMonthSection('${bodyId}')"
          style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(6,182,212,0.04);text-align:left;cursor:pointer;transition:background 0.2s ease"
          onmouseover="this.style.background='rgba(6,182,212,0.08)'"
          onmouseout="this.style.background='rgba(6,182,212,0.04)'"
        >
          <span style="font-size:13px;font-weight:700;color:#e2e8f0">${mLabel}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;font-weight:700;color:#67e8f9;font-family:'JetBrains Mono',monospace">${settings.currency}${monthTotal}</span>
            <svg id="arrow-${bodyId}" style="width:14px;height:14px;color:rgba(148,163,184,0.4);transition:transform 0.2s ease;${isOpen ? 'transform:rotate(180deg)' : ''}"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </button>
        <div id="${bodyId}" class="month-body ${isOpen ? 'expanded' : 'collapsed'}">
          <div style="padding:8px 12px;display:flex;flex-direction:column;gap:8px">${dayRows}</div>
        </div>
      </div>`;
  });

  list.innerHTML = html;
}

function toggleMonthSection(bodyId) {
  const body  = document.getElementById(bodyId);
  const arrow = document.getElementById(`arrow-${bodyId}`);
  if (!body) return;
  const isOpen = body.classList.contains('expanded');
  body.classList.toggle('expanded',  !isOpen);
  body.classList.toggle('collapsed',  isOpen);
  if (arrow) {
    arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  }
}

// ── Master render ─────────────────────────────────────────────
function render() {
  renderTotal();
  renderForecast();
  renderStats();
  renderSettingsSummary();
  renderPresetCards();
  renderCalendar();
  renderDayDetail();
  renderHistory();
}

// ── Export: Warden Report ─────────────────────────────────────
function handleExport() {
  if (logs.length === 0) {
    showInfoModal('Nothing to export', 'Log some skipped meals first, then export.');
    return;
  }

  const total     = calcTotalFor(logs);
  const genDate   = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const presetObj = PRESETS.find(p => p.id === settings.preset) || PRESETS[0];
  const presetName = presetObj.label;

  const sorted = [...logs].sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal]
  );

  const rows = sorted.map((e, i) => `
    <tr class="${i % 2 === 1 ? 'even' : ''}">
      <td>${i + 1}</td><td>${formatDate(e.date)}</td><td>${e.meal}</td>
      <td class="amount-cell">${settings.currency}${getAmount(e.meal)}</td>
    </tr>`).join('');

  const reportHTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Mess Rebate Claim Report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Georgia','Times New Roman',serif;max-width:720px;margin:48px auto;padding:0 28px;color:#0f172a;line-height:1.65;font-size:15px}
  .app-brand{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0891b2;margin-bottom:8px}
  h1{font-size:1.9rem;font-weight:900;letter-spacing:-.02em;color:#0f172a}
  .subtitle{font-size:.88rem;color:#64748b;margin-top:4px;margin-bottom:4px}
  .policy{font-size:.78rem;color:#7c3aed;font-weight:700;margin-top:2px}
  hr{border:none;border-top:3px solid #1e293b;margin:18px 0 24px}
  .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:28px}
  .meta-item label{display:block;font-size:.68rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#94a3b8;margin-bottom:3px}
  .meta-item span{font-size:.92rem;font-weight:700;color:#1e293b}
  table{width:100%;border-collapse:collapse;margin-bottom:28px}
  thead tr{background:#1e293b;color:#fff}
  thead th{padding:11px 13px;text-align:left;font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  tbody td{padding:9px 13px;border-bottom:1px solid #e2e8f0;font-size:.88rem}
  tbody tr.even td{background:#f8fafc}
  .amount-cell{font-weight:700}
  .total-row td{font-weight:800;font-size:.95rem;border-top:2.5px solid #1e293b!important;background:#ecfeff!important;padding:11px 13px}
  .grand-box{text-align:right;margin-top:28px;padding:22px 28px;background:#1e293b;color:#fff;border-radius:14px}
  .grand-box .g-label{font-size:.72rem;opacity:.55;text-transform:uppercase;letter-spacing:.09em}
  .grand-box .g-amount{font-size:2.6rem;font-weight:900;letter-spacing:-.03em;margin-top:6px;color:#67e8f9}
  .sig-block{margin-top:52px;display:grid;grid-template-columns:repeat(2,1fr);gap:48px}
  .sig-line{border-top:1px solid #1e293b;padding-top:7px;font-size:.76rem;color:#64748b}
  .footer{margin-top:28px;font-size:.74rem;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;line-height:1.7}
  @media print{body{margin:20px auto}.no-print{display:none}}
</style></head><body>
  <div class="app-brand">Mess Refund Tracker</div>
  <h1>Mess Rebate Claim Report</h1>
  <p class="subtitle">Formally submitted for processing by the Mess Warden / Administration</p>
  <p class="policy">Policy: ${presetName} Rate</p><hr/>
  <div class="meta-grid">
    <div class="meta-item"><label>Date of Report</label><span>${genDate}</span></div>
    <div class="meta-item"><label>Total Entries</label><span>${logs.length} meal${logs.length!==1?'s':''}</span></div>
    <div class="meta-item"><label>Breakfast Rate</label><span>${settings.currency}${settings.breakfast}/skip</span></div>
    <div class="meta-item"><label>Lunch Rate</label><span>${settings.currency}${settings.lunch}/skip</span></div>
    <div class="meta-item"><label>Dinner Rate</label><span>${settings.currency}${settings.dinner}/skip</span></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Meal Skipped</th><th>Amount</th></tr></thead>
    <tbody>${rows}<tr class="total-row"><td colspan="3">Total Refund Owed</td><td>${settings.currency}${total}</td></tr></tbody>
  </table>
  <div class="grand-box">
    <div class="g-label">Grand Total Refund</div>
    <div class="g-amount">${settings.currency}${total}</div>
  </div>
  <div class="sig-block">
    <div><div style="height:52px"></div><div class="sig-line">Student Signature &amp; Roll No.</div></div>
    <div><div style="height:52px"></div><div class="sig-line">Mess Warden Signature &amp; Stamp</div></div>
  </div>
  <div class="footer">
    Auto-generated by Mess Refund Tracker · ${genDate} · Policy: ${presetName}
    (B=${settings.currency}${settings.breakfast}, L=${settings.currency}${settings.lunch}, D=${settings.currency}${settings.dinner}).<br/>
    Attach supporting evidence (gate-pass records, attendance log) as required by your institution's rebate policy.
  </div>
  <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    showInfoModal('Popup blocked', 'Please allow popups for this page, then try again.');
    return;
  }
  win.document.write(reportHTML);
  win.document.close();
}

// ── Settings: save ────────────────────────────────────────────
function handleSaveSettings() {
  const b = parseFloat(document.getElementById('input-breakfast').value);
  const l = parseFloat(document.getElementById('input-lunch').value);
  const d = parseFloat(document.getElementById('input-dinner').value);
  const c = document.getElementById('input-currency').value.trim();

  settings.breakfast = isNaN(b) || b < 0 ? DEFAULT_SETTINGS.breakfast : b;
  settings.lunch     = isNaN(l) || l < 0 ? DEFAULT_SETTINGS.lunch     : l;
  settings.dinner    = isNaN(d) || d < 0 ? DEFAULT_SETTINGS.dinner    : d;
  settings.currency  = c || DEFAULT_SETTINGS.currency;

  persistSettings();
  render();

  const btn = document.getElementById('save-settings-btn');
  btn.textContent = '✓ Saved!';
  btn.classList.add('saved-state');
  setTimeout(() => {
    btn.textContent = 'Save Settings';
    btn.classList.remove('saved-state');
  }, 1800);
}

// ── Settings: panel toggle ────────────────────────────────────
function toggleSettingsPanel() {
  const panel  = document.getElementById('settings-panel');
  const arrow  = document.getElementById('settings-arrow');
  const btn    = document.getElementById('settings-toggle-btn');
  const isOpen = panel.classList.contains('expanded');

  if (isOpen) {
    panel.classList.replace('expanded', 'collapsed');
    arrow.style.transform = 'rotate(0deg)';
    btn.setAttribute('aria-expanded', 'false');
  } else {
    panel.classList.replace('collapsed', 'expanded');
    arrow.style.transform = 'rotate(180deg)';
    btn.setAttribute('aria-expanded', 'true');
    document.getElementById('input-breakfast').value = settings.breakfast;
    document.getElementById('input-lunch').value     = settings.lunch;
    document.getElementById('input-dinner').value    = settings.dinner;
    document.getElementById('input-currency').value  = settings.currency;
    renderPresetCards();
  }
}

// ── Clear data ────────────────────────────────────────────────
function handleClearData() {
  document.getElementById('modal-title').textContent   = 'Delete all data?';
  document.getElementById('modal-body').textContent    = 'Are you sure? This deletes all logged data permanently.';
  document.getElementById('modal-confirm').textContent = 'Delete Everything';
  document.getElementById('modal-confirm').style.display = '';
  document.getElementById('modal-cancel').textContent  = 'Cancel';

  showModal(() => {
    logs = [];
    selectedDay = null;
    persistLogs();
    render();
  });
}

// ── NEW: Backup — Export ──────────────────────────────────────
function handleBackupExport() {
  const backup = {
    version:  3,
    exported: new Date().toISOString(),
    settings: JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
    logs:     JSON.parse(localStorage.getItem(LOGS_KEY)     || '[]'),
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');

  const datePart = toDateStr(new Date());
  a.href     = url;
  a.download = `mess-refund-backup-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── NEW: Backup — Import ──────────────────────────────────────
function handleBackupImport() {
  // 1. Confirm intent before opening file picker
  document.getElementById('modal-title').textContent   = 'Import backup?';
  document.getElementById('modal-body').textContent    = 'This will overwrite your current data with the backup file. Your current data will be lost.';
  document.getElementById('modal-confirm').textContent = 'Choose File & Import';
  document.getElementById('modal-confirm').style.display = '';
  document.getElementById('modal-cancel').textContent  = 'Cancel';

  showModal(() => {
    // 2. Open file picker after confirmation
    document.getElementById('backup-file-input').click();
  });
}

function processBackupFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);

      // Validate shape
      if (typeof data !== 'object' || data === null) throw new Error('Not a JSON object');
      if (typeof data.settings !== 'object' || data.settings === null) throw new Error('Missing settings');
      if (!Array.isArray(data.logs)) throw new Error('Missing logs array');

      // Validate each log entry
      data.logs.forEach((e, i) => {
        if (!e.date || !e.meal) throw new Error(`Invalid log entry at index ${i}`);
        if (!['Breakfast', 'Lunch', 'Dinner'].includes(e.meal)) throw new Error(`Unknown meal: ${e.meal}`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error(`Bad date format: ${e.date}`);
      });

      // Apply to localStorage
      const mergedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
      localStorage.setItem(SETTINGS_KEY,    JSON.stringify(mergedSettings));
      localStorage.setItem(LOGS_KEY,        JSON.stringify(data.logs));

      // Reload in-memory state
      settings = mergedSettings;
      logs     = data.logs;
      selectedDay = null;

      // Sync inputs
      document.getElementById('input-breakfast').value = settings.breakfast;
      document.getElementById('input-lunch').value     = settings.lunch;
      document.getElementById('input-dinner').value    = settings.dinner;
      document.getElementById('input-currency').value  = settings.currency;

      render();
      showInfoModal('Backup restored ✓', `${data.logs.length} entries imported successfully.`);
    } catch (err) {
      showInfoModal('Invalid backup file', `Could not import: ${err.message}. Please use a file exported by this app.`);
    }
  };
  reader.readAsText(file);
}

// ── NEW: Save as Image (Canvas) ───────────────────────────────
function handleSaveAsImage() {
  const filtered   = logsForFilter();
  const total      = calcTotalFor(filtered);
  const presetObj  = PRESETS.find(p => p.id === settings.preset) || PRESETS[0];
  const presetName = presetObj.label;
  const genDate    = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const filterLabel = histFilter === 'month' ? 'This Month' : 'All Time';

  // Determine canvas height based on entry count
  const lineH      = 36;
  const headerH    = 220;
  const footerH    = 100;
  const emptyH     = 80;
  const maxEntries = 20; // cap canvas for readability
  const entries    = filtered.slice(0, maxEntries);
  const canvasH    = headerH + (entries.length > 0 ? entries.length * lineH + 24 : emptyH) + footerH;
  const canvasW    = 640;

  const canvas = document.createElement('canvas');
  canvas.width  = canvasW * 2; // 2x for retina
  canvas.height = canvasH * 2;
  canvas.style.width  = canvasW + 'px';
  canvas.style.height = canvasH + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2); // retina

  // ── Background ──
  const bgGrad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  bgGrad.addColorStop(0,   '#07070f');
  bgGrad.addColorStop(0.5, '#0d0d1a');
  bgGrad.addColorStop(1,   '#07070f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Subtle blob
  const blob1 = ctx.createRadialGradient(80, 60, 0, 80, 60, 200);
  blob1.addColorStop(0, 'rgba(6,182,212,0.12)');
  blob1.addColorStop(1, 'transparent');
  ctx.fillStyle = blob1;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const blob2 = ctx.createRadialGradient(canvasW - 60, canvasH - 60, 0, canvasW - 60, canvasH - 60, 180);
  blob2.addColorStop(0, 'rgba(167,139,250,0.1)');
  blob2.addColorStop(1, 'transparent');
  ctx.fillStyle = blob2;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // ── Card border ──
  ctx.strokeStyle = 'rgba(6,182,212,0.2)';
  ctx.lineWidth   = 1.5;
  roundRect(ctx, 16, 16, canvasW - 32, canvasH - 32, 18);
  ctx.stroke();

  // ── App brand ──
  ctx.font      = '700 10px "Space Grotesk", sans-serif';
  ctx.fillStyle = 'rgba(6,182,212,0.6)';
  ctx.letterSpacing = '2px';
  ctx.fillText('MESS REFUND TRACKER', 36, 50);
  ctx.letterSpacing = '0px';

  // ── Title ──
  ctx.font      = '800 22px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText('Refund Receipt', 36, 82);

  // ── Meta line ──
  ctx.font      = '500 12px "Space Grotesk", sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.55)';
  ctx.fillText(`${genDate}  ·  Policy: ${presetName}  ·  View: ${filterLabel}`, 36, 104);

  // ── Neon divider ──
  const divGrad = ctx.createLinearGradient(36, 0, canvasW - 36, 0);
  divGrad.addColorStop(0,   'transparent');
  divGrad.addColorStop(0.5, 'rgba(6,182,212,0.4)');
  divGrad.addColorStop(1,   'transparent');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(36, 118);
  ctx.lineTo(canvasW - 36, 118);
  ctx.stroke();

  // ── Column headers ──
  ctx.font      = '700 10px "Space Grotesk", sans-serif';
  ctx.fillStyle = 'rgba(6,182,212,0.55)';
  ctx.fillText('#',    36,  146);
  ctx.fillText('DATE', 72,  146);
  ctx.fillText('MEAL', 240, 146);
  ctx.fillText('AMOUNT', 440, 146);

  // Header underline
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(36, 154); ctx.lineTo(canvasW - 36, 154);
  ctx.stroke();

  let y = 154;

  if (entries.length === 0) {
    ctx.font      = '500 13px "Space Grotesk", sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.4)';
    ctx.fillText('No entries for this period', 36, y + 40);
    y += emptyH;
  } else {
    // Sort by date asc then meal
    const sorted = [...entries].sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal]
    );

    sorted.forEach((e, i) => {
      const rowY = y + lineH * (i + 1) - 8;

      // Alternate row tint
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(28, rowY - 18, canvasW - 56, lineH - 4);
      }

      ctx.font      = '600 12px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(148,163,184,0.55)';
      ctx.fillText(String(i + 1), 36, rowY);

      ctx.font      = '500 12px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(formatDate(e.date), 72, rowY);

      // Meal badge color
      const mealColor = e.meal === 'Breakfast' ? '#67e8f9' : e.meal === 'Lunch' ? '#c4b5fd' : '#a5b4fc';
      ctx.font      = '600 12px "Space Grotesk", sans-serif';
      ctx.fillStyle = mealColor;
      ctx.fillText(e.meal, 240, rowY);

      ctx.font      = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${settings.currency}${getAmount(e.meal)}`, 440, rowY);
    });

    if (filtered.length > maxEntries) {
      const rowY = y + lineH * (entries.length + 1) - 8;
      ctx.font      = '500 11px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(148,163,184,0.4)';
      ctx.fillText(`... and ${filtered.length - maxEntries} more entries`, 36, rowY);
    }

    y += entries.length * lineH + 24;
  }

  // ── Total divider ──
  const divGrad2 = ctx.createLinearGradient(36, 0, canvasW - 36, 0);
  divGrad2.addColorStop(0,   'transparent');
  divGrad2.addColorStop(0.5, 'rgba(167,139,250,0.3)');
  divGrad2.addColorStop(1,   'transparent');
  ctx.strokeStyle = divGrad2;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(36, y + 4); ctx.lineTo(canvasW - 36, y + 4);
  ctx.stroke();

  // ── Grand total ──
  ctx.font      = '700 12px "Space Grotesk", sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.5)';
  ctx.fillText('TOTAL REFUND OWED', 36, y + 32);

  const totalText = `${settings.currency}${total}`;
  const totalGrad = ctx.createLinearGradient(0, 0, 200, 0);
  totalGrad.addColorStop(0, '#06f0e0');
  totalGrad.addColorStop(1, '#a78bfa');
  ctx.font      = '900 36px "JetBrains Mono", monospace';
  ctx.fillStyle = totalGrad;
  ctx.fillText(totalText, 36, y + 72);

  // ── Footer ──
  ctx.font      = '400 10px "Space Grotesk", sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.3)';
  ctx.fillText(`Generated by Mess Refund Tracker — offline-first, no login required`, 36, canvasH - 24);

  // ── Download ──
  canvas.toBlob(blob => {
    if (!blob) { showInfoModal('Error', 'Could not generate image. Try again.'); return; }
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `mess-refund-receipt-${toDateStr(new Date())}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

// Canvas helper: rounded rect path
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load state
  loadState();

  // 2. Onboarding
  renderOnboarding();
  document.getElementById('onboarding-dismiss').addEventListener('click', () => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    document.getElementById('onboarding-banner').classList.add('dismissed');
  });

  // 3. Populate inputs
  document.getElementById('input-breakfast').value = settings.breakfast;
  document.getElementById('input-lunch').value     = settings.lunch;
  document.getElementById('input-dinner').value    = settings.dinner;
  document.getElementById('input-currency').value  = settings.currency;

  // 4. Wire event listeners
  document.getElementById('settings-toggle-btn').addEventListener('click', toggleSettingsPanel);
  document.getElementById('save-settings-btn').addEventListener('click', handleSaveSettings);
  document.getElementById('clear-data-btn').addEventListener('click', handleClearData);
  document.getElementById('export-btn').addEventListener('click', handleExport);
  document.getElementById('save-image-btn').addEventListener('click', handleSaveAsImage);

  // Backup / Restore
  document.getElementById('backup-export-btn').addEventListener('click', handleBackupExport);
  document.getElementById('backup-import-btn').addEventListener('click', handleBackupImport);
  document.getElementById('backup-file-input').addEventListener('change', (e) => {
    processBackupFile(e.target.files[0]);
    e.target.value = ''; // reset so same file can be selected again
  });

  // Modal buttons
  document.getElementById('modal-cancel').addEventListener('click', hideModal);
  document.getElementById('modal-backdrop').addEventListener('click', hideModal);
  document.getElementById('modal-confirm').addEventListener('click', () => {
    if (_modalCallback) _modalCallback();
    hideModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideModal();
  });

  // 5. Initialize Pendo with anonymous visitor
  pendo.initialize({
    visitor: {
      id: ''
    }
  });

  // 6. Initial render
  _prevTotal = null;
  render();
});
