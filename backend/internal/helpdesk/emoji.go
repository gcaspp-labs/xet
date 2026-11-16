package helpdesk

import "unicode/utf8"

// maxEmojiBytes bounds a reaction: the longest emoji sequences (families,
// flags of subdivisions) stay well below it.
const maxEmojiBytes = 64

const (
	zeroWidthJoiner = 0x200D
	keycap          = 0x20E3
	cancelTag       = 0xE007F
)

// isSingleEmoji reports a reaction made of one emoji: a pictograph with its
// variation selector, skin tone, tags or keycap, several of them joined into
// one by zero-width joiners (👩‍💻), a flag (two regional indicators) or a
// keycap (1️⃣). Free text, two emojis and blank are refused.
func isSingleEmoji(s string) bool {
	if s == "" || len(s) > maxEmojiBytes || !utf8.ValidString(s) {
		return false
	}
	runes := []rune(s)
	if isRegionalIndicator(runes[0]) {
		return len(runes) == 2 && isRegionalIndicator(runes[1])
	}
	if isKeycapBase(runes[0]) {
		rest := runes[1:]
		if len(rest) > 0 && isVariationSelector(rest[0]) {
			rest = rest[1:]
		}
		return len(rest) == 1 && rest[0] == keycap
	}
	// One or more pictographs joined by zero-width joiners, each one followed
	// only by the marks that change how it is drawn.
	expectBase := true
	for _, r := range runes {
		switch {
		case expectBase:
			if !isPictograph(r) {
				return false
			}
			expectBase = false
		case r == zeroWidthJoiner:
			expectBase = true
		case isVariationSelector(r), isSkinTone(r), isTag(r):
		default:
			return false
		}
	}
	return !expectBase
}

func isRegionalIndicator(r rune) bool { return r >= 0x1F1E6 && r <= 0x1F1FF }
func isKeycapBase(r rune) bool        { return (r >= '0' && r <= '9') || r == '#' || r == '*' }
func isVariationSelector(r rune) bool { return r == 0xFE0E || r == 0xFE0F }
func isSkinTone(r rune) bool          { return r >= 0x1F3FB && r <= 0x1F3FF }
func isTag(r rune) bool               { return r >= 0xE0020 && r <= cancelTag }

// isPictograph covers the blocks where emojis live (Unicode
// Extended_Pictographic, rounded to whole blocks), without the regional
// indicators and skin tones, which are not emojis on their own.
func isPictograph(r rune) bool {
	switch {
	case isRegionalIndicator(r), isSkinTone(r):
		return false
	case r == 0x00A9, r == 0x00AE, r == 0x203C, r == 0x2049, r == 0x2122, r == 0x2139,
		r >= 0x2194 && r <= 0x2199, r == 0x21A9, r == 0x21AA,
		r >= 0x2300 && r <= 0x23FF,              // relógios, ampulheta, teclado, botões de mídia
		r == 0x24C2, r >= 0x25A0 && r <= 0x25FF, // formas geométricas
		r >= 0x2600 && r <= 0x27BF, // símbolos diversos e dingbats (❤ ✅ ☀)
		r == 0x2934, r == 0x2935, r >= 0x2B00 && r <= 0x2BFF,
		r == 0x3030, r == 0x303D, r == 0x3297, r == 0x3299,
		r >= 0x1F000 && r <= 0x1FAFF: // pictogramas, emoticons, transportes e suplementos
		return true
	}
	return false
}
