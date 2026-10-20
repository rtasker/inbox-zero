#!/usr/bin/env bash
# Vercel Hobby fork: saves the hobby/ folder to the "hobby" branch. The branch
# has only this folder (no upstream files), and hobby/reapply.sh reads it.
# Run it again after you change a file in hobby/.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

index="$(mktemp -u)"
trap 'rm -f "$index"' EXIT
export GIT_INDEX_FILE="$index"

git read-tree --empty
git add hobby
# Vercel builds every pushed branch. This file tells Vercel to skip the build.
skip="$(printf '{\n  "ignoreCommand": "exit 0"\n}\n' | git hash-object -w --stdin)"
git update-index --add --cacheinfo "100644,$skip,apps/web/vercel.json"
commit="$(git commit-tree "$(git write-tree)" -m "Hobby files backup")"

unset GIT_INDEX_FILE
git push --force origin "$commit:refs/heads/hobby"
echo "[hobby] Saved hobby/ to the hobby branch."
