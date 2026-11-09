#!/usr/bin/env bash
# Turn this folder into its own Git repository named "fathom".
# Create an empty GitHub/Origin repo called fathom first, then run:
#   ./scripts/init-own-repo.sh git@github.com:<you>/fathom.git
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-https://github.com/rdmrcn/Fathom_OperationSystem.git}"
cd "$ROOT"

if [[ -d .git ]]; then
  echo "This folder already has a .git directory. Add a remote and push:"
  echo "  git remote add origin ${REMOTE:-<your-fathom-url>}"
  echo "  git push -u origin main"
  exit 0
fi

git init
git add .
git commit -m "Fathom: AI-assisted operations on SQL Server"
git branch -M main
if [[ -n "$REMOTE" ]]; then
  git remote add origin "$REMOTE"
  git push -u origin main
  echo "Pushed to $REMOTE"
else
  echo "Local repo ready. Create an empty GitHub repo named fathom, then:"
  echo "  git remote add origin git@github.com:<you>/fathom.git"
  echo "  git push -u origin main"
fi
