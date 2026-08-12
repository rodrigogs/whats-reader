# Parser Test Examples

This directory contains WhatsApp chat export examples in various formats for testing the parser's ability to handle different locales and date formats.

## Test Files

### 1. `german-format-test.txt`
- **Date Format**: `DD.MM.YYYY, HH:MM`
- **Example**: `10.12.2024, 14:30`
- **Locale**: German (de-DE)
- **Features Tested**:
  - German date format with dots
  - German media indicators: `<Medien ausgelassen>`, `.jpg (Datei angehängt)`
  - German system messages: "hat die Gruppe erstellt"

### 2. `spanish-format-test.txt`
- **Date Format**: `DD/MM/YYYY, HH:MM`
- **Example**: `10/12/2024, 14:30`
- **Locale**: Spanish (es-ES, es-MX)
- **Features Tested**:
  - European date format (DD/MM/YYYY)
  - Spanish media indicators: `<Archivo omitido>`, `.jpg (archivo adjunto)`
  - Spanish system messages: "creó el grupo"

### 3. `french-format-test.txt`
- **Date Format**: `DD/MM/YYYY, HH:MM`
- **Example**: `10/12/2024, 14:30`
- **Locale**: French (fr-FR)
- **Features Tested**:
  - European date format
  - French media indicators: `<Médias omis>`, `.jpg (fichier joint)`
  - French system messages: "a créé le groupe"

### 4. `asian-format-test.txt`
- **Date Format**: `YYYY/MM/DD, HH:MM`
- **Example**: `2024/12/10, 14:30`
- **Locale**: Japanese (ja-JP), Chinese (zh-CN)
- **Features Tested**:
  - Asian date format (year first)
  - Japanese media indicators: `<メディアなし>`, `.jpg (ファイル添付)`
  - Japanese characters in usernames and messages

### 5. `dash-format-test.txt`
- **Date Format**: `DD-MM-YYYY, HH:MM`
- **Example**: `10-12-2024, 14:30`
- **Locale**: Alternative European format
- **Features Tested**:
  - Date format with dashes instead of slashes/dots
  - Standard English media indicators

### 6. `yyyy-mm-dd-format-test.txt`
- **Date Format**: `YYYY/MM/DD, HH:MM AM/PM`
- **Example**: `2024/12/01, 10:04 pm`
- **Locale**: Asian format with 12-hour time
- **Features Tested**:
  - Year-first format with 12-hour AM/PM time
  - Lowercase am/pm variants
  - Tests for issue #69

## Supported Date Formats

The parser supports the following date patterns:

1. **US Format (12h)**: `MM/DD/YY, HH:MM AM/PM`
   - Example: `12/10/24, 2:30 PM`
   - Must include AM/PM indicator

2. **European/Brazilian Format (24h)**: `DD/MM/YY, HH:MM`
   - Example: `10/12/24, 14:30`
   - No AM/PM (24-hour format)

3. **ISO Format**: `YYYY-MM-DD, HH:MM`
   - Example: `2024-12-10, 14:30`
   - International standard

4. **German Format**: `DD.MM.YY, HH:MM`
   - Example: `10.12.24, 14:30`
   - Uses dots as separators

5. **Dash Format**: `DD-MM-YY, HH:MM`
   - Example: `10-12-24, 14:30`
   - Alternative European format

6. **Day-First 12h (localized AM/PM)**: `DD/MM/YY or DD.MM.YY, HH:MM AM/PM`
   - Examples: `28/3/2025 9:29 p. m.`, `23/06/2018, 1:55 p.m.`
   - Android Spanish exports use `a. m.`/`p. m.`; any spacing/dots variant
     (`p. m.`, `p.m.`, `PM`) is accepted
   - US `MM/DD` keeps priority when both readings are valid; dates where the
     US month would be invalid (day > 12) fall back to day-first (GH-78)

7. **Asian Format (24h)**: `YYYY/MM/DD, HH:MM`
   - Example: `2024/12/10, 14:30`
   - Year-first format (Japan, China, Korea)

8. **Asian Format (12h)**: `YYYY/MM/DD, HH:MM AM/PM`
   - Example: `2024/12/10, 2:30 PM`
   - Year-first format with 12-hour time
   - Resolves issue #69

9. **Bracketed Format**: `[DD/MM/YY or DD.MM.YY, HH:MM:SS]`
   - Examples: `[10/12/24, 14:30:45]`, `[26.06.26, 15:30:00]`
   - Some older WhatsApp versions; German iOS exports use dot separators

10. **iOS Bracketed Format (12h)**: `[DD/MM/YYYY or DD.MM.YY, HH:MM:SS AM/PM]`
    - Examples: `[13/11/2025, 12:25:55 PM]`, `[26.06.26, 3:00:00 PM]`
    - iOS WhatsApp exports
    - Uses 12-hour format with AM/PM
    - May contain Unicode whitespace (U+202F, U+00A0) before AM/PM
    - File typically named `_chat.txt` (with underscore prefix)

## Unicode Handling and Date Validation

- **Invisible prefixes**: zero-width characters and bidi marks (U+200B–U+200F,
  U+202A–U+202E, U+FEFF) that some exports prepend before the timestamp are
  stripped only from the matching view; `rawLine` and message content always
  keep the original bytes.
- **NBSP/NNBSP**: no-break space (U+00A0) and narrow no-break space (U+202F)
  are treated as regular spaces for timestamp recognition.
- **Date validation**: impossible dates (32/13/99, 29/02 in a non-leap year,
  31/04, hour 25) are rejected instead of rolling over to a different day.
- **Localized media markers**: iOS `<adjunto: ...>` (Spanish), `<Anhang: ...>`
  (German) and 40+ other languages are detected as media, and attachment
  filenames are matched to ZIP entries with NFC normalization.

## Test Files

### 1. `german-format-test.txt` (see above)
### 2. `spanish-format-test.txt` (see above)
### 3. `french-format-test.txt` (see above)
### 4. `asian-format-test.txt` (see above)
### 5. `dash-format-test.txt` (see above)
### 6. `ios-format-test.txt`
- **Date Format**: `[DD/MM/YYYY, HH:MM:SS AM/PM]`
- **Example**: `[13/11/2025, 12:25:55 PM]`
- **Locale**: iOS (all locales)
- **Features Tested**:
  - iOS bracketed date format with AM/PM
  - Unicode whitespace character (U+202F) between time and AM/PM
  - Underscore-prefixed filename (`_chat.txt`)
  - Right-to-left language support (Arabic text)

### 7. `gh78-ios-german-dot-ampm-unicode-test.txt` (GH-78)
- **Date Format**: `[DD.MM.YY, HH:MM:SS]` (24h) and `[DD.MM.YY, HH:MM:SS AM/PM]` (12h)
- **Examples**: `[26.06.26, 15:30:00]`, `[26.06.26, 3:00:00 PM]`
- **Locale**: iOS German (de-DE)
- **Features Tested**:
  - Bracketed German dates with dot separators (day-first `dd.MM.yy`)
  - Narrow no-break space (U+202F) and no-break space (U+00A0) before AM/PM
  - Invisible Unicode prefix (U+200E) before the timestamp — recognized for
    parsing while `rawLine` keeps the original bytes

### 8. `gh78-android-spanish-localized-ampm-test.txt` (GH-78)
- **Date Format**: `DD/MM/YYYY, HH:MM a. m.` / `p. m.`
- **Example**: `28/3/2025 9:29 p. m. - Sara: Hola, ¿cómo estás?`
- **Locale**: Android Spanish (es-ES, es-MX)
- **Features Tested**:
  - Day-first dates with localized AM/PM tokens (`a. m.`, `p. m.`, `p.m.`)
  - 12h rollover correctness: `12:30 p. m.` is noon, `12:05 a. m.` is midnight
  - US vs day-first discrimination: `03/04/24 9:30 PM` stays US (March 4),
    `28/3/2025 9:29 p. m.` is day-first (28 March)

### 9. `gh78-ios-localized-attached-media-test.txt` (GH-78)
- **Date Format**: `[DD/MM/YYYY, HH:MM:SS AM/PM]`
- **Example**: `[26/06/2026, 3:00:00 PM] Alex: <adjunto: 00000004-AUDIO-2026-06-26-20-31-14.opus>`
- **Locale**: iOS Spanish (es)
- **Features Tested**:
  - Localized iOS media marker `<adjunto: ...>` detected as audio
  - OPUS attachment association against ZIP media files

## Media Indicators Supported

The parser recognizes media indicators in multiple languages:

- **English**: `<Media omitted>`, `(file attached)`, iOS: `<attached:`
- **Portuguese**: `<Mídia oculta>`, `(arquivo anexado)`, iOS: `<anexo:`, `<anexado:`
- **French**: `<Médias omis>`, `(fichier joint)`, iOS: `<pièce jointe`
- **German**: `<Medien ausgelassen>`, `(Datei angehängt)`, iOS: `<Anhang:`, `<angehängt:`
- **Spanish**: `<Archivo omitido>`, `(archivo adjunto)`, iOS: `<adjunto:`
- **Italian**: `<Media eliminati>`, `(file allegato)`, iOS: `<allegato:`
- **Dutch**: `<Medien weggelaten>`, `(bestand bijgevoegd)`, iOS: `<bijgevoegd:`
- **Japanese**: `<メディアなし>`, `(ファイル添付)`, iOS: `<添付ファイル:`
- **Chinese**: `<媒体省略>`, `(附件)`, iOS: `<附件:`
- **Korean**: `<미디어 생략>`, iOS: `<첨부됨:`
- **Russian**: `<Медиа пропущены>`, `(файл прикреплен)`, iOS: `<прикреплено:`
- **Plus 20+ additional iOS languages**: Catalan, Swedish, Norwegian, Danish, Finnish, Irish, Czech, Slovak, Polish, Hungarian, Romanian, Croatian, Turkish, Vietnamese, Indonesian, Malay, Ukrainian, Greek, Arabic, Persian, Urdu, Hebrew, Hindi, Marathi, Gujarati, Thai

## System Message Indicators

System messages (group events, encryption notices) are recognized in:

- English
- Portuguese
- Spanish
- French
- German
- Italian
- Dutch

## Testing

To test the parser with these examples:

1. Run the application: `npm run dev`
2. Create a ZIP file with one of the test `.txt` files
3. Drag and drop the ZIP into the application
4. Verify that messages, dates, and media are parsed correctly

## Adding New Formats

To add support for a new date format or locale:

1. Add the date regex pattern to `DATE_PATTERNS` in `src/lib/parser/chat-parser.ts`
2. Add media indicators to `MEDIA_INDICATORS`
3. Add system message patterns to `SYSTEM_INDICATORS`
4. Create a test file in this directory
5. Test with various edge cases

## Notes

- The parser attempts multiple patterns in order, using the first match
- More specific patterns (e.g., with AM/PM) should be tested before generic ones
- Year values < 100 are automatically normalized (50-99 → 1900s, 00-49 → 2000s)
- All dates are parsed to JavaScript Date objects in UTC
