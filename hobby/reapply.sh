#!/usr/bin/env bash
# Vercel Hobby fork: puts the Hobby changes back on top of origin/main and
# pushes. Use it after "Sync fork" > "Discard commits", or when the Vercel
# build log says to run it. See hobby/README.md.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "[hobby] You have uncommitted changes. Commit or discard them first." >&2
  exit 1
fi

git fetch origin main hobby
git checkout -B main origin/main
# After "Discard commits", main has no hobby/ folder. Get it from the backup.
if ! git cat-file -e HEAD:hobby/install.mjs 2>/dev/null; then
  git checkout origin/hobby -- hobby
fi
node hobby/vercel-json.mjs
git add hobby apps/web/vercel.json

if git diff --cached --quiet; then
  echo "[hobby] main already has the Hobby changes. Nothing to push."
  exit 0
fi

git commit --no-verify -m "Apply Vercel Hobby config"
git push origin main
echo "[hobby] Pushed. Vercel starts a new deployment."
bash hobby/backup.sh
