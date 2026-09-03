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
