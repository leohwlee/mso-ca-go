package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"testing"
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
// Stems are compared as 4-word shingles within a module.
func TestNoDuplicateStems(t *testing.T) {
	bank := loadBank(t)

	byMod := map[int][]question{}
	for _, q := range bank {
		byMod[q.Module] = append(byMod[q.Module], q)
	}
	for m := 1; m <= 7; m++ {
		qs := byMod[m]
		sets := make([]map[string]bool, len(qs))
		for i, q := range qs {
			// Options[0] is the authored key for a standard question, but for a
			// combination item it is the constant "1, 2 and 3" — every one of
			// them would look alike. Compare what those items actually assert.
			body := q.En.Options[0]
			if q.combo() {
				body = strings.Join(q.En.Statements, " ")
			}
			sets[i] = shingles(q.En.Q + " " + body)
		}
		for i := range qs {
			for j := i + 1; j < len(qs); j++ {
				if s := jaccard(sets[i], sets[j]); s >= 0.75 {
					t.Errorf("module %d: %s and %s are near-duplicates (similarity %.2f)",
						m, qs[i].ID, qs[j].ID, s)
				}
			}
		}
	}
}

// TestOptionLengthBalance guards the bank's biggest weakness as an exam: a
// September 2026 audit found the keyed answer was the longest of the four
// options in 83% of questions, by a median of 55 characters, so a candidate who
// knew nothing could pass 64% of simulated papers by always picking the longest
// one. Option order is shuffled at draw time, but length is not, so length must
// not signal the key.
func TestOptionLengthBalance(t *testing.T) {
	bank := loadBank(t)

	perMod, longestMod := map[int]int{}, map[int]int{}
	for _, q := range bank {
		if q.combo() {
			continue // its options are the fixed block, identical on every such question
		}
		perMod[q.Module]++
		best, at := 0, 0
		for i, o := range q.En.Options {
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
			t.Errorf("module %d: keyed answer is the longest option in %.0f%% of questions, want at most 45%%",
				m, share*100)
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
		regexp.MustCompile(`(?i)(?:option|answer|choice)\s+[A-E]`),
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

	seen := map[string][]string{}
	for _, q := range bank {
		// what the question settles: the keyed option, or for a combination item
		// the statements, since its options are the same fixed block every time
		answer := ""
		if q.combo() {
			answer = strings.Join(q.En.Statements, " ")
		} else if q.Answer >= 0 && q.Answer < len(q.En.Options) {
			answer = q.En.Options[q.Answer]
		}
		answer = strings.TrimSpace(nonWord.ReplaceAllString(strings.ToLower(answer), " "))
		if len(answer) < 12 {
			continue // too short to identify anything
		}
		src := strings.TrimSpace(nonWord.ReplaceAllString(strings.ToLower(q.Source.En), " "))
		key := src + " || " + answer
		seen[key] = append(seen[key], q.ID)
	}
	for key, ids := range seen {
		if len(ids) > 1 {
			t.Errorf("%s all cite the same passage and give the same answer, so they ask one "+
				"question: %q", strings.Join(ids, ", "), key)
		}
	}
}

var nonWord = regexp.MustCompile(`[^\p{L}\p{N}]+`)

func shingles(s string) map[string]bool {
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
