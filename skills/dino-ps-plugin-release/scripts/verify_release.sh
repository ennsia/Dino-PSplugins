#!/bin/zsh
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "Usage: verify_release.sh <repo> <plugin> <version> <host>"
  exit 2
fi

REPO="$1"
PLUGIN="$2"
VERSION="$3"
HOST="$4"
NODE="${CODEX_NODE:-node}"
DIST="$REPO/dist/$PLUGIN/$VERSION"
CCX="$DIST/Dino-$PLUGIN"_"$HOST.ccx"
OFFLINE="$DIST/$PLUGIN-v$VERSION-offline.zip"
RELEASE="$REPO/releases/$PLUGIN/$VERSION"

cd "$REPO"

PRIVATE_EMAIL_USER="${DINO_PRIVATE_EMAIL_USER:-}"

if rg -n -i \
  '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' \
  . \
  --glob '!.git/**' \
  --glob '!dist/**' \
  --glob '!releases/**/*.ccx' \
  --glob '!releases/**/*.zip' |
  rg -v '@users\.noreply\.github\.com'; then
  echo "Release blocked: personal email information found."
  exit 1
fi

if [ -n "$PRIVATE_EMAIL_USER" ] && rg -n -i --fixed-strings "$PRIVATE_EMAIL_USER" . \
  --glob '!.git/**' \
  --glob '!dist/**' \
  --glob '!releases/**/*.ccx' \
  --glob '!releases/**/*.zip'; then
  echo "Release blocked: private email username found."
  exit 1
fi

"$NODE" scripts/validate-manifests.mjs

if [ -f "tests/$PLUGIN.test.cjs" ]; then
  "$NODE" "tests/$PLUGIN.test.cjs"
fi

if [ -f "tests/$PLUGIN-ui.test.cjs" ]; then
  "$NODE" "tests/$PLUGIN-ui.test.cjs"
fi

"$NODE" scripts/package-plugin.mjs "$PLUGIN"
"$NODE" scripts/verify-ccx.mjs "$CCX"

test -f "$CCX"
test -f "$OFFLINE"
test -f "$DIST/README_TEST_CN.txt"

mkdir -p "$RELEASE"
cp "$CCX" "$RELEASE/"
cp "$OFFLINE" "$RELEASE/"
cp "$DIST/README_TEST_CN.txt" "$RELEASE/"

cd "$RELEASE"
shasum -a 256 "Dino-$PLUGIN"_"$HOST.ccx" "$PLUGIN-v$VERSION-offline.zip" > SHA256SUMS.txt

shasum -a 256 -c SHA256SUMS.txt

echo "Release verified: $RELEASE"
