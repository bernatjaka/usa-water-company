#!/bin/sh
# Bump the stylesheet version on every page so browsers pick up CSS changes
# immediately instead of sitting on a cached copy. GitHub Pages serves
# styles.css with cache-control: max-age=600, so without this a CSS change can
# take ten minutes to appear, or longer if the browser already has it.
# Run after editing styles.css, before committing.
V=$(date +%Y%m%d%H%M%S)
for f in *.html; do
  sed -i '' "s|href=\"styles\.css[^\"]*\"|href=\"styles.css?v=$V\"|g" "$f"
done
echo "styles.css -> ?v=$V on $(ls *.html | wc -l | tr -d ' ') pages"
