#!/bin/sh
set -eu

TEMPLATE_FILE="/usr/share/nginx/html/env.template.js"
TARGET_FILE="/usr/share/nginx/html/env.js"

: "${API_BASE_URL:=http://34.58.123.99:8080}"

if [ -f "$TEMPLATE_FILE" ]; then
  sed "s|\${API_BASE_URL}|${API_BASE_URL}|g" "$TEMPLATE_FILE" > "$TARGET_FILE"
fi
