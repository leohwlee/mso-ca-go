# MSO Competence Assessment — Mock Exam

[繁體中文版 →](README.zh-Hant.md)

A practice app for the Hong Kong Customs & Excise Department's **Competence
Assessment for Money Service Operators** — the exam a licensee's sole
proprietor, partner or director must pass.

It is **one HTML file**. Download it, open it in Chrome, and it works offline
forever. Nothing to install, no account, no internet. Your results stay in your
own browser.

- **1,594 questions**, every one written from the official documents and citing
  the exact paragraph it came from.
- Both languages throughout — English, 繁體中文, or both side by side.
- Mirrors the real paper: 35 questions, 7 modules, 75 minutes, real pass rules.

## Quick start

1. **Download `mso-ca.html`** from the [Releases page](../../releases/latest)
   (about 3.5 MB — the questions and fonts are inside the file).
2. **Open it in Google Chrome.** Double-click it, or right-click → Open with →
   Google Chrome. Edge and Firefox work too.
3. **Choose your paper language** and start.

Keep the file somewhere permanent, like your Documents folder, and open the
same file each time — that is where your history lives.

## How to prepare for the exam

A sensible way to use it, from a standing start to exam day.

**1 · Learn the material, module by module.** Open *Practice*, tick one module,
and work through it without a clock. Every answer is followed immediately by the
right answer, an explanation, and the paragraph it comes from. This is where the
four-option questions earn their place: each tests a single provision, so when
you get one wrong you know exactly which rule you have not learnt. Do one module
at a time rather than all seven at once.

**2 · Find out where you actually stand.** Sit a full mock. Do not stop the
clock; the real paper does not stop either. Afterwards the results page shows
every module as a row of dots with the pass floor marked, so a weak module is
obvious at a glance.

**3 · Attack the weak module.** *Practice my wrong answers* drills exactly the
questions you missed. The home screen also tracks the questions you get wrong
most often across all your attempts — click any of them to see the answer and
the explanation.

**4 · Rehearse the real thing.** On the mock exam card, tick **Exam-realistic
paper**. That draws all 35 questions in the *combination* format C&ED actually
prints (see below). Save it for when you are nearly ready: it is the closest the
app gets to the paper you will sit.

**5 · Watch the floor, not the total.** You pass only if **both** hold: no more
than **2 wrong in each module**, and **25/35 or better overall**. A 32/35 with
three mistakes in one module is a fail. Most people who fail, fail on one
module — which is why step 3 matters more than grinding the total upward.

Your history stays in the browser, so you can see whether you are improving.
*Save history to file* writes a readable Markdown record you can back up, carry
to another computer, and load back in.

## What is in the question bank

**1,594 questions**, written from the official materials and nothing else. Each
has one correct answer, an explanation in both languages, and a citation you can
check against the source document in [`docs/`](docs/README.md).

The modules are deliberately unequal, because the official reading behind them
differs by a factor of eight. Each is sized to the volume of source material, so
every question traces to a real provision rather than rewording its neighbour.

| Module | Questions | Written from |
|---|---|---|
| 1 · General knowledge on AML/CFT and counter-proliferation financing | 126 | AML/CFT Guideline ch. 1 & 6; AMLO Sch. 1; circulars |
| 2 · Parts 1–7 of the AMLO | 308 | AMLO (Cap. 615, consolidated 15 May 2026) |
| 3 · Schedules to the AMLO | 260 | AMLO Schedules 1–3 |
| 4 · Guidelines promulgated by the C&ED | 310 | Licensing Guide, fitness-and-propriety, business-plan, AML-policy and disciplinary guidelines, circulars |
| 5 · Systems and controls (i): governance and strategy | 96 | AML/CFT Guideline ch. 2–3; circulars |
| 6 · Systems and controls (ii): AML/CFT control areas | 340 | AML/CFT Guideline ch. 4–6, 10–11; circulars |
| 7 · Systems and controls (iii): demonstrating and monitoring compliance | 154 | AML/CFT Guideline ch. 7–9; circulars |

> These are reconstructions for practice, not real exam questions. C&ED has
> never released a past paper.

### Two question formats

**Four options, one answer.** Most of the bank. Each tests a single provision,
which makes it the better shape for learning one rule at a time. The app
shuffles the options every time a question is drawn, so position never gives the
answer away.

**Combination questions.** A stem, four or five numbered statements, and five
fixed options naming subsets of them:

> Which of the following factors should be considered by an MSO licensee in
> conducting the institutional ML/TF risk assessment?
>
> 1. The MSO's target market and customer segments
> 2. The profitability of the MSO's business
> 3. The nature, scale, diversity and complexity of the MSO's business
> 4. The delivery channels of the MSO
>
> a) 1, 2 and 3  b) 1, 2 and 4  c) 2, 3 and 4  d) 1, 3 and 4  e) All of the above

The real task is to spot the statement that is false — here statement 2, because
profitability is not an ML/TF risk factor — and pick the option listing the rest.

**This is the format C&ED prints.** Every sample question the department has
published is one: the seven in circular MSSB/CA_01/2021 and the one in Guidance
Notes ¶7.1. So the bank reproduces the option block character for character and
never shuffles it — there the order is part of the question. Tick
*Exam-realistic paper* and your whole mock is drawn from these.

### The official documents

All **29** of them, English and Traditional Chinese, are in
[`docs/`](docs/README.md), so every citation in the app can be checked against
the source. They are the five reference sources Guidance Notes ¶6.1 names: the
Ordinance, the AML/CFT Guideline, the Licensing Guide, the other C&ED
guidelines, and the circulars C&ED issues to MSOs.

`docs/EN/19` is worth opening on its own — it is the only set of sample
questions C&ED has ever published.

## Everything else the app does

- **Answer sheet.** A machine-read-style sheet sits beside every question; mark
  a bubble to answer, or click a number to jump. Flagged questions show there too.
- **Keyboard.** `A`–`E` or `1`–`5` to answer (press again to erase), `Enter` or
  `→` for the next question, `←` to go back.
- **Exit and resume.** Leaving an exam saves it, but the clock keeps running, as
  it would in the exam room. Resume from the home screen.
- **Language and theme.** Switch between EN, 中文 and both at any time, even
  mid-exam; Auto, Light or Dark.
- **Custom time.** Add `?minutes=20` after `mso-ca.html` in the address bar for
  shorter drills.
- **History.** Every attempt is replayable, and *Clear history* removes
  everything after a confirmation.

## Where your history lives

In your own browser's local storage, on your own computer. Nothing is sent
anywhere — the file contains no network code. History survives closing the
browser, restarting it, and replacing the HTML file with a newer edition. It
belongs to one browser on one machine, so two people on their own computers keep
separate histories, and clearing that browser's site data erases it.

One Chrome detail: Chrome keeps a single shared store for all local HTML files,
so if you use other local pages, treat *Save history to file* as the reliable
record.

## For developers

The repository holds the app's parts (`web/`) and a small Go program that folds
them into the single file. Requires Go ≥ 1.21 and nothing else.

```bash
go test ./...                          # question-bank checks + vet
go run . -export-html dist/mso-ca.html # build the single file
go run .                               # or: serve web/ while developing
```

`build.cmd` (Windows) or `./build.sh` (Mac/Linux) does the same.

The bank is `web/questions.json`. `go test ./...` is more than a shape check: it
guards the faults that quietly ruin a question bank, each one added after a
review found it in real questions.

| Check | What it stops |
|---|---|
| Per-module counts, 4 or 5 options, both languages, a citation | questions going missing or half-written |
| Option length balance and rank | "always pick the longest" — it once passed 64% of simulated papers |
| Citation has a locator | citing a document with no paragraph to turn to |
| Statutory Chinese terms | wording the official Chinese editions never use |
| ML/TF pairing | dropping the terrorist-financing half in Chinese |
| No positional references | "option 2" in an explanation, when options are shuffled |
| No duplicate stems, no shared answer across modules | one question asked twice |
| Combination format | the printed option block, verbatim, and a spread of answer letters |

Fonts: DM Sans and DM Mono are embedded under the SIL Open Font License; Chinese
text uses the operating system's fonts.

**Releases** are cut by tag. Pushing a tag beginning with `v` runs
[`release.yml`](.github/workflows/release.yml), which vets and tests the bank,
builds the file from that exact commit, and attaches it to a GitHub release. The
tests run before the build, so a tag that fails never becomes a download.

```bash
git tag v1.5.0
git push origin v1.5.0
```

## Licence

Open source, in three parts — because the repository holds three kinds of thing.

| What | Licence |
|---|---|
| The code — Go, JavaScript, CSS, build scripts, tests | [MIT](LICENSE) |
| The question bank — `web/questions.json` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| The bundled fonts — DM Sans, DM Mono | [SIL OFL 1.1](web/fonts/OFL.txt) |

Use any of it, including commercially. For the question bank, credit the author
and link back; for the code, keep the copyright notice.

**The documents in `docs/` are excluded.** They are publications of the
Government of the Hong Kong Special Administrative Region, reproduced for study
reference only, and are not the author's to license. See
[LICENSE-CONTENT.md](LICENSE-CONTENT.md) for the detail.

This is not an official product of the Customs and Excise Department, and
nothing here is legal advice. Every question cites the paragraph it came from
so you can check it against the source.
