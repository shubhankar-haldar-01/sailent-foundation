#!/bin/bash
# Hard-coded colours in app and kit source (not tokens.css, tests, or the /dev/design preview).
cd "$1"
FILES=$(find apps/web/src packages/ui/src \( -name '*.tsx' -o -name '*.ts' -o -name '*.css' \) -not -path '*__tests__*' -not -path '*design-preview*' -not -name 'tokens.css' -not -name '*.test.*')
echo "hex:     $(grep -hEo '#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?\b|#[0-9A-Fa-f]{3}\b' $FILES | wc -l | tr -d ' ') in $(grep -lE '#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b' $FILES | wc -l | tr -d ' ') files"
echo "rgb():   $(grep -hEo 'rgba?\([^)]*\)' $FILES | wc -l | tr -d ' ')"
echo "oklch(): $(grep -hEo 'oklch\([^)]*\)' $FILES | wc -l | tr -d ' ')"
echo "palette: $(grep -hEo '\b(bg|text|border|from|to|via|ring|fill|stroke|outline|decoration|divide|shadow|accent|caret|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}' $FILES | wc -l | tr -d ' ')  (Tailwind's raw palette, e.g. text-slate-600)"
echo "--- by file (hex):"
for f in $FILES; do n=$(grep -cE '#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b' "$f"); [ "$n" -gt 0 ] && echo "$n $f"; done | sort -rn
