import { Fragment } from 'react'
import { linkify } from '@/lib/linkify'

// Texto de uma mensagem com os links clicáveis, como no WhatsApp Web. O link abre numa
// aba nova e o e-mail abre o programa de e-mail; o clique não chega às ações do balão.
export function MessageText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((part, index) =>
        part.kind === 'text' ? (
          <Fragment key={index}>{part.text}</Fragment>
        ) : (
          <a
            key={index}
            href={part.href}
            {...(part.href.startsWith('mailto:')
              ? {}
              : { target: '_blank', rel: 'noopener noreferrer' })}
            // A URL longa quebra dentro do balão em vez de estourar a largura da conversa.
            className="underline underline-offset-2 [overflow-wrap:anywhere] hover:no-underline"
            onClick={(event) => event.stopPropagation()}
          >
            {part.label}
          </a>
        ),
      )}
    </>
  )
}
