import { CalendarCheck, CheckCircle2, Circle, Clock3, PackageCheck, Sparkles, Truck } from "lucide-react";

const milestones = [
  { date: "30. aug.", title: "Forberedelse", detail: "Sjekkliste, dokumenter og måleverktøy klare", icon: PackageCheck, state: "active" },
  { date: "1. sep. 10:00", title: "Ferdigbefaring", detail: "Rom-for-rom kontroll og dokumentasjon", icon: CalendarCheck, state: "next" },
  { date: "17. sep. 10:00", title: "Overtagelse", detail: "Nøkler, protokoll og måleravlesning", icon: CheckCircle2, state: "future" },
  { date: "24.-30. sep.", title: "Klargjør Ballerud", detail: "Innkjøp, montering og innflyttingsklart hjem", icon: Sparkles, state: "future" },
  { date: "1. okt. 12:00", title: "Overtagelse Silurveien 8A", detail: "Utvask, nøkkeloverlevering og sluttkontroll", icon: Truck, state: "future" }
] as const;

const activities = [
  ["Sjekk ferdigbefaring", "Lad telefon, ta med målebånd, lader og åpne Ballerud-sjekklisten.", "1. sep. 09:30", "Young og Vilde", "Ikke startet"],
  ["Send befaringstilbakemelding", "Oppsummer observasjoner og send dokumentasjon til utbygger etter befaring.", "2. sep.", "Young", "Ikke startet"],
  ["Bestill løsning under trapp", "Bruk registrerte mål, avklar strøm og velg leverandør for plassbygget løsning.", "5. sep.", "Vilde", "Ikke startet"],
  ["Bestill hvitevarer og montering", "Bekreft modell, leveringstid, tilkobling og innbæring før overtagelse.", "8. sep.", "Young", "Ikke startet"],
  ["Pakk: sjelden brukt", "Bøker, dekor, sesongtøy, bod, gjesterom og alt som ikke trengs før overtagelse.", "10. sep.", "Begge", "Ikke startet"],
  ["Planlegg utvask Silurveien", "Bestill vask eller fordel rom, kjøp utstyr og avtal tidspunkt for sluttkontroll.", "12. sep.", "Vilde", "Ikke startet"],
  ["Før overtagelse", "Bestill internett, forsikring, adresseendring og strømflytting. Avklar nøkler og målere.", "16. sep.", "Young", "Ikke startet"],
  ["Overtagelse Ballerud", "Gå gjennom protokoll, dokumenter målerstand og motta alle nøkler.", "17. sep. 10:00", "Begge", "Milepæl"],
  ["Pakk: dagligvarer og kjøkken", "Pakk det som brukes daglig etter overtagelse, men behold flytteeske for første døgn separat.", "18.-22. sep.", "Begge", "Ikke startet"],
  ["Klargjør Ballerud", "Monter hvitevarer, innkjøp av lamper og praktisk interiør, og plasser det viktigste før flytting.", "24.-30. sep.", "Begge", "Ikke startet"],
  ["Utvask og utflytting", "Tøm bod, vask leiligheten, fotografer tilstand og klargjør nøkler til Silurveien 8A.", "29.-30. sep.", "Begge", "Ikke startet"],
  ["Overtagelse Silurveien 8A", "Sluttkontroll og overlevering av leiligheten.", "1. okt. 12:00", "Begge", "Milepæl"]
] as const;

export function PlanAndActivities() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="border-b border-slate-200 pb-5"><p className="text-sm font-semibold text-primary">Ballerud Hageby, rekkehus 111</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Plan og aktiviteter</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Prioritert fremdrift fra i dag til hjemmet er klart før flytting og dagens leilighet er overlevert.</p></header>
      <section className="mt-6" aria-labelledby="timeline-title"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary" /><h2 id="timeline-title" className="text-lg font-bold text-slate-900">Fremdriftsplan</h2></div><ol className="mt-5 grid gap-3 md:grid-cols-5">{milestones.map((milestone) => { const Icon = milestone.icon; return <li key={milestone.title} className={`border-l-4 bg-white p-4 shadow-sm ${milestone.state === "active" ? "border-primary" : "border-slate-200"}`}><Icon className={`h-5 w-5 ${milestone.state === "active" ? "text-primary" : "text-slate-500"}`} /><p className="mt-3 text-xs font-bold text-primary">{milestone.date}</p><h3 className="mt-1 text-sm font-bold text-slate-900">{milestone.title}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{milestone.detail}</p></li>; })}</ol></section>
      <section className="mt-8" aria-labelledby="activities-title"><h2 id="activities-title" className="text-lg font-bold text-slate-900">Aktiviteter</h2><div className="mt-3 overflow-x-auto border border-slate-200 bg-white shadow-sm"><table className="min-w-[780px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Aktivitet</th><th className="px-4 py-3">Beskrivelse</th><th className="px-4 py-3">Frist</th><th className="px-4 py-3">Ansvarlig</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{activities.map(([name, description, deadline, owner, status]) => <tr key={name} className="border-t border-slate-100 align-top"><td className="px-4 py-3 font-semibold text-slate-900">{name}</td><td className="max-w-md px-4 py-3 leading-5 text-slate-600">{description}</td><td className="whitespace-nowrap px-4 py-3 text-slate-700">{deadline}</td><td className="whitespace-nowrap px-4 py-3 text-slate-700">{owner}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-xs font-semibold ${status === "Milepæl" ? "text-primary" : "text-slate-600"}`}>{status === "Milepæl" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}{status}</span></td></tr>)}</tbody></table></div></section>
    </main>
  );
}