#!/usr/bin/env bash
# Uploads ./tmp-images to the R2 bucket, preserving keys as object keys.
#
# Requires Cloudflare auth. Either:
#   wrangler login                      (interactive, easiest)
#   export CLOUDFLARE_API_TOKEN=...     (needs "Workers R2 Storage: Edit")
#
# The bucket must exist first:
#   npx wrangler r2 bucket create boldermade-images
set -euo pipefail

BUCKET="${R2_BUCKET:-boldermade-images}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/tmp-images"
WRANGLER="npx --yes wrangler"

if [ ! -d "$DIR" ]; then
  echo "No tmp-images/. Run: npm run fetch:images" >&2
  exit 1
fi

# Fail fast on auth rather than part-way through 57 uploads.
if ! $WRANGLER whoami >/dev/null 2>&1; then
  cat >&2 <<'MSG'
Not authenticated with Cloudflare.

  Interactive:  npx wrangler login
  CI / token:   export CLOUDFLARE_API_TOKEN=...   (scope: Workers R2 Storage: Edit)

Then create the bucket if it does not exist yet:
  npx wrangler r2 bucket create boldermade-images
MSG
  exit 1
fi

total=$(find "$DIR" -type f | wc -l | tr -d ' ')
echo "Uploading $total objects to r2://$BUCKET"
echo ""

n=0
while IFS= read -r -d '' file; do
  key="${file#"$DIR/"}"
  case "$file" in
    *.jpg|*.jpeg) ct=image/jpeg ;;
    *.png)        ct=image/png ;;
    *.webp)       ct=image/webp ;;
    *)            ct=application/octet-stream ;;
  esac
  n=$((n + 1))
  printf "  %2d/%s  %s\n" "$n" "$total" "$key"
  $WRANGLER r2 object put "$BUCKET/$key" --file "$file" --content-type "$ct" --remote >/dev/null
done < <(find "$DIR" -type f -print0)

echo ""
echo "Done — $n objects in r2://$BUCKET"
echo "Next: bind the bucket in wrangler.toml and deploy."
