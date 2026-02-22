'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, Download, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react'

interface ImportError {
  row: number
  error: string
}

interface ImportResult {
  success: boolean
  total: number
  created: number
  skipped: number
  errors: ImportError[]
}

interface CsvImportDialogProps {
  title: string
  onClose: () => void
  onImport: (file: File) => Promise<ImportResult>
  onDownloadTemplate: () => Promise<void>
  templateFilename: string
  description: string
}

export function CsvImportDialog({
  title,
  onClose,
  onImport,
  onDownloadTemplate,
  templateFilename,
  description,
}: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Nur CSV-Dateien werden unterstützt.')
      return
    }
    setFile(f)
    setError(null)
    setResult(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleImport = async () => {
    if (!file) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await onImport(file)
      setResult(res)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Import fehlgeschlagen. Bitte prüfen Sie die Datei.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await onDownloadTemplate()
    } catch {
      setError('Vorlage konnte nicht heruntergeladen werden.')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Description */}
            <p className="text-sm text-muted-foreground">{description}</p>

            {/* Template download */}
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Download className="w-4 h-4" />
              Vorlage herunterladen ({templateFilename})
            </button>

            {/* Drop zone */}
            {!result && (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-secondary/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-primary" />
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-foreground">
                      CSV-Datei hier ablegen
                    </p>
                    <p className="text-xs text-muted-foreground">
                      oder klicken zum Auswählen
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium text-foreground">Import abgeschlossen:</span>{' '}
                    <span className="text-muted-foreground">
                      {result.created} erstellt, {result.skipped} übersprungen (von {result.total} Zeilen)
                    </span>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Fehler:</p>
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-muted-foreground flex-shrink-0">Zeile {e.row}:</span>
                        <span className="text-destructive">{e.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-5 border-t border-border">
            {result ? (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Schließen
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:bg-secondary transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || isLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {isLoading ? 'Importieren...' : 'Importieren'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
