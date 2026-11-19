// A long, invented roadmap for checking the roadmap page as it grows: 10
// releases and 30 items spread unevenly (3 now, none next, 19 later, 8
// ideas), with short and long descriptions. Loaded only by the dev server at
// /roadmap/?fixture=large; production builds leave it out. Not real plans.
import type { Column, RoadmapItem } from '../../app/utils/roadmap-items'

const REPO = 'https://github.com/akojif/painfold'
const SHORT = { en: 'A short invented description.', de: 'Eine kurze erfundene Beschreibung.' }
const LONG = {
  en: 'An invented description that runs long on purpose, to check that the first line is cut cleanly, that the rest appears in place when asked, and that nothing overflows the card on a narrow phone screen.',
  de: 'Eine absichtlich lange erfundene Beschreibung, um zu prüfen, dass die erste Zeile sauber abgeschnitten wird, der Rest auf Wunsch an Ort und Stelle erscheint und auf einem schmalen Handybildschirm nichts über die Karte hinausragt.',
}

const releases: RoadmapItem[] = Array.from({ length: 10 }, (_, index) => ({
  id: `fixtureRelease${index + 1}`,
  status: 'released',
  horizon: 'released',
  version: `v0.${index + 1}.0`,
  released: `2026-${String(index + 1).padStart(2, '0')}-15`,
  link: { kind: 'release', label: `v0.${index + 1}.0`, url: `${REPO}/releases` },
}))

const spread: Array<[Column, number]> = [['now', 3], ['next', 0], ['later', 19], ['idea', 8]]
const ahead: RoadmapItem[] = spread.flatMap(([column, count]) => Array.from({ length: count }, (_, index) => ({
  id: `fixture${column}${index + 1}`,
  status: column === 'now' ? 'inProgress' as const : column === 'idea' ? 'idea' as const : 'planned' as const,
  horizon: column,
  ...(index % 3 === 0 ? { version: `v${index + 2}.0` } : {}),
  link: { kind: 'issue' as const, label: `#${900 + index}`, url: `${REPO}/issues` },
})))

export const items: readonly RoadmapItem[] = [...releases, ...ahead]

const text = (lang: 'en' | 'de') => Object.fromEntries(items.map((item, index) => [item.id, {
  name: `${lang === 'en' ? 'Invented item' : 'Erfundener Eintrag'} ${index + 1}${index % 4 === 0 ? (lang === 'en' ? ' with a much longer name than usual' : ' mit einem viel längeren Namen als üblich') : ''}`,
  summary: index % 2 === 0 ? LONG[lang] : SHORT[lang],
}]))

export const messages = { en: { roadmap: { items: text('en') } }, de: { roadmap: { items: text('de') } } }
