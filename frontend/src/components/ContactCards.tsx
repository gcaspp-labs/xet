import { Contact, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { copyPhone } from '@/components/PhoneCopy'
import type { ContactCard } from '@/lib/conversation'
import { formatPhone } from '@/lib/format'
import { cn } from '@/lib/utils'

// Um cartão de contato dentro do balão. O recebido fica sobre o fundo do balão e tem o botão de
// copiar em cada telefone; o enviado fica sobre o fundo do cartão, como o cliente o recebeu, sem
// botão nenhum. O nome acessível do grupo é "Contato: Nome, telefone".
//
// É o mesmo componente na conversa e na prévia da janela "Enviar contato", que mostra o cartão no
// formato do enviado.
export function ContactCardItem({ card, outbound }: { card: ContactCard; outbound: boolean }) {
  const phones = card.phones.map((entry) => entry.phone)
  const label =
    phones.length > 0
      ? `Contato: ${card.name}, ${phones.map(formatPhone).join(', ')}`
      : `Contato: ${card.name}`
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex w-72 max-w-full items-start gap-2.5 rounded-(--radius-8) border px-2.5 py-2',
        outbound ? 'border-line-soft bg-card text-foreground' : 'border-line-soft bg-muted',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          outbound
            ? 'bg-accent-soft text-accent-strong'
            : 'border border-line-soft bg-card text-accent-strong',
        )}
      >
        <Contact strokeWidth={1.7} className="size-[17px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="body-strong break-words">{card.name}</p>
        {card.organization && (
          <p className="caption break-words text-ink-soft">{card.organization}</p>
        )}
        <div className="flex flex-col">
          {card.phones.map((entry) => (
            <span key={entry.phone} className="flex items-center gap-1">
              <span className={cn('mono-num', outbound ? 'text-ink-soft' : 'text-ink')}>
                {formatPhone(entry.phone)}
              </span>
              {!outbound && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Copiar telefone ${formatPhone(entry.phone)}`}
                  title="Copiar telefone"
                  className="-my-1 size-6 text-ink-soft hover:text-foreground"
                  onClick={() => void copyPhone(entry.phone)}
                >
                  <Copy strokeWidth={1.7} className="size-[13px]" aria-hidden />
                </Button>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Os cartões de uma mensagem de contato, na ordem em que chegaram: cada um no seu cartão, todos
// dentro do mesmo balão quando o cliente manda vários de uma vez.
export function ContactCards({ cards, outbound }: { cards: ContactCard[]; outbound: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      {cards.map((card, index) => (
        <ContactCardItem key={`${card.name}-${index}`} card={card} outbound={outbound} />
      ))}
    </div>
  )
}
