# Fonts for generated images

`source-serif-4-bold-mn.ttf` is used only by `src/app/opengraph-image.tsx` (`next/og` cannot read the
woff2 files that `next/font` serves to browsers). It is Source Serif 4 Bold (SIL Open Font License 1.1,
see `OFL-SourceSerif4.txt`), subset to Basic Latin, Latin-1, the Cyrillic letters Mongolian uses
(including Ө ө Ү ү), punctuation, № and ₮.

Rebuild it:

```bash
python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools brotli
curl -s "https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@700" -A curl/8   # → .ttf URL
curl -s <ttf url> -o SourceSerif4-Bold.ttf
/tmp/ft/bin/pyftsubset SourceSerif4-Bold.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0400-045F,U+0490-0491,U+04AE-04AF,U+04E8-04E9,U+2010-2027,U+2030-203A,U+20AE,U+2116" \
  --layout-features='kern,liga,clig,calt,locl' --output-file=source-serif-4-bold-mn.ttf
```
