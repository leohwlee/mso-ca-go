# MSO Competence Assessment — Mock Exam 金錢服務經營者能力評核模擬試

Offline mock-exam app for the Hong Kong C&ED **Competence Assessment for Money
Service Operators** (assessment date: **Mon 6 Oct 2026** — Leo sits the English
paper, Bevis sits the Chinese paper).

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
- **Review 重溫** — every past attempt is stored (per person) and can be
  replayed with full explanations.
- **Languages** — every question exists in English and Traditional Chinese.
  Choose **EN**, **中文**, or **EN+中** (bilingual, both shown together) at any
  time, even mid-exam.
- An accidental refresh or closed tab does **not** lose a mock exam — reopen
  the app and resume; the clock keeps running, as it would in the real room.

Hidden switch for quick drills: open `http://127.0.0.1:8321/?minutes=20` to
start mocks with a custom timer.

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
