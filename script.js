const storageKey = 'infoTvSlidesMRSM';
const dataFileName = 'data.json';

const defaultSlides = [
  {
    title: 'Welcome to Info TV',
    message: 'Beautifully designed content for your public display, updated automatically from the admin panel.',
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
    videoUrl: '',
    duration: 12,
    caption: 'Use admin.html to add image or video slides.'
  },
  {
    title: 'Picture and Video Ready',
    message: 'Show announcements, schedules, and visual storytelling with full-screen image and video support.',
    imageUrl: 'https://images.unsplash.com/photo-1496307653780-42ee777d4833?auto=format&fit=crop&w=1600&q=80',
    videoUrl: '',
    duration: 12,
    caption: 'Videos autoplay silently for TV-friendly presentations.'
  }
];

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

async function loadSlidesFromDataFile() {
  try {
    const response = await fetch(dataFileName, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load ${dataFileName}`);
    }

    const parsed = await response.json();
    if (!Array.isArray(parsed) || !parsed.length) {
      return null;
    }

    return parsed.map(normalizeSlide);
  } catch (error) {
    return null;
  }
}

async function loadSlides() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map(normalizeSlide);
      }
    }
  } catch (error) {
    console.warn('Could not load slides from local storage.', error);
  }

  const fromDataFile = await loadSlidesFromDataFile();
  return fromDataFile || defaultSlides.slice();
}

function saveSlides(slides) {
  const normalizedSlides = slides.map(normalizeSlide);
  localStorage.setItem(storageKey, JSON.stringify(normalizedSlides));
  void persistToDataFile(normalizedSlides);
  return normalizedSlides;
}

async function persistToDataFile(slides) {
  const payload = JSON.stringify(slides, null, 2);

  try {
    const response = await fetch(dataFileName, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });

    if (response.ok) {
      return;
    }
  } catch (error) {
    console.warn('Remote save was not available. Falling back to download.', error);
  }

  try {
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = dataFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.warn('Unable to download data file.', error);
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
  const tickerContent = document.getElementById('ticker-content');
  const clock = document.getElementById('clock');

  let slides = await loadSlides();
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

  function showCurrent() {
    if (!slides.length) {
      slides = defaultSlides.slice();
    }
    if (currentIndex >= slides.length) {
      currentIndex = 0;
    }
    renderSlide(slides[currentIndex]);
    const duration = Math.max(5, slides[currentIndex].duration || 12) * 1000;
    timerId = window.setTimeout(() => {
      currentIndex = (currentIndex + 1) % slides.length;
      showCurrent();
    }, duration);
  }

  updateClock();
  showCurrent();
  window.setInterval(updateClock, 60_000);

  window.addEventListener('storage', async () => {
    slides = await loadSlides();
    currentIndex = 0;
    if (timerId) {
      window.clearTimeout(timerId);
    }
    showCurrent();
  });
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

  let slides = [];
  let editIndex = null;

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
