"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  MapPin,
  Calendar,
  CheckCircle,
  Trash2,
  Plus,
  X,
  ArrowLeft,
  Upload,
  PenLine,
  AlertTriangle,
  Clock,
  Edit2,
  Save,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { siteReportsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Photo {
  id: number;
  url: string;
  caption?: string | null;
  original_name?: string | null;
}

interface Defect {
  description: string;
  severity: "low" | "medium" | "high";
  resolved: boolean;
}

interface SiteReport {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  status: string;
  report_date: string;
  customer_name?: string | null;
  signed_at?: string | null;
  defects: Defect[];
  photos: Photo[];
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_LABELS = { low: "Gering", medium: "Mittel", high: "Hoch" };
const SEVERITY_COLORS = {
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-red-500/20 text-red-400 border-red-500/30",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Signature Canvas ──────────────────────────────────────────────────────────

function SignatureCanvas({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function endDraw() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Unterschrift des Kunden:</p>
      <div className="border border-border rounded-lg overflow-hidden bg-zinc-900">
        <canvas
          ref={canvasRef}
          width={500}
          height={150}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex gap-2">
        <button onClick={clear} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors">
          Löschen
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors">
          Abbrechen
        </button>
        <button
          onClick={save}
          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          Unterschrift speichern
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SiteReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = Number(params.id);

  const [report, setReport] = useState<SiteReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit title/location/description
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);

  // Defects
  const [newDefect, setNewDefect] = useState("");
  const [newDefectSeverity, setNewDefectSeverity] = useState<"low" | "medium" | "high">("medium");
  const [addingDefect, setAddingDefect] = useState(false);

  // Signature
  const [showSignature, setShowSignature] = useState(false);
  const [sigCustomerName, setSigCustomerName] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await siteReportsApi.get(reportId);
      setReport(res.data);
    } catch {
      router.push("/site-reports");
    } finally {
      setLoading(false);
    }
  }, [reportId, router]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Edit ───────────────────────────────────────────────────────────────────

  function startEdit() {
    if (!report) return;
    setEditTitle(report.title);
    setEditLocation(report.location || "");
    setEditDescription(report.description || "");
    setEditing(true);
  }

  async function saveEdit() {
    if (!report || !editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await siteReportsApi.update(reportId, {
        title: editTitle.trim(),
        location: editLocation.trim() || null,
        description: editDescription.trim() || null,
      });
      setReport(res.data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Photos ─────────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await siteReportsApi.uploadPhoto(reportId, file);
      }
      await load();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deletePhoto(photoId: number) {
    await siteReportsApi.deletePhoto(reportId, photoId);
    setReport((prev) =>
      prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : prev
    );
  }

  // ── Defects ────────────────────────────────────────────────────────────────

  async function addDefect() {
    if (!newDefect.trim() || !report) return;
    const updated = [
      ...report.defects,
      { description: newDefect.trim(), severity: newDefectSeverity, resolved: false },
    ];
    const res = await siteReportsApi.update(reportId, { defects: updated });
    setReport(res.data);
    setNewDefect("");
    setAddingDefect(false);
  }

  async function toggleDefect(idx: number) {
    if (!report) return;
    const updated = report.defects.map((d, i) =>
      i === idx ? { ...d, resolved: !d.resolved } : d
    );
    const res = await siteReportsApi.update(reportId, { defects: updated });
    setReport(res.data);
  }

  async function removeDefect(idx: number) {
    if (!report) return;
    const updated = report.defects.filter((_, i) => i !== idx);
    const res = await siteReportsApi.update(reportId, { defects: updated });
    setReport(res.data);
  }

  // ── Signature ──────────────────────────────────────────────────────────────

  async function handleSign(dataUrl: string) {
    if (!sigCustomerName.trim()) return;
    const res = await siteReportsApi.sign(reportId, sigCustomerName.trim(), dataUrl);
    setReport(res.data);
    setShowSignature(false);
    setSigCustomerName("");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex h-screen bg-background">
          <Sidebar />
          <div className="flex-1 ml-[260px] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!report) return null;

  const isSigned = report.status === "signed";

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />

        {/* Lightbox */}
        <AnimatePresence>
          {lightboxPhoto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxPhoto(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-pointer"
            >
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.caption || "Foto"}
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              />
              {lightboxPhoto.caption && (
                <p className="absolute bottom-6 text-white text-sm bg-black/60 px-3 py-1 rounded-full">
                  {lightboxPhoto.caption}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="h-14 border-b border-border flex items-center px-6 gap-4 shrink-0">
            <button
              onClick={() => router.push("/site-reports")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
            <div className="w-px h-4 bg-border" />
            <span className="text-sm font-medium text-foreground truncate">{report.title}</span>
            <div className="ml-auto flex items-center gap-2">
              {!isSigned && (
                <>
                  {editing ? (
                    <>
                      <button
                        onClick={() => setEditing(false)}
                        className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {saving ? "Speichert…" : "Speichern"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Bearbeiten
                    </button>
                  )}
                </>
              )}
              {!isSigned && (
                <button
                  onClick={() => setShowSignature(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  Unterschrift
                </button>
              )}
            </div>
          </div>

          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">

              {/* Header card */}
              <div className="bg-card border border-border rounded-xl p-5">
                {editing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full text-lg font-semibold bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="text"
                      placeholder="Adresse / Ort"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <textarea
                      placeholder="Beschreibung"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-semibold text-foreground mb-2">{report.title}</h1>
                    {report.location && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                        <MapPin className="w-4 h-4" />
                        {report.location}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {formatDate(report.report_date)}
                    </div>
                    {report.description && (
                      <p className="mt-3 text-sm text-muted-foreground">{report.description}</p>
                    )}
                  </>
                )}

                {isSigned && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-sm text-green-400">
                      Abgenommen von <strong>{report.customer_name}</strong> am{" "}
                      {report.signed_at ? formatDate(report.signed_at) : "–"}
                    </span>
                  </div>
                )}
              </div>

              {/* Signature modal */}
              <AnimatePresence>
                {showSignature && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                  >
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-card border border-border rounded-xl p-6 w-full max-w-lg mx-4 shadow-xl"
                    >
                      <h2 className="text-base font-semibold text-foreground mb-4">Digitale Abnahme</h2>
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Name des Kunden *
                        </label>
                        <input
                          type="text"
                          placeholder="Max Mustermann"
                          value={sigCustomerName}
                          onChange={(e) => setSigCustomerName(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      {sigCustomerName.trim() && (
                        <SignatureCanvas
                          onSave={handleSign}
                          onCancel={() => { setShowSignature(false); setSigCustomerName(""); }}
                        />
                      )}
                      {!sigCustomerName.trim() && (
                        <button
                          onClick={() => { setShowSignature(false); setSigCustomerName(""); }}
                          className="w-full py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
                        >
                          Abbrechen
                        </button>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Photos */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Fotos ({report.photos.length})
                  </h2>
                  {!isSigned && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {uploading ? "Lädt hoch…" : "Fotos hinzufügen"}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {report.photos.length === 0 ? (
                  <div
                    onClick={() => !isSigned && fileInputRef.current?.click()}
                    className={cn(
                      "flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-lg text-muted-foreground",
                      !isSigned && "cursor-pointer hover:border-primary/50 hover:text-primary transition-colors"
                    )}
                  >
                    <Camera className="w-8 h-8 mb-2" />
                    <p className="text-sm">
                      {isSigned ? "Keine Fotos vorhanden" : "Fotos hochladen"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {report.photos.map((photo) => (
                      <div key={photo.id} className="relative group rounded-lg overflow-hidden bg-muted/20 aspect-square">
                        <img
                          src={photo.url}
                          alt={photo.caption || "Foto"}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setLightboxPhoto(photo)}
                        />
                        {!isSigned && (
                          <button
                            onClick={() => deletePhoto(photo.id)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        {photo.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
                            {photo.caption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Defects */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Mängel ({report.defects.length})
                  </h2>
                  {!isSigned && (
                    <button
                      onClick={() => setAddingDefect(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Mangel hinzufügen
                    </button>
                  )}
                </div>

                {/* Add defect form */}
                <AnimatePresence>
                  {addingDefect && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 overflow-hidden"
                    >
                      <div className="p-3 bg-background border border-border rounded-lg space-y-2">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Mangel beschreiben…"
                          value={newDefect}
                          onChange={(e) => setNewDefect(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addDefect()}
                          className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-muted-foreground">Schwere:</span>
                          {(["low", "medium", "high"] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => setNewDefectSeverity(s)}
                              className={cn(
                                "px-2 py-1 text-xs rounded-full border transition-colors",
                                newDefectSeverity === s
                                  ? SEVERITY_COLORS[s]
                                  : "border-border text-muted-foreground hover:bg-accent"
                              )}
                            >
                              {SEVERITY_LABELS[s]}
                            </button>
                          ))}
                          <button
                            onClick={addDefect}
                            disabled={!newDefect.trim()}
                            className="ml-auto px-3 py-1 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            Hinzufügen
                          </button>
                          <button
                            onClick={() => { setAddingDefect(false); setNewDefect(""); }}
                            className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-accent transition-colors"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {report.defects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Keine Mängel erfasst.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {report.defects.map((defect, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border",
                          defect.resolved
                            ? "border-border bg-muted/20 opacity-60"
                            : "border-border bg-background"
                        )}
                      >
                        {!isSigned && (
                          <button
                            onClick={() => toggleDefect(idx)}
                            className={cn(
                              "mt-0.5 shrink-0 w-4 h-4 rounded border transition-colors",
                              defect.resolved
                                ? "bg-green-500 border-green-500"
                                : "border-border hover:border-primary"
                            )}
                          >
                            {defect.resolved && (
                              <CheckCircle className="w-full h-full text-white" />
                            )}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm", defect.resolved && "line-through")}>
                            {defect.description}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-[10px] px-2 py-0.5 rounded-full border",
                            SEVERITY_COLORS[defect.severity as "low" | "medium" | "high"] ?? SEVERITY_COLORS.medium
                          )}
                        >
                          {SEVERITY_LABELS[defect.severity as "low" | "medium" | "high"] ?? defect.severity}
                        </span>
                        {!isSigned && (
                          <button
                            onClick={() => removeDefect(idx)}
                            className="shrink-0 p-1 text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
