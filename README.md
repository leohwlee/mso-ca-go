# MSO Competence Assessment — Mock Exam

[繁體中文版 →](README.zh-Hant.md)

An offline mock-exam app for the Hong Kong Customs & Excise Department's
**Competence Assessment for Money Service Operators**.

- **140 questions** in the bank — 20 for each of the 7 official modules — every
  one available in English and Traditional Chinese, with an explanation and a
  citation to the exact source document and paragraph.
- Mirrors the real paper: 35 questions, 75 minutes, and the real pass rules.
- One small program for Windows or Mac. No internet, no installation, no
  account. Your history stays on your own computer.

## Quick start

1. **Download** the file for your computer from the
   [Releases page](../../releases/latest):
   `mso-ca-windows-amd64.exe` (Windows),
   `mso-ca-macos-arm64` (Mac with Apple Silicon) or
   `mso-ca-macos-amd64` (Mac with an Intel chip).
2. **Run it.** Windows: double-click the `.exe`. Mac: open Terminal in the
   folder, run `chmod +x mso-ca-macos-arm64` once, then double-click the file
   (right-click → Open the first time, as it is not notarised).
   A small terminal window appears and your browser opens the app at
   <http://127.0.0.1:8321>. **Keep that terminal window open while you
   practise**; close it (or press `Ctrl+C`) when you are done.
3. **Choose your paper language** (English or Traditional Chinese) and start.

Optional flags: `-port 9000` to use another port, `-no-browser` to skip the
automatic browser launch.

## How to use it

**Mock exam.** *Start mock exam* draws 35 questions at random from the bank —
5 from each module, in module order like the real paper — and starts a
75-minute clock. Answer by clicking an option, pressing `A`–`D` or `1`–`4`
(press again to erase), or marking a bubble on the answer sheet beside the
question. `Enter` or `→` moves on; `←` goes back; the sheet's numbers jump to
any question. *Flag* marks a question to revisit. *Submit paper* lists anything
unanswered before you commit; *Exit* saves your progress and returns home, but
the clock keeps running — exactly as it would in the exam room — and you can
resume from the home screen. If time runs out the paper is submitted
automatically. The clock turns amber at 10 minutes and red at 5.

**The pass rules.** You pass only if **both** hold: no more than 2 wrong in
**each** module, **and** at least 25/35 overall. A 32/35 with three mistakes in
one module is a fail. The results page shows every module as a row of dots
with the floor marked, so a breach is obvious at a glance.

**Results and review.** After submitting you see PASS or FAIL, the score, the
per-module rows, and a full review of every question with your answer, the
correct answer, the explanation and its source. Switch to *Wrong only* to see
just the mistakes. *Practice my wrong answers* drills exactly those questions.

**Practice.** Pick one or more modules and practise without a clock: after
each answer you immediately see whether it was right, with the explanation and
citation. The pool recycles when you have seen every question once.

**Progress.** Once you have some history the home screen shows your score per
attempt, your accuracy per module across all attempts (red under 60 %, which
is on course to breach the 2-wrong floor), and the questions you miss most
often — click one to see its answer, or *Practice these questions*.

**History.** Every attempt is kept in this browser and can be replayed from
the History table. *Save history to file (.md)* writes a readable Markdown
record of all attempts (per-module accuracy, most-missed questions with
answers, every wrong answer of every attempt) that the app can also read back
with *Load history from file* — use it as a backup or to move to another
computer. *Clear history* removes everything after a confirmation.

**Language and theme.** The top bar switches between **EN**, **中文** and
**EN+中** (both languages shown together) at any time, even mid-exam, and
between Auto / Light / Dark themes.

**Quick drills.** Open `http://127.0.0.1:8321/?minutes=20` to run mocks with a
custom time limit.

## The question bank

**140 questions in total, 20 per module**, all written from the official
materials and nothing else. Each question has four options, one correct
answer, a bilingual explanation, and a citation you can check against the PDF.

| Module | Questions | Written from |
|---|---|---|
| 1 · General knowledge on AML/CFT and counter-proliferation financing | 20 | AML/CFT Guideline for MSOs (Jun 2023) ch. 1 & 6; AMLO Sch. 1 |
| 2 · Parts 1–7 of the AMLO | 20 | AMLO (Cap. 615, consolidated 15 May 2026) |
| 3 · Schedules to the AMLO | 20 | AMLO Schedules 1–3 |
| 4 · Guidelines promulgated by the C&ED | 20 | Licensing Guide (May 2026), fitness-and-propriety, business-plan, AML-policy and disciplinary guidelines, 2026 circulars |
| 5 · Systems and controls (i): governance and strategy | 20 | AML/CFT Guideline ch. 2–3 |
| 6 · Systems and controls (ii): AML/CFT control areas | 20 | AML/CFT Guideline ch. 4–6, 10–11 |
| 7 · Systems and controls (iii): demonstrating and monitoring compliance | 20 | AML/CFT Guideline ch. 7–9 |

> C&ED publishes no sample or past questions. These are reconstructions for
> practice, not real exam questions.

The bank is the file `web/questions.json`. To add or fix a question, edit it
and rebuild; `go test ./...` checks the shape (20 per module, 4 options each,
both languages and a citation present).

**The official documents themselves** — all 13, in English and Traditional
Chinese — are in [`docs/`](docs/README.md), so every citation in the app can be
checked against the source PDF.

## Where your history lives

All attempts, an in-progress exam and your settings live in the browser's
local storage on your own computer. Nothing is sent anywhere; the program is
only a local file server. Practically: history survives closing the app,
restarting the computer and app updates; it belongs to one browser on one
machine, so two people on their own computers automatically have separate
histories, and clearing that browser's site data erases it. Use *Save history
to file* as a backup.

## Build from source

Requires Go ≥ 1.21 and nothing else: the server is standard library only and
the front end is plain HTML, CSS and JavaScript with no build step.

```bash
go test ./...             # question-bank integrity + vet
go build -o mso-ca.exe .  # single binary with everything embedded
```

`build.cmd` (Windows) or `./build.sh` (Mac/Linux) cross-compiles all three
binaries into `dist/`.

Fonts: DM Sans and DM Mono are bundled under the SIL Open Font License (see
`web/fonts/`); Chinese text uses the operating system's fonts.
