const BACKEND_API_BASE = "https://gapim.onrender.com";
const BACKEND_ENDPOINT = "/infositemrsm";
const defaultFooterNews =
  "Welcome to MRSM Info TV. New updates will appear here.";
const defaultSettings = {
  tickerDuration: 24,
  timetableUrl: "",
  timetableHeight: 210,
  footerNews: defaultFooterNews,
};

const backendUrl = () => `${BACKEND_API_BASE}${BACKEND_ENDPOINT}`;
const normalizeSlide = (slide = {}) => ({
  title: slide.title || "",
  message: slide.message || "",
  videoUrl: slide.videoUrl || "",
  duration: Number(slide.duration) || 30,
});
const normalizeAnnouncement = (item = {}) => ({
  title: item.title || "Announcement",
  imageUrl: item.imageUrl || "",
  linkUrl: item.linkUrl || item.url || "#",
  duration: Number(item.duration) || 12,
});
const normalizeSettings = (settings = {}) => ({
  ...defaultSettings,
  ...settings,
  footerNews: String(
    settings.footerNews || settings.newsText || defaultFooterNews,
  ),
});

async function fetchBackendData() {
  try {
    const response = await fetch(backendUrl(), { cache: "no-store" });
    if (!response.ok)
      throw new Error(`Backend request failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Backend fetch failed.", error);
    return null;
  }
}

async function loadDisplayData() {
  const data = await fetchBackendData();
  const slides = (
    Array.isArray(data?.videos) ? data.videos : data?.slides || []
  )
    .map(normalizeSlide)
    .filter((slide) => slide.videoUrl);
  const announcements = data?.announcements || {};
  const fallback = (data?.slides || [])
    .filter((slide) => slide.imageUrl)
    .map(normalizeAnnouncement);
  return {
    slides,
    bwp: (announcements.bwp || data?.bwpAnnouncements || fallback).map(
      normalizeAnnouncement,
    ),
    maktab: (announcements.maktab || data?.maktabAnnouncements || fallback).map(
      normalizeAnnouncement,
    ),
    settings: normalizeSettings(data?.settings),
    newsText:
      data?.newsText ||
      data?.footerNews ||
      data?.settings?.footerNews ||
      defaultFooterNews,
  };
}

async function persistContent(slides, bwp, maktab, settings) {
  const payload = {
    slides,
    videos: slides,
    announcements: { bwp, maktab },
    bwpAnnouncements: bwp,
    maktabAnnouncements: maktab,
    settings,
    newsText: settings.footerNews,
    footerNews: settings.footerNews,
  };
  try {
    let response = await fetch(backendUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      response = await fetch(backendUrl(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    if (!response.ok)
      throw new Error(`Backend save failed: ${response.status}`);
  } catch (error) {
    console.warn("Backend save failed.", error);
  }
}

function renderTicker(text, settings) {
  const content = document.getElementById("ticker-content");
  const repeated = `${text || defaultFooterNews}  |  ${text || defaultFooterNews}`;
  content.textContent = repeated;
  content.style.setProperty(
    "--ticker-duration",
    `${Math.max(5, Number(settings.tickerDuration) || 24)}s`,
  );
}

function renderAnnouncementCard(item, label) {
  const card = document.createElement("article");
  card.className = "announcement-card";
  card.style.backgroundImage = `url("${item.imageUrl}")`;
  const link = document.createElement("a");
  link.href = item.linkUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const tag = document.createElement("span");
  tag.className = "announcement-label";
  tag.textContent = label;
  const title = document.createElement("h2");
  title.textContent = item.title;
  const hint = document.createElement("p");
  hint.textContent = "Open announcement";
  link.append(tag, title, hint);
  card.appendChild(link);
  return card;
}

async function initDisplayPage() {
  const data = await loadDisplayData();
  const stage = document.getElementById("video-stage");
  const title = document.getElementById("slide-title");
  const message = document.getElementById("slide-message");
  const counter = document.getElementById("video-counter");
  const announcements = document.getElementById("announcement-list");
  const timetable = document.getElementById("timetable-slot");
  const clock = document.getElementById("clock");
  let index = 0;
  let timer;

  renderTicker(data.newsText, data.settings);
  if (data.settings.timetableUrl) {
    const frame = document.createElement("iframe");
    frame.src = data.settings.timetableUrl;
    frame.title = "Timetable";
    timetable.style.height = `${Math.max(100, Number(data.settings.timetableHeight) || 210)}px`;
    timetable.appendChild(frame);
  }
  const announcementBoxes = [
    { label: "BWP", items: data.bwp, index: 0 },
    { label: "MAKTAB", items: data.maktab, index: 0 },
  ];
  function renderAnnouncements() {
    announcements.innerHTML = "";
    announcementBoxes.forEach((box) =>
      announcements.appendChild(
        renderAnnouncementCard(
          box.items[box.index] || {
            title: `No ${box.label} announcement`,
            imageUrl: "",
            linkUrl: "#",
          },
          box.label,
        ),
      ),
    );
  }
  renderAnnouncements();
  window.setInterval(() => {
    announcementBoxes.forEach((box) => {
      if (box.items.length > 1) box.index = (box.index + 1) % box.items.length;
    });
    renderAnnouncements();
  }, 12000);

  function updateClock() {
    clock.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function showSlide() {
    clearTimeout(timer);
    if (!data.slides.length) {
      stage.innerHTML =
        '<div class="empty-state">No videos are configured in admin.html.</div>';
      title.textContent = "Display ready";
      message.textContent = "Add a public video URL in the admin panel.";
      counter.textContent = "0 / 0";
      return;
    }
    const slide = data.slides[index];
    stage.innerHTML = "";
    const video = document.createElement("video");
    video.src = slide.videoUrl;
    video.autoplay = true;
    video.controls = true;
    video.playsInline = true;
    video.muted = false;
    video.onended = () => {
      index = (index + 1) % data.slides.length;
      showSlide();
    };
    video.onerror = () => {
      message.textContent = "Unable to load this video URL.";
    };
    stage.appendChild(video);
    title.textContent = slide.title || "MRSM update";
    message.textContent = slide.message || "";
    counter.textContent = `${index + 1} / ${data.slides.length}`;
    video.play().catch(() => {
      message.textContent = "Press play once to enable video sound.";
    });
  }
  updateClock();
  window.setInterval(updateClock, 60000);
  showSlide();
}

async function initAdminPage() {
  const data = await loadDisplayData();
  let slides = data.slides;
  let bwp = data.bwp;
  let maktab = data.maktab;
  let settings = data.settings;
  const $ = (id) => document.getElementById(id);
  const list = $("slide-list");
  const sync = () => persistContent(slides, bwp, maktab, settings);
  function updateList() {
    list.innerHTML = "";
    slides.forEach((slide, index) => {
      const row = document.createElement("div");
      row.className = "slide-card";
      row.innerHTML = `<div><strong>${slide.title || `Video ${index + 1}`}</strong><span>${slide.videoUrl}</span><span>${slide.duration}s</span></div>`;
      const button = document.createElement("button");
      button.className = "button button-secondary";
      button.textContent = "Delete";
      button.type = "button";
      button.onclick = () => {
        slides.splice(index, 1);
        updateList();
        sync();
      };
      row.appendChild(button);
      list.appendChild(row);
    });
    if (!slides.length)
      list.innerHTML = '<p class="note">No videos saved yet.</p>';
  }
  $("slide-form").addEventListener("submit", (event) => {
    event.preventDefault();
    slides.push(
      normalizeSlide({
        title: $("slide-title").value.trim(),
        message: $("slide-message").value.trim(),
        videoUrl: $("slide-video").value.trim(),
        duration: $("slide-duration").value,
      }),
    );
    updateList();
    sync();
    event.target.reset();
    $("slide-duration").value = 30;
  });
  $("announcement-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const item = normalizeAnnouncement({
      title: $("announcement-title").value.trim(),
      imageUrl: $("announcement-image").value.trim(),
      linkUrl: $("announcement-link").value.trim(),
      duration: $("announcement-duration").value,
    });
    ($("announcement-section").value === "bwp" ? bwp : maktab).push(item);
    sync();
    event.target.reset();
    $("announcement-duration").value = 12;
  });
  $("settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    settings = normalizeSettings({
      ...settings,
      footerNews: $("footer-news").value.trim(),
      tickerDuration: $("ticker-duration").value,
      timetableUrl: $("timetable-url").value.trim(),
      timetableHeight: $("timetable-height").value,
    });
    sync();
  });
  $("clear-btn").onclick = () => $("slide-form").reset();
  $("clear-announcement-btn").onclick = () => $("announcement-form").reset();
  $("export-btn").onclick = () => {
    $("import-json").value = JSON.stringify(slides, null, 2);
  };
  $("import-btn").onclick = () => {
    try {
      slides = JSON.parse($("import-json").value).map(normalizeSlide);
      updateList();
      sync();
    } catch {
      alert("Import failed. Paste a valid video JSON array.");
    }
  };
  $("footer-news").value = data.newsText;
  $("ticker-duration").value = settings.tickerDuration;
  $("timetable-url").value = settings.timetableUrl;
  $("timetable-height").value = settings.timetableHeight;
  updateList();
}

window.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("display-page")) initDisplayPage();
  if (document.body.classList.contains("admin-page")) initAdminPage();
});
