#!/bin/sh
set -eu

TEMPLATE_FILE="/usr/share/nginx/html/env.template.js"
TARGET_FILE="/usr/share/nginx/html/env.js"
CONF_TEMPLATE="/etc/nginx/templates/default.conf.template"
CONF_TARGET="/etc/nginx/conf.d/default.conf"

: "${API_BASE_URL:=/api}"
: "${API_UPSTREAM:=http://host.docker.internal:8080}"

if [ -f "$TEMPLATE_FILE" ]; then
  sed "s|\${API_BASE_URL}|${API_BASE_URL}|g" "$TEMPLATE_FILE" > "$TARGET_FILE"
fi

if [ -f "$CONF_TEMPLATE" ]; then
  sed "s|\${API_UPSTREAM}|${API_UPSTREAM}|g" "$CONF_TEMPLATE" > "$CONF_TARGET"
fi
