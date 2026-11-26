package db

import "time"

// LegacyLaunchClaimStaleAfter é o prazo único da reserva da fila do legado:
// quanto tempo uma reserva pode ficar sem resposta do robô antes de contar como
// vencida. A reserva (ClaimLegacyLaunch) e a soltura
// (ReleaseStaleLegacyLaunchClaim) recebem este valor por parâmetro para nunca
// discordarem sobre o que é uma reserva vencida.
const LegacyLaunchClaimStaleAfter = 10 * time.Minute
