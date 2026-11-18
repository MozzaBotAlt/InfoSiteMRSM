function renderTickerAnnouncements(container, text) {
  const announcements = String(text || '').split('|').map((item) => item.trim()).filter(Boolean);
  const tickerNodes = [];

  for (let copy = 0; copy < 2; copy += 1) {
    announcements.forEach((announcement, index) => {
      const item = document.createElement('span');
      item.className = 'ticker-announcement';
      item.textContent = announcement;
      tickerNodes.push(item);

      if (index < announcements.length - 1 || copy === 0) {
        const pause = document.createElement('span');
        pause.className = 'ticker-pause';
        pause.textContent = '|';
        tickerNodes.push(pause);
      }
    });
  }

  container.replaceChildren(...tickerNodes);
}

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
      const emptyState = document.getElementById('empty-state');
      stage.replaceChildren(emptyState);
      emptyState.hidden = false;
      slidingText.hidden = true;

      const clock = document.getElementById('empty-clock');
      if (clock) {
        clock.textContent = new Intl.DateTimeFormat(undefined, {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date());
        window.setInterval(() => {
          clock.textContent = new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit'
          }).format(new Date());
        }, 30000);
      }
      return;
    }

    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
      emptyState.hidden = true;
    }

    const playback = ++playbackId;
    const slide = slides[currentIndex];
    const message = displayData.slidingText || slide.message;
    const videoId = youtubeVideoId(slide.videoUrl);
    window.clearTimeout(timerId);
    if (youtubePlayer) {
      youtubePlayer.destroy();
      youtubePlayer = null;
    }

    stage.replaceChildren();
    stage.dataset.template = String(slide.template);
    slidingText.dataset.template = String(slide.template);
    renderTickerAnnouncements(slidingText, message);
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
let lastBackendError = null;

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

const BACKEND_REQUEST_TIMEOUT_MS = 35000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), BACKEND_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Backend did not respond within ${BACKEND_REQUEST_TIMEOUT_MS / 1000} seconds`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchBackendData() {
  if (!BACKEND_API_BASE.trim()) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(new URL(BACKEND_DATA_ENDPOINT, BACKEND_API_BASE), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: HTTP ${response.status}`);
    }

    lastBackendError = null;
    if (response.status === 204) {
      return null;
    }
    return await response.json();
  } catch (error) {
    lastBackendError = error;
    console.warn('Backend fetch failed.', error);
    return null;
  }
}

function buildAnnouncementsFromSlides(slides) {
  return slides.map((slide, index) => ({
    title: slide.title || `Update ${index + 1}`,
    message: slide.message || '',
    note: slide.caption || '',
    imageUrl: slide.imageUrl || '',
    videoUrl: slide.videoUrl || '',
    template: slide.template || 1
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
  const slidingText = backendData?.slidingText || backendData?.['sliding text'] || backendData?.newsText || backendData?.settings?.slidingText || backendData?.settings?.footerNews || '';

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

async function persistSlidesToBackend(slides, settings = {}) {
  const tickerText = String(settings.footerNews || settings.slidingText || '').trim();
  const payload = {
    slides: slides.map(normalizeSlide),
    announcements: buildAnnouncementsFromSlides(slides),
    settings: { ...settings, footerNews: tickerText, slidingText: tickerText },
    slidingText: tickerText,
    newsText: tickerText
  };
  let lastError;

  for (const method of ['PUT', 'POST']) {
    try {
      const response = await fetchWithTimeout(new URL(BACKEND_SAVE_ENDPOINT, BACKEND_API_BASE), {
        method,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        const savedData = await fetchBackendData();
        if (savedData !== null) {
          const savedSlides = Array.isArray(savedData)
            ? savedData.map(normalizeSlide)
            : Array.isArray(savedData.slides)
              ? savedData.slides.map(normalizeSlide)
              : [];
          const contentMatches = JSON.stringify(savedSlides.map((slide) => ({
            title: slide.title,
            message: slide.message,
            imageUrl: slide.imageUrl,
            videoUrl: slide.videoUrl,
            template: slide.template
          }))) === JSON.stringify(payload.slides.map((slide) => ({
            title: slide.title,
            message: slide.message,
            imageUrl: slide.imageUrl,
            videoUrl: slide.videoUrl,
            template: slide.template
          })));

          if (contentMatches) {
            lastBackendError = null;
            return;
          }
          lastError = new Error(`${method} returned success but the database did not contain the submitted content`);
        } else {
          lastError = new Error(`${method} returned success but the saved feed could not be read back`);
        }
      } else {
        lastError = new Error(`${method} save failed: HTTP ${response.status}`);
      }
    } catch (error) {
      lastError = error;
    }
  }

  lastBackendError = lastError;
  throw lastError || new Error('Backend save failed.');
}

async function initAdminPage() {
  const videoForm = document.getElementById('slide-form');
  const announcementForm = document.getElementById('announcement-form');
  const settingsForm = document.getElementById('settings-form');
  const slideList = document.getElementById('slide-list');
  const status = document.getElementById('admin-status');
  const importJson = document.getElementById('import-json');
  const footerNewsInput = document.getElementById('footer-news');
  const videoTitleInput = document.getElementById('slide-title');
  const videoMessageInput = document.getElementById('slide-message');
  const videoUrlInput = document.getElementById('slide-video');
  const videoDurationInput = document.getElementById('slide-duration');
  const announcementTitleInput = document.getElementById('announcement-title');
  const announcementImageInput = document.getElementById('announcement-image');
  const announcementSectionInput = document.getElementById('announcement-section');
  const announcementDurationInput = document.getElementById('announcement-duration');
  const tickerDurationInput = document.getElementById('ticker-duration');
  const timetableInput = document.getElementById('timetable-url');

  let slides = [];
  let settings = {};

  function setStatus(message, state = '') {
    status.textContent = message;
    status.dataset.state = state;
  }

  function updateSlideList() {
    slideList.replaceChildren();
    slides.forEach((slide, index) => {
      const card = document.createElement('div');
      card.className = 'slide-card';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = slide.title || `Slide ${index + 1}`;
      const details = document.createElement('span');
      details.textContent = slide.videoUrl ? 'Video' : 'Picture';
      info.append(title, details);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'button button-secondary';
      removeButton.textContent = 'Delete';
      removeButton.addEventListener('click', async () => {
        slides.splice(index, 1);
        updateSlideList();
        await saveFeed();
      });

      card.append(info, removeButton);
      slideList.appendChild(card);
    });
    if (!slides.length) {
      const empty = document.createElement('p');
      empty.className = 'note';
      empty.textContent = 'No media items in the backend feed.';
      slideList.appendChild(empty);
    }
  }

  async function saveFeed() {
    setStatus('Saving to backend...');
    try {
      await persistSlidesToBackend(slides, settings);
      setStatus('Saved to backend.', 'success');
      updateSlideList();
    } catch (error) {
      setStatus(`Save failed: ${error.message}. Check the backend and CORS settings.`, 'error');
    }
  }

  videoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    slides.push(normalizeSlide({
      title: videoTitleInput.value.trim(),
      message: videoMessageInput.value.trim(),
      videoUrl: videoUrlInput.value.trim(),
      duration: Number(videoDurationInput.value) || 5
    }));
    videoForm.reset();
    videoDurationInput.value = 5;
    updateSlideList();
    await saveFeed();
  });

  announcementForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = announcementTitleInput.value.trim();
    slides.push(normalizeSlide({
      title,
      message: title,
      imageUrl: announcementImageInput.value.trim(),
      duration: Number(announcementDurationInput.value) || 5,
      caption: announcementSectionInput.value
    }));
    announcementForm.reset();
    announcementDurationInput.value = 5;
    updateSlideList();
    await saveFeed();
  });

  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    settings = {
      ...settings,
      footerNews: footerNewsInput.value.trim(),
      slidingText: footerNewsInput.value.trim(),
      tickerDuration: tickerDurationInput.value,
      timetableUrl: timetableInput.value.trim()
    };
    await saveFeed();
  });

  document.getElementById('clear-btn').addEventListener('click', () => videoForm.reset());
  document.getElementById('clear-announcement-btn').addEventListener('click', () => announcementForm.reset());
  document.getElementById('export-btn').addEventListener('click', () => {
    importJson.value = JSON.stringify({ slides, settings }, null, 2);
  });
  document.getElementById('import-btn').addEventListener('click', async () => {
    try {
      const parsed = JSON.parse(importJson.value);
      slides = slidesFromFeed(parsed).map(normalizeSlide);
      settings = parsed.settings || settings;
      updateSlideList();
      await saveFeed();
    } catch (error) {
      setStatus(`Import failed: ${error.message}`, 'error');
    }
  });

  const backendData = await fetchBackendData();
  slides = slidesFromFeed(backendData).map(normalizeSlide);
  settings = backendData?.settings || {};
  footerNewsInput.value = backendData?.slidingText || backendData?.newsText || settings.slidingText || settings.footerNews || '';
  tickerDurationInput.value = settings.tickerDuration || 24;
  timetableInput.value = settings.timetableUrl || '';
  updateSlideList();
  if (lastBackendError) {
    setStatus(`Could not load backend feed: ${lastBackendError.message}`, 'error');
  } else {
    setStatus(`Loaded ${slides.length} media item${slides.length === 1 ? '' : 's'}.`, 'success');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('display-page')) {
    void initFeedDisplayPage();
  }
  if (document.body.classList.contains('admin-page')) {
    void initAdminPage();
  }
});
