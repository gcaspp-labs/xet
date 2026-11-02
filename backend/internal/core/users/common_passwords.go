package users

import (
	_ "embed"
	"strings"
	"unicode"
)

//go:embed common_passwords.txt
var commonPasswordsFile string

var commonPasswords = func() map[string]bool {
	set := make(map[string]bool)
	for line := range strings.Lines(commonPasswordsFile) {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") {
			set[line] = true
		}
	}
	return set
}()

// unleet undoes the usual swaps of letters for symbols, as in P@ssw0rd.
var unleet = strings.NewReplacer("@", "a", "4", "a", "0", "o", "1", "i", "!", "i", "3", "e", "$", "s", "5", "s", "7", "t")

// isCommonPassword reports whether the password is on the list, ignoring case,
// digits and symbols at the ends and letters swapped for symbols. The ends are
// trimmed in three ways because a digit or symbol there may be part of the word
// (q1w2e3r4!, S3nh@123) or not (Senha@123).
func isCommonPassword(password string) bool {
	lower := strings.ToLower(password)
	for _, keep := range []func(rune) bool{
		unicode.IsLetter,
		func(r rune) bool { return unicode.IsLetter(r) || r == '@' || r == '$' },
		func(r rune) bool { return unicode.IsLetter(r) || unicode.IsDigit(r) },
	} {
		word := strings.TrimFunc(lower, func(r rune) bool { return !keep(r) })
		if commonPasswords[word] || commonPasswords[unleet.Replace(word)] {
			return true
		}
	}
	return false
}
