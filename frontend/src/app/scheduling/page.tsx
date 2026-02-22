"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
  MapPin,
  Clock,
  X,
  Edit2,
  CalendarDays,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { schedulingApi } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkAssignment {
  id: number;
  user_id: number;
  worker_name: string;
  customer_id?: number | null;
  title: string;
  description?: string | null;
  location?: string | null;
  assignment_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  color?: string | null;
  notes?: string | null;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const STATUS_OPTIONS = [
  { value: "planned", label: "Geplant" },
  { value: "in_progress", label: "In Bearbeitung" },
  { value: "done", label: "Abgeschlossen" },
  { value: "cancelled", label: "Storniert" },
];

const PRESET_COLORS = [
  { value: "#3b82f6", label: "Blau" },
  { value: "#10b981", label: "Grün" },
  { value: "#f59e0b", label: "Gelb" },
  { value: "#ef4444", label: "Rot" },
  { value: "#8b5cf6", label: "Lila" },
  { value: "#f97316", label: "Orange" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#ec4899", label: "Pink" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusColor(status: string, customColor?: string | null): string {
  if (customColor) return customColor;
  switch (status) {
    case "planned": return "#3b82f6";
    case "in_progress": return "#f59e0b";
    case "done": return "#10b981";
    case "cancelled": return "#9ca3af";
    default: return "#3b82f6";
  }
}

function getStatusLabel(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function toISODateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

// ── Empty form state ──────────────────────────────────────────────────────────

const emptyForm = {
  worker_name: "",
  title: "",
  assignment_date: toISODateString(new Date()),
  start_time: "",
  end_time: "",
  location: "",
  status: "planned",
  color: "#3b82f6",
  description: "",
  notes: "",
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function SchedulingPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [workers, setWorkers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<WorkAssignment | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [activeWorkerFilter, setActiveWorkerFilter] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchWeek = useCallback(async (weekStart: Date) => {
    setIsLoading(true);
    try {
      const dateStr = toISODateString(weekStart);
      const res = await schedulingApi.listWeek(dateStr);
      setAssignments(res.data);
    } catch (err) {
      console.error("Failed to load assignments", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await schedulingApi.getWorkers();
      setWorkers(res.data);
    } catch (err) {
      console.error("Failed to load workers", err);
    }
  }, []);

  useEffect(() => {
    fetchWeek(currentWeekStart);
  }, [currentWeekStart, fetchWeek]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  // ── Week navigation ────────────────────────────────────────────────────────

  const prevWeek = () => setCurrentWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setCurrentWeekStart((d) => addDays(d, 7));
  const goToToday = () => setCurrentWeekStart(getMonday(new Date()));

  // ── Week days ──────────────────────────────────────────────────────────────

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const today = toISODateString(new Date());

  // ── Modal handling ─────────────────────────────────────────────────────────

  const openNewModal = () => {
    setEditingAssignment(null);
    setForm({ ...emptyForm, assignment_date: toISODateString(new Date()) });
    setShowModal(true);
  };

  const openEditModal = (a: WorkAssignment) => {
    setEditingAssignment(a);
    setForm({
      worker_name: a.worker_name,
      title: a.title,
      assignment_date: a.assignment_date,
      start_time: a.start_time ? formatTime(a.start_time) : "",
      end_time: a.end_time ? formatTime(a.end_time) : "",
      location: a.location ?? "",
      status: a.status,
      color: a.color ?? "#3b82f6",
      description: a.description ?? "",
      notes: a.notes ?? "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAssignment(null);
  };

  // ── Save / Delete ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.worker_name.trim() || !form.title.trim() || !form.assignment_date) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        worker_name: form.worker_name.trim(),
        title: form.title.trim(),
        assignment_date: form.assignment_date,
        status: form.status,
        color: form.color || null,
        description: form.description || null,
        location: form.location || null,
        notes: form.notes || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
      };

      if (editingAssignment) {
        await schedulingApi.update(editingAssignment.id, payload);
      } else {
        await schedulingApi.create(payload);
      }

      await fetchWeek(currentWeekStart);
      await fetchWorkers();
      closeModal();
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Einsatz wirklich loeschen?")) return;
    try {
      await schedulingApi.delete(id);
      await fetchWeek(currentWeekStart);
      await fetchWorkers();
      closeModal();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  // ── Filter assignments by day and optional worker filter ───────────────────

  const getAssignmentsForDay = (dayStr: string) => {
    return assignments.filter((a) => {
      if (a.assignment_date !== dayStr) return false;
      if (activeWorkerFilter && a.worker_name !== activeWorkerFilter) return false;
      return true;
    });
  };

  // ── Compute week label ─────────────────────────────────────────────────────

  const weekLabel = (() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}. – ${end.getDate()}. ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()}. ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()}. ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
  })();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <MobileNavProvider>
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title="Einsatzplanung"
            subtitle="Mitarbeiter disponieren und Auftraege planen"
            actions={
              <button
                onClick={openNewModal}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Neuer Einsatz
              </button>
            }
          />

          <main className="flex-1 overflow-y-auto p-6">
            {/* Week navigation */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={prevWeek}
                  className="p-2 rounded-lg border border-border hover:bg-accent transition-colors text-foreground"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextWeek}
                  className="p-2 rounded-lg border border-border hover:bg-accent transition-colors text-foreground"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-sm font-medium text-foreground"
                >
                  Heute
                </button>
                <span className="text-sm font-semibold text-foreground ml-2">{weekLabel}</span>
              </div>

              {/* Worker filter pills */}
              {workers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-1">Filter:</span>
                  <button
                    onClick={() => setActiveWorkerFilter(null)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
                      activeWorkerFilter === null
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    Alle
                  </button>
                  {workers.map((w) => (
                    <button
                      key={w}
                      onClick={() => setActiveWorkerFilter(activeWorkerFilter === w ? null : w)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
                        activeWorkerFilter === w
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <User className="w-3 h-3 inline mr-1" />
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Week grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-3 min-h-[500px]">
                {weekDays.map((day, idx) => {
                  const dayStr = toISODateString(day);
                  const isToday = dayStr === today;
                  const dayAssignments = getAssignmentsForDay(dayStr);

                  return (
                    <div key={dayStr} className="flex flex-col">
                      {/* Day header */}
                      <div
                        className={cn(
                          "text-center py-2.5 rounded-xl mb-2 font-medium text-sm",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border text-muted-foreground"
                        )}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide">
                          {DAY_NAMES[idx]}
                        </div>
                        <div className={cn("text-lg font-bold leading-tight", isToday ? "text-primary-foreground" : "text-foreground")}>
                          {day.getDate()}
                        </div>
                      </div>

                      {/* Assignments for this day */}
                      <div className="flex-1 space-y-2 min-h-[120px]">
                        <AnimatePresence>
                          {dayAssignments.map((a) => {
                            const bgColor = getStatusColor(a.status, a.color);
                            return (
                              <motion.div
                                key={a.id}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.18 }}
                                onClick={() => openEditModal(a)}
                                className="relative rounded-lg p-2.5 cursor-pointer shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
                                style={{
                                  backgroundColor: bgColor + "22",
                                  borderLeft: `3px solid ${bgColor}`,
                                  borderTop: "1px solid " + bgColor + "44",
                                  borderRight: "1px solid " + bgColor + "44",
                                  borderBottom: "1px solid " + bgColor + "44",
                                }}
                              >
                                {/* Edit hint */}
                                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Edit2 className="w-3 h-3" style={{ color: bgColor }} />
                                </div>

                                {/* Worker name */}
                                <div className="flex items-center gap-1 mb-0.5">
                                  <User className="w-3 h-3 shrink-0" style={{ color: bgColor }} />
                                  <span className="text-xs font-bold text-foreground truncate">
                                    {a.worker_name}
                                  </span>
                                </div>

                                {/* Job title */}
                                <p className="text-xs text-foreground font-medium leading-tight mb-1 line-clamp-2">
                                  {a.title}
                                </p>

                                {/* Time */}
                                {(a.start_time || a.end_time) && (
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <Clock className="w-3 h-3 shrink-0 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {a.start_time ? formatTime(a.start_time) : ""}
                                      {a.start_time && a.end_time ? " – " : ""}
                                      {a.end_time ? formatTime(a.end_time) : ""}
                                    </span>
                                  </div>
                                )}

                                {/* Location */}
                                {a.location && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 shrink-0 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground truncate">
                                      {a.location}
                                    </span>
                                  </div>
                                )}

                                {/* Status badge */}
                                <div className="mt-1.5">
                                  <span
                                    className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                                    style={{
                                      backgroundColor: bgColor + "33",
                                      color: bgColor,
                                    }}
                                  >
                                    {getStatusLabel(a.status)}
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {/* Empty state hint */}
                        {dayAssignments.length === 0 && (
                          <div className="h-full min-h-[80px] rounded-lg border border-dashed border-border flex items-center justify-center">
                            <span className="text-xs text-muted-foreground/50">–</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state for whole week */}
            {!isLoading && assignments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center mt-4">
                <CalendarDays className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-foreground font-medium mb-1">Keine Einsaetze diese Woche</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Planen Sie den ersten Einsatz fuer diese Woche
                </p>
                <button
                  onClick={openNewModal}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" />
                  Neuer Einsatz
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">
                    {editingAssignment ? "Einsatz bearbeiten" : "Neuer Einsatz"}
                  </h2>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-4">
                {/* Worker name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Mitarbeiter <span className="text-destructive">*</span>
                  </label>
                  <input
                    list="workers-list"
                    value={form.worker_name}
                    onChange={(e) => setForm({ ...form, worker_name: e.target.value })}
                    placeholder="Name des Mitarbeiters"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <datalist id="workers-list">
                    {workers.map((w) => (
                      <option key={w} value={w} />
                    ))}
                  </datalist>
                </div>

                {/* Job title */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Aufgabe / Auftrag <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="z.B. Badezimmer fliesen, Dachrinne reinigen..."
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Datum <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.assignment_date}
                    onChange={(e) => setForm({ ...form, assignment_date: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Times */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Von (optional)
                    </label>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Bis (optional)
                    </label>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Einsatzort (optional)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="Adresse oder Beschreibung"
                      className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Farbe
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        title={c.label}
                        onClick={() => setForm({ ...form, color: c.value })}
                        className={cn(
                          "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                          form.color === c.value ? "border-foreground scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-7 h-7 rounded-full border border-border cursor-pointer bg-transparent"
                      title="Benutzerdefinierte Farbe"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Beschreibung (optional)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Detaillierte Beschreibung des Auftrags..."
                    rows={3}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Notizen (optional)
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Interne Notizen..."
                    rows={2}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                <div>
                  {editingAssignment && (
                    <button
                      onClick={() => handleDelete(editingAssignment.id)}
                      className="px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      Loeschen
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.worker_name.trim() || !form.title.trim() || !form.assignment_date}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Calendar className="w-4 h-4" />
                    )}
                    {editingAssignment ? "Speichern" : "Einsatz anlegen"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthGuard>
    </MobileNavProvider>
  );
}
