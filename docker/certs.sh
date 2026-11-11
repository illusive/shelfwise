#!/bin/sh
# Creates a self-signed certificate on first start when none is mounted.
# Prefer `npm run certs` on the host (uses mkcert when installed) for a trusted certificate.
set -eu

CERT_DIR=/etc/nginx/certs
mkdir -p "$CERT_DIR"
if [ -s "$CERT_DIR/cert.pem" ] && [ -s "$CERT_DIR/key.pem" ]; then
  exit 0
fi

SAN="DNS:localhost,IP:127.0.0.1"
if [ -n "${LAN_HOST:-}" ]; then
  case "$LAN_HOST" in
    *[!0-9.]*) SAN="$SAN,DNS:$LAN_HOST" ;;
    *) SAN="$SAN,IP:$LAN_HOST" ;;
  esac
fi

echo "shelfwise: generating self-signed certificate for $SAN"
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
  -subj "/CN=Shelfwise local" -addext "subjectAltName=$SAN" >/dev/null 2>&1
