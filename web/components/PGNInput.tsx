'use client'

import { useRef } from 'react'

type Props = {
  onLoad: (pgn: string) => void
}

export default function PGNInput({ onLoad }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null)

  function handleLoad() {
    const val = textRef.current?.value.trim()
    if (val) onLoad(val)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (text) onLoad(text)
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textRef}
        placeholder="Paste PGN here…"
        rows={6}
        className="w-full text-xs font-mono rounded border border-neutral-300
          dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200
          p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <div className="flex gap-2">
        <button
          onClick={handleLoad}
          className="flex-1 px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white
            hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          Load PGN
        </button>
        <label className="px-3 py-1.5 rounded text-sm font-medium bg-neutral-100
          hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700
          cursor-pointer transition-colors">
          Open file
          <input type="file" name="pgn-file" accept=".pgn,.txt" className="hidden" onChange={handleFile} />
        </label>
      </div>
    </div>
  )
}
