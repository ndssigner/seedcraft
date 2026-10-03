#!/bin/sh
# Builds the printable PDFs in docs/ from docs/manual/*.typ:
# seedcraft-by-hand-{en,es}.pdf and seedqr-templates-{en,es}.pdf.
# Reproducible: pinned Typst, its bundled fonts only, fixed timestamp.
#   docs/manual/build.sh             (needs typst 0.15.1)
set -e
cd "$(dirname "$0")"
python3 ../../tools/gen_manual_data.py > data.json
for lang in en es; do
	typst compile --ignore-system-fonts --creation-timestamp 0 --input lang=$lang \
		by-hand.typ ../seedcraft-by-hand-$lang.pdf
	typst compile --ignore-system-fonts --creation-timestamp 0 --input lang=$lang \
		seedqr-templates.typ ../seedqr-templates-$lang.pdf
done
shasum -a 256 ../*.pdf | sed 's| \.\./| docs/|'
