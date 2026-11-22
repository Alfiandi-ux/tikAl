#!/data/data/com.termux/files/usr/bin/bash
# Jalankan tikAl
set -e
cd "$(dirname "$0")"

export PORT="${PORT:-8080}"
export HOST="${HOST:-127.0.0.1}"

# Buka browser otomatis setelah server siap (khusus Termux).
if [ "${OPEN_BROWSER:-1}" = "1" ] && command -v termux-open-url >/dev/null 2>&1; then
  ( sleep 1.2; termux-open-url "http://127.0.0.1:${PORT}" >/dev/null 2>&1 || true ) &
fi

exec python3 app.py
