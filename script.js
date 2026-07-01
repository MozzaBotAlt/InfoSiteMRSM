const BACKEND_API_BASE = "https://lvm-backend-j0ws.onrender.com/"; // Set your backend URL here, for example: 'http://localhost:4000'
const BACKEND_DATA_ENDPOINT = '/infositemrsm';
const BACKEND_SAVE_ENDPOINT = '/infositemrsm';

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
    message: 'Display is ready. Configure content by assigning BACKEND_API_BASE and a backend endpoint.',
    note: 'Backend feeds are required for this site to show content.'
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
  announcementCount: '6'
};

async function fetchBackendData() {
  if (!BACKEND_API_BASE.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_API_BASE}${BACKEND_DATA_ENDPOINT}`, {
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
  if (backendData && Array.isArray(backendData.slides) && backendData.slides.length) {
    return {
      slides: backendData.slides.map(normalizeSlide),
      announcements: Array.isArray(backendData.announcements)
        ? backendData.announcements
        : buildAnnouncementsFromSlides(backendData.slides),
      settings: backendData.settings || {}
    };
  }

  return {
    slides: [],
    announcements: defaultAnnouncements,
    settings: {}
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
    const response = await fetch(`${BACKEND_API_BASE}${BACKEND_SAVE_ENDPOINT}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slides,
        announcements: buildAnnouncementsFromSlides(slides),
        settings
      })
    });

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
  let currentIndex = 0;
  let timerId = null;

  function updateClock() {
    clock.textContent = formatClock(new Date());
  }

  function updateTicker(slide) {
    const parts = [
      slide.title || 'Information',
      slide.message || '',
      slide.caption || `Slide ${currentIndex + 1} of ${slides.length}`
    ].filter(Boolean);
    const text = `${parts.join(' • ')} • ${parts.join(' • ')}`;
    tickerContent.innerHTML = `<span>${text}</span><span>${text}</span>`;
  }

  function renderSlide(slide) {
    slideTitle.textContent = slide.title || 'Information';
    slideMessage.textContent = slide.message || 'Open admin.html to edit the slide content.';
    slideCaption.textContent = slide.caption || `Slide ${currentIndex + 1} of ${slides.length}`;
    updateTicker(slide);
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

  function renderAnnouncements(list) {
    if (!Array.isArray(list) || !list.length) {
      announcementList.innerHTML = '<div class="announcement-card"><strong>No announcements available.</strong></div>';
      return;
    }

    announcementList.innerHTML = '';
    list.slice(0, 6).forEach((item) => {
      const card = document.createElement('div');
      card.className = 'announcement-card';

      const title = document.createElement('strong');
      title.textContent = item.title || 'Announcement';

      const message = document.createElement('p');
      message.textContent = item.message || '';

      card.append(title, message);

      if (item.note) {
        const note = document.createElement('div');
        note.className = 'announcement-meta';
        note.textContent = item.note;
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
        ? 'Unable to fetch slides from backend. Check your backend server and URL.'
        : 'Open script.js and set BACKEND_API_BASE to your backend URL.';
      slideCaption.textContent = '';
      announcementList.innerHTML = '<div class="announcement-card"><strong>No announcements available.</strong></div>';
      return;
    }
    if (currentIndex >= slides.length) {
      currentIndex = 0;
    }
    renderSlide(slides[currentIndex]);
    renderAnnouncements(announcements);
    const duration = Math.max(5, slides[currentIndex].duration || 12) * 1000;
    timerId = window.setTimeout(() => {
      currentIndex = (currentIndex + 1) % slides.length;
      showCurrent();
    }, duration);
  }

  updateClock();
  applyDisplaySettings(currentSettings);
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
    slides = saveSlides(slides);
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
      announcementCount: announcementCountInput.value
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

  slides = await loadSlides();
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
