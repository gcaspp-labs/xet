// Package audit builds the change sets recorded in audit_logs.
package audit

import (
	"encoding/json"
	"fmt"
)

// Change is the previous and new value of a field.
type Change struct {
	From any `json:"from"`
	To   any `json:"to"`
}

// Changes maps field names to their change, stored in audit_logs.changes as
// {"field": {"from": ..., "to": ...}}.
type Changes map[string]Change

// Set records the field when the value changed. Pointers are compared and
// stored by the value they point to, so a nil pointer becomes null.
func (c Changes) Set(field string, from, to any) {
	from, to = deref(from), deref(to)
	if from == to {
		return
	}
	c[field] = Change{From: from, To: to}
}

// Empty reports whether nothing changed.
func (c Changes) Empty() bool {
	return len(c) == 0
}

// JSON encodes the changes for audit_logs.changes.
func (c Changes) JSON() ([]byte, error) {
	b, err := json.Marshal(c)
	if err != nil {
		return nil, fmt.Errorf("encode audit changes: %w", err)
	}
	return b, nil
}

func deref(v any) any {
	switch p := v.(type) {
	case *int64:
		if p == nil {
			return nil
		}
		return *p
	case *string:
		if p == nil {
			return nil
		}
		return *p
	default:
		return v
	}
}
