import path from 'path'
import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  // Static export for GitHub Pages
  output: 'export',
  // Site lives at bmarini.github.io/jchess/
  basePath: isProd ? '/jchess' : '',
  // next/image requires a server for optimization; disable for static export
  images: { unoptimized: true },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@chess': path.resolve(__dirname, '../src'),
    }
    // Resolve .js extension imports to .ts files (src uses ESM-style .js imports)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.js'],
    }
    return config
  },
}

export default nextConfig
