import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/chess.ts',
      name: 'jChess',
      fileName: 'chess',
      formats: ['es', 'umd'],
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
