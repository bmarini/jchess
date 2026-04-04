const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export type EngineEval = {
  depth: number
  /** Centipawns from white's perspective (positive = white advantage) */
  score: number
  /** If set, forced mate in N moves (positive = white mates, negative = black mates) */
  mate: number | null
  /** Principal variation in long algebraic notation (e2e4, e7e5, ...) */
  pv: string[]
}

export type EngineState = 'idle' | 'loading' | 'ready' | 'analyzing'

type Listener = (eval_: EngineEval) => void

/**
 * Wrapper around a Stockfish WASM Web Worker.
 * Manages UCI protocol, provides a clean async interface.
 */
export class StockfishEngine {
  private worker: Worker | null = null
  private state: EngineState = 'idle'
  private onEval: Listener | null = null
  private onReady: (() => void) | null = null

  /** Start the engine. Resolves when UCI handshake completes. */
  async init(): Promise<void> {
    if (this.state !== 'idle') return

    this.state = 'loading'
    const url = `${BASE_PATH}/stockfish/stockfish-18-lite-single.js`
    this.worker = new Worker(url)

    return new Promise<void>((resolve) => {
      this.worker!.onmessage = (e: MessageEvent<string>) => {
        this.handleMessage(e.data)
      }

      this.onReady = () => {
        this.state = 'ready'
        resolve()
      }

      this.send('uci')
    })
  }

  /** Analyze a position. Calls `onEval` with progressive updates. */
  analyze(fen: string, depth: number, onEval: Listener): void {
    if (!this.worker || this.state === 'idle' || this.state === 'loading') return

    this.stop()
    this.onEval = onEval
    this.state = 'analyzing'
    this.send(`position fen ${fen}`)
    this.send(`go depth ${depth}`)
  }

  /** Stop current analysis. */
  stop(): void {
    if (this.state === 'analyzing') {
      this.send('stop')
      this.state = 'ready'
    }
    this.onEval = null
  }

  /** Shut down the engine. */
  destroy(): void {
    this.stop()
    this.worker?.terminate()
    this.worker = null
    this.state = 'idle'
  }

  get currentState(): EngineState { return this.state }

  private send(cmd: string): void {
    this.worker?.postMessage(cmd)
  }

  private handleMessage(line: string): void {
    if (line === 'uciok') {
      this.send('isready')
      return
    }

    if (line === 'readyok') {
      this.onReady?.()
      this.onReady = null
      return
    }

    if (line.startsWith('info') && line.includes('score') && line.includes(' pv ')) {
      const eval_ = parseInfoLine(line)
      if (eval_) this.onEval?.(eval_)
      return
    }

    if (line.startsWith('bestmove')) {
      this.state = 'ready'
      return
    }
  }
}

function parseInfoLine(line: string): EngineEval | null {
  const depthMatch = line.match(/\bdepth (\d+)/)
  const cpMatch = line.match(/\bscore cp (-?\d+)/)
  const mateMatch = line.match(/\bscore mate (-?\d+)/)
  const pvMatch = line.match(/\bpv (.+)$/)

  if (!depthMatch || !pvMatch) return null

  const depth = parseInt(depthMatch[1]!, 10)
  const pv = pvMatch[1]!.trim().split(/\s+/)

  if (cpMatch) {
    return { depth, score: parseInt(cpMatch[1]!, 10), mate: null, pv }
  }
  if (mateMatch) {
    const mate = parseInt(mateMatch[1]!, 10)
    // Represent mate scores as large centipawn values for the eval bar
    return { depth, score: mate > 0 ? 10000 : -10000, mate, pv }
  }

  return null
}
