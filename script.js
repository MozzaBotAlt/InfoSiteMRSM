function youtubeVideoId(url) {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, '');
    let videoId = '';

    if (host === 'youtu.be') {
      videoId = parsedUrl.pathname.slice(1);
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      videoId = parsedUrl.searchParams.get('v') || parsedUrl.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || '';
    }

    return /^[\w-]{11}$/.test(videoId) ? videoId : '';
  } catch {
    return '';
  }
}

function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (window.youtubeApiPromise) {
    return window.youtubeApiPromise;
  }

  window.youtubeApiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    const apiScript = document.createElement('script');
    apiScript.src = 'https://www.youtube.com/iframe_api';
    apiScript.onerror = reject;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousCallback === 'function') {
        previousCallback();
      }
      resolve(window.YT);
    };
    document.head.appendChild(apiScript);
  });

  return window.youtubeApiPromise;
}

async function initFeedDisplayPage() {
  const stage = document.getElementById('media-stage');
  const slidingText = document.getElementById('sliding-text');
  const displayData = await loadDisplayData();
  const slides = displayData.slides;
  let currentIndex = 0;
  let playbackId = 0;
  let timerId = null;
  let youtubePlayer = null;

  function advance(playback) {
    if (playback !== playbackId) {
      return;
    }
    window.clearTimeout(timerId);
    if (youtubePlayer) {
      youtubePlayer.destroy();
      youtubePlayer = null;
    }
    currentIndex = (currentIndex + 1) % slides.length;
    showCurrent();
  }

  function showCurrent() {
    if (!slides.length) {
      stage.replaceChildren();
      slidingText.hidden = true;
      return;
    }

    const playback = ++playbackId;
    const slide = slides[currentIndex];
    const message = slide.message || displayData.slidingText;
    const videoId = youtubeVideoId(slide.videoUrl);
    window.clearTimeout(timerId);
    if (youtubePlayer) {
      youtubePlayer.destroy();
      youtubePlayer = null;
    }

    stage.replaceChildren();
    stage.dataset.template = String(slide.template);
    slidingText.dataset.template = String(slide.template);
    slidingText.textContent = message;
    slidingText.hidden = !message;
    slidingText.style.animation = 'none';
    void slidingText.offsetWidth;
    slidingText.style.animation = '';

    if (videoId) {
      const mount = document.createElement('div');
      mount.id = 'youtube-player';
      stage.appendChild(mount);

      loadYouTubeApi().then((youtube) => {
        if (playback !== playbackId) {
          return;
        }
        youtubePlayer = new youtube.Player(mount, {
          videoId,
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0
          },
          events: {
                onReady: (event) => {
              event.target.mute();
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === youtube.PlayerState.ENDED) {
                advance(playback);
              }
            },
                onError: (event) => console.warn('YouTube playback failed.', event.data)
          }
        });
      }).catch((error) => console.warn('Unable to load YouTube playback.', error));
      return;
    }

    if (slide.videoUrl && !slide.imageUrl) {
      const video = document.createElement('video');
      video.src = slide.videoUrl;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.addEventListener('ended', () => advance(playback), { once: true });
      stage.appendChild(video);
      void video.play().catch(() => {});
      return;
    }

    if (slide.imageUrl) {
      const image = document.createElement('img');
      image.className = `announcement-image template-${slide.template}`;
      image.src = slide.imageUrl;
      image.alt = '';
      image.draggable = false;
      stage.appendChild(image);
    }

    timerId = window.setTimeout(() => advance(playback), 5000);
  }

  showCurrent();
}

const BACKEND_API_BASE = "https://gapim.onrender.com/";
const BACKEND_DATA_ENDPOINT = '/infositemrsm';
const BACKEND_SAVE_ENDPOINT = '/infositemrsm';

function normalizeSlide(slide = {}) {
  return {
    title: slide.title || '',
    message: slide.slidingText || slide['sliding text'] || slide.message || slide.text || '',
    imageUrl: slide.imageUrl || slide.picture || slide.image || '',
    videoUrl: slide.videoUrl || slide.youtubeUrl || slide.youtube || slide.video || '',
    duration: 5,
    caption: slide.caption || '',
    template: Math.min(10, Math.max(1, Number(slide.template) || 1))
  };
}

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
    const response = await fetch(new URL(BACKEND_DATA_ENDPOINT, BACKEND_API_BASE), {
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
    if (Array.isArray(backendData)) {
      return backendData.map(normalizeSlide);
    }
    if (backendData && Array.isArray(backendData.slides)) {
      return backendData.slides.map(normalizeSlide);
    }
  }

  return [];
}

function slidesFromFeed(data) {
  if (Array.isArray(data)) {
    return data;
  }

  for (const key of ['slides', 'items', 'pictures', 'announcements']) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  if (!data || typeof data !== 'object') {
    return [];
  }

  const message = data.slidingText || data['sliding text'] || data.message || data.text || '';
  const videoUrl = data.videoUrl || data.youtubeUrl || data.youtube || data.video || '';
  const imageUrl = data.imageUrl || data.picture || data.image || '';
  const template = data.template || 1;

  return [
    ...(videoUrl ? [{ videoUrl, message, template }] : []),
    ...(imageUrl ? [{ imageUrl, message, template }] : [])
  ];
}

async function loadDisplayData() {
  const backendData = await fetchBackendData();
  const slidingText = backendData?.slidingText || backendData?.['sliding text'] || backendData?.newsText || backendData?.settings?.slidingText || '';

  return {
    slides: slidesFromFeed(backendData).flatMap((item) => {
      const slide = normalizeSlide(item);
      if (slide.videoUrl && slide.imageUrl) {
        return [
          { ...slide, imageUrl: '' },
          { ...slide, videoUrl: '' }
        ];
      }
      return [slide];
    }),
    slidingText,
    settings: backendData?.settings || {}
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
    const response = await fetch(new URL(BACKEND_SAVE_ENDPOINT, BACKEND_API_BASE), {
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
    void initFeedDisplayPage();
  }
  if (document.body.classList.contains('admin-page')) {
    void initAdminPage();
  }
});
