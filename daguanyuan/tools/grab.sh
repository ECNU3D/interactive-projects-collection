#!/bin/bash
# 無頭取畫：直接從 canvas 讀回 PNG，避開無頭 Chrome 的合成時序
#   tools/grab.sh <輸出png> "<query>"
# 需要先起本地服務器：python3 -m http.server 8430
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="$1"; Q="$2"
SZ="${SIZE:-1100,700}"; PORT="${PORT:-8430}"; MAXWAIT="${MAXWAIT:-180}"
TAG="grab$$"
TMP=$(mktemp -d)

# Chrome 的 updater 子進程會吊住前台 shell，故後台跑 + 輪詢 + 收屍
( "$CHROME" --headless=new --disable-gpu --enable-unsafe-swiftshader --use-angle=swiftshader \
    --no-first-run --disable-component-update --disable-background-networking \
    --disable-background-timer-throttling --user-data-dir="$TMP/$TAG" \
    --window-size=$SZ --timeout=$((MAXWAIT * 1000)) --dump-dom \
    "http://localhost:$PORT/index.html?still=1&$Q" > "$TMP/dom.html" 2>"$TMP/err.txt" & )

for i in $(seq 1 "$MAXWAIT"); do
  sleep 1
  grep -q 'id="shot-data"' "$TMP/dom.html" 2>/dev/null && break
done
pkill -f "$TAG" >/dev/null 2>&1

python3 - "$TMP/dom.html" "$OUT" <<'PY'
import re, sys, base64
dom = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
m = re.search(r'id="shot-data"[^>]*>(data:image/png;base64,[A-Za-z0-9+/=]+)<', dom)
if not m:
    st = re.search(r'id="load-status"[^>]*>([^<]*)<', dom)
    print('NO IMAGE; status =', st.group(1) if st else '(空)')
    sys.exit(1)
open(sys.argv[2], 'wb').write(base64.b64decode(m.group(1).split(',', 1)[1]))
print('ok', sys.argv[2])
PY
code=$?
grep -oE '\[PERF\][^"]*' "$TMP/err.txt" 2>/dev/null | tail -1
rm -rf "$TMP"
exit $code
