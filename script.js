const BACKEND_API_BASE = 'https://gapim.onrender.com';
const BACKEND_ENDPOINT = '/infositemrsm';
const defaultFooterNews = 'Welcome to MRSM Info TV • New updates will appear here • Keep an eye on the latest announcements';

function buildBackendUrl(endpoint = BACKEND_ENDPOINT) {
  const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${BACKEND_API_BASE}${safeEndpoint}`;
}

function normalizeSettings(settings = {}) {
  const theme = { ...defaultSettings, ...settings };
  const footerNews = (theme.footerNews ?? theme.newsText ?? defaultFooterNews ?? '').toString().trim() || defaultFooterNews;

  return {
    accentColor: theme.accentColor || defaultSettings.accentColor,
    accentSoftColor: theme.accentSoftColor || defaultSettings.accentSoftColor,
    backgroundColor: theme.backgroundColor || defaultSettings.backgroundColor,
    surfaceColor: theme.surfaceColor || defaultSettings.surfaceColor,
    textColor: theme.textColor || defaultSettings.textColor,
    mutedColor: theme.mutedColor || defaultSettings.mutedColor,
    slideTitleSize: theme.slideTitleSize ?? defaultSettings.slideTitleSize,
    slideMessageSize: theme.slideMessageSize ?? defaultSettings.slideMessageSize,
    overlayOpacity: theme.overlayOpacity ?? defaultSettings.overlayOpacity,
    tickerDuration: theme.tickerDuration ?? defaultSettings.tickerDuration,
    announcementCount: theme.announcementCount ?? defaultSettings.announcementCount,
    footerNews,
    newsText: footerNews
  };
}

function normalizeSlide(slide = {}) {
  return {
    title: slide.title || '',
    message: slide.message || '',
    imageUrl: slide.imageUrl || '',
    videoUrl: slide.videoUrl || '',
    duration: Number(slide.duration) || 12,
    caption: slide.caption || ''
  };
}

const defaultAnnouncements = [
  {
    title: 'Welcome',
    message: 'Display is ready and connected to the gapim.onrender.com endpoint.',
    note: 'The TV page reads slide and theme data from the shared backend.'
  }
];

const defaultSettings = {
  accentColor: '#6cc3ff',
  accentSoftColor: '#2f7fd3',
  backgroundColor: '#020814',
  surfaceColor: '#071222',
  textColor: '#eff7ff',
  mutedColor: '#9bb3cc',
  slideTitleSize: '2.5',
  slideMessageSize: '1.15',
  overlayOpacity: '0.82',
  tickerDuration: '20',
  announcementCount: '6',
  footerNews: defaultFooterNews
};

async function fetchBackendData() {
  if (!BACKEND_API_BASE.trim()) {
    return null;
  }

  try {
    const response = await fetch(buildBackendUrl(BACKEND_ENDPOINT), {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Backend fetch failed.', error);
    return null;
  }
}

function buildAnnouncementsFromSlides(slides) {
  return slides.map((slide, index) => ({
    title: slide.title || `Update ${index + 1}`,
    message: slide.message || '',
    note: slide.caption || ''
  }));
}

function applyDisplaySettings(settings = {}) {
  const theme = { ...defaultSettings, ...settings };
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.accentColor);
  root.style.setProperty('--accent-soft', theme.accentSoftColor);
  root.style.setProperty('--bg', theme.backgroundColor);
  root.style.setProperty('--surface', theme.surfaceColor);
  root.style.setProperty('--text', theme.textColor);
  root.style.setProperty('--muted', theme.mutedColor);
  root.style.setProperty('--overlay-opacity', theme.overlayOpacity);
  root.style.setProperty('--title-size', `${theme.slideTitleSize}rem`);
  root.style.setProperty('--message-size', `${theme.slideMessageSize}rem`);
  root.style.setProperty('--ticker-duration', `${Math.max(12, Number(theme.tickerDuration) || 20)}s`);
}

async function loadSlides() {
  if (BACKEND_API_BASE.trim()) {
    const backendData = await fetchBackendData();
    if (backendData && Array.isArray(backendData.slides)) {
      return backendData.slides.map(normalizeSlide);
    }
  }

  return [];
}

async function loadDisplayData() {
  const backendData = await fetchBackendData();
  const normalizedSettings = normalizeSettings(backendData?.settings || {});
  const footerNews = backendData?.newsText || backendData?.footerNews || normalizedSettings.footerNews || defaultFooterNews;

  if (backendData && Array.isArray(backendData.slides) && backendData.slides.length) {
    return {
      slides: backendData.slides.map(normalizeSlide),
      announcements: Array.isArray(backendData.announcements)
        ? backendData.announcements
        : buildAnnouncementsFromSlides(backendData.slides),
      settings: normalizedSettings,
      newsText: footerNews
    };
  }

  return {
    slides: [],
    announcements: defaultAnnouncements,
    settings: normalizedSettings,
    newsText: footerNews
  };
}

function saveSlides(slides, settings = {}) {
  const normalizedSlides = slides.map(normalizeSlide);
  void persistSlidesToBackend(normalizedSlides, settings);
  return normalizedSlides;
}

async function persistSlidesToBackend(slides, settings = {}) {
  if (!BACKEND_API_BASE.trim()) {
    return;
  }

  try {
    const normalizedSettings = normalizeSettings(settings);
    const payload = {
      slides,
      announcements: buildAnnouncementsFromSlides(slides),
      settings: normalizedSettings,
      newsText: normalizedSettings.footerNews,
      footerNews: normalizedSettings.footerNews
    };

    let response = await fetch(buildBackendUrl(BACKEND_ENDPOINT), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      response = await fetch(buildBackendUrl(BACKEND_ENDPOINT), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) {
      throw new Error(`Backend save failed: ${response.status}`);
    }
  } catch (error) {
    console.warn('Backend save failed.', error);
  }
}

function formatClock(date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function initDisplayPage() {
  const slideMedia = document.getElementById('slide-media');
  const slideTitle = document.getElementById('slide-title');
  const slideMessage = document.getElementById('slide-message');
  const slideCaption = document.getElementById('slide-caption');
  const announcementList = document.getElementById('announcement-list');
  const tickerContent = document.getElementById('ticker-content');
  const clock = document.getElementById('clock');

  const displayData = await loadDisplayData();
  let slides = displayData.slides;
  let announcements = displayData.announcements;
  let currentSettings = displayData.settings || {};
  let currentNewsText = displayData.newsText || currentSettings.footerNews || defaultFooterNews;
  let currentIndex = 0;
  let timerId = null;

  function updateClock() {
    clock.textContent = formatClock(new Date());
  }

  function updateTicker() {
    const text = (currentNewsText || '').trim() || `Latest updates • ${slides.length ? 'Slides ready' : 'No content yet'}`;
    const repeatedText = `${text} • ${text}`;
    tickerContent.innerHTML = `<span>${repeatedText}</span><span>${repeatedText}</span>`;
    const duration = Math.max(18, Math.min(40, Math.ceil(text.length / 8)));
    tickerContent.style.setProperty('--ticker-duration', `${Math.max(12, Number(currentSettings.tickerDuration) || duration)}s`);
  }

  function renderSlide(slide) {
    slideTitle.textContent = slide.title || 'Information';
    slideMessage.textContent = slide.message || 'Open admin.html to edit the slide content.';
    slideCaption.textContent = slide.caption || `Slide ${currentIndex + 1} of ${slides.length}`;
    updateTicker();
    slideMedia.innerHTML = '';

    if (slide.videoUrl) {
      const video = document.createElement('video');
      video.src = slide.videoUrl;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.loop = true;
      video.setAttribute('aria-hidden', 'true');
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.onerror = () => {
        slideMedia.textContent = 'Unable to load video. Please check the URL in admin.html.';
      };
      slideMedia.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = slide.imageUrl || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80';
      img.alt = slide.title || 'Slide background image';
      img.onerror = () => {
        slideMedia.style.backgroundImage = 'linear-gradient(180deg, #111827, #020814)';
      };
      slideMedia.appendChild(img);
    }
  }

  function renderAnnouncements(slides, activeIndex) {
    if (!Array.isArray(slides) || !slides.length) {
      announcementList.innerHTML = '<div class="announcement-card"><strong>No announcement previews available.</strong></div>';
      return;
    }

    const firstSlide = slides[activeIndex] || slides[0];
    const secondSlide = slides[(activeIndex + 1) % slides.length] || slides[0];
    const previewSlides = [firstSlide, secondSlide];

    announcementList.innerHTML = '';
    previewSlides.forEach((slide, index) => {
      const card = document.createElement('div');
      card.className = 'announcement-card';

      if (slide.imageUrl) {
        card.dataset.image = slide.imageUrl;
        card.style.backgroundImage = `url('${slide.imageUrl}')`;
      }

      const previewLabel = document.createElement('span');
      previewLabel.className = 'announcement-preview-label';
      previewLabel.textContent = index === 0 ? 'Now previewing' : 'Next preview';

      const title = document.createElement('strong');
      title.textContent = slide.title || `Slide ${activeIndex + index + 1}`;

      const message = document.createElement('p');
      message.textContent = slide.message || 'No message available.';

      card.append(previewLabel, title, message);

      if (slide.caption) {
        const note = document.createElement('div');
        note.className = 'announcement-meta';
        note.textContent = slide.caption;
        card.append(note);
      }

      announcementList.appendChild(card);
    });
  }

  function showCurrent() {
    if (!slides.length) {
      slideTitle.textContent = BACKEND_API_BASE.trim()
        ? 'Backend content unavailable'
        : 'Backend URL not configured';
      slideMessage.textContent = BACKEND_API_BASE.trim()
        ? 'Unable to fetch slides from https://gapim.onrender.com/infositemrsm. Check the backend route and data.'
        : 'Open script.js and set BACKEND_API_BASE to https://gapim.onrender.com.';
      slideCaption.textContent = '';
      announcementList.innerHTML = '<div class="announcement-card"><strong>No announcements available.</strong></div>';
      return;
    }
    if (currentIndex >= slides.length) {
      currentIndex = 0;
    }
    renderSlide(slides[currentIndex]);
    renderAnnouncements(slides, currentIndex);
    const duration = Math.max(5, slides[currentIndex].duration || 12) * 1000;
    timerId = window.setTimeout(() => {
      currentIndex = (currentIndex + 1) % slides.length;
      showCurrent();
    }, duration);
  }

  updateClock();
  applyDisplaySettings(currentSettings);
  updateTicker();
  showCurrent();
  window.setInterval(updateClock, 60_000);
}

async function initAdminPage() {
  const form = document.getElementById('slide-form');
  const slideList = document.getElementById('slide-list');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importJson = document.getElementById('import-json');
  const clearBtn = document.getElementById('clear-btn');
  const titleInput = document.getElementById('slide-title');
  const messageInput = document.getElementById('slide-message');
  const imageInput = document.getElementById('slide-image');
  const videoInput = document.getElementById('slide-video');
  const durationInput = document.getElementById('slide-duration');
  const accentColorInput = document.getElementById('accent-color');
  const accentSoftColorInput = document.getElementById('accent-soft-color');
  const backgroundColorInput = document.getElementById('background-color');
  const surfaceColorInput = document.getElementById('surface-color');
  const textColorInput = document.getElementById('text-color');
  const mutedColorInput = document.getElementById('muted-color');
  const titleSizeInput = document.getElementById('title-size');
  const messageSizeInput = document.getElementById('message-size');
  const overlayOpacityInput = document.getElementById('overlay-opacity');
  const tickerDurationInput = document.getElementById('ticker-duration');
  const announcementCountInput = document.getElementById('announcement-count');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const settingsForm = document.getElementById('settings-form');
  const footerNewsInput = document.getElementById('footer-news');

  let slides = [];
  let editIndex = null;
  let currentSettings = {};

  function updateSlideList() {
    slideList.innerHTML = '';
    if (!slides.length) {
      slideList.innerHTML = '<p class="note">No slides yet. Add a new slide to begin.</p>';
      return;
    }

    slides.forEach((slide, index) => {
      const card = document.createElement('div');
      card.className = 'slide-card';

      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = slide.title || `Slide ${index + 1}`;
      const subtitle = document.createElement('span');
      subtitle.textContent = slide.message ? slide.message.slice(0, 70) : 'No message provided.';
      const details = document.createElement('span');
      details.textContent = `Duration: ${slide.duration || 12}s · ${slide.videoUrl ? 'Video' : 'Image'}`;
      info.append(title, subtitle, details);

      const actions = document.createElement('div');
      actions.className = 'actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button button-secondary';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => populateForm(index));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button button-secondary';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => removeSlide(index));

      actions.append(editButton, deleteButton);
      card.append(info, actions);
      slideList.appendChild(card);
    });
  }

  function persistSlides() {
    slides = saveSlides(slides, { ...currentSettings, footerNews: footerNewsInput.value.trim() });
    updateSlideList();
  }

  function clearForm() {
    form.reset();
    editIndex = null;
    durationInput.value = 12;
  }

  function populateForm(index) {
    const slide = slides[index];
    titleInput.value = slide.title || '';
    messageInput.value = slide.message || '';
    imageInput.value = slide.imageUrl || '';
    videoInput.value = slide.videoUrl || '';
    durationInput.value = slide.duration || 12;
    editIndex = index;
  }

  function removeSlide(index) {
    slides.splice(index, 1);
    persistSlides();
  }

  function getSettingsFromForm() {
    return {
      accentColor: accentColorInput.value,
      accentSoftColor: accentSoftColorInput.value,
      backgroundColor: backgroundColorInput.value,
      surfaceColor: surfaceColorInput.value,
      textColor: textColorInput.value,
      mutedColor: mutedColorInput.value,
      slideTitleSize: titleSizeInput.value,
      slideMessageSize: messageSizeInput.value,
      overlayOpacity: overlayOpacityInput.value,
      tickerDuration: tickerDurationInput.value,
      announcementCount: announcementCountInput.value,
      footerNews: footerNewsInput.value.trim()
    };
  }

  function updateSettingsForm(settings = {}) {
    const theme = { ...defaultSettings, ...settings };
    accentColorInput.value = theme.accentColor;
    accentSoftColorInput.value = theme.accentSoftColor;
    backgroundColorInput.value = theme.backgroundColor;
    surfaceColorInput.value = theme.surfaceColor;
    textColorInput.value = theme.textColor;
    mutedColorInput.value = theme.mutedColor;
    titleSizeInput.value = theme.slideTitleSize;
    messageSizeInput.value = theme.slideMessageSize;
    overlayOpacityInput.value = theme.overlayOpacity;
    tickerDurationInput.value = theme.tickerDuration;
    announcementCountInput.value = theme.announcementCount;
    footerNewsInput.value = theme.footerNews || theme.newsText || '';
  }

  function persistSettings() {
    currentSettings = getSettingsFromForm();
    saveSlides(slides, currentSettings);
    applyDisplaySettings(currentSettings);
  }

  function importFromJson() {
    try {
      const parsed = JSON.parse(importJson.value);
      if (!Array.isArray(parsed)) {
        throw new Error('JSON must be an array of slides');
      }
      slides = parsed.map(normalizeSlide);
      persistSlides();
      importJson.value = '';
      alert('Slides imported successfully.');
    } catch (error) {
      alert('Import failed. Paste valid slide JSON into the text area.');
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const newSlide = {
      title: titleInput.value.trim(),
      message: messageInput.value.trim(),
      imageUrl: imageInput.value.trim(),
      videoUrl: videoInput.value.trim(),
      duration: Number(durationInput.value) || 12,
      caption: ''
    };

    if (editIndex !== null && slides[editIndex]) {
      slides[editIndex] = newSlide;
    } else {
      slides.push(newSlide);
    }
    persistSlides();
    clearForm();
  });

  exportBtn.addEventListener('click', () => {
    importJson.value = JSON.stringify(slides, null, 2);
  });

  importBtn.addEventListener('click', importFromJson);
  clearBtn.addEventListener('click', clearForm);
  saveSettingsBtn.addEventListener('click', persistSettings);
  settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    persistSettings();
  });

  const displayData = await loadDisplayData();
  slides = displayData.slides;
  currentSettings = displayData.settings || {};
  updateSettingsForm(currentSettings);
  footerNewsInput.value = displayData.newsText || currentSettings.footerNews || '';
  updateSlideList();
}

window.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('display-page')) {
    void initDisplayPage();
  }
  if (document.body.classList.contains('admin-page')) {
    void initAdminPage();
  }
});
