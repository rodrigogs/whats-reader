#!/bin/bash
# Generate Open Graph images for social media sharing
# Uses the actual app icon for a professional, recognizable look

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STATIC_DIR="$PROJECT_ROOT/static"
ICON="$STATIC_DIR/icon.png"

# Verify icon exists
if [ ! -f "$ICON" ]; then
    echo "Error: icon.png not found at $ICON"
    exit 1
fi

cd "$STATIC_DIR"

# Colors (WhatsApp theme)
BG_DARK="#075e54"      # WhatsApp dark green (header/dark mode)
BG_TEAL="#128C7E"      # WhatsApp teal

echo "Generating Open Graph images with app icon..."

# =============================================================================
# Main OG image (1200x630) - Facebook, LinkedIn, Discord, general
# Layout: Gradient background, icon on left, text on right
# =============================================================================
magick -size 1200x630 \
    -define gradient:direction=east \
    "gradient:${BG_DARK}-${BG_TEAL}" \
    \( "$ICON" -resize 280x280 \
       \( +clone -background black -shadow 60x20+0+10 \) \
       +swap -background none -layers merge +repage \
    \) -gravity west -geometry +100+0 -composite \
    -fill white \
    -font "Helvetica-Bold" -pointsize 56 \
    -gravity west -annotate +460-30 "WhatsApp" \
    -annotate +460+40 "Backup Reader" \
    -font "Helvetica" -pointsize 26 \
    -fill "rgba(255,255,255,0.85)" \
    -annotate +460+110 "Read your chat exports offline • Private & secure" \
    og-image.png

echo "✅ Created og-image.png (1200x630)"

# =============================================================================
# WhatsApp square image (800x800) - Avoids cropping on WhatsApp
# Layout: Icon centered on top, text below
# =============================================================================
magick -size 800x800 \
    -define gradient:direction=south \
    "gradient:${BG_DARK}-${BG_TEAL}" \
    \( "$ICON" -resize 260x260 \
       \( +clone -background black -shadow 60x20+0+10 \) \
       +swap -background none -layers merge +repage \
    \) -gravity center -geometry +0-100 -composite \
    -fill white \
    -font "Helvetica-Bold" -pointsize 44 \
    -gravity center -annotate +0+110 "WhatsApp" \
    -annotate +0+165 "Backup Reader" \
    -font "Helvetica" -pointsize 22 \
    -fill "rgba(255,255,255,0.85)" \
    -annotate +0+230 "Read your chats offline • Private & secure" \
    og-image-square.png

echo "✅ Created og-image-square.png (800x800)"

# =============================================================================
# Twitter/X image (copy of main, same dimensions work for Twitter cards)
# =============================================================================
cp og-image.png og-image-twitter.png
echo "✅ Created og-image-twitter.png (copy of og-image.png)"

# Show file sizes
echo ""
echo "📊 Generated images:"
ls -lh og-image*.png

echo ""
echo "🎯 Usage:"
echo "  - og-image.png (1200x630): Facebook, LinkedIn, Discord"
echo "  - og-image-square.png (800x800): WhatsApp (avoids cropping)"
echo ""
echo "💡 Test at: https://developers.facebook.com/tools/debug/"
