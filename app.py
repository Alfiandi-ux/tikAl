#!/usr/bin/env python3
"""
tikAl — downloader TikTok tanpa watermark (HD).

Aplikasi web lokal: tempel link TikTok, pilih kualitas, unduh.
Backend: Flask + requests. Tidak menyimpan data pengguna.
"""

from __future__ import annotations

import html as html_lib
import io
import ipaddress
import os
import re
import socket
import threading
import time
import zipfile
from pathlib import Path
from urllib.parse import quote, urlparse

import requests
from flask import (
    Flask,
    Response,
    jsonify,
    render_template,
    request,
    send_file,
    send_from_directory,
    stream_with_context,
)

APP_NAME = "tikAl"
DEFAULT_PORT = 8080

# ---------------------------------------------------------------------------
# Konfigurasi
# ---------------------------------------------------------------------------

TIKWM_ENDPOINTS = (
    "https://www.tikwm.com/api/",
    "https://tikwm.com/api/",
)
UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
)
HTTP_TIMEOUT = (10, 30)

# Domain CDN yang boleh dipakai lewat proxy download (mencegah SSRF).
ALLOWED_MEDIA_SUFFIXES = (
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokcdn-eu.com",
    "tiktokcdn-va.com",
    "tiktokcdn.net",
    "tiktokv.com",
    "tiktokv.us",
    "tiktok.com",
    "tikwm.com",
    "ibytedtos.com",
    "ibyteimg.com",
    "byteoversea.com",
    "byteimg.com",
    "muscdn.com",
    "ttcdn.com",
    "pstatp.com",
)

URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)
AWEME_RE = re.compile(r"/(?:video|photo|v)/(\d{6,})")
USERNAME_RE = re.compile(r"[^a-z0-9._-]+")

BASE_DIR = Path(__file__).resolve().parent
WEB_ROOT = Path(os.environ.get("TIKAL_WEB_ROOT", BASE_DIR))

app = Flask(
    __name__,
    template_folder=str(WEB_ROOT / "templates"),
    static_folder=str(WEB_ROOT / "static"),
)
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # request JSON kecil saja
app.json.ensure_ascii = False

session = requests.Session()
session.headers.update(
    {
        "User-Agent": UA,
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
        "Accept": "application/json, text/plain, */*",
    }
)

_cache: dict[str, tuple[float, dict]] = {}
_cache_lock = threading.Lock()
CACHE_TTL = 300  # detik


class AppError(Exception):
    """Kesalahan yang aman ditampilkan ke pengguna."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


# ---------------------------------------------------------------------------
# Utilitas
# ---------------------------------------------------------------------------


def extract_url(text: str) -> str:
    """Ambil URL pertama dari teks (mis. teks share TikTok)."""
    text = html_lib.unescape((text or "").strip())
    match = URL_RE.search(text)
    if match:
        return match.group(0).rstrip(".,;:!?)]}\u201d\u2019'\"")

    bare = re.search(
        r"(?:^|\s)((?:www\.|vm\.|vt\.|m\.)?tiktok\.com/\S+)", text, re.I
    )
    if bare:
        return "https://" + bare.group(1).rstrip(".,;:!?)]}\u201d\u2019'\"")

    if re.fullmatch(r"\d{8,}", text):
        return f"https://www.tiktok.com/@tiktok/video/{text}"
    raise AppError("Link tidak ditemukan. Tempel link video TikTok yang valid.")


def is_tiktok_url(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower().rstrip(".")
    except ValueError:
        return False
    return host == "tiktok.com" or host.endswith(".tiktok.com")


def resolve_url(url: str) -> str:
    """Normalisasi link pendek vm.tiktok.com / vt.tiktok.com."""
    if not is_tiktok_url(url):
        raise AppError("Link harus berasal dari TikTok (tiktok.com).")

    host = (urlparse(url).hostname or "").lower()
    if host.startswith(("vm.", "vt.")) or "/t/" in url:
        try:
            resp = session.get(url, timeout=15, allow_redirects=True, stream=True)
            final = resp.url
            resp.close()
            if is_tiktok_url(final):
                url = final
        except requests.RequestException:
            pass  # biarkan API mencoba link aslinya

    parsed = urlparse(url)
    return parsed._replace(fragment="").geturl()


def safe_username(value: str) -> str:
    cleaned = USERNAME_RE.sub("-", (value or "").lower()).strip("-._")
    return cleaned[:40] or "tiktok"


def friendly_error(message: str | None) -> str:
    low = (message or "").lower()
    if any(word in low for word in ("url parsing", "invalid", "not found", "does not exist", "private")):
        return (
            "Video tidak ditemukan. Pastikan link benar, video publik, "
            "dan belum dihapus."
        )
    if any(word in low for word in ("rate", "limit", "busy", "too many")):
        return "Server sedang sibuk. Tunggu beberapa detik lalu coba lagi."
    if any(word in low for word in ("timeout", "timed out", "connection")):
        return "Koneksi ke server lambat atau terputus. Periksa internet lalu coba lagi."
    return "Gagal mengambil video dari TikTok. Coba lagi sebentar lagi."


def human_size(size: int | None) -> str | None:
    try:
        value = int(size or 0)
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    units = ("B", "KB", "MB", "GB")
    index = 0
    number = float(value)
    while number >= 1024 and index < len(units) - 1:
        number /= 1024
        index += 1
    if index == 0:
        return f"{int(number)} {units[index]}"
    return f"{number:.1f} {units[index]}"


def safe_media_url(url: str) -> str:
    """Validasi URL media: skema, domain CDN, dan IP publik."""
    try:
        parsed = urlparse(url)
    except ValueError as exc:
        raise AppError("URL media tidak valid.") from exc

    if parsed.scheme not in ("http", "https"):
        raise AppError("URL media tidak valid.")
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host:
        raise AppError("URL media tidak valid.")
    if not any(host == suffix or host.endswith("." + suffix) for suffix in ALLOWED_MEDIA_SUFFIXES):
        raise AppError("Domain media tidak diizinkan.")

    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise AppError("Server media tidak dapat dihubungi.") from exc

    for info in infos:
        try:
            address = ipaddress.ip_address(info[4][0])
        except ValueError:
            raise AppError("Alamat media tidak valid.")
        if not address.is_global or address.is_multicast:
            raise AppError("Alamat media tidak valid.")

    return url


def content_disposition(filename: str, inline: bool = False) -> str:
    filename = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", filename or "").strip() or "tiktok.mp4"
    filename = filename[:180]
    ascii_name = filename.encode("ascii", "ignore").decode().strip() or "tiktok.mp4"
    kind = "inline" if inline else "attachment"
    return f'{kind}; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(filename)}'


# ---------------------------------------------------------------------------
# Pengambilan data TikTok
# ---------------------------------------------------------------------------


def _tikwm_request(url: str) -> dict:
    """Panggil API tikwm: dua host, masing-masing GET lalu POST."""
    last_error = "Server tidak merespons."
    for endpoint in TIKWM_ENDPOINTS:
        for method in ("get", "post"):
            try:
                if method == "get":
                    resp = session.get(
                        endpoint, params={"url": url, "hd": 1}, timeout=HTTP_TIMEOUT
                    )
                else:
                    resp = session.post(
                        endpoint, data={"url": url, "hd": 1}, timeout=HTTP_TIMEOUT
                    )
                resp.raise_for_status()
                payload = resp.json()
                if payload.get("code") == 0 and isinstance(payload.get("data"), dict):
                    return payload["data"]
                last_error = payload.get("msg") or last_error
            except (requests.RequestException, ValueError) as exc:
                last_error = str(exc)
    raise AppError(friendly_error(last_error), status=502)


def _pick_images(data: dict) -> list[str]:
    images: list[str] = []
    raw = data.get("images")
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, str) and item.startswith("http"):
                images.append(item)
            elif isinstance(item, dict):
                candidate = item.get("url") or item.get("display_image")
                if isinstance(candidate, str):
                    images.append(candidate)
                elif isinstance(candidate, dict):
                    urls = candidate.get("url_list") or []
                    if urls:
                        images.append(urls[0])

    if not images:
        post = data.get("image_post_info") or {}
        for item in post.get("images") or []:
            display = (item or {}).get("display_image") or {}
            urls = display.get("url_list") or []
            if urls:
                images.append(urls[0])

    seen: set[str] = set()
    return [img for img in images if not (img in seen or seen.add(img))]


def normalize(data: dict, source_url: str) -> dict:
    author = data.get("author") or {}
    username = author.get("unique_id") or "tiktok"
    nickname = author.get("nickname") or username
    aweme_id = str(data.get("id") or "")
    base = f"{safe_username(username)}-{aweme_id or int(time.time())}"

    music_info = data.get("music_info") or {}
    music_url = music_info.get("play") or data.get("music")

    videos = []

    def add_video(url, quality, label, size, watermark, filename):
        if not isinstance(url, str) or not url.startswith("http"):
            return
        if any(entry["url"] == url for entry in videos):
            return
        videos.append(
            {
                "quality": quality,
                "label": label,
                "url": url,
                "size": size,
                "size_label": human_size(size),
                "watermark": watermark,
                "filename": filename,
            }
        )

    hd_url = data.get("hdplay")
    sd_url = data.get("play")
    wm_url = data.get("wmplay")

    if hd_url:
        add_video(hd_url, "hd", "HD · Tanpa watermark", data.get("hd_size"), False, f"{base}-hd.mp4")
    if sd_url:
        add_video(
            sd_url,
            "sd" if hd_url else "hd",
            "Tanpa watermark" if not hd_url else "SD · Tanpa watermark",
            data.get("size"),
            False,
            f"{base}.mp4",
        )
    if wm_url:
        add_video(wm_url, "wm", "Dengan watermark", data.get("wm_size"), True, f"{base}-wm.mp4")

    if not videos and not _pick_images(data):
        raise AppError(
            "Video tidak memiliki tautan unduhan. Kemungkinan video privat atau dibatasi wilayah.",
            status=422,
        )

    duration = data.get("duration") or 0
    try:
        duration = int(duration)
    except (TypeError, ValueError):
        duration = 0

    created = data.get("create_time")
    created_iso = None
    if created:
        try:
            created_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(int(created)))
        except (TypeError, ValueError, OSError):
            created_iso = None

    images = _pick_images(data)

    return {
        "id": aweme_id,
        "sourceUrl": source_url,
        "title": (data.get("title") or "Video TikTok").strip(),
        "createdAt": created_iso,
        "duration": duration,
        "cover": data.get("origin_cover") or data.get("cover") or "",
        "dynamicCover": data.get("ai_dynamic_cover") or "",
        "author": {
            "username": username,
            "nickname": nickname,
            "avatar": author.get("avatar") or "",
            "profile": f"https://www.tiktok.com/@{username}" if username else "",
        },
        "stats": {
            "views": data.get("play_count") or 0,
            "likes": data.get("digg_count") or 0,
            "comments": data.get("comment_count") or 0,
            "shares": data.get("share_count") or 0,
            "saves": data.get("collect_count") or 0,
        },
        "music": (
            {
                "title": music_info.get("title") or "Audio TikTok",
                "author": music_info.get("author") or nickname,
                "url": music_url,
                "filename": f"{base}-audio.mp3",
                "size": music_info.get("size"),
                "size_label": human_size(music_info.get("size")),
            }
            if isinstance(music_url, str) and music_url.startswith("http")
            else None
        ),
        "videos": videos,
        "images": images,
        "zipFilename": f"{base}.zip",
    }


def get_info(raw_url: str, use_cache: bool = True) -> dict:
    url = resolve_url(extract_url(raw_url))
    key = url

    if use_cache:
        with _cache_lock:
            cached = _cache.get(key)
            if cached and time.time() - cached[0] < CACHE_TTL:
                return cached[1]

    data = _tikwm_request(url)
    info = normalize(data, url)

    with _cache_lock:
        if len(_cache) > 200:
            now = time.time()
            for old_key in [k for k, v in _cache.items() if now - v[0] > CACHE_TTL]:
                _cache.pop(old_key, None)
        _cache[key] = (time.time(), info)
    return info


# ---------------------------------------------------------------------------
# Rute
# ---------------------------------------------------------------------------


@app.get("/")
def index():
    return render_template("index.html", app_name=APP_NAME)


@app.get("/sw.js")
def service_worker():
    response = send_from_directory(app.static_folder, "sw.js", mimetype="application/javascript")
    response.headers["Service-Worker-Allowed"] = "/"
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.get("/manifest.webmanifest")
def manifest():
    return send_from_directory(
        app.static_folder, "manifest.webmanifest", mimetype="application/manifest+json"
    )


@app.get("/favicon.ico")
def favicon():
    return send_from_directory(app.static_folder, "icon-192.png", mimetype="image/png")


@app.get("/api/health")
def health():
    return jsonify(ok=True, app=APP_NAME, time=int(time.time()))


@app.route("/api/info", methods=["GET", "POST"])
def api_info():
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        raw_url = payload.get("url") or request.form.get("url") or ""
    else:
        raw_url = request.args.get("url", "")

    try:
        if not str(raw_url).strip():
            raise AppError("Tempel link TikTok terlebih dahulu.")
        info = get_info(str(raw_url))
        return jsonify(ok=True, data=info)
    except AppError as exc:
        return jsonify(ok=False, error=exc.message), exc.status
    except requests.RequestException:
        return (
            jsonify(ok=False, error="Tidak dapat terhubung ke server. Periksa koneksi internet."),
            502,
        )
    except Exception:  # noqa: BLE001 - jangan bocorkan detail internal
        app.logger.exception("Gagal memproses link")
        return jsonify(ok=False, error="Terjadi kesalahan tak terduga. Coba lagi."), 500


@app.get("/api/download")
def api_download():
    raw_url = request.args.get("url", "")
    filename = request.args.get("name") or "tiktok.mp4"
    inline = request.args.get("inline") == "1"

    try:
        url = safe_media_url(raw_url)
    except AppError as exc:
        return jsonify(ok=False, error=exc.message), exc.status

    headers = {
        "User-Agent": UA,
        "Referer": "https://www.tiktok.com/",
        "Accept": "*/*",
    }
    range_header = request.headers.get("Range")
    if range_header:
        headers["Range"] = range_header

    try:
        upstream = session.get(
            url, headers=headers, stream=True, timeout=(15, 90), allow_redirects=True
        )
    except requests.RequestException:
        return jsonify(ok=False, error="Gagal menghubungi server media."), 502

    if upstream.status_code >= 400:
        upstream.close()
        return (
            jsonify(ok=False, error="Media tidak tersedia atau tautan sudah kedaluwarsa."),
            502,
        )

    final_host = (urlparse(upstream.url).hostname or "").lower()
    if not any(
        final_host == suffix or final_host.endswith("." + suffix)
        for suffix in ALLOWED_MEDIA_SUFFIXES
    ):
        upstream.close()
        return jsonify(ok=False, error="Pengalihan media tidak diizinkan."), 400

    response_headers = {
        "Content-Disposition": content_disposition(filename, inline=inline),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Accel-Buffering": "no",
    }
    for header in (
        "Content-Type",
        "Content-Length",
        "Content-Range",
        "Accept-Ranges",
        "Last-Modified",
        "ETag",
    ):
        if header in upstream.headers:
            response_headers[header] = upstream.headers[header]
    if "Content-Type" not in response_headers:
        response_headers["Content-Type"] = "application/octet-stream"

    def generate():
        try:
            for chunk in upstream.iter_content(chunk_size=64 * 1024):
                if chunk:
                    yield chunk
        finally:
            upstream.close()

    return Response(
        stream_with_context(generate()),
        status=upstream.status_code,
        headers=response_headers,
        direct_passthrough=True,
    )


@app.route("/api/zip", methods=["GET", "POST"])
def api_zip():
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        raw_url = payload.get("url") or ""
    else:
        raw_url = request.args.get("url", "")
    try:
        info = get_info(str(raw_url))
        images = info.get("images") or []
        if not images:
            raise AppError("Postingan ini tidak berisi foto untuk diunduh.")

        buffer = io.BytesIO()
        total_bytes = 0
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for index, image_url in enumerate(images[:40], start=1):
                try:
                    safe_media_url(image_url)
                    resp = session.get(
                        image_url,
                        headers={"User-Agent": UA, "Referer": "https://www.tiktok.com/"},
                        timeout=HTTP_TIMEOUT,
                    )
                    content = resp.content
                    if not resp.ok or len(content) > 20 * 1024 * 1024:
                        continue
                    if total_bytes + len(content) > 200 * 1024 * 1024:
                        break

                    extension = "jpg"
                    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
                        extension = "webp"
                    elif content[:8] == b"\x89PNG\r\n\x1a\n":
                        extension = "png"

                    archive.writestr(f"foto-{index:02d}.{extension}", content)
                    total_bytes += len(content)
                except (AppError, requests.RequestException):
                    continue

        if buffer.tell() == 0:
            raise AppError("Gagal mengunduh foto. Coba lagi.", status=502)

        buffer.seek(0)
        return send_file(
            buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name=info.get("zipFilename") or "tikal-foto.zip",
        )
    except AppError as exc:
        return jsonify(ok=False, error=exc.message), exc.status
    except requests.RequestException:
        return jsonify(ok=False, error="Gagal mengunduh foto dari server."), 502


@app.errorhandler(404)
def not_found(_error):
    if request.path.startswith("/api/"):
        return jsonify(ok=False, error="Endpoint tidak ditemukan."), 404
    return render_template("index.html", app_name=APP_NAME), 404


def local_ip() -> str | None:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.5)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except OSError:
        return None


def run_server(host: str = "127.0.0.1", port: int = DEFAULT_PORT) -> None:
    """Jalankan server Flask (dipakai CLI maupun APK Android)."""
    app.run(host=host, port=port, debug=False, threaded=True, use_reloader=False)


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", DEFAULT_PORT))

    print()
    print("  tikAl — downloader tanpa watermark")
    print("  ─────────────────────────────────────────")
    print(f"  Lokal     : http://127.0.0.1:{port}")
    if host == "0.0.0.0":
        ip = local_ip()
        if ip:
            print(f"  Jaringan  : http://{ip}:{port}")
    print("  Hentikan  : Ctrl+C")
    print()
    run_server(host, port)


if __name__ == "__main__":
    main()
