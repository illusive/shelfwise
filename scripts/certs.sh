#!/bin/sh
# Creates certs/cert.pem + certs/key.pem for HTTPS on the LAN.
# Uses mkcert when installed (trusted once its root CA is installed on the phone),
# otherwise openssl (self-signed: accept the browser warning once per device).
set -eu
cd "$(dirname "$0")/.."
mkdir -p certs

LAN_HOST="${LAN_HOST:-$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)}"
echo "LAN host: ${LAN_HOST:-<none>}"

if command -v mkcert >/dev/null 2>&1; then
  mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 ${LAN_HOST:+"$LAN_HOST"}
  echo "Root CA for phones: $(mkcert -CAROOT)/rootCA.pem"
else
  SAN="DNS:localhost,IP:127.0.0.1${LAN_HOST:+,IP:$LAN_HOST}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout certs/key.pem -out certs/cert.pem \
    -subj "/CN=Shelfwise local" -addext "subjectAltName=$SAN"
  echo "Self-signed certificate created for $SAN"
fi
