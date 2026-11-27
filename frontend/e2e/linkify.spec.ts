import { expect, test } from '@playwright/test'
import { linkify } from '../src/lib/linkify'

// O texto de uma mensagem vira pedaços: texto puro e links. A função é pura, e o mesmo
// teste vale para os balões (recebidos, enviados e legenda), que só a renderizam.
const links = (text: string) =>
  linkify(text).flatMap((part) => (part.kind === 'link' ? [part] : []))

test('endereço com esquema vira link, e o resto do texto fica como veio', () => {
  const text = 'Segue o site https://exemplo.com/a?b=1 para conferência.'
  expect(linkify(text)).toEqual([
    { kind: 'text', text: 'Segue o site ' },
    { kind: 'link', href: 'https://exemplo.com/a?b=1', label: 'https://exemplo.com/a?b=1' },
    { kind: 'text', text: ' para conferência.' },
  ])
})

test('www. vira link com https:// na frente', () => {
  expect(links('acesse www.exemplo.com agora')).toEqual([
    { kind: 'link', href: 'https://www.exemplo.com', label: 'www.exemplo.com' },
  ])
})

test('e-mail vira link de e-mail, e o domínio dele não vira link de site', () => {
  expect(links('fale com fulano@exemplo.com.br')).toEqual([
    { kind: 'link', href: 'mailto:fulano@exemplo.com.br', label: 'fulano@exemplo.com.br' },
  ])
})

test('domínio solto e esquema perigoso continuam texto puro', () => {
  for (const text of [
    'o arquivo google.com não abre',
    'veja o arquivo.pdf e a v1.2',
    'javascript:alert(1)',
    'data:text/html,<b>oi</b>',
  ]) {
    expect(links(text), text).toEqual([])
  }
  expect(linkify('google.com')).toEqual([{ kind: 'text', text: 'google.com' }])
})

test('pontuação da frase fica fora do link', () => {
  expect(links('veja https://x.com/a.')).toEqual([
    { kind: 'link', href: 'https://x.com/a', label: 'https://x.com/a' },
  ])
  for (const punctuation of ['.', ',', ';', ':', '!', '?', ')']) {
    expect(links(`veja https://x.com/a${punctuation}`)[0]?.label).toBe('https://x.com/a')
  }
  expect(links('(https://x.com/a)')[0]?.href).toBe('https://x.com/a')
})

test('parêntese aberto dentro da URL é mantido', () => {
  expect(links('(https://x.com/a_(b))')).toEqual([
    { kind: 'link', href: 'https://x.com/a_(b)', label: 'https://x.com/a_(b)' },
  ])
})

test('vários links na mesma frase, na ordem em que aparecem', () => {
  expect(links('https://a.com, fulano@b.com e www.c.com').map((link) => link.href)).toEqual([
    'https://a.com',
    'mailto:fulano@b.com',
    'https://www.c.com',
  ])
})

test('texto sem link sai inteiro, com quebras de linha e espaços', () => {
  const text = 'Bom dia!\n\nTudo bem?  Sim.'
  expect(linkify(text)).toEqual([{ kind: 'text', text }])
  expect(linkify('')).toEqual([])
})
