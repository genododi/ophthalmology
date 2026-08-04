#!/bin/bash
#
# Push Ophthalmic Infographic Library to GitHub
# 
# Prerequisites:
# 1. GitHub CLI (gh) installed: brew install gh
# 2. Authenticated: gh auth login
#
# OR
#
# 1. SSH key set up with GitHub
#
# Usage: ./push_to_github.sh

set -e

echo "=================================================="
echo "  Ophthalmic Infographic GitHub Sync"
echo "=================================================="

# Change to script directory
cd "$(dirname "$0")"

# Generate library index
echo ""
echo "Step 1: Generating library-index.json..."
python3 sync_to_github.py --index

# Check if repo is initialized
if [ ! -d ".git" ]; then
    echo ""
    echo "Step 2: Initializing git repository..."
    git init
    git remote add origin https://github.com/genododi/ophthalmology.git
    git fetch origin
    git checkout -b main
    git reset --soft origin/main
fi

# Sync Library folder (capitalize for GitHub)
echo ""
echo "Step 3: Syncing Library folder..."
mkdir -p Library
cp library/*.json Library/ 2>/dev/null || true

# Stage changes
echo ""
echo "Step 4: Staging changes..."
git add -A

# The community pool files (community_data.json, sticky_notes.json) are written
# live by the app via the GitHub API and must never be overwritten by a stale
# local copy - always keep them out of sync commits.
git reset -- community_data.json sticky_notes.json www/community_data.json www/sticky_notes.json

# Check for changes
if git diff --cached --quiet; then
    echo "No changes to commit."
    exit 0
fi

# Commit
echo ""
echo "Step 5: Committing changes..."
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
git commit -m "Auto-sync library: $TIMESTAMP"

# Push
echo ""
echo "Step 6: Pushing to GitHub..."
echo ""

# Try GitHub CLI first (easiest authentication)
if command -v gh &> /dev/null; then
    echo "Using GitHub CLI for push..."
    gh auth status &> /dev/null && git push origin main || {
        echo ""
        echo "GitHub CLI not authenticated. Run: gh auth login"
        echo "Then run this script again."
        exit 1
    }
else
    # Fall back to regular git push
    git push origin main || {
        echo ""
        echo "Push failed. Please set up authentication:"
        echo ""
        echo "Option 1 - GitHub CLI (recommended):"
        echo "  brew install gh"
        echo "  gh auth login"
        echo ""
        echo "Option 2 - SSH Key:"
        echo "  ssh-keygen -t ed25519"
        echo "  cat ~/.ssh/id_ed25519.pub"
        echo "  (Add to https://github.com/settings/keys)"
        echo "  git remote set-url origin git@github.com:genododi/ophthalmology.git"
        echo ""
        exit 1
    }
fi

echo ""
echo "=================================================="
echo "  Successfully pushed to GitHub!"
echo "  View at: https://genododi.github.io/ophthalmology/"
echo "=================================================="
