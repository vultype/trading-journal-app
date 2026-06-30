#!/bin/bash
set -e

MSG="${1:-update}"

echo "📦 Staging changes..."
git add -A

if git diff --cached --quiet; then
  echo "⚠️  Tidak ada perubahan untuk di-commit."
else
  echo "💬 Commit: $MSG"
  git commit -m "$MSG"
fi

echo "🚀 Push ke GitHub..."
git push origin main

echo "⚡ Deploy ke Vercel..."
npx vercel --prod --yes

echo ""
echo "✅ Selesai! App sudah online."
