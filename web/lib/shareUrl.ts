function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

export async function compressPGN(pgn: string): Promise<string> {
  const input = new TextEncoder().encode(pgn)
  const stream = new Blob([input.buffer as ArrayBuffer]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer())
  return base64UrlEncode(compressed)
}

export async function decompressPGN(encoded: string): Promise<string> {
  const bytes = base64UrlDecode(encoded)
  const stream = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

export function buildShareUrl(encoded: string): string {
  const base = window.location.href.split('#')[0]!
  return `${base}#pgn=${encoded}`
}

export function getEncodedPGNFromHash(): string | null {
  const hash = window.location.hash
  if (!hash.startsWith('#pgn=')) return null
  return hash.slice(5)
}
