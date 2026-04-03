import type { ParsedGame } from '@chess/types'

type Props = {
  game: ParsedGame | null
}

const RESULT_SYMBOL: Record<string, string> = {
  '1-0': '1-0',
  '0-1': '0-1',
  '1/2-1/2': '½-½',
  '*': '',
}

function playerLabel(name?: string, elo?: string) {
  if (!name) return null
  return elo ? `${name} (${elo})` : name
}

export default function GameInfo({ game }: Props) {
  if (!game) return null

  const h = game.headers
  const white = playerLabel(h['White'], h['WhiteElo'])
  const black = playerLabel(h['Black'], h['BlackElo'])
  const event = h['Event']
  const site = h['Site']
  const date = h['Date']
  const round = h['Round'] && h['Round'] !== '?' ? `Round ${h['Round']}` : null
  const resultRaw = h['Result'] ?? '*'
  const result = RESULT_SYMBOL[resultRaw] ?? resultRaw

  const hasPlayers = white || black
  const hasMeta = event || site || date

  if (!hasPlayers && !hasMeta) return null

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800 px-3 py-2 text-xs shrink-0">
      {hasPlayers && (
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
              {white ?? '?'}
            </span>
            <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
              {black ?? '?'}
            </span>
          </div>
          {result && (
            <span className="font-semibold text-neutral-500 dark:text-neutral-400 shrink-0">
              {result}
            </span>
          )}
        </div>
      )}
      {hasMeta && (
        <div className="text-neutral-400 dark:text-neutral-500 truncate">
          {[event, site, round, date].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  )
}
