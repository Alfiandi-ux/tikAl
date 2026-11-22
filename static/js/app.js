/* =========================================================
   tikAl — frontend
   ========================================================= */

(() => {
  "use strict";

  const HISTORY_KEY = "tikAl-history-v1";
  const LEGACY_HISTORY_KEY = "tiktok-saver-history-v1";
  const MAX_HISTORY = 12;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const els = {
    form: $("#searchForm"),
    input: $("#urlInput"),
    submit: $("#submitBtn"),
    paste: $("#pasteBtn"),
    clear: $("#clearBtn"),
    loading: $("#loading"),
    loadingText: $("#loadingText"),
    errorBox: $("#errorBox"),
    errorText: $("#errorText"),
    retry: $("#retryBtn"),
    resultWrap: $("#resultWrap"),
    result: $("#result"),
    historyWrap: $("#historyWrap"),
    historyList: $("#historyList"),
    historyJump: $("#historyJump"),
    clearHistory: $("#clearHistory"),
    toast: $("#toast"),
    preview: $("#preview"),
    previewVideo: $("#previewVideo"),
  };

  const state = {
    data: null,
    busy: false,
    lastUrl: "",
    history: [],
  };

  const icons = {
    download: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0 0 4-4m-4 4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18V6.5l10-2v11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="16.5" cy="15.5" r="2.5" stroke="currentColor" stroke-width="1.8"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="13" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="m16 10 5-3v10l-5-3" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 3C19.5 15.4 12 20 12 20Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="none"><path d="M20.5 11.5a8 8 0 0 1-8 8H4.5l1.6-3.2a8 8 0 1 1 14.4-4.8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none"><path d="M14 4h6v6M20 4l-8.5 8.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 14v5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 19V7a1.5 1.5 0 0 1 1.5-1.5H10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none"><path d="M14 4h6v6M20 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 13.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none"><rect x="8.5" y="8.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M15.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 4.5V13a1.5 1.5 0 0 0 1.5 1.5h1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    zip: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3h10l3 3v15H4V3h3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 3v3h3V3M10.5 9.5v2m0 2v2m0 2v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5m0-8.5v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="10" r="1.6" stroke="currentColor" stroke-width="1.5"/><path d="m5.5 17 4.5-4 3.5 3 2.5-2 3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* ---------------- Helpers ---------------- */

  const esc = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));

  const safeUrl = (value = "") => (/^https?:\/\//i.test(value) ? value : "");

  const TRANSPARENT_PIXEL =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  const imgSrc = (value = "") => safeUrl(value) || TRANSPARENT_PIXEL;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const formatCount = (value) => {
    const number = Number(value) || 0;
    const short = (divisor, suffix) => {
      const result = number / divisor;
      const decimals = result >= 10 ? 0 : 1;
      return `${result.toFixed(decimals).replace(".", ",")}${suffix}`;
    };
    if (number >= 1e9) return short(1e9, " M");
    if (number >= 1e6) return short(1e6, " jt");
    if (number >= 1e3) return short(1e3, " rb");
    return String(number);
  };

  const formatSize = (bytes) => {
    const value = Number(bytes) || 0;
    if (value <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let index = 0;
    let number = value;
    while (number >= 1024 && index < units.length - 1) {
      number /= 1024;
      index += 1;
    }
    return `${number.toFixed(index === 0 ? 0 : 1).replace(".", ",")} ${units[index]}`;
  };

  const formatDuration = (seconds) => {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    if (!total) return "";
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  const downloadUrl = (url, filename, inline = false) =>
    `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename)}${inline ? "&inline=1" : ""}`;

  const saveBlob = (blob, filename) => {
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  };

  // Di APK Android, unduhan diserahkan ke DownloadManager lewat jembatan Java.
  const androidBridge = typeof window.TikAl !== "undefined" ? window.TikAl : null;

  const androidDownload = (path, filename) => {
    if (!androidBridge) return false;
    try {
      androidBridge.save(`${window.location.origin}${path}`, filename);
      return true;
    } catch {
      return false;
    }
  };

  const extractUrl = (text) => {
    const value = String(text || "").replace(/&amp;/gi, "&");
    const match = value.match(/https?:\/\/[^\s<>"']+/i);
    if (match) return match[0].replace(/[.,;:!?)\]}"']+$/, "");

    const bare = value.match(/(?:^|\s)((?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+)/i);
    return bare ? `https://${bare[1].replace(/[.,;:!?)\]}"']+$/, "")}` : "";
  };

  /* ---------------- Toast ---------------- */

  let toastTimer = null;

  function toast(message, type = "info") {
    clearTimeout(toastTimer);
    const icon = type === "success" ? icons.check : type === "error" ? icons.info : icons.info;
    els.toast.innerHTML = `${icon}<span>${esc(message)}</span>`;
    els.toast.className = `toast show ${type}`;
    toastTimer = setTimeout(() => {
      els.toast.className = "toast";
    }, 3800);
  }

  /* ---------------- Loading / error ---------------- */

  let loadingTimer = null;

  function showLoading() {
    els.errorBox.hidden = true;
    els.resultWrap.hidden = true;
    els.loading.hidden = false;

    const messages = [
      "Menghubungi TikTok…",
      "Mengambil detail video…",
      "Menyiapkan tautan kualitas HD…",
    ];
    let index = 0;
    els.loadingText.textContent = messages[0];
    clearInterval(loadingTimer);
    loadingTimer = setInterval(() => {
      index = (index + 1) % messages.length;
      els.loadingText.textContent = messages[index];
    }, 1500);
  }

  function stopLoading() {
    clearInterval(loadingTimer);
    els.loading.hidden = true;
  }

  function setBusy(busy) {
    state.busy = busy;
    els.submit.classList.toggle("is-busy", busy);
    els.submit.disabled = busy;
    els.input.readOnly = busy;
  }

  function showError(message) {
    stopLoading();
    els.errorText.textContent = message;
    els.errorBox.hidden = false;
    els.resultWrap.hidden = true;
    els.errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------------- Analyze ---------------- */

  async function analyze(rawInput) {
    if (state.busy) return;

    const raw = String(rawInput || "").trim();
    if (!raw) {
      toast("Tempel link TikTok dulu ya.", "error");
      els.input.focus();
      return;
    }

    let url = extractUrl(raw);
    if (!url && /^\d{8,}$/.test(raw)) {
      url = raw;
    }
    if (!url) {
      toast("Link tidak valid. Tempel link video TikTok.", "error");
      els.input.focus();
      return;
    }
    if (!/tiktok\.com/i.test(url) && !/^\d{8,}$/.test(url)) {
      toast("Link harus dari TikTok (tiktok.com).", "error");
      return;
    }

    state.lastUrl = raw;
    setBusy(true);
    showLoading();
    const started = performance.now();

    try {
      const response = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload?.error || "Gagal mengambil video. Coba lagi.");
      }

      const elapsed = performance.now() - started;
      if (elapsed < 650) await delay(650 - elapsed);

      state.data = payload.data;
      renderResult(payload.data);
      addHistory(payload.data);

      stopLoading();
      els.resultWrap.hidden = false;
      els.resultWrap.scrollIntoView({ behavior: "smooth", block: "start" });
      els.input.blur();
    } catch (error) {
      showError(error.message || "Terjadi kesalahan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- Render result ---------------- */

  function renderResult(data) {
    const images = data.images || [];
    const isSlideshow = images.length > 0;
    const videos = data.videos || [];
    const author = data.author || {};
    const stats = data.stats || {};
    const duration = formatDuration(data.duration);
    const bestVideo = videos.find((video) => !video.watermark) || videos[0];

    const slideshowMarkup = isSlideshow
      ? `
        <div class="slides-grid count-${Math.min(images.length, 4)}">
          ${images.slice(0, 4).map((src) => `<img src="${esc(imgSrc(src))}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join("")}
        </div>
        ${images.length > 4 ? `<span class="slides-more">+${images.length - 4} foto</span>` : ""}
      `
      : `
        <img class="cover" src="${esc(imgSrc(data.cover))}" alt="Sampul video" loading="lazy" referrerpolicy="no-referrer">
        ${bestVideo ? `<button type="button" class="play-btn" data-preview aria-label="Pratinjau video">${icons.play}</button>` : ""}
      `;

    const qualityRows = videos.map((video, index) => {
      const badge = video.quality === "hd" && !video.watermark ? '<em class="badge">Terbaik</em>' : "";
      const sub = [video.size_label, "MP4"].filter(Boolean).join(" · ");
      const classes = [
        "dl-row",
        video.quality === "hd" && !video.watermark ? "featured" : "",
        video.watermark ? "muted" : "",
      ].filter(Boolean).join(" ");
      return `
        <button type="button" class="${classes}" data-video-index="${index}">
          <span class="dl-ico">${video.watermark ? icons.video : icons.download}</span>
          <span class="dl-copy">
            <span class="dl-title">${esc(video.label)} ${badge}</span>
            <span class="dl-sub">${esc(sub || "Siap diunduh")}</span>
          </span>
          <span class="dl-action">${icons.download}</span>
          <span class="dl-bar"><i></i></span>
        </button>`;
    }).join("");

    const audioRow = data.music
      ? `
        <button type="button" class="dl-row audio" data-audio>
          <span class="dl-ico">${icons.music}</span>
          <span class="dl-copy">
            <span class="dl-title">Audio MP3</span>
            <span class="dl-sub">${esc([data.music.size_label, "MP3"].filter(Boolean).join(" · ") || "Musik latar")}</span>
          </span>
          <span class="dl-action">${icons.download}</span>
          <span class="dl-bar"><i></i></span>
        </button>`
      : "";

    const zipButton = isSlideshow
      ? `<button type="button" class="zip-btn" data-zip>${icons.zip} Unduh semua foto (${images.length})</button>`
      : "";

    const tag = isSlideshow
      ? `<span class="tag">${icons.image} SLIDESHOW</span>`
      : videos.some((video) => video.quality === "hd" && !video.watermark)
        ? '<span class="tag hd">HD</span>'
        : '<span class="tag">VIDEO</span>';

    els.result.innerHTML = `
      <article class="result-card">
        <div class="media ${isSlideshow ? "is-slides" : ""}">
          ${slideshowMarkup}
          <div class="media-top">
            ${tag}
            ${duration ? `<span class="duration">${esc(duration)}</span>` : ""}
          </div>
          <div class="media-bottom">
            ${data.music ? icons.music : icons.video}
            <span>${esc(data.music?.title || (isSlideshow ? `${images.length} foto` : "Video TikTok"))}</span>
          </div>
        </div>

        <div class="details">
          <div class="author-row">
            <img class="avatar" src="${esc(imgSrc(author.avatar))}" alt="" loading="lazy" referrerpolicy="no-referrer">
            <div class="author-meta">
              <strong>${esc(author.nickname || "TikTok")}</strong>
              <span>@${esc(author.username || "tiktok")}</span>
            </div>
            ${author.profile ? `<a class="open-link" href="${esc(safeUrl(author.profile))}" target="_blank" rel="noopener noreferrer">${icons.external}<span>TikTok</span></a>` : ""}
          </div>

          <p class="video-title">${esc(data.title || "Video TikTok")}</p>

          <div class="stats">
            <span class="stat">${icons.eye}<b>${formatCount(stats.views)}</b></span>
            <span class="stat">${icons.heart}<b>${formatCount(stats.likes)}</b></span>
            <span class="stat">${icons.comment}<b>${formatCount(stats.comments)}</b></span>
            <span class="stat">${icons.share}<b>${formatCount(stats.shares)}</b></span>
          </div>

          <div class="quality-list">
            ${qualityRows}
            ${audioRow}
          </div>

          ${zipButton}

          <div class="result-actions">
            <button type="button" class="action-btn" data-copy>${icons.copy} Salin link</button>
            ${bestVideo && !isSlideshow ? `<button type="button" class="action-btn" data-preview>${icons.play} Pratinjau</button>` : ""}
          </div>

          <p class="result-note">
            Unduhan diproses langsung di perangkatmu. Jika unduhan tidak mulai,
            coba lagi atau buka lewat Chrome.
          </p>
        </div>
      </article>`;

    bindResultActions();
  }

  function bindResultActions() {
    $$("[data-video-index]", els.result).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.videoIndex);
        const item = state.data?.videos?.[index];
        if (item) startDownload(button, item);
      });
    });

    const audioButton = $("[data-audio]", els.result);
    if (audioButton) {
      audioButton.addEventListener("click", () => {
        if (state.data?.music) startDownload(audioButton, state.data.music);
      });
    }

    const zipButton = $("[data-zip]", els.result);
    if (zipButton) zipButton.addEventListener("click", () => downloadZip(zipButton));

    $$("[data-preview]", els.result).forEach((button) => {
      button.addEventListener("click", openPreview);
    });

    const copyButton = $("[data-copy]", els.result);
    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(state.data?.sourceUrl || "");
          toast("Link video disalin.", "success");
        } catch {
          toast("Tidak bisa menyalin. Salin manual dari browser.", "error");
        }
      });
    }

    $$("img", els.result).forEach((image) => {
      image.addEventListener("error", () => {
        image.style.visibility = "hidden";
      });
    });
  }

  /* ---------------- Downloads ---------------- */

  async function startDownload(button, item) {
    if (button.classList.contains("downloading")) return;

    const proxy = downloadUrl(item.url, item.filename);

    if (androidDownload(proxy, item.filename)) {
      toast("Mengunduh… cek notifikasi atau folder Download.", "info");
      return;
    }

    button.classList.add("downloading");
    const bar = $(".dl-bar i", button);
    const sub = $(".dl-sub", button);
    const originalText = sub.textContent;

    try {
      const response = await fetch(proxy);

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Gagal mengunduh (${response.status}).`);
      }

      const total = Number(response.headers.get("Content-Length")) || Number(item.size) || 0;
      if (total > 100 * 1024 * 1024) {
        window.location.href = proxy;
        toast("Berkas besar — unduhan dialihkan ke browser.", "info");
        return;
      }

      if (!response.body) {
        window.location.href = proxy;
        return;
      }

      const contentType = response.headers.get("Content-Type") || "application/octet-stream";
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;

        if (total > 0) {
          const percent = Math.min(99, Math.round((received / total) * 100));
          bar.style.width = `${percent}%`;
          sub.textContent = `${percent}% · ${formatSize(received)} / ${formatSize(total)}`;
        } else {
          bar.style.width = "45%";
          sub.textContent = formatSize(received);
        }
      }

      const blob = new Blob(chunks, { type: contentType });
      saveBlob(blob, item.filename);
      bar.style.width = "100%";
      sub.textContent = "Selesai · tersimpan";
      toast("Berhasil diunduh. Cek folder Download.", "success");

      setTimeout(() => {
        button.classList.remove("downloading");
        bar.style.width = "0%";
        sub.textContent = originalText;
      }, 2600);
    } catch (error) {
      button.classList.remove("downloading");
      bar.style.width = "0%";
      sub.textContent = originalText;

      if (error instanceof TypeError) {
        window.location.href = proxy;
        toast("Mengunduh langsung lewat browser…", "info");
        return;
      }
      toast(error.message || "Gagal mengunduh. Coba lagi.", "error");
    }
  }

  async function downloadZip(button) {
    if (button.disabled) return;

    const zipName = state.data?.zipFilename || "tikal-foto.zip";
    const zipPath = `/api/zip?url=${encodeURIComponent(state.data?.sourceUrl || "")}`;
    if (androidDownload(zipPath, zipName)) {
      toast("Menyiapkan ZIP… cek notifikasi atau folder Download.", "info");
      return;
    }

    button.disabled = true;
    const original = button.innerHTML;
    button.textContent = "Menyiapkan ZIP…";

    try {
      const response = await fetch("/api/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: state.data?.sourceUrl || "" }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Gagal membuat ZIP.");
      }

      const blob = await response.blob();
      saveBlob(blob, zipName);
      toast("Semua foto berhasil diunduh.", "success");
    } catch (error) {
      toast(error.message || "Gagal mengunduh foto.", "error");
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  /* ---------------- Preview ---------------- */

  function openPreview() {
    const videos = state.data?.videos || [];
    const video = videos.find((item) => !item.watermark) || videos[0];
    if (!video) return;

    els.previewVideo.src = downloadUrl(video.url, "preview.mp4", true);
    els.preview.hidden = false;
    document.body.style.overflow = "hidden";
    els.previewVideo.play().catch(() => {});
  }

  function closePreview() {
    els.preview.hidden = true;
    els.previewVideo.pause();
    els.previewVideo.removeAttribute("src");
    els.previewVideo.load();
    document.body.style.overflow = "";
  }

  /* ---------------- History ---------------- */

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY) ?? localStorage.getItem(LEGACY_HISTORY_KEY) ?? "[]";
      const parsed = JSON.parse(raw);
      state.history = Array.isArray(parsed) ? parsed : [];
    } catch {
      state.history = [];
    }
    renderHistory();
  }

  function addHistory(data) {
    const slim = {
      id: data.id,
      title: data.title,
      cover: data.cover,
      duration: data.duration,
      author: data.author,
      stats: data.stats,
      music: data.music,
      videos: data.videos,
      images: data.images,
      sourceUrl: data.sourceUrl,
      zipFilename: data.zipFilename,
    };

    state.history = [slim, ...state.history.filter((item) => item.id !== data.id)].slice(0, MAX_HISTORY);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
    } catch {
      /* penyimpanan penuh — abaikan */
    }
    renderHistory();
  }

  function renderHistory() {
    const items = state.history;
    els.historyJump.hidden = items.length === 0;
    els.historyWrap.hidden = items.length === 0;
    if (!items.length) {
      els.historyList.innerHTML = "";
      return;
    }

    els.historyList.innerHTML = items.map((item, index) => {
      const label = item.images?.length ? "Slideshow" : formatDuration(item.duration) || "Video";
      return `
        <button type="button" class="history-card" data-history-index="${index}">
          <span class="history-thumb">
            <img src="${esc(imgSrc(item.cover))}" alt="" loading="lazy" referrerpolicy="no-referrer">
            <span class="history-play">${icons.play}</span>
          </span>
          <span class="history-copy">
            <strong>${esc(item.title || "Video TikTok")}</strong>
            <span>@${esc(item.author?.username || "tiktok")} · ${esc(label)}</span>
          </span>
        </button>`;
    }).join("");

    $$("[data-history-index]", els.historyList).forEach((button) => {
      button.addEventListener("click", () => {
        const item = state.history[Number(button.dataset.historyIndex)];
        if (!item) return;
        state.data = item;
        renderResult(item);
        els.resultWrap.hidden = false;
        els.errorBox.hidden = true;
        els.input.value = item.sourceUrl || "";
        toggleClearButton();
        els.resultWrap.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ---------------- UI events ---------------- */

  function toggleClearButton() {
    els.clear.hidden = els.input.value.length === 0;
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        toast("Clipboard kosong.", "info");
        return;
      }
      const url = extractUrl(text);
      els.input.value = url || text.trim();
      toggleClearButton();
      els.input.focus();
      toast("Link ditempel.", "success");
    } catch {
      els.input.focus();
      toast("Izin clipboard ditolak. Tempel manual dengan menekan lama di kolom.", "info");
    }
  }

  function bindEvents() {
    els.form.addEventListener("submit", (event) => {
      event.preventDefault();
      analyze(els.input.value);
    });

    els.input.addEventListener("input", toggleClearButton);

    els.clear.addEventListener("click", () => {
      els.input.value = "";
      toggleClearButton();
      els.input.focus();
    });

    els.paste.addEventListener("click", pasteFromClipboard);

    els.retry.addEventListener("click", () => {
      if (state.lastUrl) analyze(state.lastUrl);
    });

    $$(".chip[data-url]").forEach((chip) => {
      chip.addEventListener("click", () => {
        els.input.value = chip.dataset.url;
        toggleClearButton();
        analyze(chip.dataset.url);
      });
    });

    els.historyJump.addEventListener("click", () => {
      els.historyWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    els.clearHistory.addEventListener("click", () => {
      state.history = [];
      try {
        localStorage.removeItem(HISTORY_KEY);
        localStorage.removeItem(LEGACY_HISTORY_KEY);
      } catch {
        /* abaikan */
      }
      renderHistory();
      toast("Riwayat dihapus.", "success");
    });

    $$("[data-close]", els.preview).forEach((element) => {
      element.addEventListener("click", closePreview);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.preview.hidden) closePreview();
    });

    window.addEventListener("online", () => toast("Kembali online.", "success"));
    window.addEventListener("offline", () => toast("Kamu sedang offline.", "error"));
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* PWA opsional — abaikan jika gagal */
    });
  }

  /* ---------------- Init ---------------- */

  bindEvents();
  loadHistory();
  toggleClearButton();
  registerServiceWorker();
})();
