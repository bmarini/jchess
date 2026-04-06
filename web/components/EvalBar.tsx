import type { EngineEval } from '@/lib/engine'

type Props = {
  eval_: EngineEval | null
  flipped?: boolean
}

function formatScore(eval_: EngineEval): string {
  if (eval_.mate !== null) {
    return `M${Math.abs(eval_.mate)}`
  }
  const pawns = eval_.score / 100
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(1)
}

/**
 * Eval bar that renders vertically on desktop (lg:) and horizontally on mobile.
 * Uses flex-basis so the same percentage works in both orientations.
 */
export default function EvalBar({ eval_, flipped = false }: Props) {
  let whitePct = 50
  if (eval_) {
    if (eval_.mate !== null) {
      whitePct = eval_.mate > 0 ? 100 : 0
    } else {
      whitePct = 50 + 50 * Math.tanh(eval_.score / 400)
    }
  }

  const blackPct = flipped ? 100 - whitePct : whitePct
  const label = eval_ ? formatScore(eval_) : ''
  const isWhiteAdvantage = eval_ ? eval_.score >= 0 : true

  return (
    <div className="
      flex rounded overflow-hidden bg-neutral-800 relative shadow-md
      flex-row h-4 w-full
      lg:flex-col lg:h-full lg:w-8
    ">
      {/* Black portion (left on mobile, top on desktop) */}
      <div
        className="bg-neutral-800 transition-all duration-300 ease-out"
        style={{ flexBasis: `${blackPct}%` }}
      />
      {/* White portion */}
      <div className="bg-neutral-100 flex-1" />
      {/* Score label */}
      {eval_ && (
        <div
          className={[
            'absolute text-center text-[10px] font-mono font-bold py-0.5',
            // Mobile: position left/right
            isWhiteAdvantage
              ? 'right-1 lg:right-auto lg:bottom-0 lg:left-0 lg:right-0 text-neutral-700'
              : 'left-1 lg:left-auto lg:top-0 lg:left-0 lg:right-0 text-neutral-300',
            // Vertical centering on mobile
            'top-0 bottom-0 flex items-center lg:block lg:top-auto lg:bottom-auto',
          ].join(' ')}
        >
          {label}
        </div>
      )}
    </div>
  )
}
