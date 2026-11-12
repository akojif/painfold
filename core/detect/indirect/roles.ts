// Job titles and roles, in German and English, with German feminine and
// gender-inclusive forms ("Lehrer", "Lehrerin", "Lehrer:in", "LehrerIn").
//
// Two kinds:
// - Common job titles (a teacher, a tax adviser): many people hold them, so
//   they only identify someone together with a place that is not a large city.
// - Unique roles (a mayor, a bishop, a school principal, a CEO): one person
//   holds them in a place or organisation, so they warn whatever the place.

// German words that take the regular feminine "-in" ("Lehrer" → "Lehrerin").
const GERMAN_COMMON = [
  'Lehrer', 'Steuerberater', 'Berater', 'Unternehmensberater', 'Apotheker', 'Physiotherapeut', 'Therapeut', 'Psychotherapeut',
  'Psychologe', 'Notar', 'Richter', 'Staatsanwalt', 'Polizist', 'Ingenieur', 'Architekt', 'Programmierer', 'Entwickler',
  'Softwareentwickler', 'Informatiker', 'Buchhalter', 'Bilanzbuchhalter', 'Elektriker', 'Installateur', 'Tischler',
  'Schreiner', 'Maler', 'Friseur', 'Bäcker', 'Fleischhauer', 'Metzger', 'Kellner', 'Verkäufer', 'Kassier', 'Mechaniker',
  'Kfz-Mechaniker', 'Fahrer', 'Busfahrer', 'Taxifahrer', 'Lokführer', 'Pilot', 'Journalist', 'Redakteur', 'Fotograf',
  'Designer', 'Grafiker', 'Übersetzer', 'Dolmetscher', 'Sozialarbeiter', 'Erzieher', 'Kindergärtner', 'Pfleger',
  'Krankenpfleger', 'Altenpfleger', 'Sanitäter', 'Notfallsanitäter', 'Optiker', 'Hörakustiker', 'Gärtner', 'Landwirt',
  'Winzer', 'Tierpfleger', 'Trainer', 'Professor', 'Dozent', 'Lektor', 'Forscher', 'Wissenschaftler', 'Bibliothekar',
  'Manager', 'Projektmanager', 'Abteilungsleiter', 'Teamleiter', 'Filialleiter', 'Sachbearbeiter', 'Beamter',
  'Postbote', 'Briefträger', 'Hausmeister', 'Logopäde', 'Ergotherapeut', 'Masseur', 'Kosmetiker', 'Juwelier',
  'Uhrmacher', 'Goldschmied', 'Zahntechniker', 'Steinmetz', 'Dachdecker', 'Maurer', 'Zimmerer', 'Spengler',
  'Rauchfangkehrer', 'Schornsteinfeger', 'Hebammenhelfer', 'Tierarzthelfer', 'Rechtsanwaltsanwärter', 'Gemeinderat',
  'Stadtrat', 'Abgeordneter', 'Unternehmer', 'Inhaber', 'Wirt', 'Hotelier', 'Konditor', 'Florist',
]

// German pairs that are irregular, and words without a feminine form.
const GERMAN_COMMON_IRREGULAR = [
  'Arzt', 'Ärztin', 'Zahnarzt', 'Zahnärztin', 'Tierarzt', 'Tierärztin', 'Hausarzt', 'Hausärztin', 'Kinderarzt', 'Kinderärztin',
  'Frauenarzt', 'Frauenärztin', 'Anwalt', 'Anwältin', 'Rechtsanwalt', 'Rechtsanwältin', 'Koch', 'Köchin', 'Bauer', 'Bäuerin',
  'Kaufmann', 'Kauffrau', 'Feuerwehrmann', 'Feuerwehrfrau', 'Hebamme', 'Krankenschwester', 'Beamtin', 'Abgeordnete',
]

const GERMAN_UNIQUE = [
  'Bürgermeister', 'Vizebürgermeister', 'Bischof', 'Erzbischof', 'Pfarrer', 'Schuldirektor', 'Direktor', 'Schulleiter',
  'Rektor', 'Dekan', 'Primar', 'Primarius', 'Bezirkshauptmann', 'Landeshauptmann', 'Landesrat', 'Polizeikommandant',
  'Kommandant', 'Feuerwehrkommandant', 'Geschäftsführer', 'Vorstandsvorsitzender', 'Vorstand', 'Intendant', 'Obmann',
  'Präsident', 'Bundespräsident', 'Bundeskanzler', 'Kanzler', 'Minister',
]

const GERMAN_UNIQUE_IRREGULAR = [
  'Bischöfin', 'Erzbischöfin', 'Primaria', 'Bezirkshauptfrau', 'Landeshauptfrau', 'Obfrau', 'Vorstandsvorsitzende',
]

const ENGLISH_COMMON = [
  'teacher', 'tax adviser', 'tax advisor', 'accountant', 'pharmacist', 'physiotherapist', 'therapist', 'psychologist',
  'notary', 'judge', 'prosecutor', 'police officer', 'policeman', 'policewoman', 'engineer', 'architect', 'programmer',
  'developer', 'software developer', 'software engineer', 'bookkeeper', 'electrician', 'plumber', 'carpenter', 'painter',
  'hairdresser', 'barber', 'baker', 'butcher', 'waiter', 'waitress', 'cashier', 'mechanic', 'driver', 'bus driver',
  'taxi driver', 'train driver', 'pilot', 'journalist', 'editor', 'photographer', 'designer', 'translator',
  'interpreter', 'social worker', 'nurse', 'paramedic', 'optician', 'gardener', 'farmer', 'winemaker', 'coach',
  'trainer', 'professor', 'lecturer', 'researcher', 'scientist', 'librarian', 'manager', 'project manager',
  'team lead', 'team leader', 'store manager', 'branch manager', 'civil servant', 'postman', 'postwoman', 'caretaker',
  'janitor', 'doctor', 'physician', 'dentist', 'vet', 'veterinarian', 'gp', 'lawyer', 'solicitor', 'attorney', 'cook',
  'chef', 'midwife', 'consultant', 'councillor', 'councilor', 'owner', 'shop owner', 'business owner', 'landlord',
  'landlady', 'florist', 'jeweller', 'jeweler', 'roofer', 'bricklayer', 'chimney sweep',
]

const ENGLISH_UNIQUE = [
  'mayor', 'deputy mayor', 'governor', 'bishop', 'archbishop', 'priest', 'vicar', 'pastor', 'rabbi', 'imam',
  'principal', 'school principal', 'headteacher', 'head teacher', 'headmaster', 'headmistress', 'dean', 'rector',
  'chancellor', 'police chief', 'chief of police', 'fire chief', 'ceo', 'cfo', 'cto', 'coo', 'chief executive',
  'managing director', 'chairman', 'chairwoman', 'chairperson', 'president', 'minister', 'head of department',
]

// People who are not a job: an age before one of these is someone's age ("a 42-year-old woman").
const PEOPLE = [
  'Frau', 'Mann', 'Kunde', 'Kundin', 'Mutter', 'Vater', 'Sohn', 'Tochter', 'Kind', 'Mädchen', 'Junge', 'Bub', 'Person',
  'Rentner', 'Rentnerin', 'Pensionist', 'Pensionistin', 'Student', 'Studentin', 'Schüler', 'Schülerin', 'Mitarbeiter',
  'Mitarbeiterin', 'Kollege', 'Kollegin', 'Ehefrau', 'Ehemann', 'Freund', 'Freundin', 'Nutzer', 'Nutzerin', 'Patient',
  'Patientin', 'Mieter', 'Mieterin', 'Witwe', 'Witwer', 'Oma', 'Opa', 'Großmutter', 'Großvater', 'Single', 'Alleinerzieherin',
  'Alleinerzieher', 'Alleinerziehende',
  'woman', 'man', 'lady', 'guy', 'customer', 'client', 'mother', 'mum', 'mom', 'father', 'dad', 'son', 'daughter', 'child',
  'kid', 'girl', 'boy', 'person', 'retiree', 'pensioner', 'student', 'pupil', 'employee', 'colleague', 'wife', 'husband',
  'friend', 'user', 'patient', 'tenant', 'widow', 'widower', 'grandmother', 'grandfather', 'grandma', 'grandpa',
  'single mother', 'single father', 'single parent', 'female', 'male',
]

const lower = (words: readonly string[]) => words.map(word => word.toLowerCase())
const withFeminine = (words: readonly string[]) => words.flatMap(word => [word, `${word}in`])

/** Lowercased single-word and multi-word forms of each kind. */
const COMMON = new Set(lower([...withFeminine(GERMAN_COMMON), ...GERMAN_COMMON_IRREGULAR, ...ENGLISH_COMMON]))
const UNIQUE = new Set(lower([...withFeminine(GERMAN_UNIQUE), ...GERMAN_UNIQUE_IRREGULAR, ...ENGLISH_UNIQUE]))
const PERSON = new Set(lower(PEOPLE))

// German compounds end in a known role ("Volksschuldirektorin", "Kundenberaterin");
// only longer roles count, so a short word like "Koch" does not match "Kochtopf"'s end by accident.
const GERMAN_ENDINGS = (words: Set<string>) => [...words].filter(word => word.length >= 6 && !word.includes(' '))
const COMMON_ENDINGS = GERMAN_ENDINGS(new Set(lower([...withFeminine(GERMAN_COMMON), ...GERMAN_COMMON_IRREGULAR])))
const UNIQUE_ENDINGS = GERMAN_ENDINGS(new Set(lower([...withFeminine(GERMAN_UNIQUE), ...GERMAN_UNIQUE_IRREGULAR])))

/** Gender-inclusive spellings as the plain feminine: "Lehrer:in", "Lehrer*in", "Lehrer_in", "LehrerIn" → "lehrerin"; plurals "-innen" → "-in". */
export function normaliseRole(word: string): string {
  return word.replace(/[:*_]in(nen)?$/u, 'in').replace(/(?<=\p{Ll})In(nen)?$/u, 'in').replace(/innen$/u, 'in').toLowerCase()
}

export type RoleKind = 'common' | 'unique'

/** The kind of a role, as written (one or more words), or undefined if it is not a known role. */
export function roleKind(words: string): RoleKind | undefined {
  const role = normaliseRole(words.replace(/\s+/g, ' ').trim())
  if (UNIQUE.has(role)) return 'unique'
  if (COMMON.has(role)) return 'common'
  if (role.includes(' ')) return undefined
  // A German compound: the longest known ending wins, so "-schuldirektorin" is unique, not common.
  if (UNIQUE_ENDINGS.some(ending => role.endsWith(ending) && role !== ending)) return 'unique'
  if (COMMON_ENDINGS.some(ending => role.endsWith(ending) && role !== ending)) return 'common'
  return undefined
}

/** Whether a word is a person: a role, or a word such as "Kundin", "woman" or "son". */
export function isPersonNoun(word: string): boolean {
  const normalised = normaliseRole(word)
  return PERSON.has(normalised) || roleKind(word) !== undefined
}

/** Longest multi-word role first, so "school principal" is found before "principal". */
export const MULTI_WORD_ROLES: readonly string[] = [...COMMON, ...UNIQUE].filter(role => role.includes(' ')).sort((a, b) => b.length - a.length)
export const MULTI_WORD_PEOPLE: readonly string[] = [...PERSON].filter(person => person.includes(' ')).sort((a, b) => b.length - a.length)
