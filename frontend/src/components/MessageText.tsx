import { Fragment } from 'react'
import { linkify, type TextPart } from '@/lib/linkify'

// Pedaços do texto de uma mensagem, com os links clicáveis e a formatação do WhatsApp.
// O link abre numa aba nova e o e-mail abre o programa de e-mail; o clique não chega às
// ações do balão. A formatação usa elementos React, sem HTML cru.
function Parts({ parts }: { parts: TextPart[] }) {
  return (
    <>
      {parts.map((part, index) => {
        switch (part.kind) {
          case 'text':
            return <Fragment key={index}>{part.text}</Fragment>
          case 'link':
            return (
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
            )
          case 'bold':
            return (
              <strong key={index}>
                <Parts parts={part.parts} />
              </strong>
            )
          case 'italic':
            return (
              <em key={index}>
                <Parts parts={part.parts} />
              </em>
            )
          case 'strike':
            return (
              <s key={index}>
                <Parts parts={part.parts} />
              </s>
            )
          case 'code':
            return (
              <code key={index} className="[font-family:var(--font-mono)]">
                {part.text}
              </code>
            )
          case 'codeBlock':
            return (
              <code key={index} className="block [font-family:var(--font-mono)]">
                {part.text}
              </code>
            )
        }
      })}
    </>
  )
}

// Texto de uma mensagem como no WhatsApp Web: links, negrito, itálico, riscado e
// monoespaçado. O texto recebido e enviado não muda; só a tela mostra a formatação.
export function MessageText({ text }: { text: string }) {
  return <Parts parts={linkify(text)} />
}
