import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword, openQueued } from './fixtures'

const limit = 16 * 1024 * 1024

async function connectSector(baseURL: string, sectorId: number) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${sectorId}/connection`)).ok()).toBeTruthy()
  await api.dispose()
}

async function phone(request: APIRequestContext, sectorId: number, action: string, data?: object) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, {
    data,
  })
  expect(response.ok()).toBeTruthy()
}

type FileSpec = { name: string; type: string; size?: number }

// Um `DataTransfer` do navegador com os arquivos dados (ou só com texto, se `files` for vazio).
function transfer(page: Page, files: FileSpec[], text?: string) {
  return page.evaluateHandle(
    ({ files, text }) => {
      const data = new DataTransfer()
      for (const file of files) {
        const content = file.size ? new Uint8Array(file.size) : new Uint8Array([1, 2, 3])
        data.items.add(new File([content], file.name, { type: file.type }))
      }
      if (text) data.setData('text/plain', text)
      return data
    },
    { files, text },
  )
}

// Dispara a colagem no campo, com a imagem ou o texto na área de transferência. Devolve se o
// navegador teve a colagem impedida (ou seja, se a tela interceptou).
function paste(target: Locator, page: Page, files: FileSpec[], text?: string) {
  return transfer(page, files, text).then((data) =>
    target.evaluate((el, clipboardData) => {
      el.focus()
      const event = new ClipboardEvent('paste', {
        clipboardData: clipboardData as DataTransfer,
        bubbles: true,
        cancelable: true,
      })
      el.dispatchEvent(event)
      return event.defaultPrevented
    }, data),
  )
}

const image = { name: 'image.png', type: 'image/png' }

// Chamado assumido pelo atendente, com a conversa aberta.
async function openOwnTicket(
  page: Page,
  request: APIRequestContext,
  baseURL: string,
): Promise<{ conversation: Locator; sector: { id: number }; supervisor: string }> {
  const { sector, agent, supervisor } = await seedSector(baseURL)
  await connectSector(baseURL, sector.id)
  await phone(request, sector.id, 'pair')
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName: 'Paula Cliente',
    body: 'Bom dia',
  })
  await signIn(page, agent, userPassword)
  await openQueued(page, 'Paula Cliente')
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  return { conversation, sector, supervisor }
}

test('colar uma imagem anexa como o botão de anexo e envia; colar só texto não anexa', async ({
  page,
  request,
  baseURL,
}) => {
  const { conversation } = await openOwnTicket(page, request, baseURL!)
  const box = page.getByRole('textbox', { name: 'Mensagem' })

  // Só texto: a colagem não é interceptada.
  const textPaste = await paste(box, page, [], 'texto colado')
  expect(textPaste).toBe(false)
  await expect(page.getByRole('button', { name: 'Remover arquivo' })).toHaveCount(0)
  await expect(box).toHaveAttribute('placeholder', 'Escreva a mensagem')

  // Imagem: a prévia é a do botão de anexo, e o campo vira a legenda.
  expect(await paste(box, page, [image])).toBe(true)
  await expect(conversation.getByText('image.png')).toBeVisible()
  await expect(conversation.getByText('1 KB')).toBeVisible()
  const caption = page.getByRole('textbox', { name: 'Legenda do arquivo' })
  await expect(caption).toHaveAttribute('placeholder', 'Legenda (opcional)')

  // Colar outra imagem troca a anterior.
  await paste(caption, page, [{ name: 'captura.png', type: 'image/png' }])
  await expect(conversation.getByText('captura.png')).toBeVisible()
  await expect(conversation.getByText('image.png')).toHaveCount(0)

  // O envio sai pelo mesmo caminho do botão.
  const sending = page.waitForRequest(
    (req) => req.url().endsWith('/messages') && req.method() === 'POST',
  )
  await caption.fill('Segue a captura')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await sending
  const sent = conversation
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'Segue a captura' })
  await expect(sent).toContainText('Enviada')
  await expect(sent.getByRole('img', { name: 'Imagem' })).toBeVisible()
})

test('soltar um arquivo na conversa acende o destaque, anexa só o primeiro e substitui o anterior', async ({
  page,
  request,
  baseURL,
}) => {
  const { conversation } = await openOwnTicket(page, request, baseURL!)
  const highlight = conversation.getByRole('status').filter({ hasText: 'Solte para anexar' })

  // Arrastar texto não acende o destaque.
  await conversation.dispatchEvent('dragenter', {
    dataTransfer: await transfer(page, [], 'só texto'),
  })
  await expect(highlight).toHaveCount(0)

  // Arrastar arquivo acende; sair do cartão apaga.
  const dragged = await transfer(page, [{ name: 'balancete.pdf', type: 'application/pdf' }])
  await conversation.dispatchEvent('dragenter', { dataTransfer: dragged })
  await expect(highlight).toBeVisible()
  await expect(highlight).toContainText('Um arquivo por vez, até 16 MB.')
  await conversation.dispatchEvent('dragleave', { dataTransfer: dragged })
  await expect(highlight).toHaveCount(0)

  // Soltar dois arquivos anexa só o primeiro, e o destaque some.
  const two = await transfer(page, [
    { name: 'primeiro.pdf', type: 'application/pdf' },
    { name: 'segundo.pdf', type: 'application/pdf' },
  ])
  await conversation.dispatchEvent('dragenter', { dataTransfer: two })
  await expect(highlight).toBeVisible()
  await conversation.dispatchEvent('drop', { dataTransfer: two })
  await expect(highlight).toHaveCount(0)
  await expect(conversation.getByText('primeiro.pdf')).toBeVisible()
  await expect(conversation.getByText('segundo.pdf')).toHaveCount(0)

  // Soltar de novo troca o arquivo e permite legenda e envio.
  await conversation.dispatchEvent('drop', {
    dataTransfer: await transfer(page, [{ name: 'balancete.pdf', type: 'application/pdf' }]),
  })
  await expect(conversation.getByText('balancete.pdf')).toBeVisible()
  await expect(conversation.getByText('primeiro.pdf')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Legenda do arquivo' }).fill('Balancete de outubro')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  const sent = conversation
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'balancete.pdf' })
  await expect(sent).toContainText('Enviada')
  await expect(sent).toContainText('Balancete de outubro')
})

test('arquivo acima de 16 MB, colado ou solto, mostra o aviso e não anexa', async ({
  page,
  request,
  baseURL,
}) => {
  const { conversation } = await openOwnTicket(page, request, baseURL!)
  const warning = conversation.getByText('O arquivo passa de 16 MB. Escolha um arquivo menor.')
  const big = { name: 'grande.pdf', type: 'application/pdf', size: limit + 1 }

  await paste(page.getByRole('textbox', { name: 'Mensagem' }), page, [big])
  await expect(warning).toBeVisible()
  await expect(conversation.getByText('grande.pdf')).toHaveCount(0)

  // Um arquivo válido depois limpa o aviso; um solto grande avisa de novo.
  await conversation.dispatchEvent('drop', {
    dataTransfer: await transfer(page, [{ name: 'ok.pdf', type: 'application/pdf' }]),
  })
  await expect(conversation.getByText('ok.pdf')).toBeVisible()
  await expect(warning).toHaveCount(0)
  await conversation.dispatchEvent('drop', { dataTransfer: await transfer(page, [big]) })
  await expect(warning).toBeVisible()

  // Exatamente 16 MB ainda passa.
  await conversation.dispatchEvent('drop', {
    dataTransfer: await transfer(page, [
      { name: 'limite.pdf', type: 'application/pdf', size: limit },
    ]),
  })
  await expect(conversation.getByText('limite.pdf')).toBeVisible()
  await expect(warning).toHaveCount(0)
})

test('sem poder responder, colar e soltar não fazem nada e não há destaque', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { supervisor } = await openOwnTicket(page, request, baseURL!)

  // Outro atendente acompanha o chamado e não pode responder.
  const context = await browser.newContext()
  const other = await context.newPage()
  await signIn(other, supervisor, userPassword)
  await other.goto(page.url())
  const conversation = other.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText(/Chamado com agent \d+\. Peça a transferência/)

  const file = await transfer(other, [{ name: 'balancete.pdf', type: 'application/pdf' }])
  await conversation.dispatchEvent('dragenter', { dataTransfer: file })
  await expect(conversation.getByRole('status')).toHaveCount(0)
  const prevented = await conversation.evaluate((el, data) => {
    const event = new DragEvent('drop', {
      dataTransfer: data as DataTransfer,
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(event)
    return event.defaultPrevented
  }, file)
  expect(prevented).toBe(false)
  await expect(conversation.getByText('balancete.pdf')).toHaveCount(0)
  await expect(other.getByRole('textbox')).toHaveCount(0)
  await context.close()
})

test('durante a gravação e com o áudio gravado, colar e soltar não fazem nada', async ({
  page,
  request,
  baseURL,
}) => {
  const { conversation } = await openOwnTicket(page, request, baseURL!)
  const file = await transfer(page, [{ name: 'balancete.pdf', type: 'application/pdf' }])
  const highlight = conversation.getByRole('status').filter({ hasText: 'Solte para anexar' })

  await page.getByRole('button', { name: 'Gravar áudio' }).click()
  const recording = page.getByRole('status', { name: 'Gravação de áudio' })
  await expect(recording).toContainText('Gravando')
  await conversation.dispatchEvent('dragenter', { dataTransfer: file })
  await expect(highlight).toHaveCount(0)
  await conversation.dispatchEvent('drop', { dataTransfer: file })
  await expect(conversation.getByText('balancete.pdf')).toHaveCount(0)
  await expect(recording).toContainText('Gravando')

  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Concluir gravação' }).click()
  await expect(page.getByLabel('Áudio gravado')).toBeVisible()
  await conversation.dispatchEvent('dragenter', { dataTransfer: file })
  await expect(highlight).toHaveCount(0)
  await conversation.dispatchEvent('drop', { dataTransfer: file })
  await expect(conversation.getByText('balancete.pdf')).toHaveCount(0)
  await expect(page.getByLabel('Áudio gravado')).toBeVisible()
})
