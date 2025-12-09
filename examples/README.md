# Example WhatsApp Chat Exports

This directory contains example WhatsApp chat exports for testing and development purposes. These are **synthetic test data** - no real personal conversations are included.

## Quick Start

```bash
# Build the ZIP files
./chats/build-zips.sh

# Then drag the ZIP files into the app to test
```

## Directory Structure

```
examples/
├── README.md                           # This file
├── chats/                              # Chat export source files
│   ├── build-zips.sh                   # Script to create ZIP files
│   ├── family-group-chat/              # Group chat example
│   │   ├── WhatsApp Chat with Family Group 👨‍👩‍👧‍👦.txt
│   │   ├── IMG-20241201-WA0001.jpg
│   │   ├── IMG-20241204-WA0004.jpg
│   │   ├── PTT-20241201-WA0002.opus
│   │   └── VID-20241202-WA0003.mp4
│   ├── private-chat/                   # 1:1 chat example
│   │   ├── WhatsApp Chat with Alice.txt
│   │   ├── IMG-20241202-WA0001.jpg
│   │   ├── IMG-20241203-WA0003.jpg
│   │   ├── PTT-20241202-WA0002.opus
│   │   └── PTT-20241203-WA0004.opus
│   ├── family-group-chat.zip           # Built ZIP (gitignored)
│   └── private-chat.zip                # Built ZIP (gitignored)
└── bookmarks/                          # Example bookmark files
    ├── family-group-bookmarks.json     # Bookmarks for family chat
    └── private-chat-bookmarks.json     # Bookmarks for private chat
```

## Available Examples

### 1. Family Group Chat
A group chat simulation with **4 participants** demonstrating:
- ✅ Group creation and participant management
- ✅ System messages (encryption, joins, icon changes, disappearing messages)
- ✅ Text messages with emojis
- ✅ Media attachments (images, voice notes, video)
- ✅ Multi-day conversation spanning several dates

**Participants:** Mom, Dad, Sarah, Mike  
**Messages:** 50  
**Media:** 4 files (2 images, 1 audio, 1 video)

### 2. Private Chat
A 1:1 conversation between two people demonstrating:
- ✅ End-to-end encryption notification
- ✅ Security code change notification
- ✅ Text messages with emojis
- ✅ Media attachments (images, voice notes)
- ✅ Different time periods

**Participants:** Alice, Bob  
**Messages:** 45  
**Media:** 4 files (2 images, 2 audio)

## Bookmark Files

Example bookmark JSON files are provided to test the import/export functionality:

- **`bookmarks/family-group-bookmarks.json`**: 4 bookmarks from the family chat
- **`bookmarks/private-chat-bookmarks.json`**: 3 bookmarks from the private chat

### How to Use Bookmarks

1. Load a chat ZIP file into the app
2. Open the Bookmarks panel (bookmark icon)
3. Click "Import" and select the corresponding bookmark JSON file
4. The bookmarks will appear and can be navigated to

## WhatsApp Export Format Reference

### Message Format
```
[timestamp] - [sender]: [message]
```

### System Messages (no sender)
```
[timestamp] - [system notification]
```

### Common System Messages
- `Messages and calls are end-to-end encrypted...`
- `[Name] created group "[Group Name]"`
- `[Name] joined using this group's invite link`
- `[Name] added [Other Name]`
- `[Name] left`
- `[Name] changed this group's icon`
- `[Name] turned on disappearing messages`
- `[Name]'s security code with [Other Name] changed`

### Media Attachments
```
[timestamp] - [sender]: IMG-20241201-WA0001.jpg (file attached)
[timestamp] - [sender]: PTT-20241201-WA0002.opus (file attached)
[timestamp] - [sender]: VID-20241201-WA0003.mp4 (file attached)
```

### Date Formats
WhatsApp exports use locale-specific formats:
- **US:** `MM/DD/YY, HH:MM AM/PM`
- **European/Brazilian:** `DD/MM/YY, HH:MM`
- **ISO:** `YYYY-MM-DD, HH:MM`

## Media Files

The media files in these examples are:
- **Images:** Public domain placeholder images from [Lorem Picsum](https://picsum.photos/)
- **Audio:** Generated test tones (Opus format)
- **Video:** Generated test pattern (MP4 format)

All media is either generated or public domain (CC0).
