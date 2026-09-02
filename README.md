# MSO Competence Assessment — Mock Exam 金錢服務經營者能力評核模擬試

Offline mock-exam app for the Hong Kong C&ED **Competence Assessment for Money
Service Operators**.

Everything runs locally in one small program: no internet, no accounts, no
installation. Your practice history stays in your own browser.

## Run it 使用方法

| | |
|---|---|
| **Windows** | double-click `mso-ca-windows-amd64.exe` |
| **Mac (Apple Silicon)** | double-click `mso-ca-macos-arm64` * |
| **Mac (Intel)** | double-click `mso-ca-macos-amd64` * |

The program starts a tiny local server and opens the app in your browser.
**Keep the terminal window open while practising**; press `Ctrl+C` to quit.
使用期間請保持該視窗開啟；按 `Ctrl+C` 結束。

\* On a Mac you may first need: `chmod +x mso-ca-macos-arm64`, then right-click →
Open the first time (unsigned binary). If the browser doesn't open
automatically, go to <http://127.0.0.1:8321>.

Flags: `-port 9000` to use another port, `-no-browser` to skip auto-opening.

## What's inside

- **Mock Exam 模擬試** — mirrors the real paper: 35 questions (7 modules × 5,
  drawn at random from a 140-question bank), 75-minute countdown, module-grouped
  answer sheet, flags, and the **real pass rules**: at most 2 wrong in *each*
  module **and** ≥ 25/35 overall. 32/35 still fails if one module has 3
  mistakes — the app makes that painfully visible.
- **Practice 練習** — pick modules, untimed, instant feedback with an
  explanation and an exact source citation after every answer.
- **Review 重溫** — every past attempt is stored and can be replayed with full
  explanations; switch to *Wrong only* to see just the mistakes, and go
  straight to *Practice my wrong answers* from the results page.
- **Languages** — on first launch you pick English or 繁體中文; every question
  exists in both. Switch between **EN**, **中文**, or **EN+中** (bilingual,
  both shown together) at any time from the top bar, even mid-exam.
- An accidental refresh or closed tab does **not** lose a mock exam — reopen
  the app and resume; the clock keeps running, as it would in the real room.
- **Exam room layout** — on a laptop the question sits beside a sticky answer
  sheet drawn like the real machine-read sheet: mark a bubble to answer, click
  a number to jump. The **Auto / Light / Dark** switch in the top bar picks the
  theme (Auto follows the operating system).
- **Design** — minimal and monochrome: white ground, near-black ink, grey for
  everything secondary, hairline borders, no shadows. Colour is used only for
  meaning (green correct, red wrong, amber warning). DM Sans for text and DM
  Mono for numbers are bundled (`web/fonts/`, SIL Open Font License) so the
  app stays fully offline.

Hidden switch for quick drills: open `http://127.0.0.1:8321/?minutes=20` to
start mocks with a custom timer.

## Where your history lives 紀錄儲存位置

All attempts, the in-progress exam and your language choice are stored in the
**browser's local storage** (`localStorage`) on your own computer — nothing is
sent anywhere, and there is no server-side data. Practical consequences:

- History survives closing the app, restarting the computer, and app updates.
- It belongs to **one browser on one machine**: Chrome and Safari on the same
  laptop each have their own history, and clearing that browser's site data
  erases it. Each person practising on their own computer automatically has
  their own history.
- **Save to file**: after each mock exam (and any time from the home screen),
  *Save history to file (.md)* downloads `mso-ca-history-<date>.md` — a
  readable Markdown record of **all** attempts so far: per-module accuracy,
  the most-missed questions with their correct answers, and every wrong answer
  of every attempt. The file ends with a data block the app reads back.
- **Load from file**: *Load history from file* on the home screen reads such a
  file into the browser — on a new computer, a different browser, or after
  clearing browser data. Attempts already present are skipped, so loading the
  same file twice is harmless. 主頁的「儲存紀錄至檔案」把所有紀錄存成可閱讀的
  Markdown 檔案；「從檔案載入紀錄」可在任何電腦把紀錄載回。
- **Clear history**: the *Clear history* button on the home screen removes all
  attempts from the browser after a confirmation. Save to a file first if you
  may want them back; the language choice is kept.
- **Progress card**: once there is history, the home screen shows accuracy per
  module across all attempts (red under 60 % — on course to breach the
  2-wrong floor), the questions missed most often (click to see the answer),
  and a *Practice these questions* button that drills exactly those.

## The question bank

140 bilingual questions (20 per module), hand-written from the official
materials only — the AMLO (Cap. 615, consolidated 15 May 2026), the C&ED
AML/CFT Guideline for MSOs (Jun 2023), the Licensing Guide (May 2026), the
fitness-and-propriety / business-plan / AML-policy / disciplinary guidelines,
and the 2026 circulars (including the 15 May 2026 fee revisions). Every
question cites its source so answers can be checked against the PDFs.

> C&ED publishes no sample or past questions. These are reconstructions for
> practice — not real exam questions. 本題庫按官方材料重構，並非真題。

The bank lives in `web/questions.json`. To add or fix questions, edit that
file and rebuild (`go test ./...` validates its shape: 20 per module, 4
options each, both languages present).

## Build from source

Requires Go ≥ 1.21, nothing else (stdlib only, frontend is plain HTML/JS).

```bash
go test ./...   # bank integrity + vet
go build -o mso-ca.exe .
```

Cross-compile both platforms into `dist/`: run `build.cmd` (Windows) or
`./build.sh` (Mac/Linux).
