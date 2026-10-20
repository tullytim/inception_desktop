#!/bin/bash
# Build, sign, notarize and publish a macOS release to GitHub.
#
#   ./release.sh              full release (uploads a DRAFT release)
#   ./release.sh --check      run the pre-flight checks only
#   ./release.sh --dry-run    build and sign locally, publish nothing
#   ./release.sh --go-live    also publish the draft once it is uploaded (needs gh)
#   ./release.sh --skip-tests
#
# GitHub token: set GH_TOKEN, or store it once in the keychain:
#   security add-generic-password -s inception-release-gh -a "$USER" -w
# (or sign in with `gh auth login`). It is never written to this file.
#
# Notarization: set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID
# (or APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER).

[ -n "$BASH_VERSION" ] || exec bash "$0" "$@"
set -euo pipefail
cd "$(dirname "$0")"

REPO="tullytim/inception_desktop"
CHECK_ONLY=0 DRY_RUN=0 GO_LIVE=0 SKIP_TESTS=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --go-live) GO_LIVE=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    -h|--help) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg (see --help)"; exit 2 ;;
  esac
done

FAILED=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FAILED=1; }

VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"
echo "Releasing Inception $VERSION"
echo

echo "Pre-flight"

# --- git ---
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  warn "Uncommitted changes. The release will be built from your working tree, not the tag."
else
  ok "Working tree clean (branch: $BRANCH)"
fi
if git rev-parse --verify -q "origin/$BRANCH" >/dev/null; then
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]; then
    warn "HEAD isn't pushed to origin/$BRANCH. GitHub will tag whatever is on the remote."
  else
    ok "HEAD is pushed to origin/$BRANCH"
  fi
else
  warn "Branch $BRANCH isn't on origin. GitHub will tag the default branch."
fi

# --- version ---
LATEST=$(curl -fsS --max-time 10 "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null \
  | sed -n 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/p' | head -1 || true)
if [ -z "$LATEST" ]; then
  warn "Couldn't read the latest GitHub release (offline?). Skipping version comparison."
elif [ "$LATEST" = "$VERSION" ] || [ "$(printf '%s\n%s\n' "$LATEST" "$VERSION" | sort -V | tail -1)" != "$VERSION" ]; then
  warn "package.json is $VERSION but the latest release is v$LATEST. Existing users won't be offered an update unless this is newer."
else
  ok "Version $VERSION is newer than the latest release (v$LATEST)"
fi

# --- signing identity ---
IDENTITY=$(node -p "require('./package.json').build.mac.identity || ''")
IDENTS=$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application" || true)
COUNT=$(printf '%s' "$IDENTS" | grep -c . || true)
NAMES=$(printf '%s\n' "$IDENTS" | sed 's/^[^"]*"\(.*\)".*/\1/' | sort | uniq -d)
if [ "$COUNT" -eq 0 ]; then
  bad "No Developer ID Application certificate in the keychain."
elif [ -n "$NAMES" ]; then
  bad "Duplicate certificate \"$NAMES\" in the keychain; codesign can't choose between them."
  printf '%s\n' "$IDENTS" | sed 's/^/      /'
  echo "      Delete the older one in Keychain Access, then set build.mac.identity in package.json to the remaining hash."
elif [ -n "$IDENTITY" ] && ! printf '%s' "$IDENTS" | grep -qi "$IDENTITY"; then
  bad "build.mac.identity ($IDENTITY) isn't in the keychain. Found:"
  printf '%s\n' "$IDENTS" | sed 's/^/      /'
else
  ok "Signing certificate found"
fi

# --- notarization credentials ---
if [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
  ok "Notarization credentials set (Apple ID)"
elif [ -n "${APPLE_API_KEY:-}" ] && [ -n "${APPLE_API_KEY_ID:-}" ] && [ -n "${APPLE_API_ISSUER:-}" ]; then
  ok "Notarization credentials set (API key)"
elif [ "$DRY_RUN" -eq 1 ]; then
  warn "Notarization credentials not set; this local build won't be notarized."
else
  # Publishing without these produces a build macOS refuses to open ("could not verify...")
  bad "Notarization credentials missing: set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID."
fi

# --- GitHub token (only needed to publish) ---
if [ "$DRY_RUN" -eq 0 ]; then
  if [ -z "${GH_TOKEN:-}" ]; then
    GH_TOKEN=$(security find-generic-password -s inception-release-gh -w 2>/dev/null || true)
  fi
  if [ -z "${GH_TOKEN:-}" ] && command -v gh >/dev/null 2>&1; then
    GH_TOKEN=$(gh auth token 2>/dev/null || true)
  fi
  if [ -z "${GH_TOKEN:-}" ]; then
    bad "No GitHub token. Set GH_TOKEN, store it in the keychain (see top of this file), or run gh auth login."
  elif ! curl -fsS --max-time 10 -H "Authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/$REPO" >/dev/null 2>&1; then
    bad "The GitHub token can't access $REPO (expired or wrong scope?)."
  else
    ok "GitHub token works"
  fi
  export GH_TOKEN
  if git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
    warn "Tag $TAG already exists on origin; electron-builder will attach to that release."
  fi
fi

echo
if [ "$FAILED" -ne 0 ]; then
  echo "Can't continue: fix the items marked ✗ (the build would fail)."
  exit 1
fi
[ "$CHECK_ONLY" -eq 1 ] && { echo "All checks passed."; exit 0; }

# --- tests ---
if [ "$SKIP_TESTS" -eq 0 ]; then
  echo "Running tests"
  npm test --silent
  echo
fi

# After the build, confirm Gatekeeper will accept the app
verify_app() {
  local app out
  app=$(ls -dt dist/mac-arm64/Inception.app dist/mac/Inception.app 2>/dev/null | head -1)
  [ -n "$app" ] || { warn "Couldn't find the built app to verify."; return 0; }
  out=$(spctl -a -vvv -t exec "$app" 2>&1 || true)
  if printf '%s' "$out" | grep -q "Notarized Developer ID"; then
    ok "Gatekeeper: signed and notarized"
  else
    bad "Gatekeeper: NOT notarized. Users will see \"Apple could not verify Inception\". Don't publish this build."
    printf '%s\n' "$out" | sed 's/^/      /'
    return 1
  fi
}

# --- build ---
if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run: building without publishing"
  npm run build-mac -- --publish never
  echo
  verify_app || true
  echo
  echo "Done. Artifacts are in dist/ (open the .dmg to try it)."
  exit 0
fi

echo "Building and publishing $TAG"
npm run build-mac -- --publish always

echo
verify_app || echo "  The draft on GitHub contains this build. Delete it and fix notarization before publishing."
echo
if [ "$GO_LIVE" -eq 1 ]; then
  if command -v gh >/dev/null 2>&1; then
    gh release edit "$TAG" --repo "$REPO" --draft=false
    echo "Published: https://github.com/$REPO/releases/tag/$TAG"
  else
    warn "--go-live needs the gh CLI. Publish the draft by hand."
  fi
else
  echo "Uploaded as a DRAFT. Users won't see it until you publish it:"
  echo "  https://github.com/$REPO/releases"
fi
