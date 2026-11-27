// Pedaços do texto de uma mensagem: o texto puro, como veio, os links clicáveis e a
// formatação do WhatsApp. Cada pedaço diz o seu tipo, e o texto sem link nem formatação
// continua saindo inteiro num pedaço só.
export type TextPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'bold'; parts: TextPart[] }
  | { kind: 'italic'; parts: TextPart[] }
  | { kind: 'strike'; parts: TextPart[] }
  | { kind: 'code'; text: string }
  | { kind: 'codeBlock'; text: string }

// Só o que dá para clicar com segurança vira link: um endereço de site (com esquema
// http/https ou começando em www.) ou um e-mail. Domínio solto (exemplo.com) e
// esquema perigoso (javascript:, data:) ficam como texto.
// O "www." só começa um link no início de uma palavra: antes dele tem que haver o
// começo do texto, um espaço ou uma pontuação de abertura, nunca uma letra, um
// número, um ponto, um hífen ou uma barra. Assim, em "abc.www.x.com",
// "abc-www.x.com" e "a/www.x.com" o texto todo continua texto.
//
// A flag "y" (sticky) é obrigatória: o scanner chama esta expressão uma vez por
// caractere do texto, e sem ela o "exec" procuraria o link até o fim do texto a cada
// chamada — numa mensagem longa sem espaços (um hash colado, um base64) isso trava a
// tela por segundos. Com "y", cada chamada só testa a posição pedida.
const tokenPattern =
  /(?:(?<![\w@])https?:\/\/[^\s<>"'`]+)|(?:(?<![\w@.\/-])www\.[^\s<>"'`]+)|(?:[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/giy

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

// O link que começa exatamente nesta posição do texto, se houver: um endereço no meio
// de uma palavra não é procurado, porque o scanner avança caractere a caractere.
function linkAt(text: string, index: number) {
  tokenPattern.lastIndex = index
  const match = tokenPattern.exec(text)
  if (!match || match.index !== index) {
    return null
  }
  const token = trimTrailing(match[0])
  const link = linkOf(token)
  if (!link) {
    return null
  }
  return { ...link, length: token.length }
}

// Marcadores simples da formatação do WhatsApp. O bloco de três crases e o código em
// linha (uma crase) são tratados à parte, porque o conteúdo deles não formata nem vira link.
const markers = { '*': 'bold', _: 'italic', '~': 'strike' } as const

const wordChar = /[\p{L}\p{N}]/u

function isWordChar(char: string | undefined) {
  return char !== undefined && wordChar.test(char)
}

// Acha o marcador que fecha o trecho aberto em "open", seguindo as regras do WhatsApp:
// o trecho não começa nem termina com espaço (o marcador fica colado no texto), não
// atravessa quebra de linha e o marcador de fechamento não encosta na palavra seguinte
// (é o que deixa "2*3*4" como texto). Devolve -1 quando não há fechamento válido.
function closeOf(text: string, open: number, marker: string) {
  const first = open + 1
  if (first >= text.length || /\s/.test(text[first])) {
    return -1
  }
  for (let index = first + 1; index < text.length; index += 1) {
    const char = text[index]
    if (char === '\n') {
      return -1
    }
    if (char !== marker) {
      continue
    }
    if (/\s/.test(text[index - 1]) || isWordChar(text[index + 1])) {
      continue
    }
    return index
  }
  return -1
}

function parse(text: string): TextPart[] {
  const parts: TextPart[] = []
  let plain = ''
  let index = 0
  const flush = () => {
    if (plain) {
      parts.push({ kind: 'text', text: plain })
      plain = ''
    }
  }
  while (index < text.length) {
    // Bloco de monoespacado: pode ter várias linhas, e dentro dele nada formata nem vira link.
    if (text.startsWith('```', index)) {
      const end = text.indexOf('```', index + 3)
      if (end > index + 3) {
        flush()
        parts.push({ kind: 'codeBlock', text: text.slice(index + 3, end) })
        index = end + 3
        continue
      }
    }
    // Código em linha: uma crase de cada lado, na mesma linha.
    if (text[index] === '`') {
      const end = text.indexOf('`', index + 1)
      if (end > index + 1 && !text.slice(index + 1, end).includes('\n')) {
        flush()
        parts.push({ kind: 'code', text: text.slice(index + 1, end) })
        index = end + 1
        continue
      }
    }
    // Link antes de marcador: o "https://x.com/a_b_c" sai inteiro, sem o "_" virar itálico.
    const link = linkAt(text, index)
    if (link) {
      flush()
      parts.push({ kind: 'link', href: link.href, label: link.label })
      index += link.length
      continue
    }
    const kind = markers[text[index] as keyof typeof markers]
    // O marcador abre colado no começo de uma palavra: antes dele não pode vir letra nem número.
    if (kind && !isWordChar(text[index - 1])) {
      const end = closeOf(text, index, text[index])
      if (end !== -1) {
        flush()
        parts.push({ kind, parts: parse(text.slice(index + 1, end)) })
        index = end + 1
        continue
      }
    }
    plain += text[index]
    index += 1
  }
  flush()
  return parts
}

export function linkify(text: string): TextPart[] {
  return parse(text)
}
