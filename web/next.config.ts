import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
