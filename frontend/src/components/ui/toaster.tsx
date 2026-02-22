'use client'

import { useEffect } from 'react'
import { useToasts } from '@/hooks/use-toast'
import { CheckCircle, XCircle, Info } from 'lucide-react'

export function Toaster() {
  const { items, subscribe } = useToasts()
  useEffect(() => subscribe(), [subscribe])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg text-sm pointer-events-auto min-w-[280px] max-w-[400px] border
            ${t.type === 'success' ? 'bg-green-950 border-green-800 text-green-200' : ''}
            ${t.type === 'error' ? 'bg-red-950 border-red-800 text-red-200' : ''}
            ${t.type === 'info' ? 'bg-card border-border text-foreground' : ''}
          `}
        >
          {t.type === 'success' && <CheckCircle className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />}
          {t.type === 'error' && <XCircle className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />}
          {t.type === 'info' && <Info className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />}
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
