import { useReplay } from '../state/useReplay'
import { useMarketData } from '../state/useMarketData'
import { IconStepBack, IconStepFwd, IconPlay, IconPause } from './icons'

const SPEEDS = [0.5, 1, 2, 5, 10]

export function ReplayControls() {
  const cursor = useReplay((s) => s.cursor)
  const length = useReplay((s) => s.length)
  const playing = useReplay((s) => s.playing)
  const speed = useReplay((s) => s.speed)
  const candles = useMarketData((s) => s.candles)

  const t = candles[cursor]?.time
  const label = t
    ? new Date(t * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  const cycleSpeed = () => {
    const i = SPEEDS.indexOf(speed)
    useReplay.getState().setSpeed(SPEEDS[(i + 1) % SPEEDS.length])
  }

  return (
    <div className="replay">
      <span className="rtag">REPLAY</span>
      <div className="transport">
        <button className="tb" title="Step back" onClick={() => useReplay.getState().step(-1)}>
          <IconStepBack />
        </button>
        <button className="tb play" title="Play / pause" onClick={() => useReplay.getState().toggle()}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button className="tb" title="Step forward" onClick={() => useReplay.getState().step(1)}>
          <IconStepFwd />
        </button>
      </div>
      <input
        className="scrub"
        type="range"
        min={0}
        max={Math.max(0, length - 1)}
        step={1}
        value={cursor}
        onChange={(e) => useReplay.getState().setCursor(Number(e.target.value))}
      />
      <span className="rclock num">{label}</span>
      <button className="speed" onClick={cycleSpeed}>
        {speed}×
      </button>
    </div>
  )
}
