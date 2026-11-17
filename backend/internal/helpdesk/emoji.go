package helpdesk

import (
	_ "embed"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"unicode/utf8"
)

// maxEmojiBytes bounds a reaction before the catalog lookup: the longest
// emoji of the catalog (a couple with a heart and two skin tones) stays well
// below it. emoji_catalog_test.go checks it against the catalog.
const maxEmojiBytes = 64

// emojiCatalogFile is the table of emojis a reaction can be, one per line as
// the hexadecimal code points of the whole sequence (the emoji, with its
// variation selector, joiners and tags, exactly as the picker sends it). Lines
// that start with # are the header: where the table comes from.
//
// The table is the catalog of the emoji picker of the panel: every emoji of
// the groups the picker shows in emojibase-data (version in the header), each
// with all its skin tones. It is generated, not edited: to update it after
// changing the package version or the groups of
// frontend/src/components/EmojiPicker.tsx, run, from backend/:
//
//	go test ./internal/helpdesk -run TestEmojiCatalogFollowsThePicker -update-emoji-catalog
//
// (needs npm ci in frontend/). The same test fails when the table and the
// picker diverge.
//
//go:embed emoji_catalog.txt
var emojiCatalogFile string

// emojiCatalog is the set of emojis of emojiCatalogFile.
var emojiCatalog = sync.OnceValue(func() map[string]struct{} {
	set := map[string]struct{}{}
	for _, line := range strings.Split(emojiCatalogFile, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		var emoji strings.Builder
		for _, hex := range strings.Fields(line) {
			code, err := strconv.ParseInt(hex, 16, 32)
			if err != nil {
				panic(fmt.Sprintf("emoji_catalog.txt: bad code point %q: %v", hex, err))
			}
			emoji.WriteRune(rune(code))
		}
		set[emoji.String()] = struct{}{}
	}
	return set
})

// isSingleEmoji reports a reaction that is exactly one emoji of the catalog of
// the emoji picker of the panel (emojibase-data, the groups it shows, with
// skin tones). The whole sequence has to be in the catalog: a combination of
// valid parts that the catalog does not have (👍‍👨), a symbol without the
// variation selector the catalog has (☺ for ☺️), a flag with no flag in the
// catalog (🇽🇽), free text, two emojis and blank are refused. Nothing is
// repaired: ☺ is refused, not turned into ☺️. The limit is the catalog of the
// version of the package; a newer emoji is accepted only when the table is
// regenerated with the picker.
func isSingleEmoji(s string) bool {
	if s == "" || len(s) > maxEmojiBytes || !utf8.ValidString(s) {
		return false
	}
	_, ok := emojiCatalog()[s]
	return ok
}
