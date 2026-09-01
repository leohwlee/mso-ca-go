/* MSO Competence Assessment — offline mock exam. Vanilla JS, no dependencies. */
'use strict';

/* ---------------- constants ---------------- */

const MODULES = [
  { n: 1, en: 'General knowledge on AML/CFT and Counter Proliferation Financing',
    tc: '打擊洗錢／恐怖分子資金籌集／擴散資金籌集的常識' },
  { n: 2, en: 'Parts 1–7 of the AMLO', tc: '《打擊洗錢條例》第1至7部' },
  { n: 3, en: 'Schedules to the AMLO', tc: '《打擊洗錢條例》的附表' },
  { n: 4, en: 'Guidelines promulgated by the C&ED', tc: '海關頒布的指引' },
  { n: 5, en: "MSO's systems and controls (i): institutional governance and strategy",
    tc: '系統及管控措施（一）機構管治及策略' },
  { n: 6, en: "MSO's systems and controls (ii): AML/CFT control areas",
    tc: '系統及管控措施（二）打擊洗錢管控範疇' },
  { n: 7, en: "MSO's systems and controls (iii): demonstrating and monitoring compliance",
    tc: '系統及管控措施（三）證明及監察合規' },
];

const CFG = {
  perModule: 5,
  total: 35,
  passTotal: 25,
  maxWrongPerModule: 2,
  minutes: 75,
  examDate: '2026-10-06',
};

const USERS = {
  leo:   { name: 'Leo',   avatar: '\u{1F9D1}‍\u{1F4BC}', paperEn: 'English paper', paperTc: '英文卷', defaultLang: 'en' },
  bevis: { name: 'Bevis', avatar: '\u{1F468}‍\u{1F4BC}', paperEn: 'Chinese paper', paperTc: '中文卷', defaultLang: 'tc' },
};

/* ---------------- state ---------------- */

let bank = [];
let byMod = new Map();          // module n -> [questions]
let byId = new Map();           // id -> question
let S = { user: null, lang: 'en', view: 'home' };
let exam = null;                // active exam state
let practice = null;            // active practice state
let reviewAttempt = null;       // attempt shown on results view
let justFinished = false;       // results view: fresh submit vs history review
let timerId = null;
let homeNotice = null;          // one-shot message on home
let pmodSel = new Set([1, 2, 3, 4, 5, 6, 7]); // practice module selection

const qs = new URLSearchParams(location.search);
const customMinutes = qs.has('minutes') ? Math.max(0.05, parseFloat(qs.get('minutes')) || CFG.minutes) : null;

/* ---------------- storage ---------------- */

const store = {
  get(k, fallback) {
    try { const v = localStorage.getItem('msoca:' + k); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(k, v) { try { localStorage.setItem('msoca:' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('msoca:' + k); } catch {} },
};

const attemptsKey = () => S.user + ':attempts';
const examKey = () => S.user + ':exam';

/* ---------------- helpers ---------------- */

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ui(en, tc): chrome text in the current language mode */
function ui(en, tc) {
  if (S.lang === 'en') return en;
  if (S.lang === 'tc') return tc;
  return en + ' · ' + tc;
}

/* bilingual content block (stem / explanation) */
function contentHTML(obj, field) {
  const en = esc(obj.en[field]), tc = esc(obj.tc[field]);
  if (S.lang === 'en') return `<div>${en}</div>`;
  if (S.lang === 'tc') return `<div>${tc}</div>`;
  return `<div>${en}</div><div class="tcline">${tc}</div>`;
}

function optionHTML(q, origIdx) {
  const en = esc(q.en.options[origIdx]), tc = esc(q.tc.options[origIdx]);
  if (S.lang === 'en') return en;
  if (S.lang === 'tc') return tc;
  return `${en}<span class="tcline">${tc}</span>`;
}

function sourceHTML(q) {
  const src = S.lang === 'en' ? q.source.en : S.lang === 'tc' ? q.source.tc : q.source.en + ' · ' + q.source.tc;
  return `<div class="cite"><b>${ui('Source', '出處')}:</b> ${esc(src)}</div>`;
}

function modName(n) {
  const m = MODULES[n - 1];
  return ui(m.en, m.tc);
}

function fmtTime(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/* ---------------- scoring ---------------- */

function grade(qids, answers) {
  const moduleWrong = [0, 0, 0, 0, 0, 0, 0];
  const moduleTotal = [0, 0, 0, 0, 0, 0, 0];
  let score = 0;
  for (const qid of qids) {
    const q = byId.get(qid);
    if (!q) continue;
    moduleTotal[q.module - 1]++;
    if (answers[qid] === q.answer) score++;
    else moduleWrong[q.module - 1]++;
  }
  const floorsOK = moduleWrong.every(w => w <= CFG.maxWrongPerModule);
  const totalOK = score >= CFG.passTotal;
  return { score, moduleWrong, moduleTotal, floorsOK, totalOK, pass: floorsOK && totalOK };
}

/* ---------------- render root ---------------- */

function render() {
  stopTimer();
  const app = $('#app');
  if (S.view === 'exam') app.innerHTML = examView();
  else if (S.view === 'results') app.innerHTML = resultsView();
  else if (S.view === 'practice') app.innerHTML = practiceView();
  else app.innerHTML = homeView();
  bindCommon();
  if (S.view === 'exam') { bindExam(); startTimer(); }
  else if (S.view === 'practice') bindPractice();
  else if (S.view === 'results') bindResults();
  else bindHome();
}

/* ---------------- top bar ---------------- */

function topbarHTML(showUser = true) {
  const u = USERS[S.user];
  return `
  <div class="topbar"><div class="wrap">
    <div class="brand">
      <div class="t1">${ui('MSO Competence Assessment — Mock Exam', '金錢服務經營者能力評核 — 模擬試')}</div>
      <div class="t2">${ui('C&ED · 35 questions · 7 modules · 75 minutes', '香港海關 · 35題 · 7個單元 · 75分鐘')}</div>
    </div>
    <div class="topctl">
      <div class="seg" id="langseg">
        <button data-lang="en" class="${S.lang === 'en' ? 'on' : ''}">EN</button>
        <button data-lang="tc" class="${S.lang === 'tc' ? 'on' : ''}">中文</button>
        <button data-lang="both" class="${S.lang === 'both' ? 'on' : ''}">EN+中</button>
      </div>
      ${showUser && u ? `<div class="seg" id="userseg">
        <button id="userbtn">${esc(u.name)} ▾</button>
      </div>` : ''}
    </div>
  </div></div>`;
}

function bindCommon() {
  document.querySelectorAll('#langseg button').forEach(b => {
    b.onclick = () => {
      S.lang = b.dataset.lang;
      if (S.user) store.set(S.user + ':lang', S.lang);
      render();
    };
  });
  const ub = $('#userbtn');
  if (ub) ub.onclick = () => { S.user = null; store.del('user'); S.view = 'home'; render(); };
}

/* ---------------- home ---------------- */

function daysToExam() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((new Date(CFG.examDate + 'T00:00:00') - now) / 86400000);
}

function homeView() {
  if (!S.user) return profileView();
  const u = USERS[S.user];
  const attempts = store.get(attemptsKey(), []);
  const saved = store.get(examKey(), null);
  const days = daysToExam();
  const minutes = customMinutes || CFG.minutes;

  const examCard = saved ? `
    <div class="card">
      <h2>${ui('Mock exam in progress', '模擬試進行中')}</h2>
      <div class="sub">${ui('The clock keeps running while you are away.', '離開期間計時不會暫停。')}
        ${ui('Time left', '剩餘時間')}: <b id="resume-left">${fmtTime(saved.endsAt - Date.now())}</b></div>
      <div class="actions">
        <button class="btn" id="btn-resume">${ui('Resume exam', '繼續作答')}</button>
        <button class="btn secondary" id="btn-discard">${ui('Discard attempt', '放棄此卷')}</button>
      </div>
    </div>` : `
    <div class="card">
      <h2>${ui('Mock exam', '模擬試')}</h2>
      <div class="sub">${ui(
        `35 questions (7 modules × 5), ${minutes === CFG.minutes ? '75 minutes' : minutes + ' minutes (custom)'}, drawn at random from a bank of ${bank.length}.`,
        `35題（7個單元 × 每單元5題），限時${minutes === CFG.minutes ? '75' : minutes}分鐘，從${bank.length}題題庫隨機抽出。`)}</div>
      <div class="rulebox">${ui(
        '<b>Pass rules (both required):</b> at most 2 wrong in <b>each</b> module, and a total of <b>25/35</b> or above. 32/35 still fails if one module has 3 mistakes.',
        '<b>及格準則（兩項須同時符合）：</b>每個單元錯題不多於2題，及全卷總分達<b>25/35</b>。即使總分32/35，只要任何一個單元錯3題即全卷不及格。')}</div>
      <div class="actions">
        <button class="btn" id="btn-start" ${bank.length ? '' : 'disabled'}>${ui('Start mock exam', '開始模擬試')}</button>
        <span class="note">${ui('The real assessment', '正式評核')}: ${ui('Mon 6 Oct 2026', '2026年10月6日（一）')}${days >= 0 ? ' · ' + ui(`${days} day${days === 1 ? '' : 's'} to go`, `尚餘${days}日`) : ''}</span>
      </div>
    </div>`;

  const chips = MODULES.map(m =>
    `<button class="chip ${pmodSel.has(m.n) ? 'on' : ''}" data-pm="${m.n}">M${m.n} ${esc(S.lang === 'en' ? '' : '')}${esc(shortMod(m))}</button>`).join('');

  return topbarHTML() + `
  <div class="wrap">
    ${homeNotice ? `<div class="card"><div class="sub" style="margin:0">${homeNotice}</div></div>` : ''}
    ${examCard}
    <div class="card">
      <h2>${ui('Practice by module', '按單元練習')}</h2>
      <div class="sub">${ui('Untimed. Instant feedback and explanation after every answer.', '不設時限，每題作答後即時顯示對錯及解釋。')}</div>
      <div class="chips" id="pmods">${chips}
        <button class="chip" id="pm-all">${ui('All', '全選')}</button>
      </div>
      <div class="actions">
        <button class="btn secondary" id="btn-practice" ${bank.length ? '' : 'disabled'}>${ui('Start practice', '開始練習')}</button>
      </div>
    </div>
    <div class="card">
      <h2>${ui('History', '過往紀錄')} — ${esc(u.name)}</h2>
      ${attempts.length ? historyHTML(attempts) : `<div class="sub" style="margin:0">${ui('No attempts yet.', '未有應考紀錄。')}</div>`}
    </div>
    <div class="footer">${ui(
      'Practice questions are reconstructions from official C&ED / e-Legislation materials — not real exam questions.',
      '練習題按官方材料重構而成，並非真題。')}</div>
  </div>`;
}

function shortMod(m) {
  /* compact module label for chips */
  const shortEn = ['General AML/CFT', 'AMLO Parts 1–7', 'AMLO Schedules', 'C&ED guidelines',
    'Governance', 'Control areas', 'Compliance'][m.n - 1];
  const shortTc = ['常識', '條例1–7部', '條例附表', '海關指引', '管治', '管控範疇', '證明合規'][m.n - 1];
  return ui(shortEn, shortTc);
}

function historyHTML(attempts) {
  const rows = [...attempts].reverse().map((a, ri) => {
    const idx = attempts.length - 1 - ri;
    const cells = a.moduleWrong.map((w, i) =>
      `<i class="${w <= CFG.maxWrongPerModule ? 'ok' : 'bad'}" title="M${i + 1}: ${w} wrong">${w}</i>`).join('');
    return `<tr>
      <td>${fmtDate(a.ts)}</td>
      <td class="num">${a.score}/${a.qids.length}</td>
      <td><span class="modcells">${cells}</span></td>
      <td><span class="tag ${a.pass ? 'pass' : 'fail'}">${a.pass ? ui('PASS', '合格') : ui('FAIL', '不合格')}</span></td>
      <td><button class="btn secondary small" data-review="${idx}">${ui('Review', '重溫')}</button></td>
    </tr>`;
  }).join('');
  return `<table class="hist">
    <tr><th>${ui('Date', '日期')}</th><th>${ui('Score', '分數')}</th>
    <th>${ui('Wrong per module (M1–M7)', '各單元錯題數（M1–M7）')}</th><th></th><th></th></tr>
    ${rows}</table>`;
}

function bindHome() {
  homeNotice = null;
  const start = $('#btn-start');
  if (start) start.onclick = () => startExam();
  const resume = $('#btn-resume');
  if (resume) resume.onclick = () => resumeExam();
  const discard = $('#btn-discard');
  if (discard) discard.onclick = () => {
    confirmModal(
      ui('Discard this attempt?', '確定放棄此卷？'),
      ui('The exam in progress will be deleted. It will not appear in your history.', '進行中的模擬試將被刪除，且不會計入紀錄。'),
      ui('Discard', '放棄'), () => { store.del(examKey()); render(); }, true);
  };
  const prac = $('#btn-practice');
  if (prac) prac.onclick = () => startPractice();
  document.querySelectorAll('#pmods .chip[data-pm]').forEach(c => {
    c.onclick = () => {
      const n = +c.dataset.pm;
      if (pmodSel.has(n) && pmodSel.size === 1) return; // keep at least one
      pmodSel.has(n) ? pmodSel.delete(n) : pmodSel.add(n);
      render();
    };
  });
  const all = $('#pm-all');
  if (all) all.onclick = () => { pmodSel = new Set([1, 2, 3, 4, 5, 6, 7]); render(); };
  document.querySelectorAll('[data-review]').forEach(b => {
    b.onclick = () => {
      const attempts = store.get(attemptsKey(), []);
      reviewAttempt = attempts[+b.dataset.review];
      justFinished = false;
      S.view = 'results'; render();
      window.scrollTo(0, 0);
    };
  });
}

/* ---------------- profile picker ---------------- */

function profileView() {
  const cards = Object.entries(USERS).map(([id, u]) => `
    <div class="profile-card" data-user="${id}">
      <div class="avatar">${u.avatar}</div>
      <div class="name">${esc(u.name)}</div>
      <div class="paper">${ui(u.paperEn, u.paperTc)}</div>
    </div>`).join('');
  return topbarHTML(false) + `
  <div class="wrap">
    <div class="card" style="text-align:center">
      <h2>${ui('Who is studying?', '請選擇使用者')}</h2>
      <div class="profiles">${cards}</div>
    </div>
  </div>`;
}

/* ---------------- exam ---------------- */

function startExam() {
  const minutes = customMinutes || CFG.minutes;
  const qids = [], optOrder = {};
  for (const m of MODULES) {
    const pool = shuffle([...(byMod.get(m.n) || [])]);
    for (const q of pool.slice(0, CFG.perModule)) {
      qids.push(q.id);
      optOrder[q.id] = shuffle([0, 1, 2, 3]);
    }
  }
  exam = {
    qids, optOrder, answers: {}, flags: [],
    cur: 0, minutes,
    startedAt: Date.now(), endsAt: Date.now() + minutes * 60000,
  };
  saveExam();
  S.view = 'exam'; render();
  window.scrollTo(0, 0);
}

function resumeExam() {
  const saved = store.get(examKey(), null);
  if (!saved) { render(); return; }
  if (Date.now() >= saved.endsAt) { exam = saved; finishExam(true); return; }
  exam = saved;
  S.view = 'exam'; render();
  window.scrollTo(0, 0);
}

function saveExam() { if (exam) store.set(examKey(), exam); }

function examView() {
  const q = byId.get(exam.qids[exam.cur]);
  const answered = Object.keys(exam.answers).length;
  const flagged = exam.flags.includes(q.id);
  const order = exam.optOrder[q.id];
  const chosen = exam.answers[q.id];

  const opts = order.map((orig, di) => `
    <button class="opt ${chosen === orig ? 'sel' : ''}" data-orig="${orig}">
      <span class="letter">${'ABCD'[di]}</span>
      <span class="otext">${optionHTML(q, orig)}</span>
    </button>`).join('');

  return `
  <div class="exambar"><div class="wrap">
    <div class="timer" id="timer">--:--</div>
    <div class="who">${esc(USERS[S.user].name)}${exam.minutes !== CFG.minutes ? ' · ' + exam.minutes + ' min' : ''}</div>
    <div class="grow"></div>
    <div class="prog">${ui('Answered', '已作答')} <b id="prog-n">${answered}</b>/${exam.qids.length}</div>
    <button class="btn small" id="btn-submit" style="background:#fff;color:var(--navy)">${ui('Submit paper', '交卷')}</button>
    <button class="btn small secondary" id="btn-exit" style="background:rgba(255,255,255,.16);color:#fff">${ui('Exit', '離開')}</button>
  </div></div>
  <div class="wrap">
    <div class="qcard">
      <div class="qmeta">
        <span class="qnum">${ui('Question', '第')} ${exam.cur + 1} / ${exam.qids.length}${S.lang === 'tc' ? ' 題' : ''}</span>
        <span class="qmod">M${q.module} · ${esc(modName(q.module))}</span>
        <button class="qflag ${flagged ? 'on' : ''}" id="btn-flag">${flagged ? '⚑' : '⚐'} ${ui('Flag', '標記')}</button>
      </div>
      <div class="stem">${contentHTML(q, 'q')}</div>
      <div class="opts" id="opts">${opts}</div>
      <div class="qnav-row">
        <button class="btn secondary" id="btn-prev" ${exam.cur === 0 ? 'disabled' : ''}>← ${ui('Previous', '上一題')}</button>
        <div class="grow"></div>
        ${exam.cur === exam.qids.length - 1
          ? `<button class="btn" id="btn-next-submit">${ui('Submit paper', '交卷')}</button>`
          : `<button class="btn" id="btn-next">${ui('Next', '下一題')} →</button>`}
      </div>
    </div>
    ${navgridHTML()}
    <div class="footer">${ui('Keyboard: A–D or 1–4 to answer · ←/→ to move', '鍵盤：A–D 或 1–4 作答 · ←/→ 切換題目')}</div>
  </div>`;
}

function navgridHTML(reviewGrade = null) {
  const rows = MODULES.map(m => {
    const cells = exam.qids.map((qid, i) => ({ qid, i, q: byId.get(qid) }))
      .filter(x => x.q.module === m.n)
      .map(x => {
        let cls = '';
        if (reviewGrade) cls = reviewGrade.answers[x.qid] === x.q.answer ? 'rok' : 'rbad';
        else {
          if (exam.answers[x.qid] !== undefined) cls = 'answered';
          if (x.i === exam.cur) cls += ' current';
          if (exam.flags.includes(x.qid)) cls += ' flagged';
        }
        return `<button class="ncell ${cls}" data-goto="${x.i}">${x.i + 1}</button>`;
      }).join('');
    return `<div class="ngrow"><span class="mlabel">M${m.n}</span><span class="cells">${cells}</span></div>`;
  }).join('');
  return `<div class="navgrid"><h3>${ui('Answer sheet', '答題一覽')}</h3>${rows}</div>`;
}

function bindExam() {
  document.querySelectorAll('#opts .opt').forEach(b => {
    b.onclick = () => {
      const q = byId.get(exam.qids[exam.cur]);
      const orig = +b.dataset.orig;
      if (exam.answers[q.id] === orig) delete exam.answers[q.id];  // click again to erase
      else exam.answers[q.id] = orig;
      saveExam();
      rerenderExamKeepScroll();
    };
  });
  const flag = $('#btn-flag');
  if (flag) flag.onclick = () => {
    const qid = exam.qids[exam.cur];
    const i = exam.flags.indexOf(qid);
    i >= 0 ? exam.flags.splice(i, 1) : exam.flags.push(qid);
    saveExam();
    rerenderExamKeepScroll();
  };
  const prev = $('#btn-prev'); if (prev) prev.onclick = () => gotoQ(exam.cur - 1);
  const next = $('#btn-next'); if (next) next.onclick = () => gotoQ(exam.cur + 1);
  const nsub = $('#btn-next-submit'); if (nsub) nsub.onclick = () => confirmSubmit();
  $('#btn-submit').onclick = () => confirmSubmit();
  $('#btn-exit').onclick = () => {
    confirmModal(
      ui('Leave the exam?', '離開模擬試？'),
      ui('Your answers are saved and you can resume from the home screen — but the clock keeps running.',
         '你的答案已儲存，可隨時從主頁繼續 — 但計時不會暫停。'),
      ui('Leave', '離開'), () => { S.view = 'home'; render(); });
  };
  document.querySelectorAll('[data-goto]').forEach(b => { b.onclick = () => gotoQ(+b.dataset.goto); });
  document.onkeydown = examKeys;
}

function rerenderExamKeepScroll() {
  const y = window.scrollY; render(); window.scrollTo(0, y);
}

function gotoQ(i) {
  if (i < 0 || i >= exam.qids.length) return;
  exam.cur = i; saveExam();
  render();
  window.scrollTo(0, 0);
}

function examKeys(e) {
  if (S.view !== 'exam' || $('.modal-back')) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowleft') gotoQ(exam.cur - 1);
  else if (k === 'arrowright') gotoQ(exam.cur + 1);
  else if ('abcd'.includes(k) || '1234'.includes(k)) {
    const di = 'abcd'.includes(k) ? 'abcd'.indexOf(k) : '1234'.indexOf(k);
    const q = byId.get(exam.qids[exam.cur]);
    const orig = exam.optOrder[q.id][di];
    if (exam.answers[q.id] === orig) delete exam.answers[q.id];
    else exam.answers[q.id] = orig;
    saveExam();
    rerenderExamKeepScroll();
  }
}

function confirmSubmit() {
  const un = exam.qids.map((qid, i) => exam.answers[qid] === undefined ? i + 1 : null).filter(x => x);
  const flaggedN = exam.flags.length;
  let body = ui('All 35 questions answered.', '35題已全部作答。');
  if (un.length) body = `<span class="warn">${ui(
    `${un.length} unanswered question${un.length > 1 ? 's' : ''}: `, `尚有${un.length}題未作答：`)}#${un.join(', #')}</span><br>` +
    ui('Unanswered questions count as wrong.', '未作答的題目作錯題計算。');
  if (flaggedN) body += `<br>${ui(`${flaggedN} flagged for review.`, `${flaggedN}題已標記待覆核。`)}`;
  confirmModal(ui('Submit the paper?', '確定交卷？'), body, ui('Submit', '交卷'), () => finishExam(false));
}

function finishExam(auto) {
  stopTimer();
  const g = grade(exam.qids, exam.answers);
  const attempt = {
    ts: Date.now(),
    minutes: exam.minutes,
    usedMs: Math.min(Date.now() - exam.startedAt, exam.minutes * 60000),
    qids: exam.qids, optOrder: exam.optOrder, answers: exam.answers,
    score: g.score, moduleWrong: g.moduleWrong, pass: g.pass, auto: !!auto,
  };
  const attempts = store.get(attemptsKey(), []);
  attempts.push(attempt);
  store.set(attemptsKey(), attempts);
  store.del(examKey());
  exam = null;
  reviewAttempt = attempt;
  justFinished = true;
  S.view = 'results'; render();
  window.scrollTo(0, 0);
}

/* ---------------- timer ---------------- */

function startTimer() {
  const el = $('#timer');
  if (!el || !exam) return;
  const tick = () => {
    if (!exam) return;
    const left = exam.endsAt - Date.now();
    if (left <= 0) { finishExam(true); return; }
    el.textContent = fmtTime(left);
    el.classList.toggle('warn', left <= 10 * 60000 && left > 5 * 60000);
    el.classList.toggle('crit', left <= 5 * 60000);
  };
  tick();
  timerId = setInterval(tick, 500);
}

function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

/* ---------------- results / review ---------------- */

function resultsView() {
  const a = reviewAttempt;
  const g = grade(a.qids, a.answers);
  const perMod = MODULES.map(m => {
    const total = g.moduleTotal[m.n - 1], wrong = g.moduleWrong[m.n - 1];
    const breach = wrong > CFG.maxWrongPerModule;
    return `<tr class="${breach ? 'breach' : ''}">
      <td>M${m.n} · ${esc(modName(m.n))}</td>
      <td class="num">${total - wrong}/${total}</td>
      <td class="num">${wrong}</td>
      <td class="floor ${breach ? 'bad' : 'ok'}">${breach
        ? ui('✖ over the 2-wrong limit', '✖ 超出每單元錯2題上限')
        : ui('✓ within limit', '✓ 符合')}</td>
    </tr>`;
  }).join('');

  let why;
  if (g.pass) {
    why = ui('Total ≥ 25/35 and every module within the 2-wrong limit.', '總分達25/35，且每個單元錯題不多於2題。');
  } else {
    const reasons = [];
    if (!g.totalOK) reasons.push(ui(`total ${g.score}/${a.qids.length} is below ${CFG.passTotal}`,
      `總分${g.score}/${a.qids.length}未達${CFG.passTotal}`));
    if (!g.floorsOK) {
      const bad = g.moduleWrong.map((w, i) => w > CFG.maxWrongPerModule ? `M${i + 1} (${w})` : null).filter(x => x);
      reasons.push(ui(`more than 2 wrong in ${bad.join(', ')}`, `${bad.join('、')}錯題多於2題`));
    }
    why = ui('Failed: ', '不合格原因：') + reasons.join(ui(' and ', '；'));
  }

  const items = a.qids.map((qid, i) => reviewItemHTML(byId.get(qid), i, a)).join('');

  return topbarHTML() + `
  <div class="wrap">
    <div class="banner ${g.pass ? 'pass' : 'fail'}">
      <div>
        <div class="verdict">${g.pass ? ui('PASS', '合格') : ui('FAIL', '不合格')}</div>
        <div class="note">${fmtDate(a.ts)}${a.auto ? ' · ' + ui('auto-submitted when time ran out', '時間屆滿自動交卷') : ''}
          · ${ui('time used', '用時')} ${fmtTime(a.usedMs)}</div>
      </div>
      <div class="score">${g.score}<small>/${a.qids.length}</small></div>
      <div class="why">${why}</div>
    </div>
    <div class="card">
      <h2>${ui('By module', '各單元成績')}</h2>
      <table class="modtab">
        <tr><th>${ui('Module', '單元')}</th><th>${ui('Correct', '答對')}</th>
        <th>${ui('Wrong', '答錯')}</th><th>${ui('Module floor (max 2 wrong)', '單元底線（最多錯2題）')}</th></tr>
        ${perMod}
      </table>
    </div>
    <div class="card">
      <h2>${ui('Full review', '全卷重溫')}</h2>
      <div class="sub">${ui('Your answer is marked; the correct answer is highlighted in green. Click a number to jump.',
        '你的作答已標示；正確答案以綠色顯示。點擊題號可跳至該題。')}</div>
      <div class="chips" id="jumpgrid">${a.qids.map((qid, i) => {
        const ok = a.answers[qid] === byId.get(qid).answer;
        return `<button class="ncell ${ok ? 'rok' : 'rbad'}" data-jump="${i}">${i + 1}</button>`;
      }).join('')}</div>
    </div>
    ${items}
    <div class="actions" style="margin-top:22px">
      <button class="btn" id="btn-home">${ui('Back to home', '返回主頁')}</button>
    </div>
  </div>`;
}

function reviewItemHTML(q, i, a) {
  const chosen = a.answers[q.id];
  const order = (a.optOrder && a.optOrder[q.id]) || [0, 1, 2, 3];
  const opts = order.map((orig, di) => {
    let cls = 'dim';
    if (orig === q.answer) cls = 'correct';
    else if (orig === chosen) cls = 'wrong';
    return `<button class="opt ${cls}" disabled>
      <span class="letter">${'ABCD'[di]}</span>
      <span class="otext">${optionHTML(q, orig)}</span>
    </button>`;
  }).join('');
  const state = chosen === undefined
    ? `<span class="verdict bad">${ui('Not answered', '未作答')}</span>`
    : chosen === q.answer
      ? `<span class="verdict good">${ui('Correct', '答對')} ✓</span>`
      : `<span class="verdict bad">${ui('Incorrect', '答錯')} ✖</span>`;
  return `
  <div class="qcard review-item" id="rev-${i}">
    <div class="qmeta">
      <span class="qnum">${i + 1}.</span>
      <span class="qmod">M${q.module} · ${esc(modName(q.module))}</span>
    </div>
    <div class="stem">${contentHTML(q, 'q')}</div>
    <div class="opts">${opts}</div>
    <div class="explain">
      <div class="verdict">${state}</div>
      ${contentHTML(q, 'explain')}
      ${sourceHTML(q)}
    </div>
  </div>`;
}

function bindResults() {
  $('#btn-home').onclick = () => { S.view = 'home'; reviewAttempt = null; render(); window.scrollTo(0, 0); };
  document.querySelectorAll('[data-jump]').forEach(b => {
    b.onclick = () => {
      const el = $('#rev-' + b.dataset.jump);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
}

/* ---------------- practice ---------------- */

function startPractice() {
  const pool = shuffle(bank.filter(q => pmodSel.has(q.module)).map(q => q.id));
  practice = {
    pool, idx: 0,
    order: null, chosen: null,
    tally: { seen: 0, right: 0 },
  };
  nextPracticeQ(false);
  S.view = 'practice'; render();
  window.scrollTo(0, 0);
}

function nextPracticeQ(advance = true) {
  if (advance) practice.idx++;
  if (practice.idx >= practice.pool.length) {   // recycle, reshuffled
    shuffle(practice.pool);
    practice.idx = 0;
  }
  practice.order = shuffle([0, 1, 2, 3]);
  practice.chosen = null;
}

function practiceView() {
  const q = byId.get(practice.pool[practice.idx]);
  const done = practice.chosen !== null;
  const opts = practice.order.map((orig, di) => {
    let cls = '';
    if (done) {
      if (orig === q.answer) cls = 'correct';
      else if (orig === practice.chosen) cls = 'wrong';
      else cls = 'dim';
    }
    return `<button class="opt ${cls}" data-orig="${orig}" ${done ? 'disabled' : ''}>
      <span class="letter">${'ABCD'[di]}</span>
      <span class="otext">${optionHTML(q, orig)}</span>
    </button>`;
  }).join('');

  const t = practice.tally;
  return topbarHTML() + `
  <div class="wrap">
    <div class="qcard">
      <div class="qmeta">
        <span class="qnum">${ui('Practice', '練習')}</span>
        <span class="qmod">M${q.module} · ${esc(modName(q.module))}</span>
        <span class="tally" style="margin-left:auto">${ui('This session', '本節')}: <b>${t.right}</b>/${t.seen}</span>
      </div>
      <div class="stem">${contentHTML(q, 'q')}</div>
      <div class="opts" id="opts">${opts}</div>
      ${done ? `
      <div class="explain">
        <div class="verdict ${practice.chosen === q.answer ? 'good' : 'bad'}">
          ${practice.chosen === q.answer ? ui('Correct', '答對') + ' ✓' : ui('Incorrect', '答錯') + ' ✖'}</div>
        ${contentHTML(q, 'explain')}
        ${sourceHTML(q)}
      </div>
      <div class="qnav-row">
        <div class="grow"></div>
        <button class="btn" id="btn-pnext">${ui('Next question', '下一題')} →</button>
      </div>` : ''}
    </div>
    <div class="actions">
      <button class="btn secondary" id="btn-pend">${ui('End practice', '結束練習')}</button>
    </div>
  </div>`;
}

function bindPractice() {
  document.querySelectorAll('#opts .opt:not([disabled])').forEach(b => {
    b.onclick = () => {
      const q = byId.get(practice.pool[practice.idx]);
      practice.chosen = +b.dataset.orig;
      practice.tally.seen++;
      if (practice.chosen === q.answer) practice.tally.right++;
      render();
    };
  });
  const nx = $('#btn-pnext');
  if (nx) nx.onclick = () => { nextPracticeQ(); render(); window.scrollTo(0, 0); };
  $('#btn-pend').onclick = () => { practice = null; S.view = 'home'; render(); };
  document.onkeydown = e => {
    if (S.view !== 'practice' || $('.modal-back')) return;
    const k = e.key.toLowerCase();
    if (practice.chosen === null && ('abcd'.includes(k) || '1234'.includes(k))) {
      const di = 'abcd'.includes(k) ? 'abcd'.indexOf(k) : '1234'.indexOf(k);
      const el = document.querySelectorAll('#opts .opt')[di];
      if (el) el.click();
    } else if (practice.chosen !== null && (k === 'enter' || k === 'arrowright')) {
      nextPracticeQ(); render(); window.scrollTo(0, 0);
    }
  };
}

/* ---------------- modal ---------------- */

function confirmModal(title, bodyHTML, okLabel, onOK, danger = false) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal">
    <h3>${title}</h3>
    <p>${bodyHTML}</p>
    <div class="actions">
      <button class="btn secondary" id="m-cancel">${ui('Cancel', '取消')}</button>
      <button class="btn ${danger ? 'danger' : ''}" id="m-ok">${okLabel}</button>
    </div>
  </div>`;
  document.body.appendChild(back);
  back.querySelector('#m-cancel').onclick = () => back.remove();
  back.onclick = e => { if (e.target === back) back.remove(); };
  back.querySelector('#m-ok').onclick = () => { back.remove(); onOK(); };
}

/* ---------------- boot ---------------- */

async function boot() {
  try {
    const res = await fetch('questions.json');
    bank = await res.json();
  } catch (e) {
    $('#app').innerHTML = `<div class="loading">Failed to load questions.json 題庫載入失敗</div>`;
    return;
  }
  for (const q of bank) {
    byId.set(q.id, q);
    if (!byMod.has(q.module)) byMod.set(q.module, []);
    byMod.get(q.module).push(q);
  }

  S.user = store.get('user', null);
  if (S.user && !USERS[S.user]) S.user = null;
  if (S.user) S.lang = store.get(S.user + ':lang', USERS[S.user].defaultLang);

  // an exam that expired while the app was closed → submit it now
  if (S.user) {
    const saved = store.get(examKey(), null);
    if (saved && Date.now() >= saved.endsAt) {
      exam = saved;
      finishExam(true);
      return;
    }
  }
  render();
}

/* profile selection (delegated: profile cards render before user exists) */
document.addEventListener('click', e => {
  const card = e.target.closest('.profile-card');
  if (!card) return;
  S.user = card.dataset.user;
  store.set('user', S.user);
  S.lang = store.get(S.user + ':lang', USERS[S.user].defaultLang);
  render();
});

boot();
