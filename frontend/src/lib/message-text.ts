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
// A parte antes do "@" de um e-mail vai só até 64 caracteres (o limite do padrão) e o
// e-mail não começa no meio de uma palavra: sem isso, um texto colado só de letras e "_"
// (base64, hash) fazia a busca de e-mail varrer o resto da linha a partir de cada letra.
// Com os dois, cada tentativa custa no máximo 64 caracteres, e uma linha de 60.000 volta a
// desenhar em dezenas de milissegundos.
const tokenPattern =
  /(?:(?<![\w@])https?:\/\/[^\s<>"'`]+)|(?:(?<![\w@.\/-])www\.[^\s<>"'`]+)|(?:(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/giy

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

// Acima deste tamanho de linha, a formatação não é examinada e a linha sai como texto
// puro (os links continuam). Procurar o fechamento de um marcador varre a linha até o fim,
// e numa linha cheia de marcador solto (um "-_a-_a..." colado) isso custa o quadrado do
// tamanho: 10.000 caracteres levavam ~220 ms e 45.000, ~4 s, travando a tela. O limite põe
// o pior caso em ~25 ms por linha (medido no Node 24), e acima de 2.000 caracteres numa
// linha só o que costuma haver é texto colado (hash, base64, log), sem formatação a
// preservar.
const FORMAT_LIMIT = 2000

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

// Lê o texto de uma mensagem e devolve os pedaços que a tela desenha: texto puro,
// links clicáveis e a formatação do WhatsApp.
export function parseMessageText(text: string): TextPart[] {
  const parts: TextPart[] = []
  let plain = ''
  let index = 0
  // Limites da linha atual: o fechamento de um marcador nunca passa da quebra, e é daqui
  // que sai o tamanho do trecho que a formatação ainda pode examinar.
  let lineStart = 0
  let lineEnd = text.indexOf('\n')
  if (lineEnd === -1) {
    lineEnd = text.length
  }
  let longLine = lineEnd - lineStart > FORMAT_LIMIT
  const flush = () => {
    if (plain) {
      parts.push({ kind: 'text', text: plain })
      plain = ''
    }
  }
  while (index < text.length) {
    // Um salto (o bloco de três crases) pode cair em outra linha: os limites são recalculados.
    if (index > lineEnd) {
      lineStart = text.lastIndexOf('\n', index - 1) + 1
      const next = text.indexOf('\n', index)
      lineEnd = next === -1 ? text.length : next
      longLine = lineEnd - lineStart > FORMAT_LIMIT
    }
    // Linha longa demais: formatação fora (na linha toda), links e texto puro continuam.
    const formatting = !longLine
    // Bloco de monoespacado: pode ter várias linhas, e dentro dele nada formata nem vira link.
    if (formatting && text.startsWith('```', index)) {
      const end = text.indexOf('```', index + 3)
      if (end > index + 3) {
        flush()
        parts.push({ kind: 'codeBlock', text: text.slice(index + 3, end) })
        index = end + 3
        continue
      }
    }
    // Código em linha: uma crase de cada lado, na mesma linha.
    if (formatting && text[index] === '`') {
      const end = text.indexOf('`', index + 1)
      if (end > index + 1 && !text.slice(index + 1, end).includes('\n')) {
        flush()
        parts.push({ kind: 'code', text: text.slice(index + 1, end) })
        index = end + 1
        continue
      }
    }
    // Marcador antes de link: assim `_joao@x.com_` vira o e-mail em itálico, como no
    // WhatsApp, sem o "_" entrar no endereço nem sobrar solto. O link que começa nesta
    // posição continua saindo inteiro, então o "_" dentro de `https://x.com/a_b_c` nunca
    // é examinado como marcador.
    const kind = markers[text[index] as keyof typeof markers]
    // O marcador abre colado no começo de uma palavra: antes dele não pode vir letra nem número.
    if (formatting && kind && !isWordChar(text[index - 1])) {
      const end = closeOf(text, index, text[index])
      if (end !== -1) {
        flush()
        parts.push({ kind, parts: parseMessageText(text.slice(index + 1, end)) })
        index = end + 1
        continue
      }
    }
    const link = linkAt(text, index)
    if (link) {
      flush()
      parts.push({ kind: 'link', href: link.href, label: link.label })
      index += link.length
      continue
    }
    plain += text[index]
    index += 1
  }
  flush()
  return parts
}
