# WhatsApp Chat Examples

This directory contains example WhatsApp chat exports for testing the WhatsApp Backup Reader application. Both Android and iOS formats are provided.

## Directory Structure

```
examples/chats/
├── android-private-chat/       # Android format - private conversation
├── android-group-chat/         # Android format - group conversation
├── ios-private-chat/          # iOS format - private conversation
├── ios-group-chat/            # iOS format - group conversation
└── build-zips.sh             # Script to create test ZIP files
```

## Format Differences

### Android Format
- **Filename**: `WhatsApp Chat with [Contact].txt`
- **Date Format**: `DD/MM/YY, HH:MM -` (24-hour time)
- **Example**: `01/12/24, 10:00 - Alice: Hello!`
- **Characteristics**:
  - No brackets around timestamp
  - 24-hour time format
  - Hyphen after timestamp before sender name

### iOS Format
- **Filename**: `_chat.txt` (underscore prefix)
- **Date Format**: `[DD/MM/YYYY, HH:MM:SS AM/PM]` (12-hour time)
- **Example**: `[01/12/2024, 10:00:00 AM] Alice: Hello!`
- **Characteristics**:
  - Square brackets around timestamp
  - 12-hour time with AM/PM
  - Full 4-digit year
  - Includes seconds
  - May contain Unicode whitespace (U+202F) before AM/PM

## Building Test ZIP Files

Run the build script to create ZIP files from the example directories:

```bash
cd examples/chats
./build-zips.sh
```

This will create:
- `android-private-chat.zip`
- `android-group-chat.zip`
- `ios-private-chat.zip`
- `ios-group-chat.zip`

## Testing with the App

1. Build the ZIP files using the script above
2. Open the WhatsApp Backup Reader app (web or desktop)
3. Drag and drop any of the ZIP files into the app
4. The chat should load and display correctly

## Example Content

### Private Chat Examples
Both Android and iOS private chat examples contain:
- Encryption notice
- Text messages with emojis
- Media attachments (images and voice messages)
- Security code change notification
- Conversation spanning multiple days

### Group Chat Examples
Both Android and iOS group chat examples contain:
- Group creation messages
- Member additions
- Group icon changes
- Subject changes
- Multiple participants
- System messages
- Media attachments

## Media Files

Example media files are included:
- **Images**: Sample JPG files representing photos
- **Audio**: Sample OPUS files representing voice messages

Note: The media files are placeholder files for testing purposes.

## Use Cases

These examples are useful for:
- **Development**: Testing parser functionality
- **Testing**: Validating UI components
- **Documentation**: Demonstrating supported formats
- **Bug Reproduction**: Creating minimal test cases
- **Regression Testing**: Ensuring format compatibility

## Adding New Examples

To add a new example:

1. Create a new directory: `examples/chats/[format-type]-[chat-type]/`
2. Add the chat text file:
   - Android: Name it descriptively (e.g., `WhatsApp Chat with Contact.txt`)
   - iOS: Name it `_chat.txt`
3. Add any media files referenced in the chat
4. Update `build-zips.sh` to include the new example
5. Document the example in this README

## Notes

- All example data is fictional
- No real user data is included
- Media files are placeholders
- ZIP files are ignored by git (see `.gitignore`)
