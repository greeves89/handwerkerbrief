import Link from 'next/link'
import { HardHat } from 'lucide-react'

export const metadata = { title: 'AGB' }

export default function AgbPage() {
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
        <h1 className="text-3xl font-bold text-foreground mb-8">Allgemeine Geschäftsbedingungen</h1>

        <div className="space-y-6 text-foreground">
          {[
            {
              title: '§ 1 Geltungsbereich',
              content: 'Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Software-as-a-Service-Plattform HandwerkerBrief. Mit der Registrierung akzeptieren Sie diese Bedingungen.',
            },
            {
              title: '§ 2 Leistungsbeschreibung',
              content: 'HandwerkerBrief bietet eine webbasierte Plattform zur Erstellung professioneller Angebote und Rechnungen für Handwerksbetriebe. Der kostenlose Tarif umfasst bis zu 3 Rechnungen pro Monat. Der Premium-Tarif (0,99 €/Monat) bietet unlimitierte Rechnungen und erweiterte Funktionen.',
            },
            {
              title: '§ 3 Registrierung und Nutzerkonto',
              content: 'Zur Nutzung ist eine Registrierung erforderlich. Der erste registrierte Nutzer erhält Administratorrechte. Sie sind verpflichtet, Ihre Zugangsdaten geheim zu halten. Die Weitergabe an Dritte ist untersagt.',
            },
            {
              title: '§ 4 Vergütung und Zahlung',
              content: 'Der kostenlose Tarif ist dauerhaft kostenlos. Der Premium-Tarif wird monatlich mit 0,99 € abgerechnet. Die Zahlung erfolgt über Stripe. Das Abonnement verlängert sich automatisch und kann jederzeit zum Ende der Laufzeit gekündigt werden.',
            },
            {
              title: '§ 5 Kündigung',
              content: 'Sie können Ihr Konto jederzeit in den Einstellungen löschen. Das Premium-Abonnement kann jederzeit zum Ende des aktuellen Abrechnungszeitraums gekündigt werden. Eine Rückerstattung anteiliger Beträge erfolgt nicht.',
            },
            {
              title: '§ 6 Datenschutz',
              content: 'Die Verarbeitung Ihrer personenbezogenen Daten erfolgt gemäß unserer Datenschutzerklärung und den Bestimmungen der DSGVO.',
            },
            {
              title: '§ 7 Verfügbarkeit',
              content: 'Wir bemühen uns um eine hohe Verfügbarkeit des Dienstes, können jedoch keine 100%ige Verfügbarkeit garantieren. Planmäßige Wartungsarbeiten werden rechtzeitig angekündigt.',
            },
            {
              title: '§ 8 Haftungsbeschränkung',
              content: 'Wir haften nicht für den Verlust von Daten, entgangenen Gewinn oder mittelbare Schäden, sofern kein Vorsatz oder grobe Fahrlässigkeit vorliegt. Die Haftung ist auf den Betrag beschränkt, den Sie in den letzten 12 Monaten bezahlt haben.',
            },
            {
              title: '§ 9 Änderungen der AGB',
              content: 'Wir behalten uns vor, diese AGB zu ändern. Änderungen werden Ihnen per E-Mail mitgeteilt. Widersprechen Sie nicht innerhalb von 4 Wochen, gelten die neuen AGB als akzeptiert.',
            },
            {
              title: '§ 10 Anwendbares Recht',
              content: 'Es gilt deutsches Recht. Gerichtsstand ist Musterstadt.',
            },
          ].map((section) => (
            <section key={section.title} className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{section.content}</p>
            </section>
          ))}

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
