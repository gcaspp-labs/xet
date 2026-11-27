// Pedaços do texto de uma mensagem: o texto puro, como veio, e os links clicáveis.
// A formatação do WhatsApp vai se apoiar nesta mesma função, então os pedaços são
// identificados por tipo e o texto sem link continua saindo inteiro num pedaço só.
export type TextPart =
  { kind: 'text'; text: string } | { kind: 'link'; href: string; label: string }

// Só o que dá para clicar com segurança vira link: um endereço de site (com esquema
// http/https ou começando em www.) ou um e-mail. Domínio solto (exemplo.com) e
// esquema perigoso (javascript:, data:) ficam como texto.
const tokenPattern =
  /(?:(?<![\w@])(?:https?:\/\/|www\.)[^\s<>"'`]+)|(?:[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/gi

// Pontuação da frase logo depois do link não faz parte dele. Um ")" só fica dentro
// do link quando a URL abriu o par (ex.: https://x.com/a_(b)).
function trimTrailing(candidate: string) {
  let end = candidate.length
  while (end > 0) {
    const last = candidate[end - 1]
    if ('.,;:!?'.includes(last)) {
      end -= 1
      continue
    }
    if (last === ')') {
      const inside = candidate.slice(0, end)
      const opened = inside.split('(').length - 1
      const closed = inside.split(')').length - 1
      if (closed > opened) {
        end -= 1
        continue
      }
    }
    break
  }
  return candidate.slice(0, end)
}

function linkOf(token: string): { href: string; label: string } | null {
  if (!/^https?:\/\//i.test(token) && !/^www\./i.test(token)) {
    return { href: `mailto:${token}`, label: token }
  }
  const href = /^https?:\/\//i.test(token) ? token : `https://${token}`
  // Sem endereço de verdade depois do esquema (ex.: "https://.") não é link.
  const address = href.replace(/^https?:\/\//i, '')
  if (!/[A-Za-z0-9]/.test(address)) {
    return null
  }
  return { href, label: token }
}

export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = []
  let lastIndex = 0
  for (const match of text.matchAll(tokenPattern)) {
    const token = trimTrailing(match[0])
    const link = linkOf(token)
    if (!link) {
      continue
    }
    const start = match.index
    if (start > lastIndex) {
      parts.push({ kind: 'text', text: text.slice(lastIndex, start) })
    }
    parts.push({ kind: 'link', href: link.href, label: link.label })
    lastIndex = start + token.length
  }
  if (lastIndex < text.length) {
    parts.push({ kind: 'text', text: text.slice(lastIndex) })
  }
  return parts
}
