// Long feedback texts for checking that names are found wherever they are, not
// only in the first few hundred words the name model reads at once. Each text
// is far longer than that (about 1,500 model tokens, so the middle name is past the first 512) and holds three names:
// near the start, in the middle and in the last sentence. The names are
// invented combinations of common first names and surnames, as in names.ts;
// the other sentences are ordinary support feedback without personal data.
//
// Some texts are written as paragraphs, some as one block, so both ways of
// cutting a long text are exercised. This set is only reported, never used to
// tune the detectors.
import type { Lang } from './values.ts'

const NEUTRAL: Record<Lang, string[]> = {
  de: [
    'Seit dem letzten Update dauert der Export deutlich länger als früher.',
    'Bei großen Dateien bricht der Upload manchmal ohne Fehlermeldung ab.',
    'Die neue Übersicht gefällt mir grundsätzlich gut, sie ist aber etwas unübersichtlich.',
    'Wir nutzen die App täglich im Team, vor allem für die Zeiterfassung.',
    'Die Rechnungen werden korrekt erstellt, nur das Datumsformat stimmt nicht immer.',
    'Auf dem Tablet ist die Schrift in den Tabellen leider sehr klein.',
    'Es wäre hilfreich, wenn man Berichte als PDF und als Excel speichern könnte.',
    'Die Suche findet ältere Projekte nur, wenn man den genauen Namen eingibt.',
    'Nach dem Login sehe ich manchmal kurz eine leere Seite.',
    'Die Benachrichtigungen kommen inzwischen zuverlässig an, danke dafür.',
    'Beim Wechsel zwischen Monaten springt die Ansicht wieder nach oben.',
    'Unsere Buchhaltung braucht die Stunden pro Kunde und pro Monat getrennt.',
    'Das Onboarding für neue Kolleginnen und Kollegen hat gut funktioniert.',
    'Die Preise sind fair, aber das Jahresabo sollte monatlich kündbar sein.',
    'Wenn das Netz schwach ist, gehen manchmal Einträge verloren.',
    'Der Dunkelmodus ist angenehm, die Diagramme sind darin aber schlecht lesbar.',
    'Wir hätten gerne eine Möglichkeit, Vorlagen für wiederkehrende Aufgaben anzulegen.',
    'Die Importfunktion erkennt Semikolons als Trennzeichen nicht immer.',
    'Seit der Umstellung sind die Ladezeiten am Vormittag spürbar länger.',
    'Die Hilfeartikel sind verständlich geschrieben, aber schwer zu finden.',
  ],
  en: [
    'Since the last update the export takes much longer than it used to.',
    'With large files the upload sometimes stops without any error message.',
    'I like the new overview in general, but it feels a bit cluttered.',
    'We use the app every day as a team, mostly for tracking time.',
    'Invoices are created correctly, only the date format is sometimes wrong.',
    'On the tablet the text in the tables is far too small to read.',
    'It would help if reports could be saved as both PDF and Excel.',
    'Search only finds older projects when you type the exact name.',
    'After logging in I sometimes see a blank page for a few seconds.',
    'Notifications arrive reliably now, thank you for fixing that.',
    'When switching between months the view jumps back to the top.',
    'Our accountants need the hours per client and per month separately.',
    'Onboarding for new colleagues went smoothly and was easy to follow.',
    'The prices are fair, but the yearly plan should be cancellable monthly.',
    'When the connection is weak some entries get lost.',
    'Dark mode is pleasant, but the charts are hard to read in it.',
    'We would like a way to create templates for recurring tasks.',
    'The import does not always recognise semicolons as separators.',
    'Since the change, loading times in the morning are noticeably longer.',
    'The help articles are clearly written but hard to find.',
  ],
}

// Three name sentences per text: early, middle and late.
const NAMES: Record<Lang, Array<[string, string, string]>> = {
  de: [
    ['Ich schreibe im Namen von [[NAME:Theresa Brandner]] aus der Buchhaltung.', 'Gestern hat [[NAME:Mehmet Aydın]] aus [[PLACE:Wels]] dasselbe gemeldet.', 'Bei Fragen erreichen Sie mich gerne, viele Grüße, [[NAME:Johanna Leitgeb]]'],
    ['Mein Kollege [[NAME:Dragan Petrović]] hat das Problem zuerst bemerkt.', 'Auch [[NAME:Oksana Kovalenko]] aus unserem Büro in [[PLACE:Graz]] kann es nachstellen.', 'Danke im Voraus und liebe Grüße, [[NAME:Florian Wimmer]]'],
    ['Hallo, hier schreibt [[NAME:Amira Haddad]] vom Empfang.', 'Laut [[NAME:Kwame Mensah]] passiert es nur am Vormittag.', 'Bitte melden Sie sich bei [[NAME:Katarzyna Nowak]], sie kümmert sich um die Verträge.'],
    ['Wir haben das mit [[NAME:Gerhard Steiner]] besprochen.', 'Die Kollegin [[NAME:Priya Sharma]] in [[PLACE:Linz]] sieht denselben Fehler.', 'Mit freundlichen Grüßen, [[NAME:Ioana Popescu]]'],
  ],
  en: [
    ['I am writing on behalf of [[NAME:Eleanor Whitcombe]] from accounts.', 'Yesterday [[NAME:Yusuf Demir]] from our office in [[PLACE:Leeds]] reported the same thing.', 'Happy to help if you have questions. Best regards, [[NAME:Thomas Ashworth]]'],
    ['My colleague [[NAME:Milan Horvat]] noticed the problem first.', '[[NAME:Nadia Rahimi]] in [[PLACE:Manchester]] can reproduce it as well.', 'Thanks in advance, [[NAME:Grace Pemberton]]'],
    ['Hi, this is [[NAME:Hassan Al-Amin]] from the front desk.', 'According to [[NAME:Chiamaka Okafor]] it only happens in the morning.', 'Please get in touch with [[NAME:Zsófia Kertész]], who handles the contracts.'],
    ['We discussed this with [[NAME:Oliver Hartfield]] last week.', 'Our colleague [[NAME:Liu Wei]] in [[PLACE:Bristol]] sees the same error.', 'Kind regards, [[NAME:Andreea Ionescu]]'],
  ],
}

/** Neutral sentences for text i, starting at a different sentence each time, so the texts differ. */
function neutral(lang: Lang, i: number, offset: number, count: number): string[] {
  const all = NEUTRAL[lang]
  return Array.from({ length: count }, (_, k) => all[(i * 7 + offset + k) % all.length]!)
}

/** One long text: a name early, forty neutral sentences, a name in the middle, forty more, a name last. */
function longText(lang: Lang, i: number): string {
  const [early, middle, late] = NAMES[lang][i]!
  const first = [early, ...neutral(lang, i, 0, 40)]
  const second = [middle, ...neutral(lang, i, 40, 40)]
  // Even texts as paragraphs, odd ones as one block.
  const join = (sentences: string[]) => sentences.join(' ')
  return i % 2 === 0 ? [join(first), join(second), late].join('\n\n') : join([...first, ...second, late])
}

export const LONG_TEXT_CASES: Array<{ lang: Lang, source: string }> = (['de', 'en'] as const).flatMap(lang =>
  NAMES[lang].map((_, i) => ({ lang, source: longText(lang, i) })))
