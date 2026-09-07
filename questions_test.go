package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"testing"
	"unicode"
)

type qLang struct {
	Q          string   `json:"q"`
	Statements []string `json:"statements,omitempty"`
	Options    []string `json:"options"`
	Explain    string   `json:"explain"`
}

type question struct {
	ID     string `json:"id"`
	Module int    `json:"module"`
	Format string `json:"format,omitempty"`
	Answer int    `json:"answer"`
	Source struct {
		En string `json:"en"`
		Tc string `json:"tc"`
	} `json:"source"`
	En qLang `json:"en"`
	Tc qLang `json:"tc"`
}

func (q question) combo() bool { return q.Format == "combination" }

// The two option blocks C&ED prints. A combination item never varies them: the
// options are the same five strings in the same order on every paper, and the
// answer is whichever subset is true. Sample set MSSB/CA_01/2021 uses the
// four-statement block; Guidance Notes ¶7.1 uses the five-statement one.
var comboOptions = map[int]map[string][]string{
	4: {
		"en": {"1, 2 and 3", "1, 2 and 4", "2, 3 and 4", "1, 3 and 4", "All of the above"},
		"tc": {"1、2 及 3", "1、2 及 4", "2、3 及 4", "1、3 及 4", "以上皆是"},
	},
	5: {
		"en": {"1, 2 and 3", "2, 3 and 4", "1, 3 and 4", "1, 2 and 5", "3, 4 and 5"},
		"tc": {"1、2 及 3", "2、3 及 4", "1、3 及 4", "1、2 及 5", "3、4 及 5"},
	},
}

// Target bank size per module. The modules are deliberately unequal: each is
// sized to the volume of official source material behind it, so that every
// question traces to a real provision rather than rewording its neighbour.
// See README for the measured source volumes.
var minPerModule = map[int]int{1: 126, 2: 308, 3: 260, 4: 310, 5: 96, 6: 340, 7: 154}

// Every sample question C&ED publishes is a combination item, so each module
// must carry a working number of them rather than leaving the format to one
// token example. See TestCombinationFormat.
const minCombinationPerModule = 15

func wantTotal() int {
	n := 0
	for _, v := range minPerModule {
		n += v
	}
	return n
}

func loadBank(t *testing.T) []question {
	t.Helper()
	data, err := webFS.ReadFile("web/questions.json")
	if err != nil {
		t.Fatalf("read questions.json: %v", err)
	}
	var bank []question
	if err := json.Unmarshal(data, &bank); err != nil {
		t.Fatalf("parse questions.json: %v", err)
	}
	return bank
}

func TestBankIntegrity(t *testing.T) {
	bank := loadBank(t)

	if want := wantTotal(); len(bank) < want {
		t.Errorf("bank has %d questions, want at least %d", len(bank), want)
	}

	seen := map[string]bool{}
	perMod := map[int]int{}
	for _, q := range bank {
		if seen[q.ID] {
			t.Errorf("%s: duplicate id", q.ID)
		}
		seen[q.ID] = true

		if q.Module < 1 || q.Module > 7 {
			t.Errorf("%s: module %d out of range", q.ID, q.Module)
		}
		perMod[q.Module]++

		// A standard question is authored with the correct option first; the app
		// shuffles option order at draw time, so a non-zero index means an
		// authoring slip. A combination question's options are fixed and never
		// shuffled, so its key can sit at any of the five positions.
		if q.combo() {
			if q.Answer < 0 || q.Answer >= 5 {
				t.Errorf("%s: answer index %d out of range for a combination question", q.ID, q.Answer)
			}
		} else if q.Format != "" {
			t.Errorf("%s: unknown format %q", q.ID, q.Format)
		} else if q.Answer != 0 {
			t.Errorf("%s: answer index %d, want 0 (correct option written first)", q.ID, q.Answer)
		}
		if want := fmt.Sprintf("m%d-", q.Module); !strings.HasPrefix(q.ID, want) {
			t.Errorf("%s: id does not match module %d (want prefix %q)", q.ID, q.Module, want)
		}
		if q.Source.En == "" || q.Source.Tc == "" {
			t.Errorf("%s: missing source citation", q.ID)
		}
		for name, l := range map[string]qLang{"en": q.En, "tc": q.Tc} {
			if strings.TrimSpace(l.Q) == "" || strings.TrimSpace(l.Explain) == "" {
				t.Errorf("%s (%s): empty stem or explanation", q.ID, name)
			}
			want := 4
			if q.combo() {
				want = 5
			}
			if len(l.Options) != want {
				t.Errorf("%s (%s): %d options, want %d", q.ID, name, len(l.Options), want)
				continue
			}
			for i, o := range l.Options {
				if strings.TrimSpace(o) == "" {
					t.Errorf("%s (%s): option %d empty", q.ID, name, i)
				}
				// A standard question's options are shuffled at draw time, so text
				// that points at another option is meaningless. A combination
				// question's options do nothing else — but they are the fixed
				// block, checked verbatim in TestCombinationFormat.
				if q.combo() {
					continue
				}
				lo := strings.ToLower(o)
				if strings.Contains(lo, "all of the above") || strings.Contains(lo, "none of the above") ||
					strings.Contains(o, "以上皆") || strings.Contains(o, "以上各項") {
					t.Errorf("%s (%s): option %d references other options: %q", q.ID, name, i, o)
				}
			}
			if !q.combo() && len(l.Statements) != 0 {
				t.Errorf("%s (%s): %d statements on a question that is not a combination item",
					q.ID, name, len(l.Statements))
			}
		}
	}
	for m := 1; m <= 7; m++ {
		if perMod[m] < minPerModule[m] {
			t.Errorf("module %d has %d questions, want at least %d", m, perMod[m], minPerModule[m])
		}
	}
}

// TestNoDuplicateStems guards the bank against the main risk of a large
// question bank: the same proposition asked twice in slightly different words.
// Stems are compared as 4-word shingles within a module, in both languages —
// see shingles, which until September 2026 cut Chinese into a single token and
// so compared Chinese stems for exact equality and nothing else.
func TestNoDuplicateStems(t *testing.T) {
	bank := loadBank(t)

	byMod := map[int][]question{}
	for _, q := range bank {
		byMod[q.Module] = append(byMod[q.Module], q)
	}
	for _, lang := range []string{"en", "tc"} {
		for m := 1; m <= 7; m++ {
			qs := byMod[m]
			sets := make([]map[string]bool, len(qs))
			for i, q := range qs {
				side := q.En
				if lang == "tc" {
					side = q.Tc
				}
				// Options[0] is the authored key for a standard question, but for a
				// combination item it is the constant "1, 2 and 3" — every one of
				// them would look alike. Compare what those items actually assert.
				body := side.Options[0]
				if q.combo() {
					body = strings.Join(side.Statements, " ")
				}
				sets[i] = shingles(side.Q + " " + body)
			}
			for i := range qs {
				for j := i + 1; j < len(qs); j++ {
					if s := jaccard(sets[i], sets[j]); s >= 0.75 {
						t.Errorf("%s module %d: %s and %s are near-duplicates (similarity %.2f)",
							lang, m, qs[i].ID, qs[j].ID, s)
					}
				}
			}
		}
	}

	// The pass above compares within a module, so it cannot see a question that a
	// second module asks in the same words — the very thing the user objected to.
	// A September 2026 review found m1-93 and m6-190 carrying byte-identical
	// Chinese stems on the same paragraph with the same answer, invisible to both
	// the per-module sweep and to any English-only check, because their English
	// wording had drifted apart while the Chinese had not. An exact match on the
	// normalised stem is cheap and catches that in either language.
	for _, lang := range []string{"en", "tc"} {
		byStem := map[string][]string{}
		for _, q := range bank {
			stem := q.En.Q
			if lang == "tc" {
				stem = q.Tc.Q
			}
			stem = strings.TrimSpace(nonWord.ReplaceAllString(strings.ToLower(stem), " "))
			byStem[stem] = append(byStem[stem], q.ID)
		}
		for stem, ids := range byStem {
			if len(ids) > 1 {
				t.Errorf("%s: %s ask the same question word for word: %q",
					lang, strings.Join(ids, ", "), stem)
			}
		}
	}
}

// TestOptionLengthBalance guards the bank's biggest weakness as an exam: a
// September 2026 audit found the keyed answer was the longest of the four
// options in 83% of questions, by a median of 55 characters, so a candidate who
// knew nothing could pass 64% of simulated papers by always picking the longest
// one. Option order is shuffled at draw time, but length is not, so length must
// not signal the key. The same cap applies to the Chinese options: a
// September 2026 check found the Chinese key was the longest option in 54% of
// module 3, so testing English alone left half a bank unguarded.
func TestOptionLengthBalance(t *testing.T) {
	bank := loadBank(t)

	for _, lang := range []string{"en", "tc"} {
		perMod, longestMod := map[int]int{}, map[int]int{}
		for _, q := range bank {
			if q.combo() {
				continue // its options are the fixed block, identical on every such question
			}
			opts := q.En.Options
			if lang == "tc" {
				opts = q.Tc.Options
			}
			perMod[q.Module]++
			best, at := 0, 0
			for i, o := range opts {
				if n := len([]rune(o)); n > best {
					best, at = n, i
				}
			}
			if at == q.Answer {
				longestMod[q.Module]++
			}
		}
		for m := 1; m <= 7; m++ {
			if perMod[m] == 0 {
				continue
			}
			if share := float64(longestMod[m]) / float64(perMod[m]); share > 0.45 {
				t.Errorf("%s module %d: keyed answer is the longest option in %.0f%% of questions, want at most 45%%",
					lang, m, share*100)
			}
		}
	}
}

// TestOptionLengthRank is the lesson from repairing the fault above: removing a
// giveaway can plant another one. Trimming the keys so that the longest option
// would be wrong pushed the answer into second place in about half the bank, and
// "pick the second longest" is exactly as learnable as "pick the longest". So it
// is not enough to cap one rank — the answer has to sit at each of the four
// length ranks about as often as chance would put it, in both languages.
func TestOptionLengthRank(t *testing.T) {
	bank := loadBank(t)

	for _, lang := range []string{"en", "tc"} {
		var atRank [4]int
		n := 0
		for _, q := range bank {
			if q.combo() {
				continue // fixed option block; length cannot signal anything
			}
			l := q.En
			if lang == "tc" {
				l = q.Tc
			}
			if len(l.Options) != 4 || q.Answer < 0 || q.Answer >= 4 {
				continue // TestBankIntegrity reports the shape problem
			}
			n++
			key := len([]rune(l.Options[q.Answer]))
			place := 0
			for i, o := range l.Options {
				if i != q.Answer && len([]rune(o)) > key {
					place++
				}
			}
			atRank[place]++
		}
		names := [4]string{"longest", "2nd longest", "3rd longest", "shortest"}
		for r, c := range atRank {
			if share := float64(c) / float64(n); share > 0.40 {
				t.Errorf("%s: the answer is the %s option in %.0f%% of questions, want at most 40%% (chance is 25%%)",
					lang, names[r], share*100)
			}
		}
	}
}

// TestCitationHasLocator: a citation must name a place a reader can turn to —
// a paragraph, section, item or schedule number — not just a document.
func TestCitationHasLocator(t *testing.T) {
	bank := loadBank(t)
	digit := regexp.MustCompile(`\d`)
	for _, q := range bank {
		if !digit.MatchString(q.Source.En) {
			t.Errorf("%s: citation %q names no paragraph or section", q.ID, q.Source.En)
		}
	}
}

// TestChineseStatutoryTerms: the Traditional Chinese paper must use the terms
// the official Chinese editions use, so a candidate meets the same wording in
// the exam room as in the Ordinance and the Guideline. The check covers the
// citation field as well: a review in September 2026 found five citations
// carrying non-statutory terms precisely because this test used to skip it.
func TestChineseStatutoryTerms(t *testing.T) {
	bank := loadBank(t)
	banned := map[string]string{
		"電匯":      "電傳轉帳 or 電傳轉賬 (wire transfer)",
		"過渡期客戶":   "先前客戶 (pre-existing customer)",
		"單次交易":    "非經常交易 (occasional transaction)",
		"證券交易所":   "認可證券市場 or 證券市場 (recognized stock market)",
		"指明條文":    "指明的條文 (specified provision)",
		"洗錢事務主任":  "洗錢報告主任 (MLRO)",
		"安施塔特":    "機構（anstalt）",
		"通風報信":    "通風報訊 (tipping off)",
		"洩密":      "通風報訊 (tipping off)",
		"匯出機構":    "匯款機構 (ordering institution)",
		"同等司法管轄區": "對等司法管轄區 (equivalent jurisdiction)",
	}
	for _, q := range bank {
		fields := append([]string{q.Tc.Q, q.Tc.Explain, q.Source.Tc}, q.Tc.Options...)
		for _, f := range fields {
			for bad, want := range banned {
				if strings.Contains(f, bad) {
					t.Errorf("%s: Chinese text uses %q, want %s", q.ID, bad, want)
				}
			}
		}
	}
}

// TestMLTFPairing: where the English says ML/TF the Chinese must carry both
// limbs. Dropping the terrorist-financing half changes what is being asked.
func TestMLTFPairing(t *testing.T) {
	bank := loadBank(t)
	for _, q := range bank {
		en := append([]string{q.En.Q, q.En.Explain}, q.En.Options...)
		tc := append([]string{q.Tc.Q, q.Tc.Explain}, q.Tc.Options...)
		for i := range en {
			if strings.Contains(en[i], "ML/TF") &&
				strings.Contains(tc[i], "洗錢") && !strings.Contains(tc[i], "恐怖分子") {
				t.Errorf("%s: English says ML/TF but the Chinese says 洗錢 alone: %q", q.ID, tc[i])
			}
		}
	}
}

// TestNoPositionalReferences: the app shuffles option order at draw time, so an
// explanation that says "option 2" or 選項三 names whatever landed second in that
// draw, not the thing the author meant. The September 2026 review found 37 of
// these, concentrated in the Schedule 4 items, where they had been written
// against the authored order. Refer to an option by its content instead.
//
// Combination questions are checked too: their fixed options are lists of
// statement numbers, which never match these patterns, and their explanations
// must talk about "statement 2" / 陳述2 rather than the option carrying it.
func TestNoPositionalReferences(t *testing.T) {
	bank := loadBank(t)
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(?:option|distractor)s?\s*\(?[1-5]\)?`),
		// the letter stays case-sensitive: lower-cased, "answer a question" and
		// "the choice a licensee makes" would both match and fail a sound question
		regexp.MustCompile(`(?i:option|answer|choice)\s+[A-E]`),
		regexp.MustCompile(`(?i)(?:first|second|third|fourth|fifth|last)\s+(?:option|choice|answer)`),
		regexp.MustCompile(`\(D[1-5]\)|D[1-5]`),
		regexp.MustCompile(`選項\s*[一二三四五1-5A-E]`),
		regexp.MustCompile(`第[一二三四五]個?選項`),
	}
	for _, q := range bank {
		fields := map[string]string{
			"en.q": q.En.Q, "en.explain": q.En.Explain,
			"tc.q": q.Tc.Q, "tc.explain": q.Tc.Explain,
		}
		for i, o := range q.En.Options {
			fields[fmt.Sprintf("en.options[%d]", i)] = o
		}
		for i, o := range q.Tc.Options {
			fields[fmt.Sprintf("tc.options[%d]", i)] = o
		}
		for name, text := range fields {
			for _, re := range patterns {
				if m := re.FindString(text); m != "" {
					t.Errorf("%s (%s): refers to an option by position (%q); name it by its content",
						q.ID, name, m)
					break
				}
			}
		}
	}
}

// TestCombinationFormat holds the bank to the shape C&ED actually prints. Every
// sample question the department has published — the seven in sample set
// MSSB/CA_01/2021 and the one in Guidance Notes ¶7.1 — is a combination item:
// numbered statements under the stem, then five fixed options naming subsets of
// them, lettered a) to e). The candidate's real task is to find the one
// statement that is false, so the option block must be reproduced exactly, and
// which statement is the false one has to move around.
func TestCombinationFormat(t *testing.T) {
	bank := loadBank(t)

	perMod := map[int]int{}
	byAnswer := map[int]map[int]int{4: {}, 5: {}}
	total := map[int]int{4: 0, 5: 0}

	for _, q := range bank {
		if !q.combo() {
			continue
		}
		perMod[q.Module]++

		n := len(q.En.Statements)
		if n != len(q.Tc.Statements) {
			t.Errorf("%s: %d English statements but %d Chinese", q.ID, n, len(q.Tc.Statements))
			continue
		}
		if _, ok := comboOptions[n]; !ok {
			t.Errorf("%s: %d statements; the published formats use 4 or 5", q.ID, n)
			continue
		}
		for _, l := range []struct {
			name string
			v    qLang
		}{{"en", q.En}, {"tc", q.Tc}} {
			for i, st := range l.v.Statements {
				if strings.TrimSpace(st) == "" {
					t.Errorf("%s (%s): statement %d empty", q.ID, l.name, i+1)
				}
			}
			want := comboOptions[n][l.name]
			for i := range want {
				if i < len(l.v.Options) && l.v.Options[i] != want[i] {
					t.Errorf("%s (%s): option %d is %q, want the printed block's %q",
						q.ID, l.name, i, l.v.Options[i], want[i])
				}
			}
		}
		if q.Answer >= 0 && q.Answer < 5 {
			byAnswer[n][q.Answer]++
			total[n]++
		}
	}

	for m := 1; m <= 7; m++ {
		if perMod[m] < minCombinationPerModule {
			t.Errorf("module %d has %d combination questions, want at least %d — every published "+
				"C&ED sample is this format", m, perMod[m], minCombinationPerModule)
		}
	}

	// Which option is right is decided by which statement is false, so a lopsided
	// answer distribution is the same giveaway as a lopsided key length: it teaches
	// "the false one is usually the second". Chance would be 20% at each letter.
	for n, counts := range byAnswer {
		if total[n] < 20 {
			continue // too few to say anything about the distribution
		}
		for letter := 0; letter < 5; letter++ {
			if share := float64(counts[letter]) / float64(total[n]); share > 0.40 {
				t.Errorf("%d-statement combination items: answer %c in %.0f%% of them, want at most 40%% (chance is 20%%)",
					n, 'a'+rune(letter), share*100)
			}
		}
	}
}

// TestNoDuplicateAnswers catches the duplicate TestNoDuplicateStems cannot see.
// That test compares wording, within one module. But the same fact asked in
// different words, in a different module, looks nothing alike and is invisible
// to it — three such pairs were found in September 2026 (m3-17/m6-268,
// m1-70/m6-198, m1-117/m6-184), each asking one thing twice.
//
// The sharp signal is the pair (cited passage, answer): two questions that cite
// the same provision and key on the same answer are asking one question. Sharing
// an answer across *different* provisions is not a duplicate and is common on
// purpose — several offences carry a fine at level 5, and a rule stated in both
// the Ordinance and the Guideline is worth asking from each side.
func TestNoDuplicateAnswers(t *testing.T) {
	bank := loadBank(t)

	// Checked in both languages: a pair can drift apart in English while the
	// Chinese still says the same thing, and half the bank is Chinese.
	for _, lang := range []string{"en", "tc"} {
		seen := map[string][]string{}
		for _, q := range bank {
			side, src := q.En, q.Source.En
			if lang == "tc" {
				side, src = q.Tc, q.Source.Tc
			}
			// what the question settles: the keyed option, or for a combination item
			// the statements, since its options are the same fixed block every time
			answer := ""
			if q.combo() {
				answer = strings.Join(side.Statements, " ")
			} else if q.Answer >= 0 && q.Answer < len(side.Options) {
				answer = side.Options[q.Answer]
			}
			answer = strings.TrimSpace(nonWord.ReplaceAllString(strings.ToLower(answer), " "))
			if answer == "" {
				continue
			}
			// No minimum length. The check keys on the cited passage as well as the
			// answer, and a short answer is where a duplicate hides best: m1-73 and
			// m6-219 both asked which Chapter of the UN Charter carries the mandatory
			// PF obligations, both cited ¶6.9, and both answered "Chapter VII" — 11
			// characters, one under the floor this test used to apply.
			src = strings.TrimSpace(nonWord.ReplaceAllString(strings.ToLower(src), " "))
			key := src + " || " + answer
			seen[key] = append(seen[key], q.ID)
		}
		for key, ids := range seen {
			if len(ids) > 1 {
				t.Errorf("%s: %s all cite the same passage and give the same answer, so they ask one "+
					"question: %q", lang, strings.Join(ids, ", "), key)
			}
		}
	}

	// A shared answer across two modules is a duplicate even when the citations
	// differ. Six such pairs existed in September 2026, each stating a rule from
	// the Ordinance in one module and from the Guideline in another — the same
	// question twice, and a candidate could meet both in one paper. Within a
	// module a shared answer is fine and often deliberate: several distinct
	// offences carry a fine at level 5.
	byAnswer := map[string][]question{}
	for _, q := range bank {
		answer := ""
		if q.combo() {
			answer = strings.Join(q.En.Statements, " ")
		} else if q.Answer >= 0 && q.Answer < len(q.En.Options) {
			answer = q.En.Options[q.Answer]
		}
		answer = strings.TrimSpace(nonWord.ReplaceAllString(strings.ToLower(answer), " "))
		if len(answer) < 12 {
			continue
		}
		byAnswer[answer] = append(byAnswer[answer], q)
	}
	for answer, qs := range byAnswer {
		for i := range qs {
			for j := i + 1; j < len(qs); j++ {
				if qs[i].Module != qs[j].Module {
					t.Errorf("%s (module %d) and %s (module %d) give the same answer, so one mock "+
						"paper can ask the same thing twice: %q",
						qs[i].ID, qs[i].Module, qs[j].ID, qs[j].Module, answer)
				}
			}
		}
	}
}

var nonWord = regexp.MustCompile(`[^\p{L}\p{N}]+`)

// shingles cuts a stem into overlapping 4-word runs for comparison. Written
// words are separated by spaces, so Fields finds them; Chinese is not, so a
// Chinese stem collapses into a single "word" and every comparison degenerates
// into an exact match. That silently disabled near-duplicate detection on half
// the bank until a September 2026 sweep found two cross-module pairs by hand.
// shinglesCJK is the Chinese equivalent, cutting 4-character runs instead.
func shingles(s string) map[string]bool {
	if cjkHeavy(s) {
		return shinglesCJK(s)
	}
	words := strings.Fields(nonWord.ReplaceAllString(strings.ToLower(s), " "))
	out := map[string]bool{}
	const k = 4
	if len(words) < k {
		out[strings.Join(words, " ")] = true
		return out
	}
	for i := 0; i+k <= len(words); i++ {
		out[strings.Join(words[i:i+k], " ")] = true
	}
	return out
}

func cjkHeavy(s string) bool {
	cjk, letters := 0, 0
	for _, r := range s {
		switch {
		case unicode.Is(unicode.Han, r):
			cjk++
			letters++
		case unicode.IsLetter(r):
			letters++
		}
	}
	return letters > 0 && cjk*100/letters >= 30
}

func shinglesCJK(s string) map[string]bool {
	runes := []rune(nonWord.ReplaceAllString(s, ""))
	out := map[string]bool{}
	const k = 4
	if len(runes) < k {
		out[string(runes)] = true
		return out
	}
	for i := 0; i+k <= len(runes); i++ {
		out[string(runes[i:i+k])] = true
	}
	return out
}

func jaccard(a, b map[string]bool) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	inter := 0
	for k := range a {
		if b[k] {
			inter++
		}
	}
	return float64(inter) / float64(len(a)+len(b)-inter)
}

// spread reports how unevenly a set of option or statement texts is sized: the
// gap between the longest and the shortest, as a share of the mean.
func spread(ss []string) (gap int, share float64) {
	if len(ss) == 0 {
		return 0, 0
	}
	lo, hi, sum := 1<<30, 0, 0
	for _, s := range ss {
		n := len([]rune(s))
		sum += n
		if n < lo {
			lo = n
		}
		if n > hi {
			hi = n
		}
	}
	return hi - lo, float64(hi-lo) / (float64(sum) / float64(len(ss)))
}

// TestOptionLengthSpread is the third lesson about length, and the one the two
// tests above cannot teach. They rank the options and ask how often the answer
// comes first, so they see order but never size: four options of 40, 41, 42 and
// 130 characters rank exactly like four of 40, 41, 42 and 43. A September 2026
// measurement found the bank passing both while leaking badly at the extremes —
// in English an option more than 25% longer than its nearest rival was the
// answer in 1 of 55 questions and one more than 40% longer in 0 of 31, while an
// option more than 25% shorter than its nearest rival was the answer 47% of the
// time. Trimming keys to defeat "pick the longest" had taught "avoid the long
// one, take the stubby one" instead.
//
// The fix is not to balance a tell but to remove the signal: inside one
// question every option should occupy about the same space, so length carries
// no information in either direction. The same applies to the statements of a
// combination item, where the false statement was the longest or the shortest
// of the four in 14% of high-spread questions against 50% by chance — the
// outliers were reliably true, which hands over an elimination for free.
//
// The floor exempts genuinely short answer sets: "$8,000" against "$120,000"
// varies by half and signals nothing a candidate can use.
func TestOptionLengthSpread(t *testing.T) {
	bank := loadBank(t)

	const tol = 0.40
	floor := map[string]int{"en": 20, "tc": 8}

	type offence struct {
		id, lang, what string
		gap            int
		share          float64
	}
	var bad []offence
	for _, q := range bank {
		for _, lang := range []string{"en", "tc"} {
			l := q.En
			if lang == "tc" {
				l = q.Tc
			}
			sets := map[string][]string{}
			if q.combo() {
				// The options are the fixed printed block; only the
				// statements can leak.
				sets["statements"] = l.Statements
			} else {
				sets["options"] = l.Options
			}
			for what, ss := range sets {
				gap, share := spread(ss)
				if gap > floor[lang] && share > tol {
					bad = append(bad, offence{q.ID, lang, what, gap, share})
				}
			}
		}
	}
	if len(bad) > 0 {
		t.Errorf("%d question/language pairs vary too much in length; want the longest and shortest within %.0f%% of the mean (or %d/%d runes apart)",
			len(bad), tol*100, floor["en"], floor["tc"])
		for i, o := range bad {
			if i == 15 {
				t.Logf("... and %d more", len(bad)-15)
				break
			}
			t.Logf("  %s [%s] %s: %d runes apart, %.0f%% of mean", o.id, o.lang, o.what, o.gap, o.share*100)
		}
	}
}

// TestNoLengthStandout is the fourth and sharpest lesson about length. The
// spread guard above bounds the whole set — longest against shortest — but a
// question can satisfy it and still contain one option that visibly stands
// apart from its nearest rival, and that is the only comparison a candidate
// actually makes. Measured in September 2026, the Chinese options carried a
// usable signal exactly there: an option standing 15-30% clear of its nearest
// rival was the answer 42-55% of the time, while one standing 15-30% below its
// nearest rival was the answer 10-16% of the time. In English the sign was
// reversed — a conspicuously long option was the answer in 12% of cases — which
// is the pattern that prompted this work.
//
// So no option may stand apart from the option next to it in length by more
// than 15%. The floor lets small absolute differences through: on four options
// of nine, ten and eleven runes the ratios are large and the difference is
// invisible.
func TestNoLengthStandout(t *testing.T) {
	bank := loadBank(t)

	const ratio = 0.15
	floor := map[string]int{"en": 8, "tc": 3}

	type offence struct{ id, lang, what, dir string }
	var bad []offence
	for _, q := range bank {
		for _, lang := range []string{"en", "tc"} {
			l := q.En
			if lang == "tc" {
				l = q.Tc
			}
			sets := map[string][]string{}
			if q.combo() {
				sets["statements"] = l.Statements
			} else {
				sets["options"] = l.Options
			}
			for what, ss := range sets {
				if len(ss) < 2 {
					continue
				}
				n := make([]int, len(ss))
				for i, s := range ss {
					n[i] = len([]rune(s))
				}
				sort.Ints(n)
				last := len(n) - 1
				if n[1]-n[0] > floor[lang] && float64(n[0]) < float64(n[1])*(1-ratio) {
					bad = append(bad, offence{q.ID, lang, what, "shortest stands apart"})
				}
				if n[last]-n[last-1] > floor[lang] && float64(n[last]) > float64(n[last-1])*(1+ratio) {
					bad = append(bad, offence{q.ID, lang, what, "longest stands apart"})
				}
			}
		}
	}
	if len(bad) > 0 {
		t.Errorf("%d cases where one option stands more than %.0f%% clear of its nearest rival",
			len(bad), ratio*100)
		for i, o := range bad {
			if i == 15 {
				t.Logf("... and %d more", len(bad)-15)
				break
			}
			t.Logf("  %s [%s] %s: %s", o.id, o.lang, o.what, o.dir)
		}
	}
}

// TestNoAbsoluteTell guards a giveaway that survived every length rule. In a
// combination item a candidate has to decide which statements are true, and a
// September 2026 audit found the wording did that work for them: a statement
// carrying an absolute qualifier — "only", "never", "in every case", 只限, 一律,
// 無須 — was true just 33% of the time in English and 27% in Chinese, against a
// 76% base rate for statements generally. Marking the absolutes false and reading
// off the remaining combination scored 68% on the two fifths of items where the
// rule discriminated, against 20% for chance. Distractors drift that way because
// it is easy to make a statement wrong by overstating it; the repair was to make
// them wrong on substance instead — a wrong section, body, threshold or date.
//
// The check is statistical rather than per-question: one absolute on one false
// statement is noise, and a bank-wide correlation is what a candidate can learn.
func TestNoAbsoluteTell(t *testing.T) {
	bank := loadBank(t)

	absolute := map[string]*regexp.Regexp{
		"en": regexp.MustCompile(`(?i)\b(only|solely|exclusively|alone|always|never|at all|whatsoever|need not|not required|no requirement|nothing more|no more than)\b|in (every|all) cases?`),
		"tc": regexp.MustCompile(`只|僅|一律|完全|絕不|永不|毫無|無須|毋須|不得`),
	}
	// Which statements a combination answer asserts to be true, by statement count.
	trueSets := map[int][][]int{
		4: {{0, 1, 2}, {0, 1, 3}, {1, 2, 3}, {0, 2, 3}, {0, 1, 2, 3}},
		5: {{0, 1, 2}, {1, 2, 3}, {0, 2, 3}, {0, 1, 4}, {2, 3, 4}},
	}

	for _, lang := range []string{"en", "tc"} {
		var total, trueOnes int
		perModTotal, perModTrue := map[int]int{}, map[int]int{}
		for _, q := range bank {
			if !q.combo() {
				continue
			}
			sts := q.En.Statements
			if lang == "tc" {
				sts = q.Tc.Statements
			}
			sets, ok := trueSets[len(sts)]
			if !ok || q.Answer < 0 || q.Answer >= len(sets) {
				t.Fatalf("%s: %d statements with answer %d", q.ID, len(sts), q.Answer)
			}
			isTrue := map[int]bool{}
			for _, i := range sets[q.Answer] {
				isTrue[i] = true
			}
			for i, s := range sts {
				if !absolute[lang].MatchString(s) {
					continue
				}
				total++
				perModTotal[q.Module]++
				if isTrue[i] {
					trueOnes++
					perModTrue[q.Module]++
				}
			}
		}
		if total == 0 {
			continue
		}
		if share := float64(trueOnes) / float64(total); share < 0.60 {
			t.Errorf("%s: a statement carrying an absolute qualifier is true in only %.0f%% of cases (%d of %d), want at least 60%% against a base rate near 76%%",
				lang, share*100, trueOnes, total)
		}
		for m := 1; m <= 7; m++ {
			if perModTotal[m] < 8 {
				continue // too few to read anything into
			}
			if share := float64(perModTrue[m]) / float64(perModTotal[m]); share < 0.45 {
				t.Errorf("%s module %d: a statement carrying an absolute qualifier is true in only %.0f%% of cases (%d of %d), want at least 45%%",
					lang, m, share*100, perModTrue[m], perModTotal[m])
			}
		}
	}
}

// TestNoSemicolonTell is the fifth lesson about surface form, and the first
// that is not about length. The length guards above equalise how much space an
// option takes; they say nothing about how it is punctuated. A September 2026
// audit found the gap: a semicolon inside a four-option option made that option
// the key 45% of the time in English and 46% in Chinese, against 25% by chance,
// and where exactly one option in a question carried one, picking it scored 83%
// and 81%. The cause is the same one that drove the length work — the key is
// usually the fuller answer, and a semicolon is what joins its two clauses.
//
// The repair is not to balance the correlation but to remove the discrimination:
// within one question either every option carries a semicolon or none does. A
// feature that is uniform across the option set cannot tell a candidate which
// option to pick, whatever the bank-wide base rate. Combination items are exempt
// because their five options are the fixed printed block.
func TestNoSemicolonTell(t *testing.T) {
	bank := loadBank(t)

	semi := func(s string) bool { return strings.ContainsAny(s, ";；") }

	var bad []string
	for _, q := range bank {
		if q.combo() {
			continue
		}
		for _, lang := range []string{"en", "tc"} {
			opts := q.En.Options
			if lang == "tc" {
				opts = q.Tc.Options
			}
			n := 0
			for _, o := range opts {
				if semi(o) {
					n++
				}
			}
			if n != 0 && n != len(opts) {
				bad = append(bad, fmt.Sprintf("%s [%s]: %d of %d options carry a semicolon",
					q.ID, lang, n, len(opts)))
			}
		}
	}
	if len(bad) > 0 {
		t.Errorf("%d question/language sets punctuate their options unevenly; want a semicolon in all of a question's options or none of them", len(bad))
		for i, s := range bad {
			if i == 15 {
				t.Logf("... and %d more", len(bad)-15)
				break
			}
			t.Logf("  %s", s)
		}
	}
}
