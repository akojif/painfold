// Hand-written edge cases for the evaluation set, in the same [[TYPE:value]]
// markup. Text that is not marked must not be detected: these cases check for
// false positives as much as for misses. Every value is fake (see values.ts).
import type { Lang } from './values.ts'

export const HARD_CASES: Array<{ lang: Lang, source: string }> = [
  // Emails
  { lang: 'de', source: 'Schreiben Sie an [[EMAIL:anna.feldmoser@example.com]].' },
  { lang: 'en', source: 'Reach me at <[[EMAIL:j.dunmore@mail.example.com]]>, not the old address.' },
  { lang: 'de', source: 'Kontakt: [[EMAIL:Sabine.Weidenauer@Example.org]]; bitte nicht an info@ schreiben.' },
  { lang: 'en', source: 'Email me at [[EMAIL:olivia (at) example (dot) net]] if the form fails.' },
  { lang: 'de', source: 'Die Adresse [[EMAIL:felix+rechnungen@example.net]] bitte für alle Belege verwenden.' },
  { lang: 'en', source: 'The @mention feature doesn\'t notify @team members.' },

  // Phone numbers and look-alikes
  { lang: 'de', source: 'Erreichbar unter [[PHONE:+43 (0) 664 000 12 34]] ab 9 Uhr.' },
  { lang: 'de', source: 'Tel. [[PHONE:030/23125-417]], Fax gibt es keines.' },
  { lang: 'en', source: 'Call [[PHONE:+44 7700 900 461]] or text [[PHONE:07700900462]].' },
  { lang: 'de', source: 'Bestellnummer 4711-0815-2231 ist immer noch offen.' },
  { lang: 'de', source: 'Rechnung RE-2026-000417 über € 1.299,00 wurde am 12.03.2026 bezahlt.' },
  { lang: 'en', source: 'Our order 20 553 1820 shipped on 3 March, tracking 1Z 999 AA1 01 2345 6784.' },
  { lang: 'de', source: 'Wir haben 2023 bis 2026 rund 14000 Rechnungen erstellt.' },
  { lang: 'en', source: 'Opening hours are 08:30 to 17:00, Monday to Friday.' },

  // IBANs and look-alikes
  { lang: 'de', source: 'Neue Bankverbindung: [[IBAN:AT61 1904 3002 3457 3201]].' },
  { lang: 'de', source: 'IBAN [[IBAN:DE89370400440532013000]] (ohne Leerzeichen kopiert).' },
  { lang: 'de', source: 'Bitte nicht auf AT61 1904 3002 3457 3202 überweisen, da fehlt eine Ziffer.' },
  { lang: 'en', source: 'Refund to [[IBAN:de89 3704 0044 0532 0130 00]] please, lower case from my banking app.' },

  // Cards and look-alikes
  { lang: 'en', source: 'Card [[CARD:4111-1111-1111-1111]] expired last month.' },
  { lang: 'de', source: 'Amex [[CARD:3782 822463 10005]] wurde abgelehnt.' },
  { lang: 'en', source: 'The number 4111 1111 1111 1112 is not a card, it\'s our internal batch ID.' },
  { lang: 'en', source: 'Ticket 1234567890123456 was closed without a reply.' },

  // SV-Nummer, VAT IDs
  { lang: 'de', source: 'Meine Sozialversicherungsnummer ist [[SVNR:1237 010180]].' },
  { lang: 'de', source: 'SV-Nr. [[SVNR:1237010180]] für die Lohnverrechnung.' },
  { lang: 'de', source: 'Die Kundennummer 1238 010180 hat nichts mit der Versicherung zu tun.' },
  // Ten-digit order and invoice numbers whose digits pass the SV-Nummer check digit.
  { lang: 'de', source: 'Rechnung 4711190056 wurde doppelt abgebucht.' },
  { lang: 'de', source: 'Bestell-Nr. 4711253408 ist nie angekommen.' },
  { lang: 'de', source: 'Auftrag 4711514735 vom 4. März ist noch offen.' },
  { lang: 'de', source: 'Kunden-Nr. 4711546411, bitte bei Rückfragen angeben.' },
  { lang: 'en', source: 'Order 4711229651 was shipped twice.' },
  { lang: 'en', source: 'Invoice no. 4711451383 shows the wrong amount.' },
  { lang: 'de', source: 'UID [[VAT_ID:ATU13585627]] fehlt auf der Rechnung.' },
  { lang: 'de', source: 'USt-IdNr. [[VAT_ID:DE136695976]], bitte übernehmen.' },
  { lang: 'en', source: 'ATU13585628 was rejected by the VIES check, so it is probably a typo.' },

  // URLs and IP addresses
  { lang: 'en', source: 'My invoice link: [[URL:https://example.com/i/88213?token=ab12cd]].' },
  { lang: 'de', source: 'Siehe [[URL:www.example.org/rechnung/88213]], da ist der Fehler.' },
  { lang: 'en', source: 'Version 2.14.3.1 crashes on start.' },
  { lang: 'en', source: 'Our office IP is [[IP:203.0.113.42]] if you need to whitelist it.' },
  { lang: 'en', source: 'Connection from [[IP:2001:db8::8a2e:370:7334]] was blocked.' },
  { lang: 'de', source: 'Das Problem tritt seit 1.2.2026 auf, Version 4.0.1.' },

  // Dates of birth and ordinary dates
  { lang: 'de', source: 'Geburtsdatum [[DATE_OF_BIRTH:03.07.1988]], Eintritt am 01.09.2024.' },
  { lang: 'de', source: 'Ich (geb. [[DATE_OF_BIRTH:14.2.1979]]) bin seit 2019 Kunde.' },
  { lang: 'en', source: 'Born [[DATE_OF_BIRTH:21 July 1985]], member since March 2020.' },
  { lang: 'en', source: 'The invoice dated 21/07/2025 is missing from the export.' },
  { lang: 'de', source: 'Kündigung zum 31.12.2026, Vertrag seit 01.01.2021.' },

  // Addresses, postcodes and numbers that look like them
  { lang: 'de', source: 'Neue Adresse: [[ADDRESS:Mariahilfer Straße 45/3]], [[POSTCODE:1060]] [[PLACE:Wien]].' },
  { lang: 'de', source: 'Lieferung an [[ADDRESS:Hauptplatz 7]] in [[POSTCODE:4020]] [[PLACE:Linz]].' },
  { lang: 'en', source: 'Ship to [[ADDRESS:27 Willow Lane]], [[PLACE:Bristol]] [[POSTCODE:BS1 4DJ]].' },
  { lang: 'de', source: 'Wir haben 1070 Rechnungen im Jahr und 4020 Buchungszeilen.' },

  // Names and places (Stage 2), mixed language, nothing personal
  { lang: 'de', source: 'Frau [[NAME:Theresa Haselsteiner]] aus [[PLACE:Wels]] hat das gemeldet.' },
  { lang: 'en', source: 'Thanks to [[NAME:Grace]] from your support team.' },
  { lang: 'de', source: 'Feature request: export für unseren Steuerberater as Excel, bitte.' },
  { lang: 'en', source: 'Works fine. No complaints.' },
]
