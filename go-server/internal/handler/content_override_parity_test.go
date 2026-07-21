package handler

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

func TestAllowlistMatchesRegistryDump(t *testing.T) {
	// Path relative to this test file: ../../testdata/content_keys.txt
	data, err := os.ReadFile(filepath.Join("..", "..", "testdata", "content_keys.txt"))
	if err != nil {
		t.Fatalf("read key dump: %v (run: node client/scripts/dump-content-keys.mjs)", err)
	}
	var fromDump []string
	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			fromDump = append(fromDump, line)
		}
	}
	sort.Strings(fromDump)

	fromAllow := make([]string, 0, len(AllowedContentKeys))
	for k := range AllowedContentKeys {
		fromAllow = append(fromAllow, k)
	}
	sort.Strings(fromAllow)

	if strings.Join(fromDump, ",") != strings.Join(fromAllow, ",") {
		t.Fatalf("registry/allowlist drift:\n dump=%v\n allow=%v", fromDump, fromAllow)
	}
}
