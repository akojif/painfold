// Hand-written name cases for the held-out name evaluation, in the same
// [[TYPE:value]] markup as the hard cases. Names in Austrian feedback come from
// many communities, so each group below holds invented names typical of one of
// them, inside German and English sentences: real diacritics, variant
// transliterations, multi-part and particle names, possessives and a few
// lowercase chat names. The names are combinations of common first names and
// surnames, made up for testing; they are not meant to refer to anyone.
//
// The group label exists only here, to report recall per group. Painfold never
// infers anyone's origin.
//
// Each group has 12 sentences, 6 German and then 6 English. The second sentence
// of each language holds two names. Sentences 1, 5 and 11 of each group form the
// dev split, which may be used to tune the detectors; the rest is the test
// split, which is only ever reported.
//
// MORE_TEST adds 10 test-only sentences per group (5 German, 5 English, four of
// them with two names), written before any tuning so they stay unseen: every
// group then has 25 test names.
import type { Lang } from './values.ts'

export const NAME_GROUPS = [
  'german-speaking', 'english', 'bosnian-serbian-croatian', 'turkish', 'romanian', 'hungarian', 'polish',
  'ukrainian', 'arabic', 'afghan', 'african', 'south-asian', 'east-asian',
] as const
export type NameGroup = typeof NAME_GROUPS[number]

const DEV = new Set([0, 4, 10])

const SENTENCES: Record<NameGroup, string[]> = {
  'german-speaking': [
    'Frau [[NAME:Theresia Moosbrugger]] aus [[PLACE:Dornbirn]] hat angerufen.',
    'Danke an [[NAME:Florian]] und [[NAME:Hannelore Gschwandtner-Pichler]] vom Support, sehr hilfsbereit!',
    'Mag. [[NAME:Leopold Wieser]] wartet seit zwei Wochen auf eine Antwort.',
    '[[NAME:Jürgen]]s Zugang funktioniert seit gestern nicht mehr.',
    'LG, [[NAME:Sophie Grünwald]]',
    'Die Rechnung hat [[NAME:Johanna Steiner-Rauch]] schon im Jänner bezahlt.',
    'Our accountant [[NAME:Katharina Edlinger]] will send the documents.',
    'Ask for [[NAME:Matthias]] at the front desk, or for [[NAME:Anneliese Brandstätter]] in [[PLACE:Graz]].',
    'Cheers, [[NAME:Lukas Hofbauer]]',
    '[[NAME:Maximilian von Hohenberg]] approved the invoice last week.',
    'I spoke to [[NAME:Veronika]] yesterday and she was great.',
    'Please add [[NAME:Dominik Weißenböck]] as a user.',
  ],
  'english': [
    '[[NAME:William Ashby]] aus [[PLACE:Linz]] hat das Ticket eröffnet.',
    'Bitte wenden Sie sich an [[NAME:Grace Whitfield]] oder [[NAME:Callum O\'Brien]].',
    'Unser Kollege [[NAME:Oliver]] kümmert sich darum.',
    'Herr [[NAME:James Fitzgerald-Moore]] braucht einen neuen Zugang.',
    'Gruß, [[NAME:Charlotte Bennett]]',
    'Die Präsentation hat [[NAME:Daniel Cooper]] vorbereitet.',
    'Thanks to [[NAME:Olivia Hartley]] for sorting this out so quickly.',
    'My manager, [[NAME:Thomas McAllister]], and [[NAME:Harriet]] from finance want a refund.',
    '[[NAME:Sanne van der Berg]] says the export is broken.',
    'Signed: [[NAME:Eleanor St. John]]',
    'hi, this is [[NAME:jack]], i cant log in',
    'Best, [[NAME:Rebecca Holloway]]',
  ],
  'bosnian-serbian-croatian': [
    'Frau [[NAME:Amra Hodžić]] hat die Rechnung zweimal bezahlt.',
    'Bitte rufen Sie [[NAME:Dragan Petrović]] oder [[NAME:Jelena Kovačević]] zurück.',
    '[[NAME:Emir]] aus der Buchhaltung meldet einen Fehler.',
    'Die Rechnung für [[NAME:Željko Marić]] ist falsch.',
    'Danke, [[NAME:Ivana]]!',
    'Grüße von [[NAME:Marija Jurić-Novak]] aus [[PLACE:Wiener Neustadt]]',
    '[[NAME:Mirza Begović]] needs access to the reports.',
    'Please contact [[NAME:Snježana Šimić]] or [[NAME:Nikola Đorđević]] about the contract.',
    'Our intern [[NAME:Lejla]] found the bug.',
    'Kind regards, [[NAME:Goran Babić]]',
    'I\'m [[NAME:Ana Krešić]] and I can\'t log in.',
    'Transfer it to [[NAME:Dženan Mujić]] please.',
  ],
  'turkish': [
    'Frau [[NAME:Ayşe Yılmaz]] wartet auf eine Gutschrift.',
    '[[NAME:Mehmet Öztürk]] und [[NAME:Elif Çelik]] haben das Passwort vergessen.',
    'Grüße, [[NAME:Emre]]',
    '[[NAME:Gülşen]]s Konto wurde gesperrt.',
    'Herr [[NAME:Mustafa Kaya]] möchte kündigen.',
    'Bitte an [[NAME:Serkan Aksoy]] in [[PLACE:Wels]] weiterleiten.',
    '[[NAME:Zeynep Demir]] says the app crashes.',
    'Please call [[NAME:Hakan Şahin]] or [[NAME:Büşra]] back today.',
    'Our CEO [[NAME:Burak Doğan]] needs the numbers by Friday.',
    'Regards, [[NAME:Cansu Aydın]]',
    'thanks [[NAME:ozan]], that helped a lot',
    'Add [[NAME:Oğuz Kılıç]] to the team, please.',
  ],
  'romanian': [
    'Frau [[NAME:Ioana Popescu]] hat eine Frage zur Rechnung.',
    '[[NAME:Andrei Ionescu]] und [[NAME:Mihaela]] können sich nicht anmelden.',
    'Bitte an [[NAME:Ștefan Dumitrescu]] schicken.',
    'LG [[NAME:Alexandra Constantinescu]]',
    'Herr [[NAME:Bogdan Munteanu]] aus [[PLACE:Salzburg]] ruft morgen an.',
    'Das Problem hat [[NAME:Florin Mureșan]] gefunden.',
    '[[NAME:Elena Stănescu]] reported the issue.',
    'Please reply to [[NAME:Răzvan]] and copy [[NAME:Cristina Țurcanu]].',
    'My colleague [[NAME:Vlad Gheorghiu]] has the invoice.',
    'Ask [[NAME:Oana Mihăilă]] for the login details.',
    'Thanks, [[NAME:Sorin]]',
    '[[NAME:Adriana Bălan]] wants the report in English.',
  ],
  'hungarian': [
    'Frau [[NAME:Erzsébet Kovács]] möchte eine Rechnungskopie.',
    '[[NAME:Gábor Nagy]] und [[NAME:Zsófia]] haben den Export getestet.',
    'Bitte [[NAME:László Szőke]] einen Zugang geben.',
    'Herr [[NAME:Attila Horváth]] aus [[PLACE:Eisenstadt]] wartet auf einen Rückruf.',
    'Das hat [[NAME:Réka Tóth]] gemeldet.',
    'Grüße, [[NAME:Levente Balogh]]',
    '[[NAME:Bence Varga]] can\'t find the report.',
    'Please contact [[NAME:Ildikó Molnár]] or [[NAME:Csaba]] in [[PLACE:Vienna]].',
    'Best wishes, [[NAME:Katalin Farkas]]',
    '[[NAME:Dániel Kiss-Pál]] approved the change.',
    'Our tester [[NAME:Eszter]] found two bugs.',
    'Thanks to [[NAME:Tamás Lukács]] for the quick fix.',
  ],
  'polish': [
    'Frau [[NAME:Małgorzata Kowalska]] hat angerufen.',
    '[[NAME:Łukasz Wiśniewski]] und [[NAME:Agnieszka]] brauchen die Unterlagen.',
    'Bitte an [[NAME:Grzegorz Wójcik]] weiterleiten.',
    'Herr [[NAME:Paweł Zieliński]] aus [[PLACE:Innsbruck]] möchte kündigen.',
    'Das Problem hat [[NAME:Katarzyna Lewandowska-Nowak]] gefunden.',
    'Danke, [[NAME:Bartek]]!',
    '[[NAME:Krzysztof Dąbrowski]] says the PDF is empty.',
    'Please call [[NAME:Joanna Szymańska]] or [[NAME:Tomek]] back.',
    'My boss [[NAME:Michał Kamiński]] wants a refund.',
    'Ask [[NAME:Zofia Woźniak]] about the contract.',
    'Cheers, [[NAME:Jędrzej Mazur]]',
    'Thanks [[NAME:Ola Pietrzak]], great help.',
  ],
  'ukrainian': [
    'Frau [[NAME:Olena Kovalenko]] hat zweimal bezahlt.',
    '[[NAME:Oleksandr Shevchenko]] und [[NAME:Iryna]] können die App nicht öffnen.',
    'Bitte [[NAME:Dmytro Bondarenko]] zurückrufen.',
    'Herr [[NAME:Andrii Melnyk]] aus [[PLACE:Klagenfurt]] wartet auf eine Antwort.',
    'Das hat [[NAME:Yuliia Tkachenko]] vorgeschlagen.',
    'Grüße, [[NAME:Bohdan Hnatiuk]]',
    '[[NAME:Mykola Kravchenko]] needs a new password.',
    'Please contact [[NAME:Nataliia Boyko]] or [[NAME:Serhii Moroz]] about the invoice.',
    'thanks [[NAME:taras]], it works now',
    'Regards, [[NAME:Oksana Lysenko]]',
    'Ask [[NAME:Kateryna]] for the file.',
    '[[NAME:Yulia Savchenko]] from logistics reported it.',
  ],
  'arabic': [
    'Herr [[NAME:Mohammed Al-Hassan]] möchte die Rechnung auf Deutsch.',
    '[[NAME:Muhammad Khalil]] und [[NAME:Rania Haddad]] haben das Ticket eröffnet.',
    'Danke an [[NAME:Abdul Rahman Darwish]] für den Hinweis.',
    'Grüße, [[NAME:Yasmin]]',
    'Bitte [[NAME:Omar al-Sayed]] einen Zugang geben.',
    'Frau [[NAME:Hiba Nasser]] aus [[PLACE:Graz]] wartet auf einen Rückruf.',
    '[[NAME:Mohamad Kassem]] can\'t log in.',
    'Please reply to [[NAME:Lina Aboud]] and [[NAME:Ahmad]].',
    'My colleague [[NAME:Nour El-Din Shami]] sent the file.',
    '[[NAME:Fatima Al-Zahra Mansour]] approved it.',
    'Ask [[NAME:Khaled]] about the delivery.',
    'Thanks, [[NAME:Samer Haj Ibrahim]]',
  ],
  'afghan': [
    'Herr [[NAME:Ahmad Shah Rahimi]] braucht Hilfe beim Login.',
    'Frau [[NAME:Fereshta Ahmadi]] und [[NAME:Mohammad Naser Popal]] haben angerufen.',
    'Danke, [[NAME:Zahra]]!',
    'Bitte an [[NAME:Habibullah Karimi]] schicken.',
    'Das hat [[NAME:Mursal Sadat]] aus [[PLACE:St. Pölten]] gemeldet.',
    'Grüße, [[NAME:Jawid Amiri]]',
    '[[NAME:Farid Noori]] needs the invoice again.',
    'Please contact [[NAME:Shabnam Hakimi]] or [[NAME:Wahid]].',
    '[[NAME:Gulalai Stanikzai]] from sales reported it.',
    'Regards, [[NAME:Abdul Wali Hotak]]',
    'Ask [[NAME:Mariam]] about the refund.',
    'Thanks [[NAME:Sohail Wardak]], perfect.',
  ],
  'african': [
    'Herr [[NAME:Chukwuemeka Okafor]] wartet auf eine Antwort.',
    'Frau [[NAME:Amina Mohamed Abdi]] und [[NAME:Kwame Mensah]] haben das Formular geschickt.',
    'Danke an [[NAME:Fatou]] für die Hilfe.',
    'Bitte [[NAME:Tesfaye Bekele]] aus [[PLACE:Linz]] zurückrufen.',
    'Grüße, [[NAME:Ngozi Adeyemi]]',
    'Das Problem hat [[NAME:Moussa Traoré]] gemeldet.',
    '[[NAME:Oluwaseun Adebayo]] says the PDF is broken.',
    'Please call [[NAME:Abebe Girma]] or [[NAME:Aisha]] back.',
    '[[NAME:Mamadou Diallo]] approved the order.',
    'Regards, [[NAME:Wanjiru Kamau]]',
    'Our driver [[NAME:Hamza Warsame]] needs access.',
    'Thanks, [[NAME:Efua Asante]]',
  ],
  'south-asian': [
    'Frau [[NAME:Priya Sharma]] hat eine Frage.',
    '[[NAME:Rajesh Kumar]] und [[NAME:Ananya]] können sich nicht anmelden.',
    'Bitte an [[NAME:Muhammad Imran Qureshi]] weiterleiten.',
    'Herr [[NAME:Sandeep Singh Gill]] aus [[PLACE:Wien]] wartet auf einen Rückruf.',
    'Das hat [[NAME:Nusrat Jahan]] gemeldet.',
    'Grüße, [[NAME:Deepak Iyer]]',
    '[[NAME:Arjun Nair]] reported the bug.',
    'Please contact [[NAME:Fatima Siddiqui]] or [[NAME:Kavya]].',
    'Regards, [[NAME:Venkatesh Subramanian]]',
    '[[NAME:Harpreet Kaur]] needs a refund.',
    'Ask [[NAME:Tharindu Perera]] for the file.',
    'Thanks [[NAME:Ayesha Chaudhry]], that was quick.',
  ],
  'east-asian': [
    'Frau [[NAME:Li Na]] hat angerufen.',
    '[[NAME:Nguyễn Văn Minh]] und [[NAME:Mei]] können die Rechnung nicht öffnen.',
    'Bitte an [[NAME:Kim Ji-woo]] schicken.',
    'Herr [[NAME:Zhang Wei]] aus [[PLACE:Graz]] wartet auf eine Antwort.',
    'Das hat [[NAME:Tanaka Yuki]] gemeldet.',
    'Grüße, [[NAME:Liu Yang]]',
    '[[NAME:Trần Thị Lan]] says the export fails.',
    'Please call [[NAME:Park Seo-yeon]] or [[NAME:Hiroshi]] back.',
    'Regards, [[NAME:Wang Xiaoming]]',
    '[[NAME:Chen Jie]] approved the order.',
    'Ask [[NAME:Phạm Thu Hà]] about the contract.',
    'Thanks, [[NAME:Sato Haruto]]',
  ],
}

// Test-only: sign-offs and thanks with bare and full names, lowercase chat
// names, titles, possessives, multi-part and particle names.
const MORE_TEST: Record<NameGroup, { de: string[], en: string[] }> = {
  'german-speaking': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Elisabeth Haslinger]]',
      'hallo, hier ist [[NAME:stefan]], und [[NAME:magdalena]] hat das gleiche problem',
      'Danke, [[NAME:Wolfgang]]!',
      'Herr DI [[NAME:Gerhard Pfeffer-Lindner]] und Frau [[NAME:Ingrid Zöhrer]] warten auf die Gutschrift.',
      'Schöne Grüße aus [[PLACE:Feldkirch]], [[NAME:Barbara Ritzberger]]',
    ],
    en: [
      'Kind regards,\n[[NAME:Christoph Aigner]]',
      'thx [[NAME:martin]], and say hi to [[NAME:Petra Holzinger]]',
      'Thanks, [[NAME:Michaela]]',
      'Both [[NAME:Franz Xaver Mayrhofer]] and [[NAME:Gertraud Kainz]] need access.',
      'This was reported by [[NAME:Clemens von Stauffenberg-Lenz]].',
    ],
  },
  'english': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Margaret Thornbury]]',
      'hallo, hier ist [[NAME:liam]], und [[NAME:Sophie Pemberton]] kann das bestätigen',
      'Danke, [[NAME:Hugo]]!',
      'Herr [[NAME:Edward Lancaster-Hale]] und Frau [[NAME:Amelia Crowther]] möchten kündigen.',
      'Grüße, [[NAME:Patrick Dunleavy]]',
    ],
    en: [
      'Regards,\n[[NAME:Benjamin Ellery]]',
      'cheers [[NAME:ollie]], and thanks to [[NAME:Fiona MacLeod]] too',
      'Thanks, [[NAME:Imogen]]',
      '[[NAME:Mary-Jane Fairweather]] and [[NAME:Dylan ap Rhys]] signed the form.',
      'The account belongs to [[NAME:Rosalind de la Mare]].',
    ],
  },
  'bosnian-serbian-croatian': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Senada Halilović]]',
      'hallo, hier ist [[NAME:damir]], und [[NAME:Vesna Stojanović]] hat das auch',
      'Danke, [[NAME:Milica]]!',
      'Herr [[NAME:Hasan Mehmedović-Kurtić]] und Frau [[NAME:Branka Radić]] warten auf Antwort.',
      'LG [[NAME:Tomislav Perić]]',
    ],
    en: [
      'Best regards,\n[[NAME:Edina Softić]]',
      'thx [[NAME:dino]], and tell [[NAME:Stjepan Jukić]] it works now',
      'Thanks, [[NAME:Azra]]',
      '[[NAME:Zoran Ilić]] and [[NAME:Nermina Bajrić]] approved the budget.',
      'Please send it to [[NAME:Kristijan Vuković]].',
    ],
  },
  'turkish': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Hülya Karataş]]',
      'hallo, hier ist [[NAME:kerem]], und [[NAME:Selin Arslan]] hat das gleiche problem',
      'Danke, [[NAME:Yusuf]]!',
      'Herr [[NAME:Ali Rıza Güneş]] und Frau [[NAME:Fatma Erdoğan]] möchten eine Rechnungskopie.',
      'Grüße, [[NAME:Tuğba Koç]]',
    ],
    en: [
      'Kind regards,\n[[NAME:İsmail Özdemir]]',
      'thx [[NAME:deniz]], and say thanks to [[NAME:Merve Yıldız]]',
      'Thanks, [[NAME:Ebru]]',
      '[[NAME:Mehmet Ali Aydoğan]] and [[NAME:Nesrin Kurt]] need new passwords.',
      'Please contact [[NAME:Barış Çakır]] about the refund.',
    ],
  },
  'romanian': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Gabriela Pop]]',
      'hallo, hier ist [[NAME:mihai]], und [[NAME:Roxana Moldovan]] sieht das auch',
      'Danke, [[NAME:Ionuț]]!',
      'Herr [[NAME:Constantin Vasilescu]] und Frau [[NAME:Ana-Maria Neagu]] warten auf die Gutschrift.',
      'LG [[NAME:Daniela Știrbu]]',
    ],
    en: [
      'Regards,\n[[NAME:Cătălin Dobre]]',
      'thx [[NAME:radu]], and tell [[NAME:Simona Rădulescu]] too',
      'Thanks, [[NAME:Irina]]',
      '[[NAME:Petru Ciobanu]] and [[NAME:Loredana Mărgineanu]] approved it.',
      'The invoice is for [[NAME:Teodor Pătrașcu]].',
    ],
  },
  'hungarian': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Judit Szabó]]',
      'hallo, hier ist [[NAME:péter]], und [[NAME:Anikó Takács]] hat das gleiche problem',
      'Danke, [[NAME:Ferenc]]!',
      'Herr [[NAME:Zoltán Kovács-Bíró]] und Frau [[NAME:Krisztina Juhász]] warten auf eine Antwort.',
      'Grüße, [[NAME:Ágnes Fehér]]',
    ],
    en: [
      'Best wishes,\n[[NAME:Miklós Papp]]',
      'thx [[NAME:gergő]], and thanks to [[NAME:Noémi Sipos]]',
      'Thanks, [[NAME:Boglárka]]',
      '[[NAME:István Oláh]] and [[NAME:Hajnalka Vörös]] need access.',
      'Please reply to [[NAME:Szilvia Bognár]].',
    ],
  },
  'polish': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Dorota Kaczmarek]]',
      'hallo, hier ist [[NAME:kuba]], und [[NAME:Magdalena Wróblewska]] hat das auch',
      'Danke, [[NAME:Wojciech]]!',
      'Herr [[NAME:Przemysław Jankowski]] und Frau [[NAME:Halina Grabowska-Sikora]] möchten kündigen.',
      'LG [[NAME:Marta Kowalczyk]]',
    ],
    en: [
      'Kind regards,\n[[NAME:Sławomir Pawlak]]',
      'thx [[NAME:gosia]], and tell [[NAME:Rafał Michalski]] it works',
      'Thanks, [[NAME:Kasia]]',
      '[[NAME:Mirosław Sobczak]] and [[NAME:Beata Kozłowska]] signed the contract.',
      'Please send it to [[NAME:Jarosław Wieczorek]].',
    ],
  },
  'ukrainian': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Halyna Petrenko]]',
      'hallo, hier ist [[NAME:vasyl]], und [[NAME:Svitlana Kovalchuk]] hat das gleiche problem',
      'Danke, [[NAME:Roman]]!',
      'Herr [[NAME:Volodymyr Ivanenko]] und Frau [[NAME:Liudmyla Rudenko]] warten auf eine Antwort.',
      'Grüße, [[NAME:Anastasiia Pavlenko]]',
    ],
    en: [
      'Regards,\n[[NAME:Yevhen Marchenko]]',
      'thx [[NAME:maksym]], and say hi to [[NAME:Viktoriia Zaitseva]]',
      'Thanks, [[NAME:Oleh]]',
      '[[NAME:Ihor Polishchuk]] and [[NAME:Tetiana Sydorenko]] need access.',
      'The order is for [[NAME:Sergey Kuzmenko]].',
    ],
  },
  'arabic': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Abdullah Al-Masri]]',
      'hallo, hier ist [[NAME:karim]], und [[NAME:Noor Al-Hussein]] hat das auch',
      'Danke, [[NAME:Layla]]!',
      'Herr [[NAME:Abd al-Aziz Haddad]] und Frau [[NAME:Reem Abu Khalil]] warten auf die Gutschrift.',
      'Grüße, [[NAME:Tarek Bin Saleh]]',
    ],
    en: [
      'Kind regards,\n[[NAME:Mahmoud El-Sayed]]',
      'thx [[NAME:hamza]], and thanks to [[NAME:Dalia Kanaan]] too',
      'Thanks, [[NAME:Sami]]',
      '[[NAME:Abu Bakr Othman]] and [[NAME:Maryam Al-Khatib]] approved the order.',
      'Please contact [[NAME:Walid Abdel Rahman]] about the invoice.',
    ],
  },
  'afghan': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Nasrin Azimi]]',
      'hallo, hier ist [[NAME:ahmad]], und [[NAME:Hamid Safi]] hat das gleiche problem',
      'Danke, [[NAME:Parwana]]!',
      'Herr [[NAME:Gul Mohammad Zazai]] und Frau [[NAME:Mahbooba Rasuli]] möchten eine Rechnungskopie.',
      'Grüße, [[NAME:Rahmatullah Mohammadi]]',
    ],
    en: [
      'Regards,\n[[NAME:Najibullah Sarwari]]',
      'thx [[NAME:yama]], and tell [[NAME:Laila Haidari]] it works now',
      'Thanks, [[NAME:Sediqa]]',
      '[[NAME:Mir Ahmad Nazari]] and [[NAME:Khatera Faizi]] need new passwords.',
      'The account belongs to [[NAME:Abdul Qadir Mujaddidi]].',
    ],
  },
  'african': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Adaeze Nwosu]]',
      'hallo, hier ist [[NAME:kofi]], und [[NAME:Halima Yusuf]] hat das auch',
      'Danke, [[NAME:Makeda]]!',
      'Herr [[NAME:Babajide Ogunleye]] und Frau [[NAME:Nomvula Dlamini]] warten auf eine Antwort.',
      'Grüße, [[NAME:Yonas Haile]]',
    ],
    en: [
      'Kind regards,\n[[NAME:Chidinma Eze]]',
      'thx [[NAME:abdi]], and thanks to [[NAME:Awa Ndiaye]]',
      'Thanks, [[NAME:Tendai]]',
      '[[NAME:Ibrahim Abdullahi Musa]] and [[NAME:Akosua Boateng]] signed the form.',
      'Please send it to [[NAME:Sipho Ndlovu]].',
    ],
  },
  'south-asian': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Lakshmi Raghavan]]',
      'hallo, hier ist [[NAME:rohan]], und [[NAME:Shabana Akhtar]] hat das gleiche problem',
      'Danke, [[NAME:Anjali]]!',
      'Herr [[NAME:Gurpreet Singh Sandhu]] und Frau [[NAME:Meenakshi Pillai]] möchten kündigen.',
      'Grüße, [[NAME:Saif ur Rehman]]',
    ],
    en: [
      'Regards,\n[[NAME:Aravind Krishnamurthy]]',
      'thx [[NAME:neha]], and say thanks to [[NAME:Bilal Hussain]]',
      'Thanks, [[NAME:Sunil]]',
      '[[NAME:Mohammed Rafiq Butt]] and [[NAME:Dilani Fernando]] need access.',
      'The order is for [[NAME:Rukhsana Begum]].',
    ],
  },
  'east-asian': {
    de: [
      'Mit freundlichen Grüßen\n[[NAME:Huang Xiu Ying]]',
      'hallo, hier ist [[NAME:jun]], und [[NAME:Lê Văn Hùng]] hat das auch',
      'Danke, [[NAME:Yuna]]!',
      'Herr [[NAME:Watanabe Kenji]] und Frau [[NAME:Choi Min-jung]] warten auf die Gutschrift.',
      'Grüße, [[NAME:Zhao Lei]]',
    ],
    en: [
      'Kind regards,\n[[NAME:Nguyễn Thị Hồng]]',
      'thx [[NAME:minh]], and tell [[NAME:Lee Seung-hoon]] it works now',
      'Thanks, [[NAME:Aiko]]',
      '[[NAME:Yamamoto Haruka]] and [[NAME:Ouyang Ming]] approved the order.',
      'Please contact [[NAME:Đỗ Quang Huy]] about the invoice.',
    ],
  },
}

export const NAME_CASES: Array<{ lang: Lang, group: NameGroup, split: 'dev' | 'test', source: string }> = [
  ...NAME_GROUPS.flatMap(group =>
    SENTENCES[group].map((source, i) => ({ lang: i < 6 ? 'de' as const : 'en' as const, group, split: DEV.has(i) ? 'dev' as const : 'test' as const, source }))),
  ...NAME_GROUPS.flatMap(group => (['de', 'en'] as const).flatMap(lang =>
    MORE_TEST[group][lang].map(source => ({ lang, group, split: 'test' as const, source })))),
]
