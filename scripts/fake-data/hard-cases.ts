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

  // Messy real-world forms: how people actually write, paste and forward data.
  // Emails: mailto links, quoted replies, capitals, a missing space after the full stop.
  { lang: 'de', source: 'Bitte an <a href="mailto:[[EMAIL:lena.gruber@example.com]]">[[NAME:Lena]]</a> weiterleiten.' },
  { lang: 'en', source: 'Sent from my iPhone\n\n> On 3 Mar 2026, at 09:14, [[EMAIL:m.okonkwo@example.org]] wrote:\n> The export is broken.' },
  { lang: 'en', source: 'EMAIL: [[EMAIL:MARK.OKONKWO@EXAMPLE.ORG]] (please update)' },
  { lang: 'de', source: 'Antwort bitte an [[EMAIL:anna.feldmoser@example.com]].Danke!' },
  { lang: 'en', source: 'Write to [[EMAIL:j.dunmore AT example DOT net]], the form eats my messages.' },

  // Phone numbers: 00 and (0) prefixes, slashes, extensions, non-breaking spaces.
  { lang: 'de', source: 'Rückruf bitte unter [[PHONE:0043 664 1234567]], ich bin den ganzen Tag erreichbar.' },
  { lang: 'de', source: 'Tel.: [[PHONE:+49 (0)30 23125-418]]' },
  { lang: 'de', source: 'mobil [[PHONE:0664/2345678]] oder per Mail' },
  { lang: 'en', source: 'ph. [[PHONE:020 7946 0321]] ext. 12' },
  { lang: 'de', source: 'Handy: [[PHONE:+43 676 123 45 67]] (abends)' },
  { lang: 'en', source: 'Call me on [[PHONE:+44 (0) 7700 900 123]] before noon.' },
  { lang: 'de', source: 'Tel.\u00A0[[PHONE:030\u00A023125\u00A0419]] (Zentrale)' },
  // Numbers that are not phone numbers.
  { lang: 'de', source: 'Zeitraum 2025-01-01 bis 2025-12-31, Belegnummer 2025-000417.' },
  { lang: 'de', source: 'Betrag: EUR 1.234.567,89 brutto, fällig am 15.04.2026.' },
  { lang: 'en', source: 'Build 20260312.1422 failed on the CI server.' },
  { lang: 'de', source: 'ISBN 978-3-16-148410-0 steht falsch im Literaturverzeichnis.' },
  { lang: 'de', source: 'EAN 4006381333931 ist im Katalog doppelt.' },

  // IBANs, cards, SV-Nummern and VAT IDs written with dashes, dots or without spaces.
  { lang: 'de', source: 'IBAN: [[IBAN:AT61-1904-3002-3457-3201]]' },
  { lang: 'de', source: 'Konto: [[IBAN:DE89 3704 0044 0532 0130 00]], BIC COBADEFFXXX' },
  { lang: 'de', source: 'Kreditkarte [[CARD:5555.5555.5555.4444]] bitte löschen.' },
  { lang: 'en', source: 'Visa [[CARD:4111 1111 1111 1111]], exp 04/27, please remove it from my account.' },
  { lang: 'de', source: 'SVNR: [[SVNR:1237-010180]]' },
  { lang: 'de', source: 'Versicherungsnr.:[[SVNR:1237010180]] (für die Lohnverrechnung)' },
  { lang: 'de', source: 'UID-Nr.: [[VAT_ID:ATU 13585627]]' },
  { lang: 'en', source: 'VAT [[VAT_ID:DE 136 695 976]] on the invoice is ours.' },

  // URLs and IP addresses inside brackets, before punctuation, with ports.
  { lang: 'en', source: 'The help page (see [[URL:https://example.com/help/export]]) is outdated.' },
  { lang: 'de', source: 'Link: [[URL:https://example.org/a?b=1&c=2]].' },
  { lang: 'en', source: 'Screenshot at [[URL:http://203.0.113.9/upload/x.png]] shows the error.' },
  { lang: 'en', source: 'Requests from [[IP:198.51.100.23]]:8080 time out.' },

  // Dates of birth in other formats, and ordinary dates written the same way.
  { lang: 'de', source: 'geb. am [[DATE_OF_BIRTH:3.7.88]], falls Sie das brauchen' },
  { lang: 'en', source: 'DOB: [[DATE_OF_BIRTH:1985-07-21]]' },
  { lang: 'de', source: 'Geburtsdatum: [[DATE_OF_BIRTH:12. März 1979]]' },
  { lang: 'de', source: 'Termin am 12. März 2026 um 10 Uhr passt.' },

  // Addresses with abbreviations, letters, ranges and flats.
  { lang: 'de', source: 'Adresse: [[ADDRESS:Hauptstr. 5a]], [[POSTCODE:80331]] [[PLACE:München]]' },
  { lang: 'de', source: 'Ich wohne jetzt in der [[ADDRESS:Wiedner Hauptstraße 12/4/9]].' },
  { lang: 'de', source: 'Lieferadresse [[ADDRESS:Am Graben 3-5]], [[POSTCODE:1010]] [[PLACE:Wien]]' },
  { lang: 'en', source: 'Please send it to [[ADDRESS:Flat 2, 14 Market Street]], [[PLACE:Leeds]] [[POSTCODE:LS1 6DT]].' },
  { lang: 'de', source: 'Wir sind auf der Messe in Halle 3, Stand 12.' },

  // Added after the separator fix for IBANs, cards, SV-Nummern and VAT IDs, with
  // values the fix was not written against, to check that it generalises.
  { lang: 'de', source: 'Überweisung bitte auf [[IBAN:AT73-7917-3019-7877-8826]].' },
  { lang: 'en', source: 'iban [[IBAN:at61-4491-2176-6286-4827]] (copied from my bank)' },
  { lang: 'de', source: 'Referenz AT73-7917-3019-7877-8827 aus dem alten System.' },
  { lang: 'en', source: 'Card [[CARD:4012.8888.8888.1881]], please delete it.' },
  { lang: 'de', source: 'MC [[CARD:5105.1051.0510.5100]] wurde abgelehnt.' },
  { lang: 'de', source: 'Seriennummer 4012.8888.8888.1882 steht am Gerät.' },
  { lang: 'de', source: 'SV-Nummer [[SVNR:9076-011073]] für die Anmeldung.' },
  { lang: 'de', source: 'Versicherungsnummer: [[SVNR:9803-150353]]' },
  { lang: 'de', source: 'Vorgang 2024-010106 ist abgeschlossen.' },
  { lang: 'de', source: 'USt-IdNr. [[VAT_ID:DE 735 402 677]] bitte auf die Rechnung.' },
  { lang: 'en', source: 'Our VAT ID is [[VAT_ID:DE 111 840 966]].' },
  { lang: 'de', source: 'UID-Nummer [[VAT_ID:ATU 6133 1053]]' },
  { lang: 'de', source: 'Kundennr. DE 735 402 678 (keine UID)' },
]
