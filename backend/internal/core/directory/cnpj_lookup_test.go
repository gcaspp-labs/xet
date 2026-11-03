package directory_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

func TestMunicipalitiesHaveIBGECode(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)

	var distinct int
	if err := e.Pool.QueryRow(t.Context(), "select count(distinct ibge_code) from municipalities").Scan(&distinct); err != nil {
		t.Fatal(err)
	}
	if distinct != 645 {
		t.Errorf("distinct ibge codes = %d, want 645", distinct)
	}
	for name, want := range map[string]string{
		"Adamantina": "3500105", "Óleo": "3533809", "Florínea": "3516101", "São Paulo": "3550308",
	} {
		var code string
		if err := e.Pool.QueryRow(t.Context(), "select ibge_code from municipalities where name = $1", name).Scan(&code); err != nil {
			t.Fatal(err)
		}
		if code != want {
			t.Errorf("%s: ibge code %s, want %s", name, code, want)
		}
	}
}

func TestCNPJLookupRequiresSupervisorOrAdmin(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.User("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	e.CNPJAPI.Respond(numericCNPJ, http.StatusOK, `{"razao_social": "ORGAO", "codigo_municipio_ibge": 3550308}`)
	path := "/api/cnpj/" + numericCNPJ

	if resp := e.Do(http.MethodGet, path, e.Login("agente@exemplo.com", testPassword), nil); resp.Status != http.StatusForbidden {
		t.Errorf("agent: status %d, want 403", resp.Status)
	}
	if resp := e.Do(http.MethodGet, path, "", nil); resp.Status != http.StatusUnauthorized {
		t.Errorf("no session: status %d, want 401", resp.Status)
	}
	if calls := e.CNPJAPI.Calls(); len(calls) != 0 {
		t.Errorf("refused requests must not call the API: %v", calls)
	}
	for _, email := range []string{"sup@exemplo.com", "admin@exemplo.com"} {
		if resp := e.Do(http.MethodGet, path, e.Login(email, testPassword), nil); resp.Status != http.StatusOK {
			t.Errorf("%s: status %d, want 200", email, resp.Status)
		}
	}
}

func TestCNPJLookupSuggestsWithoutSaving(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	tests := []struct {
		name, cnpj, input, body string
		wantName                string
		wantMunicipality        string
	}{
		{
			name: "municipality found by the code, with the name of the list", cnpj: numericCNPJ, input: numericCNPJ,
			body:     `{"razao_social": " MUNICIPIO DE PERUIBE ", "municipio": "PERUIBE", "codigo_municipio_ibge": 3537602, "capital_social": 10}`,
			wantName: "MUNICIPIO DE PERUIBE", wantMunicipality: "Peruíbe",
		},
		{
			name: "code as a string and alphanumeric CNPJ in lower case", cnpj: alphanumericCNPJ, input: "12abc34501de35",
			body:     `{"razao_social": "CAMARA DE ITU", "codigo_municipio_ibge": "3523909"}`,
			wantName: "CAMARA DE ITU", wantMunicipality: "Itu",
		},
		{
			name: "municipality outside the list stays to be chosen", cnpj: "00000000000191", input: "00000000000191",
			body:     `{"razao_social": "BANCO DO BRASIL SA", "municipio": "BRASILIA", "codigo_municipio_ibge": 5300108}`,
			wantName: "BANCO DO BRASIL SA",
		},
		{
			name: "no municipality code", cnpj: "11444777000161", input: "11444777000161",
			body:     `{"razao_social": "ORGAO SEM CODIGO", "codigo_municipio_ibge": null}`,
			wantName: "ORGAO SEM CODIGO",
		},
	}
	for _, tc := range tests {
		e.CNPJAPI.Respond(tc.cnpj, http.StatusOK, tc.body)
		resp := e.Do(http.MethodGet, "/api/cnpj/"+tc.input, token, nil)
		if resp.Status != http.StatusOK {
			t.Errorf("%s: status %d: %v", tc.name, resp.Status, resp.Body)
			continue
		}
		if resp.Body["name"] != tc.wantName {
			t.Errorf("%s: name %v, want %q", tc.name, resp.Body["name"], tc.wantName)
		}
		municipality, _ := resp.Body["municipality"].(map[string]any)
		if tc.wantMunicipality == "" {
			if resp.Body["municipality"] != nil {
				t.Errorf("%s: municipality %v, want none", tc.name, resp.Body["municipality"])
			}
			continue
		}
		if municipality["name"] != tc.wantMunicipality || int64(municipality["id"].(float64)) != e.Municipality(tc.wantMunicipality) {
			t.Errorf("%s: municipality %v, want %s", tc.name, municipality, tc.wantMunicipality)
		}
		if len(resp.Body) != 2 {
			t.Errorf("%s: extra data in the response: %v", tc.name, resp.Body)
		}
	}

	if got := e.Count("organizations"); got != 0 {
		t.Errorf("organizations = %d, want 0: the lookup saves nothing", got)
	}
	if got := e.Count("audit_logs"); got != 0 {
		t.Errorf("audit logs = %d, want 0: the lookup saves nothing", got)
	}
}

func TestCNPJLookupRefusesInvalidCNPJBeforeCallingTheAPI(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	for _, cnpj := range []string{"11222333000182", "123", "11111111111111"} {
		resp := e.Do(http.MethodGet, "/api/cnpj/"+cnpj, token, nil)
		if resp.Status != http.StatusUnprocessableEntity || resp.Body["error"] != "CNPJ inválido. Confira os 14 caracteres." {
			t.Errorf("%s: status %d: %v", cnpj, resp.Status, resp.Body)
		}
	}
	if calls := e.CNPJAPI.Calls(); len(calls) != 0 {
		t.Errorf("invalid CNPJs must not call the API: %v", calls)
	}
}

func TestCNPJLookupFailureKeepsManualRegistration(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	const unavailable = "Consulta de CNPJ indisponível. Preencha os dados manualmente."

	e.CNPJAPI.Respond("11222333000181", http.StatusInternalServerError, `{"message": "erro"}`)
	e.CNPJAPI.Respond("11444777000161", http.StatusTooManyRequests, ``)
	e.CNPJAPI.Respond("00000000000191", http.StatusOK, `não é json`)
	e.CNPJAPI.Respond("12ABC34501DE35", http.StatusOK, `{"razao_social": "  "}`)
	e.CNPJAPI.Drop("ABCDEFGH000195")

	failures := map[string]struct {
		status  int
		message string
	}{
		"11222333000181": {http.StatusServiceUnavailable, unavailable},
		"11444777000161": {http.StatusServiceUnavailable, unavailable},
		"00000000000191": {http.StatusServiceUnavailable, unavailable},
		"12ABC34501DE35": {http.StatusServiceUnavailable, unavailable},
		"ABCDEFGH000195": {http.StatusServiceUnavailable, unavailable},
		// Sem resposta definida, a API falsa devolve 404.
		"11222333000262": {http.StatusNotFound, "CNPJ não encontrado na consulta. Preencha os dados manualmente."},
	}
	i := 0
	for cnpj, want := range failures {
		resp := e.Do(http.MethodGet, "/api/cnpj/"+cnpj, token, nil)
		if resp.Status != want.status || resp.Body["error"] != want.message {
			t.Errorf("%s: status %d: %v, want %d", cnpj, resp.Status, resp.Body, want.status)
		}
		// O cadastro manual do mesmo CNPJ continua funcionando.
		body := map[string]any{"name": fmt.Sprintf("Órgão %d", i), "municipalityId": e.Municipality("Itu"), "cnpj": cnpj}
		if created := e.Do(http.MethodPost, "/api/organizations", token, body); created.Status != http.StatusCreated {
			raw, _ := json.Marshal(created.Body)
			t.Errorf("%s: manual registration: status %d: %s", cnpj, created.Status, raw)
		}
		i++
	}
}
