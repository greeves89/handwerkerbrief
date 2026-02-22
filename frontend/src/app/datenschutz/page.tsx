import Link from 'next/link'
import { HardHat } from 'lucide-react'

export const metadata = { title: 'Datenschutzerklärung' }

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <HardHat className="w-6 h-6 text-primary" />
            <span className="font-bold text-foreground">HandwerkerBrief</span>
          </Link>
          <Link href="/login" className="text-sm text-primary hover:underline">Anmelden</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-8">Datenschutzerklärung</h1>

        <div className="space-y-8 text-foreground">
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">1. Verantwortlicher</h2>
            <p className="text-muted-foreground leading-relaxed">
              Verantwortlicher im Sinne der DSGVO ist: HandwerkerBrief, Musterstraße 1, 12345 Musterstadt, E-Mail: info@handwerkerbrief.de
            </p>
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">2. Erhebung und Verarbeitung personenbezogener Daten</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Wir erheben und verarbeiten folgende personenbezogene Daten:
            </p>
            <ul className="text-muted-foreground space-y-1 list-disc list-inside">
              <li>Name und E-Mail-Adresse (bei Registrierung)</li>
              <li>Firmenname (optional)</li>
              <li>Kundendaten (von Ihnen erfasste Kunden und Projekte)</li>
              <li>Angebots- und Rechnungsdaten</li>
              <li>Zahlungsinformationen (verarbeitet über Stripe, wir speichern keine Kartendaten)</li>
            </ul>
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">3. Zweck der Verarbeitung</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ihre Daten werden ausschließlich zur Bereitstellung der HandwerkerBrief-Dienste verarbeitet: Rechnungsverwaltung, Angebotserstellung und Zahlungsabwicklung. Eine Weitergabe an Dritte erfolgt nicht, außer soweit gesetzlich erforderlich.
            </p>
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">4. Rechtsgrundlage</h2>
            <p className="text-muted-foreground leading-relaxed">
              Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch Registrierung).
            </p>
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">5. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Wir verwenden technisch notwendige Cookies für die Authentifizierung (JWT-Token als httpOnly Cookie). Diese Cookies sind für den Betrieb der Anwendung zwingend erforderlich und können nicht deaktiviert werden. Es werden keine Tracking- oder Werbe-Cookies eingesetzt.
            </p>
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">6. Speicherdauer</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ihre Daten werden gespeichert, solange Ihr Konto aktiv ist. Bei Kontolöschung werden alle personenbezogenen Daten unverzüglich gelöscht.
            </p>
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">7. Ihre Rechte (DSGVO)</h2>
            <ul className="text-muted-foreground space-y-2 list-disc list-inside">
              <li><strong className="text-foreground">Auskunftsrecht</strong> (Art. 15 DSGVO): Datenexport in den Einstellungen</li>
              <li><strong className="text-foreground">Recht auf Löschung</strong> (Art. 17 DSGVO): Kontolöschung in den Einstellungen</li>
              <li><strong className="text-foreground">Recht auf Berichtigung</strong> (Art. 16 DSGVO): Profilbearbeitung in den Einstellungen</li>
              <li><strong className="text-foreground">Recht auf Datenübertragbarkeit</strong> (Art. 20 DSGVO): JSON-Export in den Einstellungen</li>
              <li><strong className="text-foreground">Beschwerderecht</strong>: Bei der zuständigen Datenschutzbehörde</li>
            </ul>
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">8. Zahlungsdienstleister</h2>
            <p className="text-muted-foreground leading-relaxed">
              Premium-Abonnements werden über Stripe, Inc. (354 Oyster Point Blvd, South San Francisco, CA 94080, USA) abgewickelt. Stripe ist nach EU-US Data Privacy Framework zertifiziert. Datenschutzerklärung: <a href="https://stripe.com/de/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">stripe.com/de/privacy</a>
            </p>
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-3">9. Kontakt Datenschutz</h2>
            <p className="text-muted-foreground leading-relaxed">
              Bei Fragen zum Datenschutz: <a href="mailto:datenschutz@handwerkerbrief.de" className="text-primary hover:underline">datenschutz@handwerkerbrief.de</a>
            </p>
          </section>

          <p className="text-muted-foreground text-sm">Stand: Februar 2026</p>
        </div>
      </main>

      <footer className="border-t border-border mt-12">
        <div className="max-w-4xl mx-auto px-6 py-6 flex gap-6 text-sm text-muted-foreground">
          <Link href="/impressum" className="hover:text-foreground">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-foreground">Datenschutz</Link>
          <Link href="/agb" className="hover:text-foreground">AGB</Link>
        </div>
      </footer>
    </div>
  )
}
