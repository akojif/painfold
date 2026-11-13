"""Writes the labelling spreadsheets for the analysis evaluation (#129).

    python3 scripts/labelling/make_sheets.py

Reads data/eval/analysis/items.jsonl and writes one XLSX file per language to
data/eval/analysis/labelling-en.xlsx and labelling-de.xlsx: a guidelines tab,
an items tab (one row per item, with dropdowns for sentiment and type) and a
themes tab, where the labeller keeps the names they use. The files open in
Excel, LibreOffice and Google Sheets (File, Import). The dev/test split is
not in the files: labellers label every item the same way.

Needs Python 3 with openpyxl (MIT), used only here: SheetJS, which the app
uses, cannot write dropdowns. The generated files are committed, so nobody
needs Python to label or to convert (scripts/convert-labels.ts).
"""
import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parents[2]
ITEMS = ROOT / 'data/eval/analysis/items.jsonl'
OUT = ROOT / 'data/eval/analysis'

SENTIMENTS = ['positive', 'negative', 'mixed', 'neutral']
TYPES = ['bug', 'feature request', 'question', 'praise', 'complaint', 'other']
KINDS = ['job', 'pain', 'gain']

# Sheet and column names per language. The converter accepts both.
NAMES = {
    'en': {'guide': 'Guidelines', 'items': 'Items', 'themes': 'Themes',
           'items_header': ['id', 'text', 'jobs', 'pains', 'gains', 'sentiment', 'type', 'comment'],
           'themes_header': ['kind', 'name', 'note']},
    'de': {'guide': 'Anleitung', 'items': 'Einträge', 'themes': 'Themen',
           'items_header': ['id', 'Text', 'Jobs', 'Pains', 'Gains', 'Stimmung', 'Art', 'Kommentar'],
           'themes_header': ['Art', 'Name', 'Notiz']},
}

GUIDE = {
    'en': [
        ('h', 'Labelling feedback: jobs, pains and gains'),
        ('p', 'Each row is one piece of invented customer feedback about accounting and invoicing software. Personal data has already been replaced, for example [NAME_1]. Label what the text says, not what you guess. Take about 30 seconds per row; when unsure, choose the simpler label and add a comment.'),
        ('h', 'Jobs, pains and gains'),
        ('p', 'Job: what the customer is trying to get done, in their words. A goal, not a feature. Example: "Send invoices and get paid on time".'),
        ('p', 'Pain: what frustrates, blocks or risks that job. Example: "Bank connection keeps dropping".'),
        ('p', 'Gain: what the customer wants, or what would delight them: a wished outcome or feature. Example: "Recurring invoices".'),
        ('p', 'A row can have none, one or several of each. Leave a cell empty if the text says nothing about it ("ok", "Perfect."). Separate several names with a semicolon (;) or a line break (Alt+Enter, Option+Enter on a Mac).'),
        ('h', 'Names'),
        ('p', 'Write short names, 2 to 7 words, from the customer\'s point of view, in the language of the text. Reuse the same name for the same thing: keep every name you use on the Themes tab, and pick from there. The converter flags names that are not on the Themes tab. Never put placeholders such as [NAME_1] in a name.'),
        ('h', 'Sentiment (dropdown)'),
        ('p', 'The overall tone of the whole text: positive, negative, mixed (clearly both) or neutral (a plain question or statement). Sarcasm counts as what is meant ("Fantastic. Really helpful." about a problem is negative).'),
        ('h', 'Type (dropdown, one per row)'),
        ('p', 'The main purpose of the text: bug (something does not work as it should), feature request (asks for something new), question (asks how or what), praise (thanks or compliments), complaint (unhappy, but not a bug: price, support, a decision), other (none of these).'),
        ('h', 'Worked examples (not from the set)'),
        ('ex', 'The invoice email never arrives at clients using Gmail. I send 50 invoices a month and now I have to call them all.',
         'Send invoices and get paid on time', 'Invoice emails do not arrive', '', 'negative', 'bug'),
        ('ex', 'Could you add a way to split a bill between two customers? We do joint projects all the time.',
         'Bill joint projects', '', 'Split one invoice between customers', 'neutral', 'feature request'),
        ('ex', 'Reports are great now, thank you! Only thing missing is a filter by month.',
         '', 'Missing report filters', 'Filter reports by month', 'mixed', 'praise'),
        ('ex', 'Is there a way to change the currency on an existing invoice?',
         '', '', 'Change invoice currency', 'neutral', 'question'),
        ('ex', 'Twice the price for the same features. Not happy.',
         '', 'Price increase without new value', '', 'negative', 'complaint'),
        ('h', 'When you are done'),
        ('p', 'Save the file (keep it as .xlsx; from Google Sheets: File, Download, Microsoft Excel) and send it back. Do not change the id or text columns, and do not reorder or delete rows.'),
    ],
    'de': [
        ('h', 'Feedback beschriften: Jobs, Pains und Gains'),
        ('p', 'Jede Zeile ist eine erfundene Kundenrückmeldung zu einer Buchhaltungs- und Rechnungssoftware. Personenbezogene Daten sind schon ersetzt, zum Beispiel [NAME_1]. Beschriften Sie, was im Text steht, nicht was Sie vermuten. Etwa 30 Sekunden pro Zeile; im Zweifel die einfachere Beschriftung wählen und einen Kommentar schreiben.'),
        ('h', 'Jobs, Pains und Gains'),
        ('p', 'Job: was die Kundin oder der Kunde erledigen will, in deren Worten. Ein Ziel, keine Funktion. Beispiel: „Rechnungen schreiben und pünktlich bezahlt werden“.'),
        ('p', 'Pain: was diesen Job erschwert, blockiert oder gefährdet. Beispiel: „Bankverbindung bricht ständig ab“.'),
        ('p', 'Gain: was sich die Person wünscht oder was sie begeistern würde: ein gewünschtes Ergebnis oder eine Funktion. Beispiel: „Wiederkehrende Rechnungen“.'),
        ('p', 'Eine Zeile kann keinen, einen oder mehrere davon haben. Lassen Sie eine Zelle leer, wenn der Text dazu nichts sagt („passt“, „Perfekt.“). Mehrere Namen mit Strichpunkt (;) oder Zeilenumbruch trennen (Alt+Enter, am Mac Wahl+Enter).'),
        ('h', 'Namen'),
        ('p', 'Kurze Namen, 2 bis 7 Wörter, aus Sicht der Kundin oder des Kunden, in der Sprache des Textes. Dieselbe Sache immer gleich benennen: alle verwendeten Namen auf dem Tab Themen führen und von dort übernehmen. Das Umwandlungsskript meldet Namen, die nicht auf dem Tab Themen stehen. Nie Platzhalter wie [NAME_1] in einen Namen schreiben.'),
        ('h', 'Stimmung (Auswahlliste)'),
        ('p', 'Der Gesamtton des Textes: positive (positiv), negative (negativ), mixed (deutlich beides) oder neutral (eine sachliche Frage oder Aussage). Ironie zählt so, wie sie gemeint ist („Großartig. Sehr hilfreich.“ über ein Problem ist negativ). Die Werte in der Liste sind englisch, damit beide Hälften gleich ausgewertet werden.'),
        ('h', 'Art (Auswahlliste, eine pro Zeile)'),
        ('p', 'Der Hauptzweck des Textes: bug (etwas funktioniert nicht wie es soll), feature request (wünscht sich etwas Neues), question (fragt wie oder was), praise (Dank oder Lob), complaint (unzufrieden, aber kein Fehler: Preis, Support, eine Entscheidung), other (nichts davon).'),
        ('h', 'Beispiele (nicht aus der Liste)'),
        ('ex', 'Die Rechnungsmail kommt bei Kunden mit Gmail nie an. Ich verschicke 50 Rechnungen im Monat und muss jetzt alle anrufen.',
         'Rechnungen schreiben und pünktlich bezahlt werden', 'Rechnungsmails kommen nicht an', '', 'negative', 'bug'),
        ('ex', 'Könntet ihr eine Möglichkeit einbauen, eine Rechnung auf zwei Kunden aufzuteilen? Wir haben oft gemeinsame Projekte.',
         'Gemeinsame Projekte verrechnen', '', 'Rechnung auf Kunden aufteilen', 'neutral', 'feature request'),
        ('ex', 'Die Berichte sind jetzt super, danke! Nur ein Filter nach Monat fehlt noch.',
         '', 'Fehlende Berichtsfilter', 'Berichte nach Monat filtern', 'mixed', 'praise'),
        ('ex', 'Kann ich bei einer bestehenden Rechnung die Währung ändern?',
         '', '', 'Rechnungswährung ändern', 'neutral', 'question'),
        ('ex', 'Doppelter Preis für dieselben Funktionen. Nicht zufrieden.',
         '', 'Preiserhöhung ohne Mehrwert', '', 'negative', 'complaint'),
        ('h', 'Wenn Sie fertig sind'),
        ('p', 'Datei speichern (als .xlsx; aus Google Sheets: Datei, Herunterladen, Microsoft Excel) und zurückschicken. Die Spalten id und Text nicht ändern, keine Zeilen umsortieren oder löschen.'),
    ],
}

EXAMPLE_HEADER = {
    'en': ['Text', 'Jobs', 'Pains', 'Gains', 'Sentiment', 'Type'],
    'de': ['Text', 'Jobs', 'Pains', 'Gains', 'Stimmung', 'Art'],
}

HEADER_FILL = PatternFill('solid', fgColor='EEF1F4')
BOLD = Font(bold=True)
WRAP = Alignment(wrap_text=True, vertical='top')


def guide_sheet(book, lang):
    sheet = book.active
    sheet.title = NAMES[lang]['guide']
    sheet.column_dimensions['A'].width = 60
    for column in 'BCDEF':
        sheet.column_dimensions[column].width = 28
    row = 1
    examples_started = False
    for kind, *values in GUIDE[lang]:
        if kind == 'h':
            row += 1
            sheet.cell(row, 1, values[0]).font = Font(bold=True, size=13)
        elif kind == 'p':
            cell = sheet.cell(row, 1, values[0])
            cell.alignment = WRAP
            sheet.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
            sheet.row_dimensions[row].height = 15 * max(1, len(values[0]) // 140 + 1)
        elif kind == 'ex':
            if not examples_started:
                for column, title in enumerate(EXAMPLE_HEADER[lang], start=1):
                    header = sheet.cell(row, column, title)
                    header.font = BOLD
                    header.fill = HEADER_FILL
                row += 1
                examples_started = True
            for column, value in enumerate(values, start=1):
                sheet.cell(row, column, value).alignment = WRAP
            sheet.row_dimensions[row].height = 45
        row += 1


def items_sheet(book, lang, items):
    names = NAMES[lang]
    sheet = book.create_sheet(names['items'])
    for column, title in enumerate(names['items_header'], start=1):
        cell = sheet.cell(1, column, title)
        cell.font = BOLD
        cell.fill = HEADER_FILL
    widths = [9, 70, 32, 32, 32, 13, 17, 28]
    for column, width in enumerate(widths, start=1):
        sheet.column_dimensions[chr(64 + column)].width = width
    for row, item in enumerate(items, start=2):
        sheet.cell(row, 1, item['id'])
        sheet.cell(row, 2, item['text'])
        for column in range(1, 9):
            sheet.cell(row, column).alignment = WRAP
        sheet.row_dimensions[row].height = 15 * max(2, len(item['text']) // 80 + 1)
    last = len(items) + 1
    for column, values in (('F', SENTIMENTS), ('G', TYPES)):
        validation = DataValidation(type='list', formula1='"' + ','.join(values) + '"', allow_blank=True, showErrorMessage=True)
        validation.add(f'{column}2:{column}{last}')
        sheet.add_data_validation(validation)
    sheet.freeze_panes = 'C2'


def themes_sheet(book, lang):
    names = NAMES[lang]
    sheet = book.create_sheet(names['themes'])
    for column, title in enumerate(names['themes_header'], start=1):
        cell = sheet.cell(1, column, title)
        cell.font = BOLD
        cell.fill = HEADER_FILL
    sheet.column_dimensions['A'].width = 10
    sheet.column_dimensions['B'].width = 45
    sheet.column_dimensions['C'].width = 50
    validation = DataValidation(type='list', formula1='"' + ','.join(KINDS) + '"', allow_blank=True, showErrorMessage=True)
    validation.add('A2:A400')
    sheet.add_data_validation(validation)
    sheet.freeze_panes = 'A2'


def main():
    items = [json.loads(line) for line in ITEMS.read_text(encoding='utf-8').splitlines() if line.strip()]
    for lang in ('en', 'de'):
        book = Workbook()
        guide_sheet(book, lang)
        items_sheet(book, lang, [item for item in items if item['lang'] == lang])
        themes_sheet(book, lang)
        # Fixed metadata, so the same input gives the same file.
        book.properties.creator = 'Painfold'
        book.properties.title = f'Painfold analysis labels ({lang})'
        path = OUT / f'labelling-{lang}.xlsx'
        book.save(path)
        print(f'Wrote {path.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
