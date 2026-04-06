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

type EvalListener = (eval_: EngineEval) => void
type BestMoveListener = (eval_: EngineEval | null) => void

/**
 * Wrapper around a Stockfish WASM Web Worker.
 * Manages UCI protocol, provides both streaming and promise-based interfaces.
 */
export class StockfishEngine {
  private worker: Worker | null = null
  private state: EngineState = 'idle'
  private onEval: EvalListener | null = null
  private onBestMove: BestMoveListener | null = null
  private onReady: (() => void) | null = null
  private lastEval: EngineEval | null = null

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

  /** Analyze a position with streaming eval updates. */
  analyze(fen: string, depth: number, onEval: EvalListener): void {
    if (!this.worker || this.state === 'idle' || this.state === 'loading') return

    this.stop()
    this.onEval = onEval
    this.onBestMove = null
    this.lastEval = null
    this.state = 'analyzing'
    this.send(`position fen ${fen}`)
    this.send(`go depth ${depth}`)
  }

  /** Analyze a position and return the final eval. */
  analyzePosition(fen: string, depth: number): Promise<EngineEval> {
    return new Promise((resolve, reject) => {
      if (!this.worker || this.state === 'idle' || this.state === 'loading') {
        reject(new Error('Engine not ready'))
        return
      }

      this.stop()
      this.lastEval = null
      this.onEval = null
      this.onBestMove = (eval_) => {
        resolve(eval_ ?? { depth: 0, score: 0, mate: null, pv: [] })
      }
      this.state = 'analyzing'
      this.send(`position fen ${fen}`)
      this.send(`go depth ${depth}`)
    })
  }

  /** Play a bot move: set skill level, think briefly, return UCI move string. */
  async playBotMove(fen: string, skillLevel: number): Promise<string | null> {
    if (!this.worker || this.state === 'idle' || this.state === 'loading') return null
    this.stop()
    this.send(`setoption name Skill Level value ${skillLevel}`)
    // Limit depth for weaker play — low skill levels should also search shallowly
    const depth = Math.max(1, Math.round(skillLevel * 0.6 + 2))
    this.lastEval = null
    this.state = 'analyzing'
    this.send(`position fen ${fen}`)
    this.send(`go depth ${depth}`)
    return new Promise((resolve) => {
      this.onBestMove = (eval_) => {
        resolve(eval_?.pv[0] ?? null)
      }
    })
  }

  /** Stop current analysis. */
  stop(): void {
    if (this.state === 'analyzing') {
      this.send('stop')
      this.state = 'ready'
    }
    this.onEval = null
    this.onBestMove = null
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
      if (eval_) {
        this.lastEval = eval_
        this.onEval?.(eval_)
      }
      return
    }

    if (line.startsWith('bestmove')) {
      this.state = 'ready'
      this.onBestMove?.(this.lastEval)
      this.onBestMove = null
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
    return { depth, score: mate > 0 ? 10000 : -10000, mate, pv }
  }

  return null
}
