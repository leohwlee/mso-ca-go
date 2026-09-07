---
name: exam-question-bank
description: Build, extend or audit a bank of multiple-choice questions written from a fixed set of source documents, in one language or two, and draw mock exams from it. Use when asked to generate practice questions, quiz items, a certification question bank or a mock paper out of PDFs, statutes, guidelines, manuals or course material; and when auditing an existing bank for wrong keys, second defensible answers, ungrounded claims, duplicates, or answers a candidate can guess from surface form without knowing the material.
---

# Building a question bank from documents

This runbook was distilled from taking a 1,594-question bilingual bank through
six review passes. Every rule below was added after a review found the fault in
real questions, and the measured effect is quoted where it exists, because the
numbers are the part that is hard to re-derive. Thresholds are defaults you can
move; the reasoning behind each is what to keep.

## The one principle

**A question is worth asking only if the sole way to answer it is to know the
cited passage.** Every defect in this document is a way that stops being true.
Either the question is wrong about its source, or the answer can be reached
without reading the source at all — from the shape of the options, from a word
that hedges, from a length, from a semicolon.

The second failure is the one that survives ordinary review, because each
question looks fine on its own. It is only visible in aggregate, so **you have
to measure the bank, not read it.**

## Choose the mode

- **Building from scratch** — work the phases in order.
- **Extending an existing bank** — phases 1, 3 and 5, plus the duplicate sweep.
- **Auditing** — jump to *Verify blind* and *The catalogue of tells*, measure
  everything before changing anything, and report the ceiling honestly.

---

## Phase 1 — Fix the source set

The bank is only as authoritative as the documents behind it, so settle those
first and never author from memory or from the open web.

- **Get the exact list from the user, then archive it locally**, every language
  edition, under stable filenames. Work from the archive, not from live URLs —
  sources get re-issued and a citation that moves is worse than none.
- **Never guess an identifier.** Where documents are served by numeric id or
  code, read the real listing. Translated editions do *not* reliably sit at a
  predictable offset from the original; two of fourteen in this project did not.
- **Look for published sample questions or a past paper before designing
  anything.** If the examiner prints a specific format, that format is part of
  the exam, and reproducing it character for character matters more than any
  question you write. Check the syllabus document's own worked examples too —
  the sample in an appendix is easy to miss and may be newer than the sample set.
- **Record the volume of each source.** It decides the blueprint in Phase 2.
- **Extract text once, up front.** Anchoring an extract by paragraph number
  tends to land in a table of contents; searching for a distinctive 5–9 word
  phrase is what actually locates a provision. Build the small "show me the
  source for question X" tool now — you will use it in every later phase.

**Scope check.** Ask what is examinable, not just what is available. Supporting
circulars, FAQs and amendment notices are often examinable and are usually the
part nobody archived. Say explicitly which sources you covered and which you
could not reach.

---

## Phase 2 — Blueprint before authoring

- **Size each section to the volume of source material behind it**, not to a
  round number. Sections sized equally against unequal sources force the writers
  to reword each other's questions, which is where duplicates come from. Unequal
  section sizes look odd in a table and are correct; say why in the README.
- **Fix the schema up front**, including a per-language citation field carrying
  a *locator* — a paragraph, section or item number, not just a document name.
  A citation you cannot turn to is not a citation.
- **Store the key at a fixed index and shuffle at draw time.** Then position
  cannot leak, and every remaining tell is about *content and shape* — which is
  what the rest of this document is about. Exempt any fixed printed option block
  from shuffling.
- **Decide the formats.** Two earn their place:
  - *Single-provision, four options.* Best for learning, because a wrong answer
    tells the candidate exactly which rule they have not learnt.
  - *Combination / multi-statement.* A stem, four or five numbered statements,
    and a fixed block of options naming subsets ("1, 2 and 3", "All of the
    above"). The real task is to find the false statement. If the examiner uses
    this format, reproduce the option strings **verbatim**, including spacing
    and punctuation in every language, and hold them in a test.
- **The binding constraint on how many distinct papers you can draw is the
  smallest section, not the total.** Lifting one section while others sit at the
  floor buys nothing. Grow all sections in parallel.
- **Write the guards as failing tests before authoring.** A guard added after
  the fact means a rewrite of the bank; every threshold in Phase 5 cost hundreds
  of hand rewrites because it arrived late.

---

## Phase 3 — Author in packets

Authoring at scale means delegating, and delegation is where banks get
corrupted. The pattern that held up:

- **Subagents return JSON patches; they never edit the bank file.** Parallel
  packets then cannot collide, and re-running is idempotent.
- **One applier validates every rule and applies per question**, not per batch,
  so one bad estimate no longer rejects the whole round trip. A no-op apply must
  round-trip the bank file **byte-identically** — verify that before the first
  real write.
- **Give each packet a disjoint slice** of the candidate list (`cands[i::n]`),
  or two agents will pick the same questions.
- **Save incrementally, every ~8 items.** Rate limits killed three waves of
  subagents in this project; incremental saves plus a follow-up packet for the
  leftover ids lost nothing after that. **Check coverage against the packet's id
  list before declaring a category done** — one packet saved 8 of 18 and died
  silently.
- **Batches of 16–20 questions per round trip** were the sweet spot.
- **Both languages must travel in the same patch entry**, because the applier
  validates the merged question. A patch carrying only one language for a
  question whose other language also fails is rejected whole and nothing lands.
- **`check` before `apply`.** A dry run that prints the resulting measurements
  and pass/fail costs nothing and saves a rejected batch.
- Tell every packet-runner the **index-alignment rule** from the bilingual
  section below. Length-tuning constantly tempts agents into reordering one
  language.
- **Require the writer to trim the key rather than pad the distractors**, and
  forbid generic bolt-on clauses. Audit each wave for repeated distractor-only
  phrases and trailing tags — they become a tell of their own.

**Shell notes that cost real time:** force UTF-8 on tooling stdout
(`PYTHONIOENCODING=utf-8`) or non-Latin text returns as mojibake through the
pipe and cannot be edited. Heredocs break intermittently on long multi-line
JSON; write patch files with the file-writing tool instead.

---

## Phase 4 — Verify blind

Reviewing a question with the key in front of you verifies nothing. The reviewer
must be made to answer it.

- **Shuffle the options in the review packet and put the key and explanation at
  the end.** Inline the exact source chapter with the packet so the reviewer
  answers from the source, then compares.
- **Two criteria only:** is the keyed answer correct, and is it *uniquely*
  correct. A second defensible answer is as fatal as a wrong one and far more
  common — this bank had 0 wrong keys and 9 second-defensible answers in 1,510.
- **Require a structured row per question with a ≤40-word deciding quote** from
  the source. The quote is what makes a "looks right" verdict checkable.
- **For multi-statement items, rule TRUE/FALSE on each statement before deriving
  the answer.** Never evaluate the option block directly.
- **Add a mechanical pre-check**: the explanation names which statements are
  false, so the key can be re-derived from it and compared. Two traps — collect
  *every* "statement N is false" in the explanation, not just the first, and
  teach it that "none of them is false" / "all are correct" maps to the
  all-of-the-above index.
- **Sampling is defensible once independent verification confirms rather than
  corrects.** Across two passes, blind verification found zero wrong answers in
  228 questions, so a ~19% sample plus 100% mechanical checks was the right cost
  trade. Say the sample size when you report.
- **Verify invented falsehoods.** Making a distractor wrong on substance means
  inventing a wrong section, body, deadline or figure — and an invented wrong
  fact that happens to be *true* silently breaks the question. Sample them
  against the source.
- **Re-verify after a bulk rewrite.** An audit that read the *old* text has not
  audited the bank you now have.

---

## Phase 5 — Guard it with tests

Ship the measurements as tests so a regression fails the build. This bank's
suite, generalised:

| Guard | What it stops |
|---|---|
| Per-section counts, option count, all languages present, citation present | questions going missing or half-written |
| Citation contains a locator | citing a document with no paragraph to turn to |
| Key-is-longest ≤45% per section per language | "always pick the longest" |
| No length rank above 40% (chance 25%), per language | the same tell relocated to rank 2 |
| Within-question spread ≤40% of mean, with an absolute floor | one option carrying visibly more content |
| **No option >15% clear of its nearest rival**, either end | the comparison a reader actually makes |
| Punctuation uniform within a question | a semicolon marking the fuller answer |
| Absolute qualifiers true at ≥60% bank-wide, ≥45% per section | "mark the absolutes false" |
| No positional references in stems, options or explanations | "option 2", when options shuffle |
| No duplicate stems, and no answer shared across sections | one question asked twice |
| Terminology matches the official edition of each language | wording the source never uses |
| Fixed option blocks verbatim; no answer letter above 40% | drift in the printed format |

### The meta-rule, learned three times

**When you add or review a guard, ask first whether it covers every language.**
Three separate guards in this project were silently monolingual — the
key-is-longest check ran on English only through *three* review passes, which is
exactly how one section reached 54% key-is-longest with a green build. Half the
bank was unguarded and looked fine.

### Two guard-writing traps

- **Case-fold the keyword only, not the whole pattern.** `(?i)` across
  `(option|answer|choice)\s+[A-E]` makes "answer a question" and "the choice a
  licensee makes" fail the build. Write `(?i:option|answer|choice)\s+[A-E]`.
- **An absolute floor in a similarity or duplicate check is where duplicates
  hide.** Ignoring answers under 12 characters hid a genuine cross-section
  duplicate whose shared answer was 11 characters long. If the check already
  keys on the cited passage, the floor buys nothing — remove it and verify at
  several floors that nothing else appears.

---

## The catalogue of tells

Ordered by how much they leak. Each was measured, not guessed.

### 1. Length, in four rules — and only the last one matters to a reader

The rules were learnt in this order, and each was necessary but insufficient:

1. **Key-is-longest.** The original fault: the key was the longest option in
   1,241 of 1,510 questions, by a median of 55 characters. "Always pick the
   longest" passed 64% of simulated papers.
2. **Rank flatness.** Fixing (1) by trimming keys pushed the answer to *second*
   longest across half the bank. "Pick the second longest" is exactly as
   learnable. Cap every rank, do not cap one.
3. **Within-question spread.** Rank compares order and never size: options of
   40/41/42/130 characters rank identically to 40/41/42/43. Bound
   longest − shortest against the mean.
4. **Standout — the one that matters.** Nobody compares an option against the
   mean of four. They compare it against *the one nearest it in length*. A set
   can satisfy every rule above and still have one option standing clear at one
   end. **No option may stand more than 15% clear of its nearest rival, at
   either end**, with an absolute floor (~8 characters Latin, ~3 CJK) so that
   9/10/11-character sets are exempt.

The direction of the tell is not universal and you must measure it. In this
bank's English an option >25% longer than its nearest rival was the key **1 time
in 55**, and >40% longer **0 in 31** — a *reverse* tell — while one >25%
*shorter* was the key **47.4%** of the time. In Chinese the sign was the other
way: standing out long meant the key **37.0%** of the time. Do not assume
"longest is the answer"; find out.

**The rank-shift trap, hit and then undone.** Padding *one* distractor past the
key moves the key from rank 1 to rank 2 — the same tell, relocated. Rank 1 fell
35.7%→30.2% while rank 2 rose 31%→36.7%. Fixing it properly means padding **two**
shorter distractors, and each padding must clear the key by **+2 characters or
more**: a +1 estimate lands on a tie, and ties usually sort to the better rank,
so nothing moves.

**Trimming a bloated distractor is almost always better than padding three
others.** Where padding is unavoidable, use words already in the register of the
source — legal drafting has plenty of `that is`, `of its own`, `in question`,
`which are` — so a levelled option still reads like the source rather than like
filler.

**Where the residue lives.** Once every margin is inside the band, restrict any
remaining rank skew to questions where the key is ≥3 characters from its nearest
neighbour. What is left usually sits on option sets differing by one character —
dates, statute names — where rank is an artifact no reader can perceive. Say so
instead of chasing it.

### 2. Absolute qualifiers in multi-statement items

The tell that survives every length rule. A statement carrying `only, solely,
exclusively, alone, always, never, at all, whatsoever, need not, not required,
no requirement` (and the equivalents in the other language) was TRUE **32%** of
the time against a **76% base rate**. So: mark the absolutes false, pick the
combination that excludes them — **66–71%** on the half of items where the rule
discriminated, against 20% for chance.

**Why distractors drift that way:** overstating a true rule is the easiest way to
make it false. **The fix is to make the distractor wrong on substance** — a
wrong section, body, threshold or date — not wrong by overstatement. That also
tests knowledge rather than register. Three sub-cases:

- the absolute is incidental padding → delete it;
- the absolute *is* the error → restate the error as a wrong fact;
- neither is safe → add a genuinely accurate absolute to a **true** statement.
  Real source texts are full of real exclusivity, and this kills the correlation
  for a human reader too.

**The trap I nearly fell into:** rewriting "only if X, so Y is not enough" as
"where X, so Y falls short" evades the regex while keeping the same exclusivity
for a human. That is optimising for your own guard. **Check every rewrite
against a reader, not against the pattern.**

**Guard this statistically, not per question.** One absolute on one false
statement is noise; the learnable thing is the correlation. Assert a bank-wide
floor and a per-section floor, and skip sections with too few instances to read.

### 3. Hedging — the reverse tell, and usually the biggest one left

Legal and regulatory drafting hedges in the *true* statement, so words like
**"reasonable" and "appropriate" marked the key 71.1%** of the time in English
and 62.0% in Chinese. This is stronger than any length signal and it is the
hardest to remove, because the hedge belongs in the true statement. The repair
is to hedge the distractors too, in the same register.

Its mirror: an option that *alone* claims `only/solely/exclusively` was the key
**6.5%** of the time (chance 25%) — a strong negative tell — as was an option
containing a currency figure, at 6.2%.

### 4. Punctuation

A semicolon inside an option made it the key **45%** of the time in English and
46% in Chinese, against 25% by chance. It is the length problem in different
clothes: the key is usually the fuller answer, and a semicolon is what joins its
two clauses.

**Do not balance the correlation — remove the discrimination.** Within one
question either every option carries a semicolon or none does. A feature uniform
across the option set cannot tell a candidate anything, whatever the bank-wide
base rate. Most recasts become ", and" or ", while"; expect ~10% to need writing
by hand where the mechanical recast produces a comma splice or breaks a length
guard.

The same *all-or-none* logic applies to any surface feature you find correlating:
parentheses, bullet-like enumeration, quoted terms, trailing citations.

### 5. The rest of the surface

- **Positional references in explanations** ("option 2", "the third choice")
  when options shuffle at draw time — the explanation then describes a layout
  the candidate never saw. Name options by content.
- **"All of the above" inside a shuffled set** — it is only meaningful in a
  fixed block.
- **Grammatical agreement with the stem**, singular/plural or article, marking
  the option that was written first.
- **Answer-letter spread in fixed-block formats.** "The second one is usually
  the false one" is as learnable as any length tell. Cap any letter at ~40%.

### 6. Duplicates

- **Duplicate stems**, both within and across sections, on an exact normalised
  match as well as fuzzy.
- **A shared answer across two sections** is almost always one question asked
  twice. A shared answer *within* a section is often legitimate — several
  distinct offences may carry the same penalty.
- **Sweep every cross-section pair, comparing stem similarity and answer
  similarity separately**, in every language. That is what settles the question;
  the shingle tests will not find it.
- **Re-aim duplicates, do not delete them** if section counts are fixed. And
  re-aim **from the source**, not from invention: extract the paragraph and
  write from it. To find room, histogram the section's cited paragraphs and take
  one with exactly one question. Check the neighbouring angles are not already
  keyed elsewhere before assuming a gap exists.

---

## Bilingual rules

Half of a bilingual bank is invisible unless you look for it. These are the
faults that only exist because there are two languages.

- **Options must align index-for-index across languages.** A bilingual renderer
  pairs `a.options[i]` with `b.options[i]`; reordering one language silently
  mis-keys the paper. State this to every packet-runner — length-tuning is a
  constant temptation to reorder.
- **Whenever a per-language check drives a content edit, re-check the other
  language.** The absolutes detector runs per language, so where only one side
  was flagged only that side was rewritten — and in **29 questions** the two
  languages then asserted different things. One told an English candidate a
  document *is* acceptable and a Chinese candidate it never is. Keys were
  unaffected; it was no longer one exam in two languages.
- **Align to the side that was NOT rewritten.** It is the reference, its
  explanation was written for it, and most stale explanations then fix
  themselves. Where the reference side still carries the offending qualifier,
  keep its claim and drop the qualifier rather than substitute a new claim.
- **Use the terminology of the official edition in each language**, not a
  translation of the source language. Maintain a banned-term list with the
  statutory replacement, and cover the citation field too — five citations
  carried non-statutory terms precisely because the check skipped that field.
- **Check how a term is actually used before banning it.** One term I "fixed"
  was correct: the source defines a long form once and uses the short form
  throughout. Grep the extracted text first.
- **Do not collapse compound terms.** A guard that both limbs of a paired term
  survive translation is worth having; 42 questions had dropped one half.
- **Word-shingle similarity does not work on CJK.** Splitting on whitespace
  collapses a Chinese stem to a single token and Jaccard degenerates to exact
  match — which is why two duplicate pairs needed hand-written scans to find.
  Use **character n-grams (~4) for CJK** and word shingles for space-delimited
  languages.
- **Count runes, not bytes**, in every length rule.
- **Model estimates of CJK character counts run 1–3 short, consistently.**
  Overshoot every target by 3–4 characters and run the mechanical check before
  applying; a target hit exactly is a coin flip. Watch float equality while you
  are there — `207 > 180*1.15` is *true* in Python, because `180*1.15` is
  `206.99999999999997`.

---

## Repairing without breaking

- **Rewriting a statement silently invalidates its explanation.** The
  explanation says *why* a statement is false; change the statement and it now
  argues with a version the candidate never saw. This is the worst defect the
  material can carry, because a candidate who gets it wrong reads the
  explanation precisely to find out why, and is answered about something else.
  Re-aim every explanation you disturb, and name the words in the source that
  make the statement false.
- **When repairing a "second correct answer", re-read the whole list the stem
  draws on.** Two misses in one pass came from swapping one true distractor
  without checking the others in the same enumeration.
- **Changing option count breaks stored attempts.** If attempts persist a
  shuffled option order, converting a 4-option question to 5 makes a stored
  4-entry order wrong — it drops the fifth option and can hide the key. Discard
  any stored order whose length no longer matches.
- **Reach for the draw logic before the content.** Adding a switch that filters
  the pool to one format cost a single editing pass and is what made the format
  usable; converting questions costs an agent each. Ask what the smallest code
  change is that delivers the outcome.
- **When a per-question rule drives hundreds of rewrites, build the tool first.**
  Three commands are enough: `list` (print only failing items with per-option
  measurements and the explanation), `check` (show resulting measurements and
  pass/fail *before* applying), `apply` (validate each item independently and
  apply only what passes). Accept a sparse patch form for single-option edits.
  Forty batches cleared 637 questions this way.

---

## Reporting honestly

- **Measure before you speculate.** Every tell in this document was found by
  asking "what else is guessable?" and then computing it, after the previous
  pass had shipped.
- **Broaden the detector before quoting a count.** A first regex missed several
  forms and undercounted by 7; the size of one job was 637 questions, not the
  ~415 first quoted, because the early estimate covered only one language and one
  format. Re-derive the count from the actual rule.
- **Triage detector output by hand before quoting a number.** Two crude
  staleness detectors each over-flagged badly — hand-checking 20 of 43 flags
  found only 2 real. The true total was 15.
- **State the ceiling in the same breath as the scary percentage.** A tell that
  gives free elimination on one question in eight is not a pass-by-guessing
  hole. Simulate whole papers against the real pass rule: 4,000 simulated papers
  driven by the strongest lexical guesser averaged 11.7/35 against a 25/35 pass
  mark plus a per-section floor — a **0.00%** pass rate. Say that alongside the
  71%.
- **Report checked-and-legitimate findings explicitly** rather than staying
  silent about them. "These 3 shared answers are legitimate, and here is why"
  is a result; omitting them looks like you did not look.
- **Say which build first carries a repair.** A user holding an earlier download
  still has the wrong keys.
- **Answer "is it finished?" by looking.** Reviewing your own rewrite is a real
  pass and it found two regressions this project had introduced. Saying so was
  the right answer to the question.
