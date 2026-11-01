package helpdesk

import (
	"errors"
	"net/http"
	"time"

	"github.com/skip2/go-qrcode"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/core/sectors"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
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
func (h *Handler) qrCode(sectorID int64) (string, bool) {
	pairing, ok := h.provider.(messaging.QRPairing)
	if !ok {
		return "", false
	}
	return pairing.QRCode(sectorID)
}

func (h *Handler) writeConnection(w http.ResponseWriter, r *http.Request, sectorID int64) {
	h.writeConnectionWarning(w, r, sectorID, "")
}

func (h *Handler) writeConnectionWarning(w http.ResponseWriter, r *http.Request, sectorID int64, warning string) {
	sec, err := h.sectors.Get(r.Context(), sectorID)
	if err != nil {
		sectors.WriteError(h.logger, w, r, err)
		return
	}
	_, pairing := h.qrCode(sectorID)
	httpx.WriteJSON(w, http.StatusOK, connectionResponse{
		Status:          sec.ConnectionStatus,
		LastConnectedAt: sec.LastConnectedAt,
		Phone:           sec.Phone,
		Linked:          sec.ExternalAccountID != nil,
		ConnectionError: sec.ConnectionError,
		Pairing:         pairing,
		Warning:         warning,
	})
}

func (h *Handler) getConnection(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	h.writeConnection(w, r, sectorID)
}

// connect starts the session of the sector number; without a linked account
// it starts a new pairing and the response says the QR code is ready.
func (h *Handler) connect(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	if err := h.service.Connect(r.Context(), h.provider, sectorID); err != nil {
		if errors.Is(err, sectors.ErrNotFound) {
			sectors.WriteError(h.logger, w, r, err)
			return
		}
		h.logger.Error("connect sector", "sector_id", sectorID, "error", err)
		httpx.WriteError(w, http.StatusBadGateway, "Não foi possível conectar ao WhatsApp. Tente novamente em instantes.")
		return
	}
	h.writeConnection(w, r, sectorID)
}

// disconnect unlinks the sector number. Unlinked here but not on the device,
// the answer is still a success and asks to remove it by the phone.
func (h *Handler) disconnect(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	warning := ""
	err := h.service.Disconnect(r.Context(), h.provider, auth.CurrentUser(r.Context()).ID, sectorID)
	switch {
	case errors.Is(err, ErrDeviceNotNotified):
		h.logger.Warn("unlink sector device", "sector_id", sectorID, "error", err)
		warning = "Não foi possível avisar o aparelho. Remova-o também pelo celular, em Dispositivos conectados."
	case err != nil:
		sectors.WriteError(h.logger, w, r, err)
		return
	}
	h.writeConnectionWarning(w, r, sectorID, warning)
}

// connectionQR serves the pairing QR code as a PNG image.
func (h *Handler) connectionQR(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	code, ok := h.qrCode(sectorID)
	if !ok {
		httpx.WriteError(w, http.StatusNotFound, "Nenhum QR code disponível. Conecte o número para gerar um novo.")
		return
	}
	png, err := qrcode.Encode(code, qrcode.Medium, 320)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(png)
}
