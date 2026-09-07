# Licensing, part by part

This repository holds four kinds of material with three different owners. This
file says which is which.

## 1 · The source code — MIT

Everything except the four items below: `main.go`, `questions_test.go`,
`web/app.js`, `web/style.css`, `web/index.html`, the build scripts and the
workflows. Full text in [`LICENSE`](LICENSE).

Do anything you like with it, including selling it. Keep the copyright notice.

## 2 · The question bank — CC BY 4.0

`web/questions.json` — 1,594 questions, statements and explanations in English
and Traditional Chinese.

Licensed under the **Creative Commons Attribution 4.0 International Licence**
(CC BY 4.0). The canonical legal text governs and is at:

<https://creativecommons.org/licenses/by/4.0/legalcode>

A plain-language summary is at <https://creativecommons.org/licenses/by/4.0/>.

In short: copy it, adapt it, translate it, build a product on it, sell it. The
one condition is credit — name the author, link to this repository, link to the
licence, and say whether you changed anything. A reasonable form is:

> Question bank from *MSO Competence Assessment — Mock Exam* by Leo,
> https://github.com/leohwlee/mso-ca-go, licensed under CC BY 4.0.
> Modified.

The questions are written from the official documents listed in
[`docs/README.md`](docs/README.md), and each cites the paragraph it comes from.
The wording, the selection, the distractors and the explanations are the
author's own work. The provisions they describe are not — see part 4.

## 3 · The bundled fonts — SIL Open Font License 1.1

`web/fonts/` — DM Sans and DM Mono, Latin subsets, WOFF2.

Copyright 2014 The DM Sans Project Authors and copyright 2020 The DM Mono
Project Authors, licensed under the SIL Open Font License, Version 1.1. Full
text in [`web/fonts/OFL.txt`](web/fonts/OFL.txt).

The fonts are embedded as data URIs in the single-file build, so that build
carries this notice and the full licence text in an HTML comment at the top of
the file. If you redistribute `mso-ca.html`, that comment must stay.

## 4 · The official documents — not licensed here

`docs/EN/` and `docs/TC/` — 29 publications of the Government of the Hong Kong
Special Administrative Region, and the Anti-Money Laundering and Counter-
Terrorist Financing Ordinance as published on Hong Kong e-Legislation.

**These are not the author's work and are not covered by any licence in this
repository.** They are reproduced for study reference only, as
[`docs/README.md`](docs/README.md) has always said. Nothing in the MIT or
CC BY licences above grants you any right in them.

If you redistribute this repository, or reuse the question bank commercially,
satisfy yourself about the terms on which those documents may be copied. Every
one of them is available from the official sources listed in
[`docs/README.md`](docs/README.md), and linking there rather than redistributing
the files avoids the question entirely.

## No warranty

None of this is legal advice, and the question bank is not an official product
of the Customs and Excise Department. It is one person's reading of published
guidance, written to study from. Verify anything that matters against the
source documents, which is why every question cites one.
