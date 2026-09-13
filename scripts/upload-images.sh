#!/usr/bin/env bash
# Uploads ./tmp-images to the R2 bucket, preserving keys.
# Requires: wrangler login, and the bucket to exist.
set -euo pipefail

BUCKET="${R2_BUCKET:-boldermade-images}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tmp-images"

[ -d "$DIR" ] || { echo "No tmp-images/. Run: npm run fetch:images" >&2; exit 1; }

count=0
while IFS= read -r -d '' file; do
  key="${file#"$DIR/"}"
  case "$file" in
    *.jpg|*.jpeg) ct=image/jpeg ;;
    *.png)        ct=image/png ;;
    *.webp)       ct=image/webp ;;
    *)            ct=application/octet-stream ;;
  esac
  echo "  -> $key"
  wrangler r2 object put "$BUCKET/$key" --file "$file" --content-type "$ct" --remote
  count=$((count + 1))
done < <(find "$DIR" -type f -print0)

echo ""
echo "Uploaded $count objects to r2://$BUCKET"
