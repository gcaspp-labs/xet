package helpdesk

import "testing"

func TestFormatNickname(t *testing.T) {
	for _, tc := range []struct{ body, want string }{
		{"Olá", "*Tayná:*\nOlá"},
		{"Primeira linha\nSegunda linha", "*Tayná:*\nPrimeira linha\nSegunda linha"},
		{"", "*Tayná:*"},
		{"  \n ", "*Tayná:*"},
	} {
		if got := formatNickname("Tayná", tc.body); got != tc.want {
			t.Errorf("formatNickname(%q) = %q, want %q", tc.body, got, tc.want)
		}
	}
}
