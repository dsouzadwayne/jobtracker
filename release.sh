#!/bin/bash

# Choose browser
echo "Select browser:"
echo "  1) chrome"
echo "  2) firefox"
read -p "Enter choice (1 or 2): " BROWSER_CHOICE

case "$BROWSER_CHOICE" in
  1) BROWSER="chrome" ;;
  2) BROWSER="firefox" ;;
  *)
    echo "Invalid choice. Aborting."
    exit 1
    ;;
esac

echo "Selected: $BROWSER"

MANIFEST="$BROWSER/jobtracker/manifest.json"

# Get current version
CURRENT_VERSION=$(grep -oP '"version":\s*"\K[^"]+' "$MANIFEST")
echo "Current version: $CURRENT_VERSION"

# Ask user for new version
read -p "Enter new version: " NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
  echo "No version entered. Aborting."
  exit 1
fi

# Update version in manifest.json
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST"
echo "Version updated to $NEW_VERSION"

# Delete existing zip
rm -f "$BROWSER/jobtracker.zip" 2>/dev/null

# Create new zip
(cd "$BROWSER/jobtracker" && zip -r ../jobtracker.zip .)
echo "Created $BROWSER/jobtracker.zip"

# Git commit and push
read -p "Enter commit message: " COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
  echo "No commit message entered. Aborting."
  exit 1
fi

git add .
git commit -m "$COMMIT_MSG"
git push
