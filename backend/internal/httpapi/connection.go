package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/skip2/go-qrcode"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/sector"
)

type connectionResponse struct {
	Status          db.ConnectionStatus `json:"status"`
	LastConnectedAt *time.Time          `json:"lastConnectedAt"`
	// Phone is the number read from the QR code.
	Phone *string `json:"phone"`
	// Linked reports an account to unlink, even during a temporary drop.
	Linked bool `json:"linked"`
	// ConnectionError is why the last connection was refused.
	ConnectionError *string `json:"connectionError"`
	// Pairing reports a QR code waiting to be read, served by qr.png.
	Pairing bool `json:"pairing"`
	// Warning asks to finish the unlink by the phone.
	Warning string `json:"warning,omitempty"`
}

// qrCode returns the pairing code of the sector, for providers linked by QR code.
func (s *server) qrCode(sectorID int64) (string, bool) {
	pairing, ok := s.opts.Messaging.(messaging.QRPairing)
	if !ok {
		return "", false
	}
	return pairing.QRCode(sectorID)
}

func (s *server) writeConnection(w http.ResponseWriter, r *http.Request, sectorID int64) {
	s.writeConnectionWarning(w, r, sectorID, "")
}

func (s *server) writeConnectionWarning(w http.ResponseWriter, r *http.Request, sectorID int64, warning string) {
	sec, err := s.sectors.Get(r.Context(), sectorID)
	if err != nil {
		s.sectorError(w, r, err)
		return
	}
	_, pairing := s.qrCode(sectorID)
	writeJSON(w, http.StatusOK, connectionResponse{
		Status:          sec.ConnectionStatus,
		LastConnectedAt: sec.LastConnectedAt,
		Phone:           sec.Phone,
		Linked:          sec.ExternalAccountID != nil,
		ConnectionError: sec.ConnectionError,
		Pairing:         pairing,
		Warning:         warning,
	})
}

func (s *server) getConnection(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	s.writeConnection(w, r, sectorID)
}

// connect starts the session of the sector number; without a linked account
// it starts a new pairing and the response says the QR code is ready.
func (s *server) connect(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	if err := s.sectors.Connect(r.Context(), s.opts.Messaging, sectorID); err != nil {
		if errors.Is(err, sector.ErrNotFound) {
			s.sectorError(w, r, err)
			return
		}
		s.logger.Error("connect sector", "sector_id", sectorID, "error", err)
		writeError(w, http.StatusBadGateway, "Não foi possível conectar ao WhatsApp. Tente novamente em instantes.")
		return
	}
	s.writeConnection(w, r, sectorID)
}

// disconnect unlinks the sector number. Unlinked here but not on the device,
// the answer is still a success and asks to remove it by the phone.
func (s *server) disconnect(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	warning := ""
	err := s.sectors.Disconnect(r.Context(), s.opts.Messaging, currentUser(r.Context()).ID, sectorID)
	switch {
	case errors.Is(err, sector.ErrDeviceNotNotified):
		s.logger.Warn("unlink sector device", "sector_id", sectorID, "error", err)
		warning = "Não foi possível avisar o aparelho. Remova-o também pelo celular, em Dispositivos conectados."
	case err != nil:
		s.sectorError(w, r, err)
		return
	}
	s.writeConnectionWarning(w, r, sectorID, warning)
}

// connectionQR serves the pairing QR code as a PNG image.
func (s *server) connectionQR(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	code, ok := s.qrCode(sectorID)
	if !ok {
		writeError(w, http.StatusNotFound, "Nenhum QR code disponível. Conecte o número para gerar um novo.")
		return
	}
	png, err := qrcode.Encode(code, qrcode.Medium, 320)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(png)
}
