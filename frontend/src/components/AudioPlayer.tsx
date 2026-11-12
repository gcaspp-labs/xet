import { Pause, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { formatDuration } from '@/lib/format'
import { cn } from 'cn'

// Player sobre um <audio> sem os controles nativos, usado na gravação e nas
// mensagens. `durationSeconds` vale enquanto o navegador não informa a duração:
// antes de carregar o arquivo e nas gravações em WebM, que não a registram.
export function AudioPlayer({
  src,
  label,
  durationSeconds,
  className,
}: {
  src: string
  label: string
  durationSeconds: number | null
  className?: string
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [mediaDuration, setMediaDuration] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const duration = mediaDuration ?? durationSeconds

  const toggle = () => {
    const element = audio.current
    if (!element) {
      return
    }
    if (!element.paused) {
      element.pause()
      return
    }
    // Depois de uma falha, tenta carregar o arquivo de novo.
    if (failed) {
      setFailed(false)
      element.load()
    }
    // Uma falha ao carregar chega pelo evento de erro do elemento.
    void element.play().catch(() => {})
  }

  const seek = (value: number | readonly number[]) => {
    const next = typeof value === 'number' ? value : value[0]
    setPosition(next)
    if (audio.current) {
      audio.current.currentTime = next
    }
  }

  const time = (value: number) =>
    duration ? `${formatDuration(value)} de ${formatDuration(duration)}` : formatDuration(value)

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-(--radius-7) border border-line bg-card py-1 pr-2.5 pl-1 text-foreground',
        className,
      )}
    >
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration
          setMediaDuration(Number.isFinite(value) ? value : null)
        }}
        onEnded={(event) => {
          event.currentTarget.currentTime = 0
          setPosition(0)
        }}
        onError={() => {
          setFailed(true)
          setPlaying(false)
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label={playing ? 'Pausar áudio' : 'Tocar áudio'}
        onClick={toggle}
      >
        {playing ? <Pause strokeWidth={1.7} aria-hidden /> : <Play strokeWidth={1.7} aria-hidden />}
      </Button>
      {failed ? (
        <span className="caption min-w-0 flex-1 text-ink-soft">Áudio indisponível</span>
      ) : (
        <Slider
          className="min-w-8 flex-1"
          min={0}
          max={duration || 1}
          step={1}
          largeStep={10}
          disabled={!duration}
          value={Math.min(position, duration ?? 0)}
          onValueChange={seek}
          thumbProps={{
            getAriaLabel: () => 'Posição do áudio',
            getAriaValueText: (_formatted, value) => time(value),
          }}
        />
      )}
      <span className="mono-num caption shrink-0 whitespace-nowrap text-ink-soft">
        {!failed && <span aria-label="Tempo do áudio">{formatDuration(position)}</span>}
        {!failed && duration !== null && ' / '}
        {duration !== null && <span aria-label="Duração do áudio">{formatDuration(duration)}</span>}
      </span>
    </div>
  )
}
