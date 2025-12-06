#!/bin/bash

# Build ZIP files from example chat folders
# These ZIPs can be used for testing the WhatsApp Backup Reader app

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building example ZIP files..."

# Build family-group-chat.zip
if [ -d "family-group-chat" ]; then
    rm -f family-group-chat.zip
    cd family-group-chat
    zip -r ../family-group-chat.zip . -x "*.DS_Store"
    cd ..
    echo "✅ Created family-group-chat.zip"
else
    echo "❌ family-group-chat folder not found"
fi

# Build private-chat.zip
if [ -d "private-chat" ]; then
    rm -f private-chat.zip
    cd private-chat
    zip -r ../private-chat.zip . -x "*.DS_Store"
    cd ..
    echo "✅ Created private-chat.zip"
else
    echo "❌ private-chat folder not found"
fi

echo ""
echo "Done! ZIP files are ready for testing."
echo ""
echo "To test, drag and drop the ZIP files into the WhatsApp Backup Reader app."
