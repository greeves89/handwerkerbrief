'use client'

import { useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

let listeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []
let nextId = 0

function notify() {
  listeners.forEach((l) => l([...toasts]))
}

export function toast(message: string, type: ToastType = 'info') {
  const id = nextId++
  toasts = [...toasts, { id, message, type }]
  notify()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  }, 4000)
}

export function useToasts() {
  const [items, setItems] = useState<Toast[]>([])
  const subscribe = useCallback(() => {
    const handler = (t: Toast[]) => setItems(t)
    listeners.push(handler)
    return () => {
      listeners = listeners.filter((l) => l !== handler)
    }
  }, [])
  return { items, subscribe }
}
