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
};

/* ---------------- state ---------------- */

let bank = [];
let byMod = new Map();          // module n -> [questions]
let byId = new Map();           // id -> question
let S = { lang: null, view: 'home' };   // lang null = not chosen yet
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

const attemptsKey = () => 'attempts';
const examKey = () => 'exam';

/* ---------------- helpers ---------------- */

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* inline SVG icons (render identically on Windows and Mac, unlike emoji) */
const ICONS = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  clearTimeout(toast.t);
  requestAnimationFrame(() => el.classList.add('show'));
  toast.t = setTimeout(() => el.classList.remove('show'), 3500);
}

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

function topbarHTML() {
  return `
  <div class="topbar"><div class="wrap">
    <div class="brand">
      <div class="t1">${ui('MSO Competence Assessment — Mock Exam', '金錢服務經營者能力評核 — 模擬試')}</div>
      <div class="t2">${ui('C&ED · 35 questions · 7 modules · 75 minutes', '香港海關 · 35題 · 7個單元 · 75分鐘')}</div>
    </div>
    ${S.lang ? `<div class="topctl">
      <div class="seg" id="langseg">
        <button data-lang="en" class="${S.lang === 'en' ? 'on' : ''}">EN</button>
        <button data-lang="tc" class="${S.lang === 'tc' ? 'on' : ''}">中文</button>
        <button data-lang="both" class="${S.lang === 'both' ? 'on' : ''}">EN+中</button>
      </div>
    </div>` : ''}
  </div></div>`;
}

function bindCommon() {
  document.querySelectorAll('#langseg button').forEach(b => {
    b.onclick = () => {
      S.lang = b.dataset.lang;
      store.set('lang', S.lang);
      render();
    };
  });
}

/* ---------------- home ---------------- */

function homeView() {
  if (!S.lang) return langView();
  const attempts = store.get(attemptsKey(), []);
  const saved = store.get(examKey(), null);
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
      <h2>${ui('History', '過往紀錄')}</h2>
      ${attempts.length ? historyHTML(attempts) : `<div class="sub" style="margin:0">${ui('No attempts yet.', '未有應考紀錄。')}</div>`}
      <div class="actions">
        ${attempts.length ? `<button class="btn secondary small" id="btn-save">${ui('Save history to file (.md)', '儲存紀錄至檔案 (.md)')}</button>` : ''}
        <button class="btn secondary small" id="btn-load">${ui('Load history from file', '從檔案載入紀錄')}</button>
        ${attempts.length ? `<button class="btn secondary small" id="btn-clear">${ui('Clear history', '清除紀錄')}</button>` : ''}
        <input type="file" id="file-load" accept=".md,.json,.txt,text/markdown,application/json" hidden>
        <span class="note">${ui('History lives in this browser; the file is a readable backup you can load on any computer.',
          '紀錄儲存於此瀏覽器；檔案是可閱讀的備份，可在任何電腦載入。')}</span>
      </div>
    </div>
    ${attempts.length ? progressCardHTML(attempts) : ''}
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
  return `<div class="tablewrap"><table class="hist">
    <tr><th>${ui('Date', '日期')}</th><th>${ui('Score', '分數')}</th>
    <th>${ui('Wrong per module (M1–M7)', '各單元錯題數（M1–M7）')}</th><th></th><th></th></tr>
    ${rows}</table></div>`;
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
  const save = $('#btn-save');
  if (save) save.onclick = saveHistoryFile;
  const load = $('#btn-load'), fileIn = $('#file-load');
  if (load && fileIn) {
    load.onclick = () => fileIn.click();
    fileIn.onchange = async () => {
      const f = fileIn.files[0];
      if (!f) return;
      try {
        const r = importHistoryText(await f.text());
        homeNotice = ui(`Loaded ${esc(f.name)}: ${r.found} attempt${r.found === 1 ? '' : 's'} found, ${r.added} new added.`,
          `已載入 ${esc(f.name)}：找到${r.found}次應考紀錄，新增${r.added}次。`);
      } catch (e) {
        homeNotice = ui(`Could not read ${esc(f.name)} — it is not a history file saved by this app.`,
          `無法讀取 ${esc(f.name)}——這不是本程式儲存的紀錄檔案。`);
      }
      render();
    };
  }
  const clear = $('#btn-clear');
  if (clear) clear.onclick = () => {
    const n = store.get(attemptsKey(), []).length;
    confirmModal(
      ui('Clear all history?', '清除所有紀錄？'),
      ui(`All ${n} attempt${n === 1 ? '' : 's'} and the Progress card will be removed from this browser. This cannot be undone — save history to a file first if you may want it later.`,
         `此瀏覽器內的${n}次應考紀錄及進度卡將被刪除，且無法復原。如日後可能需要，請先將紀錄儲存至檔案。`),
      ui('Clear history', '清除紀錄'),
      () => {
        store.del(attemptsKey());
        homeNotice = ui('History cleared.', '紀錄已清除。');
        render();
      }, true);
  };
  document.querySelectorAll('.missed-head').forEach(b => {
    b.onclick = () => { const body = $('#mq-' + b.dataset.mq); if (body) body.hidden = !body.hidden; };
  });
  const weak = $('#btn-practice-weak');
  if (weak) weak.onclick = () => startPractice(stats(store.get(attemptsKey(), [])).mostMissed.map(x => x.qid));
}

/* ---------------- first-run language chooser ---------------- */

function langView() {
  return topbarHTML() + `
  <div class="wrap">
    <div class="card welcome">
      <div class="eyebrow">Customs and Excise Department · Money Service Operators</div>
      <h2>Choose your paper language<br>請選擇試卷語言</h2>
      <div class="profiles">
        <div class="profile-card" data-pick-lang="en">
          <div class="avatar">EN</div>
          <div class="name">English paper</div>
          <div class="paper">Questions, answers and explanations in English</div>
        </div>
        <div class="profile-card" data-pick-lang="tc">
          <div class="avatar">中</div>
          <div class="name">中文卷</div>
          <div class="paper">以繁體中文顯示題目、答案及解釋</div>
        </div>
      </div>
      <div class="note" style="margin-top:20px">You can switch languages, or show both (EN+中), at any time from the top bar.<br>可隨時於頂欄切換語言或同時顯示雙語（EN+中）。</div>
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
  warned = new Set();
  saveExam();
  S.view = 'exam'; render();
  window.scrollTo(0, 0);
}

function resumeExam() {
  const saved = store.get(examKey(), null);
  if (!saved) { render(); return; }
  if (Date.now() >= saved.endsAt) { exam = saved; finishExam(true); return; }
  exam = saved;
  warned = new Set();
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

  const n = exam.qids.length;
  const buttons = `
    <button class="btn small btn-submit">${ui('Submit paper', '交卷')}</button>
    <button class="btn small secondary btn-exit">${ui('Exit', '離開')}</button>`;

  return `
  <div class="examtop"><div class="wrap">
    <div class="timer">${icon('clock')}<span class="tval">--:--</span></div>
    <div class="grow"></div>
    <div class="prog">${ui('Answered', '已作答')} <b>${answered}</b>/${n}</div>
    ${buttons}
  </div></div>
  <div class="wrap">
    <div class="examgrid">
      <div>
        <div class="qcard">
          <div class="qmeta">
            <span class="qnum">${ui('Question', '第')} ${exam.cur + 1} / ${n}${S.lang === 'tc' ? ' 題' : ''}</span>
            <span class="qmod">M${q.module} · ${esc(modName(q.module))}</span>
            <button class="qflag ${flagged ? 'on' : ''}" id="btn-flag">${icon('flag')} ${flagged ? ui('Flagged', '已標記') : ui('Flag', '標記')}</button>
          </div>
          <div class="stem">${contentHTML(q, 'q')}</div>
          <div class="opts" id="opts">${opts}</div>
          <div class="qnav-row">
            <button class="btn secondary" id="btn-prev" ${exam.cur === 0 ? 'disabled' : ''}>${ui('Previous', '上一題')}</button>
            <div class="grow"></div>
            ${exam.cur === n - 1
              ? `<button class="btn" id="btn-next-submit">${ui('Submit paper', '交卷')}</button>`
              : `<button class="btn" id="btn-next">${ui('Next', '下一題')}</button>`}
          </div>
        </div>
        <div class="footer kbd">${ui('Keyboard: A–D or 1–4 to answer · ←/→ to move · click the sheet to mark or jump',
          '鍵盤：A–D 或 1–4 作答 · ←/→ 切換題目 · 可直接在答題紙上作答或跳題')}</div>
      </div>
      <aside class="rail">
        <div class="card">
          <div class="tlabel">${ui('Time remaining', '剩餘時間')}${exam.minutes !== CFG.minutes ? ` · ${exam.minutes} min` : ''}</div>
          <div class="timer">${icon('clock')}<span class="tval">--:--</span></div>
          <div class="tprog"><i></i></div>
          <div class="meta">
            <span>${ui('Answered', '已作答')} <b>${answered}</b>/${n}</span>
            <span>${ui('Flagged', '已標記')} <b>${exam.flags.length}</b></span>
          </div>
        </div>
        <div class="railbtns">${buttons}</div>
        <div class="card">
          <div class="tlabel">${ui('Answer sheet', '答題紙')}</div>
          ${omrSheetHTML()}
          <div class="omr-legend">${ui('Mark a bubble to answer; click a number to jump.', '點選圓圈作答；點擊題號跳至該題。')}</div>
        </div>
      </aside>
    </div>
  </div>`;
}

/* the answer sheet in the rail, drawn like the machine-read sheet: one row per question, bubbles A–D */
function omrSheetHTML() {
  const groups = MODULES.map(m => {
    const rows = exam.qids.map((qid, i) => ({ qid, i, q: byId.get(qid) }))
      .filter(x => x.q.module === m.n)
      .map(x => {
        const chosen = exam.answers[x.qid];
        const bubbles = exam.optOrder[x.qid].map((orig, di) =>
          `<button class="bub ${chosen === orig ? 'on' : ''}" data-mark="${x.i}:${di}" title="Q${x.i + 1} ${'ABCD'[di]}">${'ABCD'[di]}</button>`).join('');
        const fl = exam.flags.includes(x.qid) ? `<span class="fl">${icon('flag')}</span>` : '';
        return `<div class="omr-row ${x.i === exam.cur ? 'current' : ''}">
          <button class="omr-num" data-goto="${x.i}">${x.i + 1}</button>${bubbles}${fl}</div>`;
      }).join('');
    return `<div class="omr-group"><div class="omr-mod">M${m.n}</div>${rows}</div>`;
  }).join('');
  return `<div class="omr">${groups}</div>`;
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
  document.querySelectorAll('.btn-submit').forEach(b => { b.onclick = () => confirmSubmit(); });
  document.querySelectorAll('.btn-exit').forEach(b => {
    b.onclick = () => confirmModal(
      ui('Leave the exam?', '離開模擬試？'),
      ui('Your answers are saved and you can resume from the home screen — but the clock keeps running.',
         '你的答案已儲存，可隨時從主頁繼續 — 但計時不會暫停。'),
      ui('Leave', '離開'), () => { S.view = 'home'; render(); });
  });
  document.querySelectorAll('[data-goto]').forEach(b => { b.onclick = () => gotoQ(+b.dataset.goto); });
  document.querySelectorAll('[data-mark]').forEach(b => {
    b.onclick = () => {                       // mark the sheet directly
      const [i, di] = b.dataset.mark.split(':').map(Number);
      const qid = exam.qids[i];
      const orig = exam.optOrder[qid][di];
      if (exam.answers[qid] === orig) delete exam.answers[qid];
      else exam.answers[qid] = orig;
      saveExam();
      rerenderExamKeepScroll();
    };
  });
  // keep the current row visible inside the sticky rail (wide layout only)
  const cur = document.querySelector('.omr-row.current');
  if (cur && window.matchMedia('(min-width: 960px)').matches) cur.scrollIntoView({ block: 'nearest' });
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

let warned = new Set();   // minute marks already announced in this sitting

function startTimer() {
  if (!exam) return;
  const els = document.querySelectorAll('.timer');
  const bar = document.querySelector('.tprog i');
  if (!els.length) return;
  const tick = () => {
    if (!exam) return;
    const left = exam.endsAt - Date.now();
    if (left <= 0) { finishExam(true); return; }
    const txt = fmtTime(left);
    els.forEach(el => {
      el.querySelector('.tval').textContent = txt;
      el.classList.toggle('warn', left <= 10 * 60000 && left > 5 * 60000);
      el.classList.toggle('crit', left <= 5 * 60000);
    });
    if (bar) bar.style.width = Math.min(100, 100 * (1 - left / (exam.minutes * 60000))) + '%';
    for (const m of [10, 5]) {
      if (left <= m * 60000 && !warned.has(m)) { warned.add(m); toast(ui(`${m} minutes left`, `尚餘 ${m} 分鐘`)); }
    }
  };
  tick();
  timerId = setInterval(tick, 500);
}

function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

/* ---------------- results / review ---------------- */

function resultsView() {
  const a = reviewAttempt;
  const g = grade(a.qids, a.answers);
  // one row of dots per module: correct first, then wrong; the mark is the floor (at least 3 correct)
  const perMod = MODULES.map(m => {
    const total = g.moduleTotal[m.n - 1], wrong = g.moduleWrong[m.n - 1], right = total - wrong;
    const breach = wrong > CFG.maxWrongPerModule;
    const need = total - CFG.maxWrongPerModule;
    let dots = '';
    for (let i = 0; i < total; i++) {
      if (i === need) dots += '<i class="floor"></i>';
      dots += `<i class="dot ${i < right ? 'ok' : 'bad'}"></i>`;
    }
    return `<div class="dotrow ${breach ? 'breach' : ''}">
      <div class="dlabel">M${m.n} · ${esc(modName(m.n))}</div>
      <div class="dots">${dots}</div>
      <div class="dnum">${right}/${total} · ${breach
        ? `<span class="bad">${ui(`${wrong} wrong, over the limit`, `錯${wrong}題，超出上限`)}</span>`
        : `<span class="ok">${ui(`${wrong} wrong`, `錯${wrong}題`)}</span>`}</div>
    </div>`;
  }).join('');

  const whyIn = lang => {
    if (g.pass) return lang === 'en'
      ? 'Total ≥ 25/35 and every module within the 2-wrong limit.'
      : '總分達25/35，且每個單元錯題不多於2題。';
    const reasons = [];
    if (!g.totalOK) reasons.push(lang === 'en'
      ? `total ${g.score}/${a.qids.length} is below ${CFG.passTotal}`
      : `總分${g.score}/${a.qids.length}未達${CFG.passTotal}`);
    if (!g.floorsOK) {
      const bad = g.moduleWrong.map((w, i) => w > CFG.maxWrongPerModule ? `M${i + 1} (${w})` : null).filter(x => x);
      reasons.push(lang === 'en'
        ? `more than 2 wrong in ${bad.join(', ')}`
        : `${bad.join('、')}錯題多於2題`);
    }
    return (lang === 'en' ? 'Failed: ' : '不合格原因：') + reasons.join(lang === 'en' ? ' and ' : '；');
  };
  const why = S.lang === 'en' ? whyIn('en') : S.lang === 'tc' ? whyIn('tc')
    : whyIn('en') + '<br>' + whyIn('tc');

  const items = a.qids.map((qid, i) => byId.has(qid) ? reviewItemHTML(byId.get(qid), i, a) : '').join('');

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
    <div class="actions" style="margin-top:12px">
      <button class="btn secondary small" id="btn-save-r">${ui('Save history to file (.md)', '儲存紀錄至檔案 (.md)')}</button>
      <span class="note">${ui('This attempt is already kept in this browser; the file is a readable backup of all attempts.',
        '此次應考已存於此瀏覽器；檔案是所有紀錄的可閱讀備份。')}</span>
    </div>
    <div class="card">
      <h2>${ui('By module', '各單元成績')}</h2>
      <div class="sub">${ui('Correct answers first, then wrong. The mark is the floor: at least 3 correct in every module.',
        '先列答對、後列答錯。豎線代表底線：每個單元最少須答對3題。')}</div>
      <div class="dotrows">${perMod}</div>
    </div>
    <div class="card">
      <h2>${ui('Full review', '全卷重溫')}</h2>
      <div class="sub">${ui('Your answer is marked; the correct answer is highlighted in green. Click a number to jump.',
        '你的作答已標示；正確答案以綠色顯示。點擊題號可跳至該題。')}</div>
      <div class="chips" id="jumpgrid">${a.qids.map((qid, i) => {
        if (!byId.has(qid)) return '';
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
    ? `<span class="verdict bad">${icon('x')} ${ui('Not answered', '未作答')}</span>`
    : chosen === q.answer
      ? `<span class="verdict good">${icon('check')} ${ui('Correct', '答對')}</span>`
      : `<span class="verdict bad">${icon('x')} ${ui('Incorrect', '答錯')}</span>`;
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
  const save = $('#btn-save-r');
  if (save) save.onclick = saveHistoryFile;
  document.querySelectorAll('[data-jump]').forEach(b => {
    b.onclick = () => {
      const el = $('#rev-' + b.dataset.jump);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
}

/* ---------------- history file & progress ---------------- */

const pad2 = n => String(n).padStart(2, '0');
function fmtDateFull(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/* plain-text (no HTML) question text in the current language mode, for the file */
function qStem(q) { return S.lang === 'en' ? q.en.q : S.lang === 'tc' ? q.tc.q : q.en.q + ' ｜ ' + q.tc.q; }
function optText(q, i) { return S.lang === 'en' ? q.en.options[i] : S.lang === 'tc' ? q.tc.options[i] : q.en.options[i] + ' ｜ ' + q.tc.options[i]; }

/* aggregate all attempts: accuracy per module, and questions most often missed */
function stats(attempts) {
  const perModule = MODULES.map(() => ({ correct: 0, total: 0 }));
  const seen = new Map();   // qid -> { wrong, seen }
  for (const a of attempts) {
    for (const qid of a.qids) {
      const q = byId.get(qid);
      if (!q) continue;
      const ok = a.answers[qid] === q.answer;   // unanswered counts as wrong
      const pm = perModule[q.module - 1];
      pm.total++; if (ok) pm.correct++;
      const m = seen.get(qid) || { wrong: 0, seen: 0 };
      m.seen++; if (!ok) m.wrong++;
      seen.set(qid, m);
    }
  }
  const mostMissed = [...seen.entries()].filter(([, m]) => m.wrong > 0)
    .sort((x, y) => y[1].wrong - x[1].wrong || (y[1].wrong / y[1].seen) - (x[1].wrong / x[1].seen))
    .map(([qid, m]) => ({ qid, ...m }));
  return { perModule, mostMissed };
}

/* the saved file: readable Markdown + a JSON data block the app reads back */
function historyMarkdown(attempts) {
  const L = (en, tc) => S.lang === 'en' ? en : S.lang === 'tc' ? tc : en + ' / ' + tc;
  const st = stats(attempts);
  const out = [];
  out.push(`# ${L('MSO Competence Assessment — mock exam history', '金錢服務經營者能力評核 — 模擬試紀錄')}`, '');
  out.push(`${L('Saved', '儲存時間')}: ${fmtDateFull(Date.now())} · ${L('Attempts', '應考次數')}: ${attempts.length}`, '');
  out.push(`## ${L('Performance by module (all attempts)', '各單元表現（累計）')}`, '');
  out.push(`| ${L('Module', '單元')} | ${L('Correct', '答對')} | % |`, '|---|---|---|');
  MODULES.forEach(m => {
    const s = st.perModule[m.n - 1];
    const pct = s.total ? Math.round(100 * s.correct / s.total) : 0;
    out.push(`| M${m.n} ${L(m.en, m.tc)} | ${s.correct}/${s.total} | ${pct}% |`);
  });
  if (st.mostMissed.length) {
    out.push('', `## ${L('Most-missed questions', '最常答錯的題目')}`, '');
    st.mostMissed.slice(0, 15).forEach(x => {
      const q = byId.get(x.qid);
      out.push(`- **${q.id}** (M${q.module}) — ${L('wrong', '答錯')} ${x.wrong}/${x.seen}: ${qStem(q)}`);
      out.push(`  - ${L('Correct answer', '正確答案')}: ${optText(q, q.answer)}`);
    });
  }
  [...attempts].reverse().forEach(a => {
    out.push('', `## ${fmtDateFull(a.ts)} — ${a.score}/${a.qids.length} — ${a.pass ? L('PASS', '合格') : L('FAIL', '不合格')}`, '');
    out.push(`${L('Wrong per module', '各單元錯題')}: ${a.moduleWrong.map((w, i) => `M${i + 1}: ${w}`).join(' · ')}` +
      (a.auto ? ' · ' + L('auto-submitted when time ran out', '時間屆滿自動交卷') : ''), '');
    a.qids.forEach((qid, n) => {
      const q = byId.get(qid);
      if (!q || a.answers[qid] === q.answer) return;
      const chosen = a.answers[qid];
      out.push(`- Q${n + 1} (M${q.module}, ${q.id}) ${qStem(q)}`);
      out.push(`  - ${L('Your answer', '你的答案')}: ${chosen === undefined ? L('(not answered)', '（未作答）') : optText(q, chosen)}`);
      out.push(`  - ${L('Correct answer', '正確答案')}: ${optText(q, q.answer)}`);
    });
  });
  out.push('', '---', '', `<!-- ${L('Data block: the app reads this when you load the file. Do not edit.', '資料區塊：程式載入檔案時讀取，請勿修改。')} -->`);
  out.push('```json', JSON.stringify({ app: 'mso-ca', version: 1, attempts }, null, 1), '```', '');
  return out.join('\n');
}

function downloadText(text, filename, type) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

function saveHistoryFile() {
  downloadText(historyMarkdown(store.get(attemptsKey(), [])),
    'mso-ca-history-' + new Date().toISOString().slice(0, 10) + '.md', 'text/markdown');
}

/* merge attempts from a saved file (.md with data block, or plain .json); returns counts */
function importHistoryText(text) {
  let raw = text.trim();
  const fence = raw.match(/```json\s*([\s\S]*?)```/);
  if (fence) raw = fence[1];
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : data && data.attempts;
  if (!Array.isArray(list)) throw new Error('no attempts');
  const valid = list.filter(a => a && typeof a.ts === 'number' && Array.isArray(a.qids) && a.answers
    && typeof a.score === 'number' && Array.isArray(a.moduleWrong) && a.qids.every(id => byId.has(id)));
  const existing = store.get(attemptsKey(), []);
  const have = new Set(existing.map(a => a.ts));
  const added = valid.filter(a => !have.has(a.ts));
  store.set(attemptsKey(), existing.concat(added).sort((x, y) => x.ts - y.ts));
  return { found: valid.length, added: added.length };
}

/* a question with its correct answer and explanation (no attempt context) */
function explainCardHTML(q) {
  const opts = [0, 1, 2, 3].map((orig, di) => `
    <button class="opt ${orig === q.answer ? 'correct' : 'dim'}" disabled>
      <span class="letter">${'ABCD'[di]}</span>
      <span class="otext">${optionHTML(q, orig)}</span>
    </button>`).join('');
  return `<div class="stem">${contentHTML(q, 'q')}</div>
    <div class="opts">${opts}</div>
    <div class="explain">${contentHTML(q, 'explain')}${sourceHTML(q)}</div>`;
}

/* score per attempt, with the pass mark as a dashed line; inline SVG, no library */
function sparklineSVG(attempts) {
  if (attempts.length < 2) return '';
  const W = 1000, H = 72, px = 12, py = 10, T = CFG.total;
  const xs = i => (px + i * (W - 2 * px) / (attempts.length - 1)).toFixed(1);
  const ys = s => (H - py - (s / T) * (H - 2 * py)).toFixed(1);
  const pts = attempts.map((a, i) => `${xs(i)},${ys(a.score)}`).join(' ');
  const dots = attempts.map((a, i) =>
    `<circle class="pt ${a.pass ? 'pass' : 'fail'}" cx="${xs(i)}" cy="${ys(a.score)}" r="5"><title>${fmtDate(a.ts)} · ${a.score}/${a.qids.length}</title></circle>`).join('');
  const passY = ys(CFG.passTotal);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid meet">
    <line class="pass-line" x1="${px}" x2="${W - px}" y1="${passY}" y2="${passY}"/>
    <text x="${W - px}" y="${passY - 4}" text-anchor="end">${CFG.passTotal}/${T}</text>
    <polyline class="line" points="${pts}"/>${dots}</svg>`;
}

function progressCardHTML(attempts) {
  const st = stats(attempts);
  const rows = MODULES.map(m => {
    const s = st.perModule[m.n - 1];
    const pct = s.total ? Math.round(100 * s.correct / s.total) : 0;
    const cls = pct < 60 ? 'bad' : pct < 80 ? 'mid' : 'good';
    return `<div class="prow">
      <div class="plabel">M${m.n} · ${esc(modName(m.n))}</div>
      <div class="pbar"><i class="${cls}" style="width:${pct}%"></i></div>
      <div class="pnum">${s.correct}/${s.total} · <b>${pct}%</b></div>
    </div>`;
  }).join('');
  const missed = st.mostMissed.slice(0, 10).map(x => {
    const q = byId.get(x.qid);
    return `<div class="missed">
      <button class="missed-head" data-mq="${q.id}">
        <span class="qmod">M${q.module}</span>
        <span class="mstem">${contentHTML(q, 'q')}</span>
        <span class="tag fail">${ui('wrong', '答錯')} ${x.wrong}/${x.seen}</span>
      </button>
      <div class="missed-body" id="mq-${q.id}" hidden>${explainCardHTML(q)}</div>
    </div>`;
  }).join('');
  const n = attempts.length, k = st.mostMissed.length;
  return `<div class="card">
    <h2>${ui('Progress', '進度')}</h2>
    <div class="sub">${ui(`Across ${n} attempt${n === 1 ? '' : 's'}. A module under 60% is on course to breach the 2-wrong floor.`,
      `累計${n}次應考。單元答對率低於60%，即有機會超出每單元錯2題的上限。`)}</div>
    ${sparklineSVG(attempts)}
    ${n >= 2 ? `<div class="note">${ui('Score per attempt, oldest to newest; the dashed line is the pass mark.', '每次應考的分數（由舊至新）；虛線為及格分數。')}</div>` : ''}
    <h3 class="subhead">${ui('Accuracy by module', '各單元答對率')}</h3>
    <div class="pgrid">${rows}</div>
    ${k ? `<h3 class="subhead">${ui('Most-missed questions', '最常答錯的題目')} · ${ui('click to see the answer', '點擊查看答案')}</h3>
    <div class="missed-list">${missed}</div>
    <div class="actions">
      <button class="btn" id="btn-practice-weak">${ui('Practice these questions', '練習這些題目')}</button>
      <span class="note">${ui(`${k} question${k === 1 ? '' : 's'} missed at least once`, `共${k}題曾答錯`)}</span>
    </div>` : `<div class="note" style="margin-top:12px">${ui('No mistakes so far.', '暫未有錯題。')}</div>`}
  </div>`;
}

/* ---------------- practice ---------------- */

function startPractice(customPool = null) {
  const pool = customPool ? customPool.slice() : shuffle(bank.filter(q => pmodSel.has(q.module)).map(q => q.id));
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
          ${practice.chosen === q.answer ? icon('check') + ' ' + ui('Correct', '答對') : icon('x') + ' ' + ui('Incorrect', '答錯')}</div>
        ${contentHTML(q, 'explain')}
        ${sourceHTML(q)}
      </div>
      <div class="qnav-row">
        <div class="grow"></div>
        <button class="btn" id="btn-pnext">${ui('Next question', '下一題')}</button>
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

  S.lang = store.get('lang', null);

  // an exam that expired while the app was closed → submit it now
  const saved = store.get(examKey(), null);
  if (saved && Date.now() >= saved.endsAt) {
    exam = saved;
    finishExam(true);
    return;
  }
  render();
}

/* first-run language choice (delegated) */
document.addEventListener('click', e => {
  const card = e.target.closest('[data-pick-lang]');
  if (!card) return;
  S.lang = card.dataset.pickLang;
  store.set('lang', S.lang);
  render();
});

boot();
