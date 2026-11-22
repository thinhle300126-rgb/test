/* Daily Habits — a tiny habit tracker that keeps everything in localStorage. */
(() => {
  'use strict';

  // ---------- Constants ----------
  const STORE_KEY = 'daily-habits-v1';
  const COLORS = ['lavender', 'mint', 'peach', 'sky', 'rose', 'butter', 'sage', 'lilac'];
  const TYPES = {
    check: 'Simple tick',
    reading: 'Reading (pages / minutes / books)',
    screen: 'Screen time (hours, with a goal)',
  };
  const DAY_MS = 86400000;

  const defaultState = () => ({
    version: 1,
    settings: { theme: 'auto' },
    habits: [
      { id: 'english', name: 'English practice', emoji: '🗣️', color: 'lavender', type: 'check', time: '07:00', options: ['Speaking', 'Grammar', 'Vocabulary'] },
      { id: 'reading', name: 'Reading', emoji: '📚', color: 'peach', type: 'reading', weeklyBooks: 1 },
      { id: 'exercise', name: 'Exercise', emoji: '🏃', color: 'mint', type: 'check' },
      { id: 'meditation', name: 'Meditation', emoji: '🧘', color: 'sky', type: 'check' },
      { id: 'journal', name: 'Journaling', emoji: '✍️', color: 'rose', type: 'check' },
      { id: 'screen', name: 'Low screen time', emoji: '📱', color: 'butter', type: 'screen', goal: 3 },
    ],
    logs: {},   // { 'YYYY-MM-DD': { habitId: entry } }
    books: [],  // [{ id, title, date }]
  });

  // ---------- Storage ----------
  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return normalise(JSON.parse(raw));
    } catch (e) { /* storage blocked or corrupt — start fresh */ }
    return defaultState();
  }
  function normalise(s) {
    const d = defaultState();
    return {
      version: 1,
      settings: { ...d.settings, ...(s.settings || {}) },
      habits: Array.isArray(s.habits) ? s.habits : d.habits,
      logs: s.logs && typeof s.logs === 'object' ? s.logs : {},
      books: Array.isArray(s.books) ? s.books : [],
    };
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save — storage is full or blocked'); }
  }

  // ---------- Date helpers (always local time, never UTC) ----------
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const todayKey = () => keyOf(new Date());
  const startOfWeek = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }; // Monday
  const fmt = (d, opts) => d.toLocaleDateString('en-GB', opts);

  // ---------- Habit logic ----------
  const entry = (dateKey, id) => (state.logs[dateKey] || {})[id];
  function setEntry(dateKey, id, value) {
    if (!state.logs[dateKey]) state.logs[dateKey] = {};
    if (value == null) delete state.logs[dateKey][id];
    else state.logs[dateKey][id] = value;
    if (!Object.keys(state.logs[dateKey]).length) delete state.logs[dateKey];
    save();
  }
  function isDone(h, e) {
    if (!e) return false;
    if (h.type === 'reading') return (e.pages || 0) > 0 || (e.minutes || 0) > 0;
    if (h.type === 'screen') return typeof e.hours === 'number' && e.hours <= (h.goal ?? 3);
    return !!e.done;
  }
  const doneOn = (h, k) => isDone(h, entry(k, h.id));

  function currentStreak(h) {
    let d = new Date();
    if (!doneOn(h, keyOf(d))) d = addDays(d, -1); // today is still open — don't break the streak yet
    let n = 0;
    while (doneOn(h, keyOf(d))) { n++; d = addDays(d, -1); }
    return n;
  }
  function bestStreak(h) {
    const keys = Object.keys(state.logs).filter((k) => doneOn(h, k)).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      const d = parseKey(k);
      run = prev && Math.round((d - prev) / DAY_MS) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    return best;
  }
  const booksBetween = (from, to) => state.books.filter((b) => b.date >= keyOf(from) && b.date <= keyOf(to));

  // ---------- UI state ----------
  let tab = 'today';
  let viewDate = todayKey();
  let weekStart = startOfWeek(new Date());
  const $view = document.getElementById('view');
  const $modal = document.getElementById('modal');

  // ---------- Utilities ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const colorVars = (c) => { const k = COLORS.includes(c) ? c : 'lavender'; return `--c:var(--${k});--c-soft:var(--${k}-soft);--c-ink:var(--${k}-ink)`; };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const round1 = (n) => Math.round(n * 10) / 10;
  const icon = {
    left: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  };
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function haptic() { if (navigator.vibrate) navigator.vibrate(10); }

  // ---------- Theme ----------
  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  }

  // ---------- Render router ----------
  function render() {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'today') renderToday();
    else if (tab === 'week') renderWeek();
    else if (tab === 'stats') renderStats();
    else renderSettings();
  }

  // ---------- TODAY ----------
  function renderToday() {
    const d = parseKey(viewDate);
    const isToday = viewDate === todayKey();
    const habits = state.habits;
    const done = habits.filter((h) => doneOn(h, viewDate)).length;
    const pct = habits.length ? done / habits.length : 0;
    const C = 2 * Math.PI * 24;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    $view.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow">${isToday ? fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Editing a past day'}</div>
          <h1>${isToday ? greet : fmt(d, { weekday: 'long' })} ${isToday ? '🌿' : ''}</h1>
        </div>
        <div class="ring" aria-label="${done} of ${habits.length} habits done">
          <svg viewBox="0 0 58 58"><circle class="track" cx="29" cy="29" r="24"/>
          <circle class="fill" cx="29" cy="29" r="24" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
          <span>${done}/${habits.length}</span>
        </div>
      </header>

      <div class="date-nav">
        <button class="icon-btn" data-action="day" data-step="-1" aria-label="Previous day">${icon.left}</button>
        <div class="label">${isToday ? 'Today' : fmt(d, { day: 'numeric', month: 'short', year: 'numeric' })}
          <small>${isToday ? fmt(d, { day: 'numeric', month: 'short' }) : '<button data-action="goto-today" class="small" style="color:var(--accent);font-weight:800">Back to today</button>'}</small></div>
        <button class="icon-btn" data-action="day" data-step="1" aria-label="Next day" ${isToday ? 'disabled' : ''}>${icon.right}</button>
      </div>

      <div class="cards">
        ${habits.length ? habits.map((h) => habitCard(h)).join('') : `<div class="empty">No habits yet.<br><br><button class="btn primary" data-action="add-habit">Add your first habit</button></div>`}
      </div>`;
  }

  function habitCard(h) {
    const e = entry(viewDate, h.id) || {};
    const done = isDone(h, e);
    const streak = currentStreak(h);
    const streakTxt = streak ? `<span class="streak">🔥 ${streak} day${streak > 1 ? 's' : ''}</span>` : '';
    const time = h.time ? `<span>⏰ ${esc(h.time)}</span>` : '';
    const checkMark = `<span class="check" aria-hidden="true">${icon.check}</span>`;
    const head = (meta, tappable) => `
      <${tappable ? `button class="habit-row" data-action="toggle" data-id="${h.id}" aria-pressed="${done}"` : 'div class="habit-row"'}>
        <span class="bubble">${esc(h.emoji || '✨')}</span>
        <span class="habit-main"><div class="habit-name">${esc(h.name)}</div><div class="habit-meta">${meta}</div></span>
        ${checkMark}
      </${tappable ? 'button' : 'div'}>`;

    if (h.type === 'reading') {
      const wk = startOfWeek(parseKey(viewDate));
      const books = booksBetween(wk, addDays(wk, 6)).length;
      const goal = h.weeklyBooks || 1;
      return `<div class="card ${done ? 'done' : ''}" style="${colorVars(h.color)}">
        ${head(`${streakTxt}<span>📖 ${books}/${goal} book${goal > 1 ? 's' : ''} this week</span>`, false)}
        <div class="fields">
          ${stepper(h.id, 'pages', 'Pages', e.pages, 5)}
          ${stepper(h.id, 'minutes', 'Minutes', e.minutes, 5)}
        </div>
        <div class="progress-bar" title="Books this week"><div style="width:${Math.min(100, (books / goal) * 100)}%"></div></div>
        <div class="card-foot">
          <span class="small muted">${books >= goal ? 'Weekly book goal reached 🎉' : `${goal - books} more to hit your weekly goal`}</span>
          <button class="pill-btn" data-action="finish-book">+ Finished a book</button>
        </div>
      </div>`;
    }

    if (h.type === 'screen') {
      const goal = h.goal ?? 3;
      const logged = typeof e.hours === 'number';
      let status = `<span class="status muted">Log today's total from Settings › Screen Time</span>`;
      if (logged) {
        status = e.hours <= goal
          ? `<span class="status ok">✓ Within goal (${round1(goal - e.hours)}h to spare)</span>`
          : `<span class="status bad">▲ ${round1(e.hours - goal)}h over goal</span>`;
      }
      return `<div class="card ${done ? 'done' : ''}" style="${colorVars(h.color)}">
        ${head(`${streakTxt}<span>🎯 Goal ≤ ${goal}h</span>`, false)}
        <div class="fields" style="grid-template-columns:1fr">
          ${stepper(h.id, 'hours', 'Hours on phone', logged ? e.hours : '', 0.5, true)}
        </div>
        <div class="card-foot">${status}
          ${logged ? `<button class="pill-btn ghost" data-action="clear-screen" data-id="${h.id}">Clear</button>` : ''}
        </div>
      </div>`;
    }

    // simple tick (optionally with tags)
    const opts = Array.isArray(h.options) ? h.options.filter(Boolean) : [];
    const tags = e.tags || [];
    const chips = opts.length ? `<div class="chips">${opts.map((o) =>
      `<button class="chip ${tags.includes(o) ? 'on' : ''}" data-action="tag" data-id="${h.id}" data-tag="${esc(o)}">${esc(o)}</button>`).join('')}</div>` : '';
    return `<div class="card ${done ? 'done' : ''}" data-card="${h.id}" style="${colorVars(h.color)}">
      ${head(`${streakTxt}${time}${!streak && !time ? '<span>Tap to complete</span>' : ''}`, true)}
      ${chips}
    </div>`;
  }

  function stepper(id, field, label, value, step, decimal) {
    const v = value === '' || value == null || value === 0 ? '' : value;
    return `<div class="field"><label for="f-${id}-${field}">${label}</label>
      <div class="stepper">
        <button data-action="step" data-id="${id}" data-field="${field}" data-step="${-step}" aria-label="Less">−</button>
        <input id="f-${id}-${field}" type="number" min="0" step="${decimal ? 0.1 : 1}" inputmode="${decimal ? 'decimal' : 'numeric'}"
          placeholder="0" value="${v}" data-input="${field}" data-id="${id}">
        <button data-action="step" data-id="${id}" data-field="${field}" data-step="${step}" aria-label="More">+</button>
      </div></div>`;
  }

  function updateField(id, field, value) {
    const h = state.habits.find((x) => x.id === id);
    if (!h) return;
    const cur = { ...(entry(viewDate, id) || {}) };
    if (h.type === 'screen') {
      if (value === null) { setEntry(viewDate, id, null); return; }
      setEntry(viewDate, id, { hours: round1(value) });
    } else {
      cur[field] = Math.round(value);
      if (!cur.pages && !cur.minutes) setEntry(viewDate, id, null);
      else setEntry(viewDate, id, cur);
    }
  }

  // ---------- WEEK ----------
  function renderWeek() {
    const days = [...Array(7)].map((_, i) => addDays(weekStart, i));
    const tk = todayKey();
    const end = days[6];
    const isThisWeek = keyOf(weekStart) === keyOf(startOfWeek(new Date()));
    const range = `${fmt(weekStart, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short' })}`;

    const head = `<div></div>${days.map((d) => `<div class="wg-head ${keyOf(d) === tk ? 'today' : ''}">${fmt(d, { weekday: 'narrow' })}<b>${d.getDate()}</b></div>`).join('')}`;
    const rows = state.habits.map((h) => {
      const cells = days.map((d) => {
        const k = keyOf(d), e = entry(k, h.id), done = isDone(h, e);
        const future = k > tk;
        let label = '';
        let cls = done ? 'done' : '';
        if (h.type === 'screen' && e && typeof e.hours === 'number') { label = round1(e.hours); if (!done) cls = 'miss-screen'; }
        else if (h.type === 'reading' && e) label = e.pages ? e.pages : (e.minutes ? `${e.minutes}′` : '');
        else if (done) label = '✓';
        const title = `${h.name} · ${fmt(d, { weekday: 'short', day: 'numeric', month: 'short' })}`;
        return `<button class="wg-cell ${cls} ${future ? 'future' : ''} ${k === tk ? 'today' : ''}" data-action="open-day" data-date="${k}" ${future ? 'disabled' : ''} title="${esc(title)}" aria-label="${esc(title)}: ${done ? 'done' : 'not done'}">${label}</button>`;
      }).join('');
      return `<div class="wg-name" style="${colorVars(h.color)}"><span>${esc(h.emoji)}</span><span>${esc(h.name)}</span></div>${cells}`;
    }).join('');
    const totals = `<div class="wg-name muted">Done</div>${days.map((d) => {
      const k = keyOf(d);
      const n = state.habits.filter((h) => doneOn(h, k)).length;
      return `<div class="wg-total">${k > tk ? '' : `${n}/${state.habits.length}`}</div>`;
    }).join('')}`;

    const pastDays = days.filter((d) => keyOf(d) <= tk).length || 1;
    const summary = state.habits.map((h) => {
      const n = days.filter((d) => doneOn(h, keyOf(d))).length;
      return `<div class="sum-row" style="${colorVars(h.color)}"><span>${esc(h.emoji)}</span>
        <span style="width:110px;font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.name)}</span>
        <div class="bar"><div style="width:${(n / pastDays) * 100}%"></div></div><b>${n}/${pastDays}</b></div>`;
    }).join('');

    const books = booksBetween(weekStart, end);

    $view.innerHTML = `
      <header class="page-head"><div><div class="eyebrow">Weekly overview</div><h1>${isThisWeek ? 'This week' : range}</h1></div></header>
      <div class="date-nav">
        <button class="icon-btn" data-action="week" data-step="-1" aria-label="Previous week">${icon.left}</button>
        <div class="label">${range}<small>${isThisWeek ? 'Current week' : '<button data-action="this-week" style="color:var(--accent);font-weight:800" class="small">Jump to this week</button>'}</small></div>
        <button class="icon-btn" data-action="week" data-step="1" aria-label="Next week" ${isThisWeek ? 'disabled' : ''}>${icon.right}</button>
      </div>
      <div class="week-wrap"><div class="week-grid">${head}${rows}${totals}</div></div>
      <p class="hint" style="text-align:center">Tap any square to open and edit that day.</p>
      <h2>Completion</h2>
      <div class="week-summary">${summary}</div>
      <h2>Books finished this week</h2>
      ${books.length ? `<ul class="book-list">${books.map(bookItem).join('')}</ul>` : '<p class="muted small" style="margin:0 2px">None yet — keep going 📖</p>'}`;
  }

  // ---------- STATS ----------
  function renderStats() {
    const streaks = state.habits.map((h) => {
      const cur = currentStreak(h), best = bestStreak(h);
      return `<div class="streak-card" style="${colorVars(h.color)}">
        <div class="top"><span class="bubble" style="width:30px;height:30px;font-size:15px;border-radius:10px">${esc(h.emoji)}</span><span>${esc(h.name)}</span></div>
        <div class="big">${cur} <small>day${cur === 1 ? '' : 's'} 🔥</small></div>
        <div class="best">Best: ${best} day${best === 1 ? '' : 's'}</div>
      </div>`;
    }).join('');

    const screenHabit = state.habits.find((h) => h.type === 'screen');
    const readingHabit = state.habits.find((h) => h.type === 'reading');

    // reading numbers
    const now = new Date();
    let pages7 = 0, mins7 = 0;
    for (let i = 0; i < 7; i++) {
      const e = readingHabit && entry(keyOf(addDays(now, -i)), readingHabit.id);
      if (e) { pages7 += e.pages || 0; mins7 += e.minutes || 0; }
    }
    const wk = startOfWeek(now);
    const booksWeek = booksBetween(wk, addDays(wk, 6)).length;
    const booksMonth = booksBetween(new Date(now.getFullYear(), now.getMonth(), 1), now).length;
    const booksYear = booksBetween(new Date(now.getFullYear(), 0, 1), now).length;
    const sortedBooks = [...state.books].sort((a, b) => (a.date < b.date ? 1 : -1));

    $view.innerHTML = `
      <header class="page-head"><div><div class="eyebrow">Your progress</div><h1>Stats</h1></div></header>
      <h2 style="margin-top:0">Streaks</h2>
      ${state.habits.length ? `<div class="streak-grid">${streaks}</div>` : '<p class="muted">Add a habit to see streaks.</p>'}

      ${screenHabit ? `<h2>Screen time · last 30 days</h2>${screenChart(screenHabit)}` : ''}

      ${readingHabit ? `
      <h2>Reading</h2>
      <div class="chart-card">
        <div class="chart-stats" style="margin-bottom:8px">
          <div><b>${pages7}</b><span>pages, 7d</span></div>
          <div><b>${mins7}</b><span>minutes, 7d</span></div>
          <div><b>${booksWeek}/${readingHabit.weeklyBooks || 1}</b><span>books / week</span></div>
        </div>
        <div class="chart-stats" style="grid-template-columns:1fr 1fr;margin:0">
          <div><b>${booksMonth}</b><span>books this month</span></div>
          <div><b>${booksYear}</b><span>books in ${now.getFullYear()}</span></div>
        </div>
      </div>
      <h2>Books finished</h2>
      ${sortedBooks.length ? `<ul class="book-list">${sortedBooks.map(bookItem).join('')}</ul>` : '<p class="muted small" style="margin:0 2px">No books logged yet. Tap “Finished a book” on the Today screen.</p>'}
      ` : ''}`;

    if (screenHabit) wireChart();
  }

  function bookItem(b) {
    return `<li><span style="font-size:20px">📘</span><span class="t"><b>${esc(b.title || 'Untitled book')}</b>
      <span class="small muted">${fmt(parseKey(b.date), { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
      <button class="icon-btn" data-action="delete-book" data-id="${b.id}" aria-label="Delete book">${icon.trash}</button></li>`;
  }

  function screenChart(h) {
    const goal = h.goal ?? 3;
    const days = [...Array(30)].map((_, i) => addDays(new Date(), i - 29));
    const data = days.map((d) => { const e = entry(keyOf(d), h.id); return { d, v: e && typeof e.hours === 'number' ? e.hours : null }; });
    const vals = data.filter((x) => x.v !== null).map((x) => x.v);
    const avg = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const within = data.filter((x) => x.v !== null && x.v <= goal).length;

    const W = 340, H = 180, padL = 26, padR = 6, padT = 12, padB = 22;
    const max = Math.max(goal * 1.5, ...vals, 1);
    const yMax = Math.ceil(max / 2) * 2;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const slot = plotW / 30, bw = Math.max(3, slot - 2); // 2px gap between bars
    const y = (v) => padT + plotH - (v / yMax) * plotH;

    const ticks = []; const step = yMax <= 6 ? 1 : yMax <= 12 ? 2 : 4;
    for (let t = 0; t <= yMax; t += step) ticks.push(t);

    const r = 4;
    const bars = data.map((p, i) => {
      const x = padL + i * slot + (slot - bw) / 2;
      if (p.v === null) return `<circle class="nodata" cx="${x + bw / 2}" cy="${padT + plotH - 2}" r="1.6"/>`;
      const top = y(p.v), hgt = Math.max(2, padT + plotH - top), rr = Math.min(r, bw / 2, hgt);
      // rounded top, square base anchored on the baseline
      const path = `M${x},${padT + plotH} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + bw - rr} Q${x + bw},${top} ${x + bw},${top + rr} V${padT + plotH} Z`;
      return `<path class="${p.v <= goal ? 'bar-ok' : 'bar-over'}" d="${path}" data-i="${i}"/>`;
    }).join('');
    const hits = data.map((p, i) => `<rect class="hit" x="${padL + i * slot}" y="${padT}" width="${slot}" height="${plotH + padB}" data-i="${i}"
      data-label="${fmt(p.d, { weekday: 'short', day: 'numeric', month: 'short' })}" data-v="${p.v ?? ''}"/>`).join('');
    const xLabels = [0, 7, 14, 21, 29].map((i) => `<text x="${padL + i * slot + slot / 2}" y="${H - 6}" text-anchor="middle">${fmt(days[i], { day: 'numeric', month: 'short' })}</text>`).join('');

    return `<div class="chart-card">
      <div class="chart-stats">
        <div><b>${avg ?? '–'}${avg !== null ? 'h' : ''}</b><span>avg / day</span></div>
        <div><b>${goal}h</b><span>goal</span></div>
        <div><b>${within}/${vals.length}</b><span>within goal</span></div>
      </div>
      <div class="chart" id="chart" data-goal="${goal}">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart of daily screen time for the last 30 days, goal ${goal} hours">
          <g class="grid">${ticks.map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
          <g class="axis">${ticks.map((t) => `<text x="${padL - 6}" y="${y(t) + 3}" text-anchor="end">${t}h</text>`).join('')}${xLabels}</g>
          ${bars}
          <line class="goal" x1="${padL}" x2="${W - padR}" y1="${y(goal)}" y2="${y(goal)}"/>
          ${hits}
        </svg>
        <div class="chart-tip" id="chart-tip"></div>
      </div>
      <div class="legend"><span><i style="background:var(--chart-ok)"></i>Within goal</span><span><i style="background:var(--chart-over)"></i>Over goal</span><span><i class="dash"></i>Goal (${goal}h)</span></div>
      ${vals.length ? '' : '<p class="note">No screen time logged yet. Add today’s hours on the Today screen.</p>'}
    </div>`;
  }

  function wireChart() {
    const chart = document.getElementById('chart');
    const tip = document.getElementById('chart-tip');
    if (!chart) return;
    const svg = chart.querySelector('svg');
    const goal = num(chart.dataset.goal);
    const show = (rect) => {
      chart.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel'));
      const v = rect.dataset.v;
      const bar = chart.querySelector(`path[data-i="${rect.dataset.i}"]`);
      if (bar) bar.classList.add('sel');
      tip.innerHTML = `${rect.dataset.label} · ${v === '' ? 'not logged' : `${v}h ${num(v) <= goal ? '✓' : '▲'}`}`;
      const box = rect.getBoundingClientRect(), cbox = chart.getBoundingClientRect();
      const left = Math.min(Math.max(box.left - cbox.left + box.width / 2, 60), cbox.width - 60);
      const top = bar ? bar.getBoundingClientRect().top - cbox.top - 6 : cbox.height * 0.7;
      tip.style.left = `${left}px`; tip.style.top = `${Math.max(top, 24)}px`;
      tip.classList.add('show');
    };
    const hide = () => { tip.classList.remove('show'); chart.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel')); };
    svg.addEventListener('pointermove', (e) => { if (e.target.classList.contains('hit')) show(e.target); });
    svg.addEventListener('pointerdown', (e) => { if (e.target.classList.contains('hit')) show(e.target); });
    svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  }

  // ---------- SETTINGS / MANAGE ----------
  function renderSettings() {
    const t = state.settings.theme;
    const items = state.habits.map((h, i) => `
      <div class="list-item" style="${colorVars(h.color)}">
        <span class="bubble">${esc(h.emoji)}</span>
        <span class="grow"><b>${esc(h.name)}</b><span class="small muted">${h.type === 'screen' ? `Screen time · goal ≤ ${h.goal ?? 3}h` : h.type === 'reading' ? `Reading · ${h.weeklyBooks || 1} book/week` : 'Daily tick'}${h.time ? ` · ${esc(h.time)}` : ''}</span></span>
        <button class="icon-btn" data-action="move" data-id="${h.id}" data-step="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${icon.up}</button>
        <button class="icon-btn" data-action="move" data-id="${h.id}" data-step="1" aria-label="Move down" ${i === state.habits.length - 1 ? 'disabled' : ''}>${icon.down}</button>
        <button class="icon-btn" data-action="edit-habit" data-id="${h.id}" aria-label="Edit ${esc(h.name)}">${icon.edit}</button>
      </div>`).join('');

    const daysLogged = Object.keys(state.logs).length;

    $view.innerHTML = `
      <header class="page-head"><div><div class="eyebrow">Make it yours</div><h1>Habits & settings</h1></div></header>
      <h2 style="margin-top:0">Your habits</h2>
      ${state.habits.length ? `<div class="list">${items}</div>` : '<p class="muted">No habits yet.</p>'}
      <button class="add-btn" data-action="add-habit">+ Add a habit</button>

      <h2>Appearance</h2>
      <div class="list"><div class="settings-row">
        <div class="title">Theme</div>
        <div class="segmented" role="radiogroup" aria-label="Theme">
          ${['auto', 'light', 'dark'].map((x) => `<button role="radio" aria-checked="${t === x}" class="${t === x ? 'on' : ''}" data-action="theme" data-theme="${x}">${x === 'auto' ? 'Auto' : x === 'light' ? 'Light' : 'Dark'}</button>`).join('')}
        </div>
        <p class="note">Auto follows your phone’s light/dark setting.</p>
      </div></div>

      <h2>Backup</h2>
      <div class="list">
        <div class="settings-row">
          <div class="title">Export your data</div>
          <p class="note">Saves a .json file with all habits, logs and books (${daysLogged} day${daysLogged === 1 ? '' : 's'} logged). Do this every week or two.</p>
          <div class="btn-row"><button class="btn primary" data-action="export">Export backup</button><button class="btn" data-action="export-csv">Export CSV</button></div>
        </div>
        <div class="settings-row">
          <div class="title">Restore from a backup</div>
          <p class="note">Also how you move your data between iPhone and computer — each browser keeps its own copy.</p>
          <div class="btn-row"><label class="btn" for="import-file" style="cursor:pointer">Import .json</label>
          <input id="import-file" type="file" accept="application/json,.json" hidden></div>
        </div>
        <div class="settings-row">
          <div class="title">Start over</div>
          <p class="note">Deletes everything on this device. Export a backup first.</p>
          <div class="btn-row"><button class="btn danger" data-action="reset">Reset all data</button></div>
        </div>
      </div>
      <p class="hint" style="text-align:center;margin-top:24px">Your data never leaves this device. 🌱</p>`;

    document.getElementById('import-file').addEventListener('change', importFile);
  }

  // ---------- Modals ----------
  function openModal(html, onSubmit) {
    $modal.innerHTML = html;
    const form = $modal.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.submitter && e.submitter.value === 'cancel') { $modal.close(); return; }
      if (onSubmit(new FormData(form), e.submitter) !== false) $modal.close();
    });
    $modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => $modal.close()));
    $modal.showModal();
    const first = $modal.querySelector('input[type="text"]');
    if (first && window.matchMedia('(pointer: fine)').matches) first.focus();
  }
  $modal.addEventListener('click', (e) => { if (e.target === $modal) $modal.close(); }); // tap backdrop to close

  function confirmModal(title, text, okLabel, onOk) {
    openModal(`<form><h3>${esc(title)}</h3><p class="muted" style="margin:0">${esc(text)}</p>
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn danger" value="ok">${esc(okLabel)}</button></div></form>`, () => { onOk(); });
  }

  function habitForm(h) {
    const isNew = !h;
    h = h || { name: '', emoji: '✨', color: COLORS[state.habits.length % COLORS.length], type: 'check', time: '', options: [], goal: 3, weeklyBooks: 1 };
    const html = `<form>
      <h3>${isNew ? 'New habit' : 'Edit habit'}</h3>
      <div class="form-row">
        <div class="form-field"><label for="hf-emoji">Emoji</label><input id="hf-emoji" name="emoji" type="text" value="${esc(h.emoji)}" maxlength="4" style="text-align:center;font-size:22px"></div>
        <div class="form-field"><label for="hf-name">Name</label><input id="hf-name" name="name" type="text" value="${esc(h.name)}" required maxlength="40" placeholder="e.g. Drink 2L water"></div>
      </div>
      <div class="form-field"><label>Colour</label><div class="swatches">
        ${COLORS.map((c) => `<button type="button" class="swatch ${c === h.color ? 'on' : ''}" style="--c:var(--${c})" data-color="${c}" aria-label="${c}"></button>`).join('')}
      </div><input type="hidden" name="color" value="${esc(h.color)}"></div>
      <div class="form-field"><label for="hf-type">Type</label>
        <select id="hf-type" name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === h.type ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="form-field" data-show="check"><label for="hf-time">Time (optional)</label><input id="hf-time" name="time" type="time" value="${esc(h.time || '')}">
        <p class="hint">Shown as a reminder label on the card.</p></div>
      <div class="form-field" data-show="check"><label for="hf-options">Focus options (optional)</label>
        <input id="hf-options" name="options" type="text" value="${esc((h.options || []).join(', '))}" placeholder="e.g. Speaking, Grammar, Vocabulary">
        <p class="hint">Comma separated. They appear as tappable tags under the habit.</p></div>
      <div class="form-field" data-show="screen"><label for="hf-goal">Daily screen-time goal (hours)</label>
        <input id="hf-goal" name="goal" type="number" min="0.5" step="0.5" inputmode="decimal" value="${h.goal ?? 3}"></div>
      <div class="form-field" data-show="reading"><label for="hf-books">Books per week goal</label>
        <input id="hf-books" name="weeklyBooks" type="number" min="1" step="1" inputmode="numeric" value="${h.weeklyBooks || 1}"></div>
      <div class="modal-actions">
        ${isNew ? '' : '<button type="submit" class="btn danger" value="delete" style="margin-right:auto">Delete</button>'}
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn primary" value="save">Save</button>
      </div>
    </form>`;

    openModal(html, (fd, submitter) => {
      if (submitter && submitter.value === 'delete') {
        setTimeout(() => confirmModal(`Delete “${h.name}”?`, 'The habit and its history will be removed. This can’t be undone.', 'Delete', () => {
          state.habits = state.habits.filter((x) => x.id !== h.id);
          for (const k of Object.keys(state.logs)) { delete state.logs[k][h.id]; if (!Object.keys(state.logs[k]).length) delete state.logs[k]; }
          save(); render(); toast('Habit deleted');
        }), 50);
        return;
      }
      const name = String(fd.get('name') || '').trim();
      if (!name) return false;
      const data = {
        name,
        emoji: String(fd.get('emoji') || '').trim() || '✨',
        color: fd.get('color'),
        type: fd.get('type'),
      };
      if (data.type === 'check') {
        data.time = fd.get('time') || '';
        data.options = String(fd.get('options') || '').split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (data.type === 'screen') data.goal = Math.max(0.5, num(fd.get('goal')) || 3);
      if (data.type === 'reading') data.weeklyBooks = Math.max(1, Math.round(num(fd.get('weeklyBooks')) || 1));

      if (isNew) state.habits.push({ id: uid(), ...data });
      else {
        const i = state.habits.findIndex((x) => x.id === h.id);
        const { time, options, goal, weeklyBooks, ...rest } = state.habits[i];
        state.habits[i] = { ...rest, ...data };
      }
      save(); render(); toast(isNew ? 'Habit added' : 'Saved');
    });

    // dynamic bits inside the form
    const form = $modal.querySelector('form');
    const sync = () => {
      const type = form.type.value;
      form.querySelectorAll('[data-show]').forEach((el) => { el.hidden = el.dataset.show !== type; });
    };
    form.type.addEventListener('change', sync); sync();
    form.querySelectorAll('.swatch').forEach((s) => s.addEventListener('click', () => {
      form.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on'));
      s.classList.add('on'); form.color.value = s.dataset.color;
    }));
  }

  function finishBookModal() {
    openModal(`<form>
      <h3>🎉 Finished a book!</h3>
      <div class="form-field"><label for="bk-title">Book title</label><input id="bk-title" name="title" type="text" maxlength="80" placeholder="e.g. Atomic Habits"></div>
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" value="save">Add book</button></div>
    </form>`, (fd) => {
      state.books.push({ id: uid(), title: String(fd.get('title') || '').trim() || 'Untitled book', date: viewDate });
      save(); render(); toast('Book added — well done! 📚');
    });
  }

  // ---------- Export / import ----------
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportJSON() {
    const payload = { app: 'daily-habits', exportedAt: new Date().toISOString(), ...state };
    download(`habits-backup-${todayKey()}.json`, JSON.stringify(payload, null, 2), 'application/json');
    toast('Backup saved');
  }
  function exportCSV() {
    const cols = state.habits;
    const header = ['date', ...cols.flatMap((h) => h.type === 'reading' ? [`${h.name} pages`, `${h.name} minutes`] : h.type === 'screen' ? [`${h.name} hours`] : [h.name])];
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = Object.keys(state.logs).sort().map((k) => [k, ...cols.flatMap((h) => {
      const e = entry(k, h.id) || {};
      if (h.type === 'reading') return [e.pages || '', e.minutes || ''];
      if (h.type === 'screen') return [typeof e.hours === 'number' ? e.hours : ''];
      return [e.done ? `yes${e.tags && e.tags.length ? ` (${e.tags.join('; ')})` : ''}` : ''];
    })]);
    download(`habits-${todayKey()}.csv`, [header, ...rows].map((r) => r.map(q).join(',')).join('\n'), 'text/csv');
    toast('CSV saved');
  }
  function importFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.habits) || typeof data.logs !== 'object') throw new Error('bad');
        confirmModal('Restore this backup?', `It replaces the data on this device with ${data.habits.length} habits and ${Object.keys(data.logs).length} logged days.`, 'Restore', () => {
          state = normalise(data); save(); applyTheme(); render(); toast('Backup restored');
        });
      } catch (e) { toast('That file isn’t a valid backup'); }
    };
    reader.readAsText(file);
    ev.target.value = '';
  }

  // ---------- Events ----------
  document.querySelector('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b) return;
    tab = b.dataset.tab;
    if (tab === 'today' && viewDate > todayKey()) viewDate = todayKey();
    render(); window.scrollTo(0, 0);
  });

  $view.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const { action, id } = el.dataset;
    const h = id && state.habits.find((x) => x.id === id);

    switch (action) {
      case 'toggle': {
        const cur = entry(viewDate, id);
        const nowDone = !(cur && cur.done);
        setEntry(viewDate, id, nowDone ? { done: true, tags: (cur && cur.tags) || [] } : null);
        haptic(); render();
        if (nowDone) { const c = $view.querySelector(`[data-card="${id}"]`); if (c) c.classList.add('pop'); }
        break;
      }
      case 'tag': {
        const cur = { done: true, tags: [], ...(entry(viewDate, id) || {}) };
        const tag = el.dataset.tag;
        cur.tags = cur.tags.includes(tag) ? cur.tags.filter((t) => t !== tag) : [...cur.tags, tag];
        cur.done = true; // picking a focus counts as done
        setEntry(viewDate, id, cur); haptic(); render();
        break;
      }
      case 'step': {
        const field = el.dataset.field;
        const cur = entry(viewDate, id) || {};
        const base = h.type === 'screen' ? (typeof cur.hours === 'number' ? cur.hours : (h.goal ?? 3)) : (cur[field] || 0);
        // first tap on an empty screen-time field starts from the goal, so ± feels natural
        const next = h.type === 'screen' && typeof cur.hours !== 'number' ? base : Math.max(0, base + Number(el.dataset.step));
        updateField(id, field, next);
        haptic(); render();
        break;
      }
      case 'clear-screen': setEntry(viewDate, id, null); render(); break;
      case 'finish-book': finishBookModal(); break;
      case 'delete-book': {
        const b = state.books.find((x) => x.id === id);
        confirmModal('Remove this book?', b ? b.title : '', 'Remove', () => { state.books = state.books.filter((x) => x.id !== id); save(); render(); });
        break;
      }
      case 'day': {
        const next = keyOf(addDays(parseKey(viewDate), Number(el.dataset.step)));
        if (next <= todayKey()) { viewDate = next; render(); }
        break;
      }
      case 'goto-today': viewDate = todayKey(); render(); break;
      case 'week': weekStart = addDays(weekStart, 7 * Number(el.dataset.step)); render(); break;
      case 'this-week': weekStart = startOfWeek(new Date()); render(); break;
      case 'open-day': viewDate = el.dataset.date; tab = 'today'; render(); window.scrollTo(0, 0); break;
      case 'add-habit': habitForm(null); break;
      case 'edit-habit': habitForm(h); break;
      case 'move': {
        const i = state.habits.indexOf(h), j = i + Number(el.dataset.step);
        if (j < 0 || j >= state.habits.length) break;
        [state.habits[i], state.habits[j]] = [state.habits[j], state.habits[i]];
        save(); render(); break;
      }
      case 'theme': state.settings.theme = el.dataset.theme; save(); applyTheme(); render(); break;
      case 'export': exportJSON(); break;
      case 'export-csv': exportCSV(); break;
      case 'reset':
        confirmModal('Reset everything?', 'All habits, logs and books on this device will be deleted and the starter habits restored.', 'Reset', () => {
          state = defaultState(); save(); applyTheme(); render(); toast('Data reset');
        });
        break;
    }
  });

  // typed numbers: save when the field is committed (blur / Done on iPhone keyboard)
  $view.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-input]'); if (!inp) return;
    const h = state.habits.find((x) => x.id === inp.dataset.id); if (!h) return;
    if (h.type === 'screen' && inp.value.trim() === '') updateField(h.id, 'hours', null);
    else updateField(h.id, inp.dataset.input, num(inp.value));
    render();
  });
  $view.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-input]')) e.target.blur(); });

  // when the app is reopened on a new day, jump to the new "today"
  let lastToday = todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const t = todayKey();
    if (t !== lastToday) { if (viewDate === lastToday) viewDate = t; lastToday = t; weekStart = startOfWeek(new Date()); render(); }
  });
  // keep in sync if the app is open in two tabs
  window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) { state = load(); applyTheme(); render(); } });

  // ---------- Boot ----------
  applyTheme();
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
