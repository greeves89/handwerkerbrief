"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HardHat, Mail, AlertCircle, Check } from "lucide-react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await api.post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
            <HardHat className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">HandwerkerBrief</h1>
          <p className="text-sm text-muted-foreground mt-1">Passwort zurücksetzen</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">E-Mail gesendet</h2>
              <p className="text-muted-foreground text-sm">
                Falls ein Konto mit <strong>{email}</strong> existiert, haben wir einen Link zum Zurücksetzen gesendet. Bitte prüfen Sie Ihren Posteingang.
              </p>
              <Link
                href="/login"
                className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold text-center hover:bg-primary/90 transition-colors mt-4"
              >
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-1">Passwort vergessen?</h2>
              <p className="text-muted-foreground text-sm mb-5">
                Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Reset-Link.
              </p>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">E-Mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="ihre@email.de"
                      className="w-full pl-10 pr-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? "Wird gesendet..." : "Reset-Link senden"}
                </button>
              </form>

              <p className="text-center text-xs text-muted-foreground mt-4">
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Zurück zur Anmeldung
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
