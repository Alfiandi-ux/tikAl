"""Titik masuk Python untuk APK Android (Chaquopy).

Menjalankan server Flask tikAl di 127.0.0.1. Dipanggil dari MainActivity.java
lewat Python.getInstance().getModule("server").callAttr("start", PORT).
"""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import app as tikal  # noqa: E402


def start(port: int = 8765) -> None:
    tikal.run_server("127.0.0.1", int(port))
