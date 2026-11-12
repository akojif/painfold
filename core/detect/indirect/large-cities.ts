// Cities with 100,000 or more residents. A common job title next to one of
// them ("Lehrerin in Graz") is not identifying, so it does not warn; next to
// any other place ("Steuerberaterin in Wels") it does. Unique roles (a mayor,
// a bishop) warn whatever the place (roles.ts).
//
// A place that is not on these lists warns, so a missing city only adds a
// warning; it never hides one. Cities in other countries are not listed yet.
//
// Sources:
// - Austria: Statistik Austria, "Zahlen Daten Fakten Österreich 24/25", table
//   "Die sechs größten und die sechs kleinsten Gemeinden", population at the
//   start of 2024 (Statistik des Bevölkerungsstandes). Exactly six
//   municipalities are above 100,000: Wien 2,005,760, Graz 302,749, Linz
//   211,944, Salzburg 157,399, Innsbruck 132,188, Klagenfurt 104,866. Checked
//   on 2026-11-12.
// - Germany: Statistisches Bundesamt (Destatis), Gemeindeverzeichnis-
//   Informationssystem, "Gemeinden in Deutschland nach Fläche, Bevölkerung und
//   Postleitzahl am 31.12.2025", population based on the 2022 census. 79
//   municipalities are above 100,000, from Berlin (3,700,577) to
//   Kaiserslautern (100,247). Checked on 2026-11-12.
// Re-check both when a new year's figures are published; a city near the
// threshold (Klagenfurt, Kaiserslautern) can cross it.

const AUSTRIA = ['Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Klagenfurt am Wörthersee']

const GERMANY = [
  'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Frankfurt', 'Düsseldorf', 'Leipzig', 'Stuttgart',
  'Dortmund', 'Bremen', 'Essen', 'Dresden', 'Nürnberg', 'Hannover', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld',
  'Bonn', 'Mannheim', 'Karlsruhe', 'Münster', 'Augsburg', 'Wiesbaden', 'Mönchengladbach', 'Gelsenkirchen', 'Aachen',
  'Braunschweig', 'Kiel', 'Chemnitz', 'Magdeburg', 'Freiburg im Breisgau', 'Freiburg', 'Krefeld', 'Halle (Saale)',
  'Halle', 'Mainz', 'Erfurt', 'Lübeck', 'Oberhausen', 'Rostock', 'Kassel', 'Hagen', 'Potsdam', 'Saarbrücken', 'Hamm',
  'Oldenburg', 'Ludwigshafen am Rhein', 'Ludwigshafen', 'Mülheim an der Ruhr', 'Mülheim', 'Leverkusen', 'Darmstadt',
  'Osnabrück', 'Solingen', 'Herne', 'Heidelberg', 'Paderborn', 'Neuss', 'Regensburg', 'Ingolstadt', 'Pforzheim',
  'Würzburg', 'Offenbach am Main', 'Offenbach', 'Heilbronn', 'Fürth', 'Göttingen', 'Ulm', 'Wolfsburg', 'Reutlingen',
  'Bremerhaven', 'Bottrop', 'Erlangen', 'Recklinghausen', 'Remscheid', 'Koblenz', 'Bergisch Gladbach', 'Jena', 'Trier',
  'Salzgitter', 'Siegen', 'Moers', 'Kaiserslautern',
]

// English names people write in English feedback.
const ENGLISH_NAMES = ['Vienna', 'Munich', 'Cologne', 'Nuremberg', 'Hanover', 'Brunswick']

const normalise = (place: string) => place.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

const LARGE = new Set([...AUSTRIA, ...GERMANY, ...ENGLISH_NAMES].map(normalise))

/** Whether a place, as written, is one of the listed cities with 100,000 or more residents. */
export function isLargeCity(place: string): boolean {
  return LARGE.has(normalise(place))
}
