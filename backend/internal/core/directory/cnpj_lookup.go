package directory

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

const (
	cnpjLookupTimeout = 8 * time.Second
	cnpjLookupMaxBody = 1 << 20
)

// CNPJSuggestion holds the data suggested for an organization form. Municipality
// is nil when the lookup returns a municipality outside the list.
type CNPJSuggestion struct {
	Name         string
	Municipality *db.GetMunicipalityByIBGECodeRow
}

// LookupCNPJ asks the external API for the data of a CNPJ. It saves nothing and
// runs outside any transaction, because the API may take seconds to answer.
func (s *Service) LookupCNPJ(ctx context.Context, raw string) (CNPJSuggestion, error) {
	cnpj, err := NormalizeCNPJ(raw)
	if err != nil {
		return CNPJSuggestion{}, err
	}
	company, err := s.fetchCNPJ(ctx, cnpj)
	if err != nil {
		return CNPJSuggestion{}, err
	}
	suggestion := CNPJSuggestion{Name: strings.TrimSpace(company.Name)}
	if suggestion.Name == "" {
		return CNPJSuggestion{}, fmt.Errorf("%w: response without a name", ErrCNPJLookupUnavailable)
	}
	if company.IBGECode == "" {
		return suggestion, nil
	}
	municipality, err := s.q.GetMunicipalityByIBGECode(ctx, company.IBGECode.String())
	if errors.Is(err, pgx.ErrNoRows) {
		return suggestion, nil
	}
	if err != nil {
		return CNPJSuggestion{}, fmt.Errorf("get municipality by ibge code: %w", err)
	}
	suggestion.Municipality = &municipality
	return suggestion, nil
}

type cnpjCompany struct {
	Name string `json:"razao_social"`
	// json.Number accepts the code as a number or as a string, and stays empty when null.
	IBGECode json.Number `json:"codigo_municipio_ibge"`
}

func (s *Service) fetchCNPJ(ctx context.Context, cnpj string) (cnpjCompany, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.cnpjAPIURL+"/"+cnpj, nil)
	if err != nil {
		return cnpjCompany{}, fmt.Errorf("%w: %v", ErrCNPJLookupUnavailable, err)
	}
	resp, err := s.cnpjClient.Do(req)
	if err != nil {
		return cnpjCompany{}, fmt.Errorf("%w: %v", ErrCNPJLookupUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound:
		return cnpjCompany{}, ErrCNPJNotFound
	default:
		return cnpjCompany{}, fmt.Errorf("%w: status %d", ErrCNPJLookupUnavailable, resp.StatusCode)
	}
	var company cnpjCompany
	if err := json.NewDecoder(io.LimitReader(resp.Body, cnpjLookupMaxBody)).Decode(&company); err != nil {
		return cnpjCompany{}, fmt.Errorf("%w: %v", ErrCNPJLookupUnavailable, err)
	}
	return company, nil
}
