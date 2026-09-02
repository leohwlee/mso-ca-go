package main

import (
	"encoding/json"
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

const perModule = 20

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

	if len(bank) != 7*perModule {
		t.Errorf("bank has %d questions, want %d", len(bank), 7*perModule)
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

		if q.Answer < 0 || q.Answer > 3 {
			t.Errorf("%s: answer index %d out of range", q.ID, q.Answer)
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
		if perMod[m] != perModule {
			t.Errorf("module %d has %d questions, want %d", m, perMod[m], perModule)
		}
	}
}
