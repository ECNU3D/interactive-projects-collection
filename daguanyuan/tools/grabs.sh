#!/bin/bash
# 批量取畫：tools/grabs.sh <輸出目錄> "名字|query" ...
D="$1"; shift
mkdir -p "$D"
for spec in "$@"; do
  N="${spec%%|*}"; Q="${spec#*|}"
  tools/grab.sh "$D/$N.png" "$Q"
done
