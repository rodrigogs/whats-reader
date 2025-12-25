#!/bin/bash

# Build ZIP files from example chat folders
# These ZIPs can be used for testing the WhatsApp Backup Reader app

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building example ZIP files..."
echo ""

# Android Examples
echo "📱 Android Format Examples:"

# Build android-group-chat.zip
if [ -d "android-group-chat" ]; then
    rm -f android-group-chat.zip
    cd android-group-chat
    zip -r ../android-group-chat.zip . -x "*.DS_Store"
    cd ..
    echo "✅ Created android-group-chat.zip"
else
    echo "❌ android-group-chat folder not found"
fi

# Build android-private-chat.zip
if [ -d "android-private-chat" ]; then
    rm -f android-private-chat.zip
    cd android-private-chat
    zip -r ../android-private-chat.zip . -x "*.DS_Store"
    cd ..
    echo "✅ Created android-private-chat.zip"
else
    echo "❌ android-private-chat folder not found"
fi

echo ""
echo "📱 iOS Format Examples:"

# Build ios-group-chat.zip
if [ -d "ios-group-chat" ]; then
    rm -f ios-group-chat.zip
    cd ios-group-chat
    zip -r ../ios-group-chat.zip . -x "*.DS_Store"
    cd ..
    echo "✅ Created ios-group-chat.zip"
else
    echo "❌ ios-group-chat folder not found"
fi

# Build ios-private-chat.zip
if [ -d "ios-private-chat" ]; then
    rm -f ios-private-chat.zip
    cd ios-private-chat
    zip -r ../ios-private-chat.zip . -x "*.DS_Store"
    cd ..
    echo "✅ Created ios-private-chat.zip"
else
    echo "❌ ios-private-chat folder not found"
fi

echo ""
echo "Done! ZIP files are ready for testing."
echo ""
echo "To test, drag and drop the ZIP files into the WhatsApp Backup Reader app."
echo ""
echo "Formats:"
echo "  - Android: DD/MM/YY, HH:MM - format"
echo "  - iOS:     [DD/MM/YYYY, HH:MM:SS AM/PM] format"

