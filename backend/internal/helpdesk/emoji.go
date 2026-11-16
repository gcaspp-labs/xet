package helpdesk

import (
	"sort"
	"unicode/utf8"
)

// maxEmojiBytes bounds a reaction: the longest emoji sequences (families,
// flags of subdivisions) stay well below it.
const maxEmojiBytes = 64

// maxZWJComponents is the most emojis joined into one: a family of four.
const maxZWJComponents = 4

const (
	zeroWidthJoiner = 0x200D
	keycap          = 0x20E3
	blackFlag       = 0x1F3F4
	cancelTag       = 0xE007F
)

// isSingleEmoji reports a reaction made of one emoji, as the emoji picker of
// the panel offers them: a pictograph with its variation selector or skin
// tone, up to four of them joined into one by zero-width joiners (👩‍💻), a
// flag (two regional indicators or a black flag with tags) or a keycap (1️⃣).
// Free text, symbols that are not emojis, two emojis and blank are refused.
// The check is per component, not per whole sequence: a combination made of
// valid parts that the catalog does not have (👍‍👨) is accepted. Checking
// whole sequences would need a table of about 1,400 of them.
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
	components := splitRunes(runes, zeroWidthJoiner)
	if len(components) > maxZWJComponents {
		return false
	}
	for i, c := range components {
		if len(c) == 0 {
			return false
		}
		// After a joiner comes only what WhatsApp draws joined to the emoji
		// before it (people, hair, gender, professions, ❤, 🔥...), so two
		// emojis glued by a joiner are refused.
		if i == 0 && !isEmojiBase(c[0]) || i > 0 && !zwjComponents[c[0]] {
			return false
		}
		if !validMarks(c[0], c[1:]) {
			return false
		}
	}
	return true
}

// validMarks reports the marks after a pictograph that only change how it is
// drawn: one variation selector and one skin tone at most, or the tags of a
// subdivision flag (🏴 followed by tags and the cancel tag).
func validMarks(base rune, marks []rune) bool {
	if base == blackFlag && len(marks) > 0 && isTag(marks[0]) {
		if len(marks) < 2 {
			return false
		}
		for _, r := range marks[:len(marks)-1] {
			if !isTag(r) || r == cancelTag {
				return false
			}
		}
		return marks[len(marks)-1] == cancelTag
	}
	variation, tone := false, false
	for _, r := range marks {
		switch {
		case isVariationSelector(r) && !variation:
			variation = true
		case isSkinTone(r) && !tone:
			tone = true
		default:
			return false
		}
	}
	return true
}

func splitRunes(runes []rune, sep rune) [][]rune {
	out := [][]rune{{}}
	for _, r := range runes {
		if r == sep {
			out = append(out, []rune{})
			continue
		}
		out[len(out)-1] = append(out[len(out)-1], r)
	}
	return out
}

func isRegionalIndicator(r rune) bool { return r >= 0x1F1E6 && r <= 0x1F1FF }
func isKeycapBase(r rune) bool        { return (r >= '0' && r <= '9') || r == '#' || r == '*' }
func isVariationSelector(r rune) bool { return r == 0xFE0E || r == 0xFE0F }
func isSkinTone(r rune) bool          { return r >= 0x1F3FB && r <= 0x1F3FF }
func isTag(r rune) bool               { return r >= 0xE0020 && r <= cancelTag }

// isEmojiBase reports a code point that starts an emoji of the picker.
func isEmojiBase(r rune) bool {
	i := sort.Search(len(emojiBases), func(i int) bool { return emojiBases[i][1] >= r })
	return i < len(emojiBases) && emojiBases[i][0] <= r
}

// emojiBases are the code points that start an emoji of the picker of the
// panel (frontend, emojibase-data 18.0.0, the groups it shows, with skin
// tones), without regional indicators and keycap bases, in ranges sorted by
// their first code point. Update it with the picker; react_test.go checks
// samples of each kind.
var emojiBases = [][2]rune{
	{0xA9, 0xA9}, {0xAE, 0xAE}, {0x203C, 0x203C}, {0x2049, 0x2049},
	{0x2122, 0x2122}, {0x2139, 0x2139}, {0x2194, 0x2199}, {0x21A9, 0x21AA},
	{0x231A, 0x231B}, {0x2328, 0x2328}, {0x23CF, 0x23CF}, {0x23E9, 0x23F3},
	{0x23F8, 0x23FA}, {0x24C2, 0x24C2}, {0x25AA, 0x25AB}, {0x25B6, 0x25B6},
	{0x25C0, 0x25C0}, {0x25FB, 0x25FE}, {0x2600, 0x2604}, {0x260E, 0x260E},
	{0x2611, 0x2611}, {0x2614, 0x2615}, {0x2618, 0x2618}, {0x261D, 0x261D},
	{0x2620, 0x2620}, {0x2622, 0x2623}, {0x2626, 0x2626}, {0x262A, 0x262A},
	{0x262E, 0x262F}, {0x2638, 0x263A}, {0x2640, 0x2640}, {0x2642, 0x2642},
	{0x2648, 0x2653}, {0x265F, 0x2660}, {0x2663, 0x2663}, {0x2665, 0x2666},
	{0x2668, 0x2668}, {0x267B, 0x267B}, {0x267E, 0x267F}, {0x2692, 0x2697},
	{0x2699, 0x2699}, {0x269B, 0x269C}, {0x26A0, 0x26A1}, {0x26A7, 0x26A7},
	{0x26AA, 0x26AB}, {0x26B0, 0x26B1}, {0x26BD, 0x26BE}, {0x26C4, 0x26C5},
	{0x26C8, 0x26C8}, {0x26CE, 0x26CF}, {0x26D1, 0x26D1}, {0x26D3, 0x26D4},
	{0x26E9, 0x26EA}, {0x26F0, 0x26F5}, {0x26F7, 0x26FA}, {0x26FD, 0x26FD},
	{0x2702, 0x2702}, {0x2705, 0x2705}, {0x2708, 0x270D}, {0x270F, 0x270F},
	{0x2712, 0x2712}, {0x2714, 0x2714}, {0x2716, 0x2716}, {0x271D, 0x271D},
	{0x2721, 0x2721}, {0x2728, 0x2728}, {0x2733, 0x2734}, {0x2744, 0x2744},
	{0x2747, 0x2747}, {0x274C, 0x274C}, {0x274E, 0x274E}, {0x2753, 0x2755},
	{0x2757, 0x2757}, {0x2763, 0x2764}, {0x2795, 0x2797}, {0x27A1, 0x27A1},
	{0x27B0, 0x27B0}, {0x27BF, 0x27BF}, {0x2934, 0x2935}, {0x2B05, 0x2B07},
	{0x2B1B, 0x2B1C}, {0x2B50, 0x2B50}, {0x2B55, 0x2B55}, {0x3030, 0x3030},
	{0x303D, 0x303D}, {0x3297, 0x3297}, {0x3299, 0x3299}, {0x1F004, 0x1F004},
	{0x1F0CF, 0x1F0CF}, {0x1F170, 0x1F171}, {0x1F17E, 0x1F17F}, {0x1F18E, 0x1F18E},
	{0x1F191, 0x1F19A}, {0x1F201, 0x1F202}, {0x1F21A, 0x1F21A}, {0x1F22F, 0x1F22F},
	{0x1F232, 0x1F23A}, {0x1F250, 0x1F251}, {0x1F300, 0x1F321}, {0x1F324, 0x1F393},
	{0x1F396, 0x1F397}, {0x1F399, 0x1F39B}, {0x1F39E, 0x1F3F0}, {0x1F3F3, 0x1F3F5},
	{0x1F3F7, 0x1F3FA}, {0x1F400, 0x1F4FD}, {0x1F4FF, 0x1F53D}, {0x1F549, 0x1F54E},
	{0x1F550, 0x1F567}, {0x1F56F, 0x1F570}, {0x1F573, 0x1F57A}, {0x1F587, 0x1F587},
	{0x1F58A, 0x1F58D}, {0x1F590, 0x1F590}, {0x1F595, 0x1F596}, {0x1F5A4, 0x1F5A5},
	{0x1F5A8, 0x1F5A8}, {0x1F5B1, 0x1F5B2}, {0x1F5BC, 0x1F5BC}, {0x1F5C2, 0x1F5C4},
	{0x1F5D1, 0x1F5D3}, {0x1F5DC, 0x1F5DE}, {0x1F5E1, 0x1F5E1}, {0x1F5E3, 0x1F5E3},
	{0x1F5E8, 0x1F5E8}, {0x1F5EF, 0x1F5EF}, {0x1F5F3, 0x1F5F3}, {0x1F5FA, 0x1F64F},
	{0x1F680, 0x1F6C5}, {0x1F6CB, 0x1F6D2}, {0x1F6D5, 0x1F6D9}, {0x1F6DC, 0x1F6E5},
	{0x1F6E9, 0x1F6E9}, {0x1F6EB, 0x1F6EC}, {0x1F6F0, 0x1F6F0}, {0x1F6F3, 0x1F6FC},
	{0x1F7E0, 0x1F7EB}, {0x1F7F0, 0x1F7F0}, {0x1F90C, 0x1F93A}, {0x1F93C, 0x1F945},
	{0x1F947, 0x1F9AF}, {0x1F9B4, 0x1F9FF}, {0x1FA70, 0x1FA7C}, {0x1FA80, 0x1FAC6},
	{0x1FAC8, 0x1FAC8}, {0x1FACC, 0x1FADD}, {0x1FADF, 0x1FAEB}, {0x1FAEF, 0x1FAFA},
}

// zwjComponents are the code points that come after a zero-width joiner in
// the emojis of the picker (emojibase-data 18.0.0).
var zwjComponents = map[rune]bool{
	0x2194: true, 0x2195: true, 0x2620: true, 0x2640: true, 0x2642: true, 0x2695: true,
	0x2696: true, 0x26A7: true, 0x2708: true, 0x2744: true, 0x2764: true, 0x27A1: true,
	0x2B1B: true, 0x1F308: true, 0x1F32B: true, 0x1F33E: true, 0x1F373: true, 0x1F37C: true,
	0x1F384: true, 0x1F393: true, 0x1F3A4: true, 0x1F3A8: true, 0x1F3EB: true, 0x1F3ED: true,
	0x1F430: true, 0x1F466: true, 0x1F467: true, 0x1F468: true, 0x1F469: true, 0x1F48B: true,
	0x1F4A5: true, 0x1F4A8: true, 0x1F4AB: true, 0x1F4BB: true, 0x1F4BC: true, 0x1F525: true,
	0x1F527: true, 0x1F52C: true, 0x1F5E8: true, 0x1F680: true, 0x1F692: true, 0x1F7E9: true,
	0x1F7EB: true, 0x1F91D: true, 0x1F9AF: true, 0x1F9B0: true, 0x1F9B1: true, 0x1F9B2: true,
	0x1F9B3: true, 0x1F9BA: true, 0x1F9BC: true, 0x1F9BD: true, 0x1F9D1: true, 0x1F9D2: true,
	0x1FA70: true, 0x1FA79: true, 0x1FAEF: true, 0x1FAF2: true,
}
