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

6. **Asian Format**: `YYYY/MM/DD, HH:MM`
   - Example: `2024/12/10, 14:30`
   - Year-first format (Japan, China, Korea)

7. **Bracketed Format**: `[DD/MM/YY, HH:MM:SS]`
   - Example: `[10/12/24, 14:30:45]`
   - Some older WhatsApp versions

## Media Indicators Supported

The parser recognizes media indicators in multiple languages:

- **English**: `<Media omitted>`, `(file attached)`
- **Portuguese**: `<Mídia oculta>`, `(arquivo anexado)`
- **French**: `<Médias omis>`, `(fichier joint)`
- **German**: `<Medien ausgelassen>`, `(Datei angehängt)`
- **Spanish**: `<Archivo omitido>`, `(archivo adjunto)`
- **Italian**: `<Media eliminati>`, `(file allegato)`
- **Dutch**: `<Medien weggelaten>`, `(bestand bijgevoegd)`
- **Japanese**: `<メディアなし>`, `(ファイル添付)`
- **Chinese**: `<媒体省略>`, `(附件)`
- **Russian**: `<Медиа пропущены>`, `(файл прикреплен)`

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
