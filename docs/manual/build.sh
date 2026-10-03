#!/bin/sh
# Builds docs/seedcraft-by-hand-{en,es}.pdf from docs/manual/by-hand.typ.
# Reproducible: pinned Typst, its bundled fonts only, fixed timestamp.
#   docs/manual/build.sh             (needs typst 0.15.1)
set -e
cd "$(dirname "$0")"
python3 ../../tools/gen_manual_data.py > data.json
for lang in en es; do
	typst compile --ignore-system-fonts --creation-timestamp 0 --input lang=$lang \
		by-hand.typ ../seedcraft-by-hand-$lang.pdf
done
shasum -a 256 ../seedcraft-by-hand-*.pdf | sed 's| \.\./| docs/|'
