"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { HardHat, Check, AlertCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Kein Verifizierungstoken gefunden.");
      return;
    }

    api.get(`/api/auth/verify-email?token=${token}`)
      .then(() => {
        setStatus("success");
        setMessage("Ihre E-Mail-Adresse wurde erfolgreich bestätigt.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.detail || "Verifizierung fehlgeschlagen. Der Link ist möglicherweise abgelaufen.");
      });
  }, [token]);

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
          <p className="text-sm text-muted-foreground mt-1">E-Mail Verifizierung</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl text-center">
          {status === "loading" && (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <p className="text-muted-foreground text-sm">Verifizierung läuft...</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">E-Mail bestätigt!</h2>
              <p className="text-muted-foreground text-sm">{message}</p>
              <Link
                href="/login"
                className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold text-center hover:bg-primary/90 transition-colors mt-2"
              >
                Jetzt anmelden
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Verifizierung fehlgeschlagen</h2>
              <p className="text-muted-foreground text-sm">{message}</p>
              <Link
                href="/login"
                className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold text-center hover:bg-primary/90 transition-colors mt-2"
              >
                Zur Anmeldung
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
