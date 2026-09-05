package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"testing"
)

type qLang struct {
	Q       string   `json:"q"`
	Options []string `json:"options"`
	Explain string   `json:"explain"`
}

type question struct {
	ID     string `json:"id"`
	Module int    `json:"module"`
	Answer int    `json:"answer"`
	Source struct {
		En string `json:"en"`
		Tc string `json:"tc"`
	} `json:"source"`
	En qLang `json:"en"`
	Tc qLang `json:"tc"`
}

// Target bank size per module. The modules are deliberately unequal: each is
// sized to the volume of official source material behind it, so that every
// question traces to a real provision rather than rewording its neighbour.
// See README for the measured source volumes.
var minPerModule = map[int]int{1: 120, 2: 300, 3: 260, 4: 300, 5: 90, 6: 300, 7: 140}

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

		// the bank is authored with the correct option first; the app shuffles
		// option order at draw time, so a non-zero index means an authoring slip
		if q.Answer != 0 {
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
			if len(l.Options) != 4 {
				t.Errorf("%s (%s): %d options, want 4", q.ID, name, len(l.Options))
				continue
			}
			for i, o := range l.Options {
				if strings.TrimSpace(o) == "" {
					t.Errorf("%s (%s): option %d empty", q.ID, name, i)
				}
				// options are shuffled at draw time, so position-referencing text is forbidden
				lo := strings.ToLower(o)
				if strings.Contains(lo, "all of the above") || strings.Contains(lo, "none of the above") ||
					strings.Contains(o, "以上皆") || strings.Contains(o, "以上各項") {
					t.Errorf("%s (%s): option %d references other options: %q", q.ID, name, i, o)
				}
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
			sets[i] = shingles(q.En.Q + " " + q.En.Options[0])
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
		for _, q := range bank {
			l := q.En
			if lang == "tc" {
				l = q.Tc
			}
			if len(l.Options) != 4 || q.Answer < 0 || q.Answer >= 4 {
				continue // TestBankIntegrity reports the shape problem
			}
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
		for r, n := range atRank {
			if share := float64(n) / float64(len(bank)); share > 0.40 {
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
// the exam room as in the Ordinance and the Guideline.
func TestChineseStatutoryTerms(t *testing.T) {
	bank := loadBank(t)
	banned := map[string]string{
		"電匯":     "電傳轉帳 or 電傳轉賬 (wire transfer)",
		"過渡期客戶":  "先前客戶 (pre-existing customer)",
		"單次交易":   "非經常交易 (occasional transaction)",
		"證券交易所":  "認可證券市場 or 證券市場 (recognized stock market)",
		"指明條文":   "指明的條文 (specified provision)",
		"洗錢事務主任": "洗錢報告主任 (MLRO)",
		"安施塔特":   "機構（anstalt）",
	}
	for _, q := range bank {
		fields := append([]string{q.Tc.Q, q.Tc.Explain}, q.Tc.Options...)
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
