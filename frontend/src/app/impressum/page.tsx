import Link from 'next/link'
import { HardHat } from 'lucide-react'

export const metadata = { title: 'Impressum' }

export default function ImpressumPage() {
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

      <main className="max-w-4xl mx-auto px-6 py-12 prose prose-invert max-w-none">
        <h1 className="text-3xl font-bold text-foreground mb-8">Impressum</h1>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">Angaben gemäß § 5 TMG</h2>
            <div className="bg-card border border-border rounded-xl p-6 text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">HandwerkerBrief</p>
              <p>Musterstraße 1</p>
              <p>12345 Musterstadt</p>
              <p>Deutschland</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Kontakt</h2>
            <div className="bg-card border border-border rounded-xl p-6 text-muted-foreground space-y-1">
              <p>E-Mail: <a href="mailto:info@handwerkerbrief.de" className="text-primary hover:underline">info@handwerkerbrief.de</a></p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Haftung für Inhalte</h2>
            <p className="text-muted-foreground leading-relaxed">
              Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Haftung für Links</h2>
            <p className="text-muted-foreground leading-relaxed">
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Urheberrecht</h2>
            <p className="text-muted-foreground leading-relaxed">
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            </p>
          </section>
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
