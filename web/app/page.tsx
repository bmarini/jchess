import { EngineProvider } from '@/hooks/useSharedEngine'
import ChessApp from '@/components/ChessApp'

export default function Home() {
  return (
    <EngineProvider>
      <ChessApp />
    </EngineProvider>
  )
}
