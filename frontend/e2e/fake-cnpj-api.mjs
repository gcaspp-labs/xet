// API de CNPJ falsa dos testes ponta a ponta. Cada teste define a resposta do seu
// CNPJ com PUT /responses/:cnpj; sem resposta definida, a consulta devolve 404.
import { createServer } from 'node:http'

const responses = new Map()

function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

createServer((req, res) => {
  const [, resource, cnpj] = new URL(req.url, 'http://localhost').pathname.split('/')
  if (resource === 'health') {
    reply(res, 200, { status: 'ok' })
  } else if (req.method === 'PUT' && resource === 'responses') {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      responses.set(cnpj, JSON.parse(data))
      reply(res, 200, {})
    })
  } else if (req.method === 'GET' && resource === 'cnpj' && responses.has(cnpj)) {
    const { status, body } = responses.get(cnpj)
    reply(res, status, body)
  } else {
    reply(res, 404, { message: 'CNPJ não encontrado.' })
  }
}).listen(Number(process.env.PORT))
