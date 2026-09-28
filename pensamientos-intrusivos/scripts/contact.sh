#!/usr/bin/env bash
# Hoja de contactos de los stills (revisar el episodio de un vistazo).
# Uso: scripts/contact.sh ep01_felipe_vi   → episodes/<ep>/generated/contact.png
set -e
cd "$(dirname "$0")/.."
G="$(pwd)/episodes/$1/generated"
SHELL_BIN=${REMOTION_BROWSER:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
{
  echo '<html><body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:4px;width:2200px">'
  for f in "$G"/still_*.jpg; do
    n=$(basename "$f" .jpg); n=${n#still_}
    echo "<div style='position:relative'><img src='file://$f' width=270 height=480><span style='position:absolute;left:4px;top:4px;background:#ff0;font:bold 20px sans-serif'>${n}</span></div>"
  done
  echo '</body></html>'
} > "$G/contact.html"
"$SHELL_BIN" --no-sandbox --allow-file-access-from-files --hide-scrollbars --window-size=2200,1470 --screenshot="$G/contact.png" "file://$G/contact.html" >/dev/null 2>&1
echo "$G/contact.png"
