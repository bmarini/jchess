import { defineConfig } from 'vite'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'

// Copy examples/*.pgn into the build output so fetch('./examples/...') works
function copyExamples() {
  return {
    name: 'copy-examples',
    closeBundle() {
      const outDir = 'dist/demo/examples'
      mkdirSync(outDir, { recursive: true })
      for (const file of readdirSync('examples')) {
        copyFileSync(join('examples', file), join(outDir, file))
      }
    },
  }
}

export default defineConfig({
  // Served at https://<user>.github.io/jchess/
  base: '/jchess/',
  build: {
    outDir: 'dist/demo',
    emptyOutDir: true,
  },
  plugins: [copyExamples()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
