/*
Copyright (C) 2026 MozzaBot This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

function renderTickerAnnouncements(container, text) {
  const announcements = String(text || '').split('|').map((item) => item.trim()).filter(Boolean);
  const tickerNodes = [];
  const track = document.createElement('div');
  track.className = 'ticker-track';

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

  track.replaceChildren(...tickerNodes);
  container.replaceChildren(track);
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

function renderDashboardAnnouncements(slides) {
  for (const section of ['maktab', 'bwp']) {
    const card = document.querySelector(`.dashboard-announcement[data-section="${section}"]`);
    const slide = [...slides].reverse().find((item) => (
      String(item.caption || '').trim().toLowerCase() === section
    ));
    const image = card.querySelector('img');
    const title = card.querySelector('h3');
    const message = card.querySelector('.announcement-message');
    const imageUrl = safeHttpsUrl(slide?.imageUrl);

    card.classList.toggle('has-image', Boolean(imageUrl));
    image.hidden = !imageUrl;
    if (imageUrl) {
      image.src = imageUrl;
      image.alt = slide?.title || `${section.toUpperCase()} announcement`;
    } else {
      image.removeAttribute('src');
      image.alt = '';
    }

    title.textContent = slide?.title || 'No announcement';
    message.textContent = slide?.message || (slide ? '' : 'Updates will appear here.');
  }
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function renderTimetable(urlValue) {
  const frame = document.getElementById('timetable-frame');
  const placeholder = document.getElementById('timetable-placeholder');
  const url = safeHttpsUrl(urlValue);
  frame.hidden = !url;
  placeholder.hidden = Boolean(url);
  if (url && frame.src !== url) {
    frame.src = url;
  } else if (!url) {
    frame.removeAttribute('src');
  }
}

const KDH06_PRAYER_ENDPOINT = 'https://api.waktusolat.online/api/solat/KDH06';
const MALAYSIA_TIME_ZONE = 'Asia/Kuala_Lumpur';
const HIJRI_MONTHS_MS = [
  'Muharam', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jamadilawal', 'Jamadilakhir',
  'Rejab', 'Syaaban', 'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah'
];
let cachedKdh06Schedule = null;
let cachedKdh06At = 0;
let cachedKdh06YearMonth = '';
let currentPrayerSchedule = null;

function kualaLumpurDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MALAYSIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function kualaLumpurDateKey(date = new Date()) {
  const { year, month, day } = kualaLumpurDateParts(date);
  return `${year}-${month}-${day}`;
}

function malaysiaIsoFromDateTimeInput(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/);
  if (!match) {
    throw new Error('Enter a valid event date and time.');
  }
  return `${match[1]}T${match[2]}:00+08:00`;
}

function malaysiaDateTimeInputValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MALAYSIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function solatDateKey(dateText) {
  const match = String(dateText || '').match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) {
    return '';
  }
  const monthNumber = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  }[match[2].toLowerCase()];
  return monthNumber ? `${match[3]}-${monthNumber}-${match[1].padStart(2, '0')}` : '';
}

async function fetchKdh06Schedule() {
  const { year, month } = kualaLumpurDateParts();
  const currentYearMonth = `${year}-${month}`;
  if (
    cachedKdh06Schedule
    && cachedKdh06YearMonth === currentYearMonth
    && Date.now() - cachedKdh06At < 6 * 60 * 60 * 1000
  ) {
    return cachedKdh06Schedule;
  }

  const endpoint = new URL(KDH06_PRAYER_ENDPOINT);
  endpoint.searchParams.set('month', String(Number(month)));
  endpoint.searchParams.set('year', year);
  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`KDH06 prayer schedule returned HTTP ${response.status}`);
  }
  const result = await response.json();
  if (!Array.isArray(result.prayerTime) || result.prayerTime.length === 0) {
    throw new Error('KDH06 prayer schedule has no daily entries');
  }

  cachedKdh06Schedule = result.prayerTime;
  cachedKdh06At = Date.now();
  cachedKdh06YearMonth = currentYearMonth;
  return cachedKdh06Schedule;
}

async function prayerScheduleForToday() {
  const schedule = await fetchKdh06Schedule();
  const dateKey = kualaLumpurDateKey();
  const today = schedule.find((day) => solatDateKey(day.date) === dateKey);
  if (!today) {
    throw new Error(`KDH06 schedule has no entry for ${dateKey}`);
  }
  return today;
}

function formatHijriDate(hijriDate) {
  const match = String(hijriDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return hijriDate || 'Hijri date unavailable';
  }
  const month = HIJRI_MONTHS_MS[Number(match[2]) - 1];
  return month
    ? `${Number(match[3])} ${month} ${match[1]}H`
    : hijriDate;
}

function prayerTimeMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function kualaLumpurClockParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MALAYSIA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
}

function nextPrayerInfo(schedule, now = new Date()) {
  const nowParts = kualaLumpurClockParts(now);
  const currentSeconds = nowParts.hour * 3600 + nowParts.minute * 60 + nowParts.second;
  const prayers = [
    ['Subuh', schedule.fajr],
    ['Zohor', schedule.dhuhr],
    ['Asar', schedule.asr],
    ['Maghrib', schedule.maghrib],
    ['Isyak', schedule.isha]
  ];

  for (const [name, value] of prayers) {
    const minutes = prayerTimeMinutes(value);
    if (minutes !== null && minutes * 60 > currentSeconds) {
      return { name, secondsUntil: minutes * 60 - currentSeconds };
    }
  }

  const fajr = prayerTimeMinutes(schedule.fajr);
  return {
    name: 'Subuh',
    secondsUntil: fajr === null ? 0 : 24 * 60 * 60 - currentSeconds + fajr * 60
  };
}

function updatePrayerCountdown(schedule) {
  const name = document.getElementById('next-prayer-name');
  const countdown = document.getElementById('next-prayer-countdown');
  if (!name || !countdown) {
    return;
  }
  const next = nextPrayerInfo(schedule);
  const hours = Math.floor(next.secondsUntil / 3600);
  const minutes = Math.floor((next.secondsUntil % 3600) / 60);
  const seconds = next.secondsUntil % 60;
  name.textContent = next.name;
  countdown.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function updatePrayerTimes() {
  const status = document.getElementById('prayer-status');
  if (!status) {
    return;
  }
  try {
    const today = await prayerScheduleForToday();
    currentPrayerSchedule = today;
    const prayerEntries = [
      ['fajr', 'Subuh'],
      ['syuruk', 'Syuruk'],
      ['dhuhr', 'Zohor'],
      ['asr', 'Asar'],
      ['maghrib', 'Maghrib'],
      ['isha', 'Isyak']
    ];
    const prayerItems = [...document.querySelectorAll('.prayer-time')];
    prayerEntries.forEach(([key], index) => {
      if (prayerItems[index]) {
        prayerItems[index].querySelector('time').textContent = String(today[key] || '--:--').slice(0, 5);
      }
    });

    const hijriDate = document.getElementById('hijri-date');
    if (hijriDate) {
      hijriDate.textContent = formatHijriDate(today.hijri);
    }
    status.textContent = 'KDH06 Langkawi';
    updatePrayerCountdown(today);
  } catch (error) {
    status.textContent = 'Prayer times unavailable';
    console.warn('Unable to load the KDH06 Langkawi prayer schedule.', error);
  }
}

async function initFeedDisplayPage() {
  const stage = document.getElementById('media-stage');
  const emptyState = document.getElementById('empty-state');
  const videoAudioToggle = document.getElementById('video-audio-toggle');
  const slidingText = document.getElementById('sliding-text');
  const clock = document.getElementById('display-clock');
  const gregorianDate = document.getElementById('gregorian-date');
  const calendarEvents = document.getElementById('calendar-events');
  const eventTitle = document.getElementById('event-countdown-title');
  const eventTime = document.getElementById('event-countdown-time');
  const soundToggle = document.getElementById('alert-sound-toggle');
  let displayData = { slides: [], slidingText: '', settings: {}, events: [] };
  let slides = displayData.slides;
  let events = displayData.events;
  let currentIndex = 0;
  let playbackId = 0;
  let timerId = null;
  let youtubePlayer = null;
  let youtubeAudioEnabled = true;
  let alertAudioContext = null;
  let alertSoundEnabled = false;
  let lastEventBeep = '';

  function enableCurrentVideoAudio() {
    if (youtubePlayer) {
      youtubeAudioEnabled = true;
      youtubePlayer.unMute();
      youtubePlayer.playVideo();
      videoAudioToggle.hidden = true;
      return;
    }

    const video = stage.querySelector('video');
    if (video) {
      video.muted = false;
      void video.play().then(() => {
        videoAudioToggle.hidden = true;
      }).catch((error) => {
        videoAudioToggle.hidden = false;
        console.warn('Unable to start video audio.', error);
      });
    }
  }

  function setSoundEnabled(enabled) {
    alertSoundEnabled = enabled;
    soundToggle.textContent = enabled ? 'Sound on' : 'Enable sound';
    soundToggle.setAttribute('aria-pressed', String(enabled));
  }

  async function toggleEventSound() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      soundToggle.textContent = 'Sound unavailable';
      return;
    }

    try {
      if (!alertAudioContext) {
        alertAudioContext = new AudioContextConstructor();
      }
      if (alertSoundEnabled) {
        await alertAudioContext.suspend();
        setSoundEnabled(false);
      } else {
        await alertAudioContext.resume();
        setSoundEnabled(alertAudioContext.state === 'running');
      }
    } catch (error) {
      soundToggle.textContent = 'Sound unavailable';
      console.warn('Unable to enable event alert sound.', error);
    }
  }

  function beepForEvent() {
    if (!alertSoundEnabled || alertAudioContext?.state !== 'running') {
      return;
    }
    const oscillator = alertAudioContext.createOscillator();
    const gain = alertAudioContext.createGain();
    const now = alertAudioContext.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    oscillator.connect(gain);
    gain.connect(alertAudioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.17);
  }

  function formatEventTimeRemaining(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const time = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
    return days ? `${days}d ${time}` : time;
  }

  function openSolatForEvent(event) {
    try {
      window.sessionStorage.setItem('infositemrsm.activeEvent', JSON.stringify(event));
    } catch (error) {
      console.warn('Unable to stage the pinned event for Jom Solat.', error);
    }
    const url = new URL('misc/solat.html', window.location.href);
    url.searchParams.set('eventMode', '1');
    url.searchParams.set('eventId', event.id);
    url.searchParams.set('returnTo', '../index.html');
    window.location.assign(url.href);
  }

  function updateEventCountdown() {
    const now = Date.now();
    const upcoming = events
      .map((event) => ({ ...normalizeEvent(event), startsAtMs: Date.parse(event.startsAt) }))
      .filter((event) => Number.isFinite(event.startsAtMs) && event.startsAtMs > now - 1000)
      .sort((left, right) => left.startsAtMs - right.startsAtMs)[0];

    if (!upcoming) {
      eventTitle.textContent = 'NO UPCOMING EVENTS';
      eventTime.textContent = '';
      lastEventBeep = '';
      return;
    }

    const remaining = upcoming.startsAtMs - now;
    eventTitle.textContent = upcoming.title;
    eventTime.textContent = remaining > 10000
      ? formatEventTimeRemaining(remaining)
      : `STARTS IN ${formatEventTimeRemaining(remaining)}`;

    if (remaining <= 0) {
      openSolatForEvent(upcoming);
      return;
    }

    const secondsRemaining = Math.ceil(remaining / 1000);
    if (secondsRemaining <= 10) {
      const beepToken = `${upcoming.id}:${secondsRemaining}`;
      if (lastEventBeep !== beepToken) {
        lastEventBeep = beepToken;
        beepForEvent();
      }
    } else {
      lastEventBeep = '';
    }
  }

  function updateClockAndDate() {
    const now = new Date();
    clock.textContent = new Intl.DateTimeFormat('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(now);
    gregorianDate.textContent = new Intl.DateTimeFormat('ms-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(now);
  }

  function renderCalendarEvents() {
    if (!calendarEvents) {
      return;
    }

    const now = Date.now();
    const upcoming = events
      .map((event) => ({ ...normalizeEvent(event), startsAtMs: Date.parse(event.startsAt) }))
      .filter((event) => event.title && Number.isFinite(event.startsAtMs) && event.startsAtMs > now - 1000)
      .sort((left, right) => left.startsAtMs - right.startsAtMs)
      .slice(0, 3);

    if (!upcoming.length) {
      const empty = document.createElement('li');
      empty.className = 'calendar-empty';
      empty.textContent = 'No upcoming events';
      calendarEvents.replaceChildren(empty);
      return;
    }

    const formatter = new Intl.DateTimeFormat('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit'
    });
    const items = upcoming.map((event) => {
      const item = document.createElement('li');
      const time = document.createElement('time');
      const title = document.createElement('span');
      time.dateTime = event.startsAt;
      time.textContent = formatter.format(new Date(event.startsAtMs));
      title.textContent = event.title;
      item.append(time, title);
      return item;
    });
    calendarEvents.replaceChildren(...items);
  }

  function applyDashboardData() {
    renderDashboardAnnouncements(slides);
    renderTimetable(displayData.settings.timetableUrl);
    renderCalendarEvents();
    if (slidingText) {
      const tickerMessage = displayData.slidingText || '* EVERY SUNDAY: Community Gathering *';
      slidingText.hidden = !tickerMessage;
      renderTickerAnnouncements(slidingText, tickerMessage);
      slidingText.style.setProperty(
        '--ticker-duration',
        `${Math.max(5, Number(displayData.settings.tickerDuration) || 24)}s`
      );
    }
  }

  function advance(playback) {
    if (playback !== playbackId || !slides.length) {
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
    applyDashboardData();
    const playback = ++playbackId;
    videoAudioToggle.hidden = true;
    window.clearTimeout(timerId);
    if (youtubePlayer) {
      youtubePlayer.destroy();
      youtubePlayer = null;
    }

    if (!slides.length) {
      stage.replaceChildren(emptyState);
      emptyState.hidden = false;
      return;
    }

    const slide = slides[currentIndex];
    const videoId = youtubeVideoId(slide.videoUrl);
    youtubeAudioEnabled = false;
    emptyState.hidden = true;

    if (videoId) {
      const mount = document.createElement('div');
      mount.id = 'youtube-player';
      stage.replaceChildren(mount);
      const youtubeOrigin = /^https?:$/.test(window.location.protocol)
        ? window.location.origin
        : '';
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
            rel: 0,
            ...(youtubeOrigin ? { origin: youtubeOrigin } : {})
          },
          events: {
            onReady: (event) => {
              event.target.mute();
              event.target.playVideo();
              videoAudioToggle.hidden = false;
            },
            onStateChange: (event) => {
              if (event.data === youtube.PlayerState.PLAYING) {
                videoAudioToggle.hidden = youtubeAudioEnabled;
              } else if (event.data === youtube.PlayerState.ENDED) {
                advance(playback);
              }
            },
            onAutoplayBlocked: () => {
              videoAudioToggle.hidden = false;
            },
            onError: (event) => console.warn('YouTube playback failed.', event.data)
          }
        });
      }).catch((error) => console.warn('Unable to load YouTube playback.', error));
      return;
    }

    if (slide.videoUrl && !slide.imageUrl) {
      const videoUrl = safeHttpsUrl(slide.videoUrl);
      if (videoUrl) {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.addEventListener('ended', () => advance(playback), { once: true });
        stage.replaceChildren(video);
        void video.play().then(() => {
          videoAudioToggle.hidden = false;
        }).catch((error) => {
          videoAudioToggle.hidden = false;
          console.warn('Video autoplay was blocked.', error);
        });
      } else {
        stage.replaceChildren(emptyState);
      }
      return;
    }

    if (safeHttpsUrl(slide.imageUrl)) {
      const image = document.createElement('img');
      image.className = `announcement-image template-${slide.template}`;
      image.src = safeHttpsUrl(slide.imageUrl);
      image.alt = slide.title || 'MRSM Langkawi announcement';
      image.draggable = false;
      stage.replaceChildren(image);
    } else {
      stage.replaceChildren(emptyState);
      emptyState.hidden = false;
    }
    timerId = window.setTimeout(() => advance(playback), 5000);
  }

  updateClockAndDate();
  window.setInterval(updateClockAndDate, 30000);
  videoAudioToggle.addEventListener('click', enableCurrentVideoAudio);
  soundToggle.addEventListener('click', () => void toggleEventSound());
  setSoundEnabled(false);
  void updatePrayerTimes();
  window.setInterval(updatePrayerTimes, 60 * 60 * 1000);
  updateEventCountdown();
  window.setInterval(updateEventCountdown, 250);
  showCurrent();

  let lastFeed = JSON.stringify(displayData);
  let feedRefreshInProgress = false;
  async function refreshDisplayFeed() {
    if (feedRefreshInProgress) {
      return;
    }
    feedRefreshInProgress = true;
    try {
      const latestData = await loadDisplayData();
      if (lastBackendError) {
        return;
      }
      const latestFeed = JSON.stringify(latestData);
      if (latestFeed === lastFeed) {
        return;
      }
      lastFeed = latestFeed;
      displayData = latestData;
      slides = latestData.slides;
      events = latestData.events;
      currentIndex = 0;
      showCurrent();
    } finally {
      feedRefreshInProgress = false;
    }
  }

  void refreshDisplayFeed();
  window.setInterval(() => void refreshDisplayFeed(), 10000);
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

function normalizeEvent(event = {}) {
  const title = String(event.title || '').trim();
  const startsAt = String(event.startsAt || event.dateTime || '');
  const pinnedImageUrl = String(event.pinnedImageUrl || event.imageUrl || '');
  return {
    id: String(event.id || `${title}-${startsAt}`),
    title,
    startsAt,
    pinnedImageUrl
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
    settings: backendData?.settings || {},
    events: Array.isArray(backendData?.events) ? backendData.events.map(normalizeEvent) : []
  };
}

async function persistSlidesToBackend(slides, settings = {}, events = []) {
  const tickerText = String(settings.footerNews || settings.slidingText || '').trim();
  const payload = {
    slides: slides.map(normalizeSlide),
    announcements: buildAnnouncementsFromSlides(slides),
    events: events.map(normalizeEvent),
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

          const savedSettings = savedData?.settings || {};
          const savedEvents = Array.isArray(savedData?.events) ? savedData.events.map(normalizeEvent) : [];
          const eventsMatch = JSON.stringify(savedEvents) === JSON.stringify(payload.events);
          const settingsMatch = ['footerNews', 'slidingText', 'tickerDuration', 'timetableUrl']
            .every((key) => String(savedSettings[key] || '') === String(payload.settings[key] || ''));

          if (contentMatches && eventsMatch && settingsMatch) {
            lastBackendError = null;
            return;
          }
          lastError = new Error(`${method} returned success but the database did not contain the submitted content, events, and settings`);
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

async function initSolatPage() {
  const clock = document.getElementById('solat-clock');
  const gregorianDate = document.getElementById('solat-date');
  const hijriDate = document.getElementById('solat-hijri-date');
  const status = document.getElementById('solat-status');
  const query = new URLSearchParams(window.location.search);
  const eventMode = query.get('eventMode') === '1';

  function updateClock() {
    const now = new Date();
    clock.textContent = new Intl.DateTimeFormat('en-MY', {
      timeZone: MALAYSIA_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(now);
    gregorianDate.textContent = new Intl.DateTimeFormat('ms-MY', {
      timeZone: MALAYSIA_TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(now);
    if (currentPrayerSchedule) {
      updatePrayerCountdown(currentPrayerSchedule);
    }
  }

  function renderSchedule(schedule) {
    const entries = [
      ['fajr', 'Subuh'],
      ['syuruk', 'Syuruk'],
      ['dhuhr', 'Zohor'],
      ['asr', 'Asar'],
      ['maghrib', 'Maghrib'],
      ['isha', 'Isyak']
    ];
    entries.forEach(([key]) => {
      const time = document.querySelector(`.solat-prayer-time[data-prayer="${key}"] time`);
      if (time) {
        time.textContent = String(schedule[key] || '--:--').slice(0, 5);
      }
    });
    hijriDate.textContent = formatHijriDate(schedule.hijri);
    currentPrayerSchedule = schedule;
    updatePrayerCountdown(schedule);
    status.textContent = 'KDH06 Langkawi';
  }

  async function loadSchedule() {
    try {
      renderSchedule(await prayerScheduleForToday());
    } catch (error) {
      status.textContent = 'Prayer times unavailable';
      console.warn('Unable to load the Jom Solat schedule.', error);
    }
  }

  updateClock();
  window.setInterval(updateClock, 1000);
  void loadSchedule();
  window.setInterval(() => void loadSchedule(), 60 * 60 * 1000);

  if (eventMode && query.get('returnTo') === '../index.html') {
    const eventBanner = document.getElementById('solat-event-banner');
    const eventTitle = document.getElementById('solat-event-title');
    const eventImage = document.getElementById('solat-event-image');
    const returnNotice = document.getElementById('solat-return-notice');
    const returnCountdown = document.getElementById('solat-return-countdown');
    const returnAt = Date.now() + 60 * 1000;
    let returnStarted = false;
    returnNotice.hidden = false;

    function updateReturnCountdown() {
      const remaining = Math.max(0, Math.ceil((returnAt - Date.now()) / 1000));
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      returnCountdown.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      if (remaining === 0 && !returnStarted) {
        returnStarted = true;
        window.location.replace('../index.html');
      }
    }

    updateReturnCountdown();
    window.setInterval(updateReturnCountdown, 250);
    const requestedEventId = query.get('eventId');
    let stagedEvent = null;
    try {
      const serializedEvent = window.sessionStorage.getItem('infositemrsm.activeEvent');
      stagedEvent = serializedEvent ? normalizeEvent(JSON.parse(serializedEvent)) : null;
      window.sessionStorage.removeItem('infositemrsm.activeEvent');
    } catch (error) {
      console.warn('Unable to restore the pinned event for Jom Solat.', error);
    }

    function renderEvent(event) {
      if (!event || event.id !== requestedEventId) {
        return;
      }
      eventBanner.hidden = false;
      eventTitle.textContent = event.title;
      const imageUrl = safeHttpsUrl(event.pinnedImageUrl);
      eventBanner.classList.toggle('has-image', Boolean(imageUrl));
      eventImage.hidden = !imageUrl;
      if (imageUrl) {
        eventImage.src = imageUrl;
        eventImage.alt = event.title;
      } else {
        eventImage.removeAttribute('src');
        eventImage.alt = '';
      }
    }

    renderEvent(stagedEvent);
    void loadDisplayData().then((data) => {
      const event = data.events.find((item) => item.id === requestedEventId);
      renderEvent(event);
    });
  }
}

function initMaintenancePage() {
  const clock = document.getElementById('maintenance-clock');
  const date = document.getElementById('maintenance-date');
  function updateMaintenanceClock() {
    const now = new Date();
    clock.textContent = new Intl.DateTimeFormat('en-MY', {
      timeZone: MALAYSIA_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(now);
    date.textContent = new Intl.DateTimeFormat('en-MY', {
      timeZone: MALAYSIA_TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(now);
  }
  updateMaintenanceClock();
  window.setInterval(updateMaintenanceClock, 1000);
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
  const announcementMessageInput = document.getElementById('announcement-message');
  const announcementImageInput = document.getElementById('announcement-image');
  const announcementSectionInput = document.getElementById('announcement-section');
  const announcementDurationInput = document.getElementById('announcement-duration');
  const tickerDurationInput = document.getElementById('ticker-duration');
  const timetableInput = document.getElementById('timetable-url');
  const eventForm = document.getElementById('event-form');
  const eventTitleInput = document.getElementById('event-title');
  const eventStartsAtInput = document.getElementById('event-starts-at');
  const eventImageUrlInput = document.getElementById('event-image-url');
  const eventList = document.getElementById('event-list');
  const eventSaveButton = document.getElementById('event-save-button');
  const eventCancelButton = document.getElementById('event-cancel-button');

  let slides = [];
  let events = [];
  let editingEventId = '';
  let settings = {
    footerNews: '',
    slidingText: '',
    tickerDuration: '24',
    timetableUrl: ''
  };

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

  function resetEventForm() {
    editingEventId = '';
    eventForm.reset();
    eventSaveButton.textContent = 'Add event';
    eventCancelButton.hidden = true;
  }

  function updateEventList() {
    eventList.replaceChildren();
    if (!events.length) {
      const empty = document.createElement('p');
      empty.className = 'note';
      empty.textContent = 'No scheduled events.';
      eventList.appendChild(empty);
      return;
    }

    events.forEach((event) => {
      const card = document.createElement('div');
      card.className = 'event-card';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = event.title;
      const date = document.createElement('span');
      const startsAt = new Date(event.startsAt);
      date.textContent = Number.isFinite(startsAt.getTime())
        ? new Intl.DateTimeFormat('en-MY', {
          timeZone: MALAYSIA_TIME_ZONE,
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(startsAt)
        : 'Invalid event date';
      info.append(title, date);

      const actions = document.createElement('div');
      actions.className = 'button-row';
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button button-secondary';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => {
        editingEventId = event.id;
        eventTitleInput.value = event.title;
        eventStartsAtInput.value = malaysiaDateTimeInputValue(event.startsAt);
        eventImageUrlInput.value = event.pinnedImageUrl;
        eventSaveButton.textContent = 'Save event';
        eventCancelButton.hidden = false;
        eventTitleInput.focus();
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button button-secondary';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', async () => {
        events = events.filter((item) => item.id !== event.id);
        if (editingEventId === event.id) {
          resetEventForm();
        }
        updateEventList();
        await saveFeed();
      });

      actions.append(editButton, deleteButton);
      card.append(info, actions);
      eventList.appendChild(card);
    });
  }

  async function saveFeed() {
    setStatus('Saving to backend...');
    try {
      await persistSlidesToBackend(slides, settings, events);
      setStatus('Saved to backend.', 'success');
      updateSlideList();
      updateEventList();
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
    const section = announcementSectionInput.value;
    slides = slides.filter((slide) => String(slide.caption || '').trim().toLowerCase() !== section);
    slides.push(normalizeSlide({
      title,
      message: announcementMessageInput.value.trim() || title,
      imageUrl: announcementImageInput.value.trim(),
      duration: Number(announcementDurationInput.value) || 5,
      caption: section
    }));
    announcementForm.reset();
    announcementDurationInput.value = 5;
    updateSlideList();
    await saveFeed();
  });

  eventForm.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const pinnedImageUrl = eventImageUrlInput.value.trim();
    if (pinnedImageUrl && !safeHttpsUrl(pinnedImageUrl)) {
      setStatus('Pinned picture must be a valid HTTPS URL.', 'error');
      return;
    }

    let startsAt;
    try {
      startsAt = malaysiaIsoFromDateTimeInput(eventStartsAtInput.value);
    } catch (error) {
      setStatus(error.message, 'error');
      return;
    }
    const eventId = editingEventId || `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const updatedEvent = normalizeEvent({
      id: eventId,
      title: eventTitleInput.value.trim(),
      startsAt,
      pinnedImageUrl
    });
    events = editingEventId
      ? events.map((item) => item.id === editingEventId ? updatedEvent : item)
      : [...events, updatedEvent];
    events.sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
    resetEventForm();
    updateEventList();
    await saveFeed();
  });

  eventCancelButton.addEventListener('click', resetEventForm);

  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const timetableUrl = timetableInput.value.trim();
    if (timetableUrl && !safeHttpsUrl(timetableUrl)) {
      setStatus('Timetable embed must be a valid HTTPS URL.', 'error');
      return;
    }
    settings = {
      ...settings,
      footerNews: footerNewsInput.value.trim(),
      slidingText: footerNewsInput.value.trim(),
      tickerDuration: tickerDurationInput.value,
      timetableUrl
    };
    await saveFeed();
  });

  document.getElementById('clear-btn').addEventListener('click', () => videoForm.reset());
  document.getElementById('clear-announcement-btn').addEventListener('click', () => announcementForm.reset());
  document.getElementById('export-btn').addEventListener('click', () => {
    importJson.value = JSON.stringify({ slides, events, settings }, null, 2);
  });
  document.getElementById('import-btn').addEventListener('click', async () => {
    try {
      const parsed = JSON.parse(importJson.value);
      slides = slidesFromFeed(parsed).map(normalizeSlide);
      events = Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent) : events;
      settings = { ...settings, ...(parsed.settings || {}) };
      const tickerText = parsed.slidingText || parsed.newsText || settings.slidingText || settings.footerNews || '';
      settings.footerNews = tickerText;
      settings.slidingText = tickerText;
      updateSlideList();
      updateEventList();
      await saveFeed();
    } catch (error) {
      setStatus(`Import failed: ${error.message}`, 'error');
    }
  });

  const backendData = await fetchBackendData();
  slides = slidesFromFeed(backendData).map(normalizeSlide);
  events = Array.isArray(backendData?.events) ? backendData.events.map(normalizeEvent) : [];
  settings = { ...settings, ...(backendData?.settings || {}) };
  const tickerText = backendData?.slidingText || backendData?.newsText || settings.slidingText || settings.footerNews || '';
  settings.footerNews = tickerText;
  settings.slidingText = tickerText;
  footerNewsInput.value = tickerText;
  tickerDurationInput.value = settings.tickerDuration || 24;
  timetableInput.value = settings.timetableUrl || '';
  updateSlideList();
  updateEventList();
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
  if (document.body.classList.contains('solat-page')) {
    void initSolatPage();
  }
  if (document.body.classList.contains('maintenance-page')) {
    initMaintenancePage();
  }
  if (document.body.classList.contains('admin-page')) {
    void initAdminPage();
  }
});
