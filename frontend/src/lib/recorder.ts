import { useCallback, useEffect, useRef, useState } from 'react'

// Áudio gravado no navegador, ainda no formato do MediaRecorder (WebM/Opus no
// Chrome e no Firefox, MP4 no Safari); o backend converte para mensagem de voz.
export type Recording = { blob: Blob; url: string; seconds: number }

// Formatos em ordem de preferência; o navegador escolhe o padrão se nenhum servir.
const formats = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']

function recorderError(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Acesso ao microfone negado. Permita o microfone no navegador e tente de novo.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'Nenhum microfone encontrado. Conecte um microfone e tente de novo.'
  }
  return 'Não foi possível gravar o áudio. Tente de novo.'
}

// Gravação de áudio com o MediaRecorder nativo. O navegador só libera o
// microfone em HTTPS ou em localhost.
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const startedAt = useRef(0)

  const release = useCallback(() => {
    recorder.current?.stream.getTracks().forEach((track) => track.stop())
    recorder.current = null
    setRecording(false)
  }, [])

  // Solta o microfone se a tela for fechada durante a gravação.
  useEffect(() => release, [release])

  useEffect(() => {
    if (!recording) {
      return
    }
    const timer = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250)
    return () => clearInterval(timer)
  }, [recording])

  const start = async () => {
    setError(null)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Gravação de áudio indisponível neste endereço. Acesse o painel por HTTPS.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = formats.find((format) => MediaRecorder.isTypeSupported(format))
      const media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      media.start()
      recorder.current = media
      startedAt.current = Date.now()
      setElapsed(0)
      setRecording(true)
    } catch (err) {
      release()
      setError(recorderError(err))
    }
  }

  // Encerra a gravação e devolve o áudio; vazio se nada foi gravado.
  const stop = () =>
    new Promise<Recording | null>((resolve) => {
      const media = recorder.current
      if (!media) {
        resolve(null)
        return
      }
      const chunks: Blob[] = []
      media.ondataavailable = (event) => chunks.push(event.data)
      media.onstop = () => {
        const blob = new Blob(chunks, { type: media.mimeType })
        const seconds = (Date.now() - startedAt.current) / 1000
        release()
        resolve(blob.size > 0 ? { blob, url: URL.createObjectURL(blob), seconds } : null)
      }
      media.stop()
    })

  const cancel = () => {
    const media = recorder.current
    if (media) {
      media.ondataavailable = null
      media.onstop = null
      media.stop()
    }
    release()
  }

  return { recording, elapsed, error, setError, start, stop, cancel }
}
