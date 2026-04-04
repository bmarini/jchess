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
 * Vertical eval bar showing engine evaluation.
 * White advantage fills from the bottom, black from the top.
 */
export default function EvalBar({ eval_, flipped = false }: Props) {
  // Convert centipawns to a percentage (0% = completely losing for white, 100% = winning)
  // Use a sigmoid-like curve so ±3 pawns ≈ fills most of the bar
  let whitePct = 50
  if (eval_) {
    if (eval_.mate !== null) {
      whitePct = eval_.mate > 0 ? 100 : 0
    } else {
      // Sigmoid: 50 + 50 * tanh(score / 400)
      whitePct = 50 + 50 * Math.tanh(eval_.score / 400)
    }
  }

  const topPct = flipped ? whitePct : 100 - whitePct
  const label = eval_ ? formatScore(eval_) : ''
  const isWhiteAdvantage = eval_ ? eval_.score >= 0 : true

  return (
    <div className="w-6 h-full rounded-sm overflow-hidden bg-neutral-800 relative flex flex-col">
      {/* Black portion (top) */}
      <div
        className="bg-neutral-800 transition-all duration-300 ease-out"
        style={{ height: `${topPct}%` }}
      />
      {/* White portion (bottom) */}
      <div className="bg-white flex-1" />
      {/* Score label */}
      {eval_ && (
        <div
          className={[
            'absolute left-0 right-0 text-center text-[9px] font-mono font-bold leading-tight',
            isWhiteAdvantage
              ? 'bottom-0.5 text-neutral-700'
              : 'top-0.5 text-neutral-300',
          ].join(' ')}
        >
          {label}
        </div>
      )}
    </div>
  )
}
