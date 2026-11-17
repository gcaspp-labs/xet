package helpdesk_test

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"
	"unicode/utf8"
)

// The table of emojis a reaction can be (emoji_catalog.txt) is generated from
// the catalog of the emoji picker of the panel. Rewrite it with:
//
//	go test ./internal/helpdesk -run TestEmojiCatalogFollowsThePicker -update-emoji-catalog
var updateEmojiCatalog = flag.Bool("update-emoji-catalog", false, "rewrite emoji_catalog.txt from the emoji picker of the frontend")

const (
	emojiCatalogPath = "emoji_catalog.txt"
	frontendDir      = "../../../frontend"
	maxEmojiBytes    = 64 // as in emoji.go
)

// emojiCatalogHeader are the two header lines of the table: the version of
// emojibase-data and the groups of the picker.
type emojiCatalogHeader struct {
	version string
	groups  []int
}

func (h emojiCatalogHeader) lines() string {
	groups := make([]string, len(h.groups))
	for i, g := range h.groups {
		groups[i] = strconv.Itoa(g)
	}
	return "# emojibase-data: " + h.version + "\n# groups: " + strings.Join(groups, " ") + "\n"
}

// pickerHeader reads the version the frontend pins and the groups the picker
// shows, from files committed to the repository.
func pickerHeader(t *testing.T) emojiCatalogHeader {
	t.Helper()
	pkg, err := os.ReadFile(filepath.Join(frontendDir, "package.json"))
	if err != nil {
		t.Fatal(err)
	}
	version := regexp.MustCompile(`"emojibase-data":\s*"([^"]+)"`).FindSubmatch(pkg)
	if version == nil {
		t.Fatal("frontend/package.json does not pin emojibase-data")
	}
	picker, err := os.ReadFile(filepath.Join(frontendDir, "src/components/EmojiPicker.tsx"))
	if err != nil {
		t.Fatal(err)
	}
	var groups []int
	for _, m := range regexp.MustCompile(`(?m)^\s*\{ group: (\d+),`).FindAllSubmatch(picker, -1) {
		g, _ := strconv.Atoi(string(m[1]))
		groups = append(groups, g)
	}
	if len(groups) == 0 {
		t.Fatal("no emoji group found in EmojiPicker.tsx")
	}
	return emojiCatalogHeader{version: string(version[1]), groups: groups}
}

// pickerEmojis lists every emoji the picker offers, each with its skin tones,
// from the installed emojibase-data. ok is false when frontend/node_modules
// is not installed (npm ci).
func pickerEmojis(t *testing.T, h emojiCatalogHeader) (emojis []string, ok bool) {
	t.Helper()
	dir := filepath.Join(frontendDir, "node_modules/emojibase-data")
	pkg, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if os.IsNotExist(err) {
		return nil, false
	}
	if err != nil {
		t.Fatal(err)
	}
	var meta struct{ Version string }
	if err := json.Unmarshal(pkg, &meta); err != nil {
		t.Fatal(err)
	}
	if meta.Version != h.version {
		t.Fatalf("node_modules has emojibase-data %s, the frontend pins %s: run npm ci in frontend/", meta.Version, h.version)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "pt/compact.json"))
	if err != nil {
		t.Fatal(err)
	}
	var data []pickerEntry
	if err := json.Unmarshal(raw, &data); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, e := range data {
		if e.Group == nil || !slices.Contains(h.groups, *e.Group) {
			continue
		}
		all := []string{e.Unicode}
		for _, skin := range e.Skins {
			all = append(all, skin.Unicode)
		}
		for _, emoji := range all {
			if !seen[emoji] {
				seen[emoji] = true
				emojis = append(emojis, emoji)
			}
		}
	}
	return emojis, true
}

// pickerEntry is an emoji of emojibase-data/pt/compact.json, with its skin
// tones (the same fields, without nested skins).
type pickerEntry struct {
	Group   *int   `json:"group"`
	Unicode string `json:"unicode"`
	Skins   []struct {
		Unicode string `json:"unicode"`
	} `json:"skins"`
}

func hexOf(emoji string) string {
	var parts []string
	for _, r := range emoji {
		parts = append(parts, fmt.Sprintf("%X", r))
	}
	return strings.Join(parts, " ")
}

func catalogEmoji(t *testing.T, line string) string {
	t.Helper()
	var b strings.Builder
	for _, hex := range strings.Fields(line) {
		code, err := strconv.ParseInt(hex, 16, 32)
		if err != nil {
			t.Fatalf("%s: bad code point %q", emojiCatalogPath, hex)
		}
		b.WriteRune(rune(code))
	}
	return b.String()
}

// tableEmojis reads the table: its header lines and its emojis, in order.
func tableEmojis(t *testing.T) (header string, emojis []string) {
	t.Helper()
	raw, err := os.ReadFile(emojiCatalogPath)
	if err != nil {
		t.Fatal(err)
	}
	var head []string
	for _, line := range strings.Split(string(raw), "\n") {
		switch line = strings.TrimSpace(line); {
		case line == "":
		case strings.HasPrefix(line, "# emojibase-data:"), strings.HasPrefix(line, "# groups:"):
			head = append(head, line)
		case strings.HasPrefix(line, "#"):
		default:
			emojis = append(emojis, catalogEmoji(t, line))
		}
	}
	return strings.Join(head, "\n") + "\n", emojis
}

func writeTable(t *testing.T, h emojiCatalogHeader, emojis []string) {
	t.Helper()
	var b strings.Builder
	b.WriteString("# Table of the emojis a reaction can be: the catalog of the emoji picker of the panel.\n")
	b.WriteString("# Generated, do not edit. Regenerate from backend/ (needs npm ci in frontend/):\n")
	b.WriteString("#   go test ./internal/helpdesk -run TestEmojiCatalogFollowsThePicker -update-emoji-catalog\n")
	b.WriteString(h.lines())
	b.WriteString("# One emoji per line: the hexadecimal code points of the whole sequence.\n")
	for _, e := range emojis {
		b.WriteString(hexOf(e) + "\n")
	}
	if err := os.WriteFile(emojiCatalogPath, []byte(b.String()), 0o644); err != nil {
		t.Fatal(err)
	}
}

// The table of the backend and the catalog of the picker must not diverge:
// the version of the package and the groups of the picker (always checked,
// from committed files) and, with frontend/node_modules installed, every
// emoji of the picker with its skin tones.
func TestEmojiCatalogFollowsThePicker(t *testing.T) {
	h := pickerHeader(t)
	picker, installed := pickerEmojis(t, h)
	if *updateEmojiCatalog {
		if !installed {
			t.Fatal("frontend/node_modules is missing: run npm ci in frontend/")
		}
		writeTable(t, h, picker)
	}
	header, table := tableEmojis(t)
	if header != h.lines() {
		t.Fatalf("the table was made from another package version or other picker groups.\ntable:\n%spicker:\n%sRegenerate it (see the top of %s)", header, h.lines(), emojiCatalogPath)
	}
	for _, emoji := range table {
		if len(emoji) > maxEmojiBytes || !utf8.ValidString(emoji) {
			t.Fatalf("emoji %q does not fit the %d-byte limit", emoji, maxEmojiBytes)
		}
	}
	if !installed {
		t.Skip("frontend/node_modules is missing: only the version and the groups were checked; run npm ci in frontend/ to compare every emoji")
	}
	if !slices.Equal(table, picker) {
		missing, extra := difference(picker, table), difference(table, picker)
		t.Fatalf("the table and the picker diverge: %d emojis only in the picker %q, %d only in the table %q. Regenerate it (see the top of %s)", len(missing), first(missing), len(extra), first(extra), emojiCatalogPath)
	}
}

func difference(a, b []string) []string {
	var out []string
	for _, x := range a {
		if !slices.Contains(b, x) {
			out = append(out, x)
		}
	}
	return out
}

func first(s []string) []string { return s[:min(len(s), 5)] }

// Every emoji the picker offers, with each skin tone, is a valid reaction:
// the whole catalog, not a sample.
func TestEveryEmojiOfThePickerIsAValidReaction(t *testing.T) {
	t.Parallel()
	h := pickerHeader(t)
	emojis, installed := pickerEmojis(t, h)
	if !installed {
		_, emojis = tableEmojis(t)
	}
	if len(emojis) < 1000 {
		t.Fatalf("catalog too small: %d emojis", len(emojis))
	}
	c := newReactionConversation(t)
	msg := c.e.messageID(c.ticket.ID, "MSG-1")
	for _, emoji := range emojis {
		if resp := c.e.reactTo(msg, c.anaToken, emoji); resp.Status != http.StatusOK || resp.Body["emoji"] != emoji {
			t.Fatalf("emoji %q (%s): status %d, body %v", emoji, hexOf(emoji), resp.Status, resp.Body)
		}
	}
}
