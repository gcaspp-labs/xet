// Package paging is the contract every paged list shares: the page and order
// read from the query string and the response with the items and the total.
package paging

import (
	"net/http"
	"slices"
	"strconv"
)

// PageSize is the fixed number of items in each page of a paged list.
const PageSize = 20

// Request is the page and order a paged list asks for, read from the
// query string: ?page= (from 1), ?sort= (a column the list allows) and
// ?direction= (asc or desc).
type Request struct {
	Page       int
	Sort       string
	Descending bool
}

// Parse reads the page and order of a paged list. A missing or invalid page
// is the first; a column outside allowed falls back to the default column and
// its default direction; without a column the direction applies to the default
// one; a direction other than asc or desc is the default one.
func Parse(r *http.Request, allowed []string, defaultSort string, defaultDescending bool) Request {
	q := r.URL.Query()
	req := Request{Page: 1, Sort: defaultSort, Descending: defaultDescending}
	if page, err := strconv.Atoi(q.Get("page")); err == nil && page > 1 {
		req.Page = page
	}
	sort := q.Get("sort")
	if sort == "" || slices.Contains(allowed, sort) {
		if sort != "" {
			req.Sort = sort
		}
		switch q.Get("direction") {
		case "asc":
			req.Descending = false
		case "desc":
			req.Descending = true
		}
	}
	return req
}

// Clamp keeps the page within the pages that total items fill: a page past the
// last is the last, and an empty list has only the first.
func (p Request) Clamp(total int64) Request {
	last := max(1, int((total+PageSize-1)/PageSize))
	p.Page = min(p.Page, last)
	return p
}

// Offset is the number of items before the page.
func (p Request) Offset() int32 {
	return int32((p.Page - 1) * PageSize) //nolint:gosec // the page is clamped to the items of a table
}

// Page is the response of a paged list: the items of the page, the total of
// items the filter finds, the page actually returned (the last one when the
// request went past it) and the page size.
type Page[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
}

// NewPage builds the response of a page.
func NewPage[T any](items []T, total int64, req Request) Page[T] {
	if items == nil {
		items = []T{}
	}
	return Page[T]{Items: items, Total: total, Page: req.Page, PageSize: PageSize}
}
