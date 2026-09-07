import { gsap } from 'gsap';
import hotspotsData from './data/hotspots.json';
import { QuizModule } from './modules/QuizModule.js';
import { SCORMAdapter } from './modules/SCORMAdapter.js';

// ─────────────────────────────────────────────────────────────
// Application State
// ─────────────────────────────────────────────────────────────
let currentHotspotId = 'saluran-cerna';
const visitedHotspots = new Set(['saluran-cerna']);
let currentCategory = 'all';
let currentStep = 1;
let is3DMode = false;

let scorm;
let quiz;
let glightboxInstance = null;

// 3D lazy state
let scene3D = null;
let bodyViewer = null;
let xrayCtrl = null;
let threeInitialized = false;

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  scorm = new SCORMAdapter();

  // Initialize Quiz
  quiz = new QuizModule({
    onComplete: (score, answers) => {
      showResult(score);
      scorm.complete(score);
      updateProgressUI();
    }
  });

  // Setup Event Handlers
  setupSidebar();
  setupFilterPills();
  setupStepNav();
  setupBodyHotspots();
  setupCarousel();
  setupViewModeToggle();
  setupHelpModal();
  setupResultModal();

  // Initial display
  selectHotspot('saluran-cerna', false);
  updateProgressUI();

  // Resize listener to re-align connector line
  window.addEventListener('resize', () => {
    updateConnectorLine(false);
  });

  // Initial connector line animation after slight layout settle
  setTimeout(() => {
    updateConnectorLine(true);
  }, 250);
}

// ─────────────────────────────────────────────────────────────
// Sidebar Management
// ─────────────────────────────────────────────────────────────
function setupSidebar() {
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('app-sidebar');

  toggleBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    setTimeout(() => updateConnectorLine(false), 260);
  });

  // Module items
  const moduleItems = document.querySelectorAll('.module-item');
  moduleItems.forEach(item => {
    item.addEventListener('click', () => {
      moduleItems.forEach(m => m.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Filter Pills (Fokus Area Tubuh)
// ─────────────────────────────────────────────────────────────
function setupFilterPills() {
  const filterPills = document.querySelectorAll('.filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const cat = pill.getAttribute('data-category');
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filterCategory(cat);
    });
  });
}

function filterCategory(catId) {
  currentCategory = catId;

  // Highlight/dim hotspot pins on body
  const pins = document.querySelectorAll('.body-hotspot-pin');
  pins.forEach(pin => {
    const hsId = pin.getAttribute('data-id');
    const hs = hotspotsData.hotspots.find(h => h.id === hsId);
    if (!hs) return;

    if (catId === 'all' || hs.categoryId === catId) {
      pin.style.display = 'flex';
      pin.style.opacity = '1';
    } else {
      pin.style.opacity = '0.35';
    }
  });

  // Highlight/dim carousel items
  const cards = document.querySelectorAll('.carousel-card');
  cards.forEach(card => {
    const hsId = card.getAttribute('data-id');
    const hs = hotspotsData.hotspots.find(h => h.id === hsId);
    if (!hs) return;

    if (catId === 'all' || hs.categoryId === catId) {
      card.style.opacity = '1';
    } else {
      card.style.opacity = '0.45';
    }
  });

  // If currently active hotspot doesn't match, select first matching
  const currentHs = hotspotsData.hotspots.find(h => h.id === currentHotspotId);
  if (catId !== 'all' && currentHs && currentHs.categoryId !== catId) {
    const match = hotspotsData.hotspots.find(h => h.categoryId === catId);
    if (match) {
      selectHotspot(match.id, true);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Step Navigation (1 Informasi, 2 Indikator, 3 SOP, 4 Kuis)
// ─────────────────────────────────────────────────────────────
function setupStepNav() {
  const stepPills = document.querySelectorAll('.step-pill');
  stepPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const step = parseInt(pill.getAttribute('data-step'), 10);
      stepPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      switchStep(step);
    });
  });
}

function switchStep(stepNum) {
  currentStep = stepNum;

  if (stepNum === 4) {
    // Open quiz
    quiz.start();
    return;
  }

  const detailPanel = document.getElementById('detail-card-panel');
  if (!detailPanel) return;

  if (stepNum === 1) {
    detailPanel.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (stepNum === 2) {
    const el = document.getElementById('block-indicators');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      gsap.fromTo(el, { scale: 0.98, backgroundColor: '#FFE58F' }, { scale: 1, backgroundColor: '#FFFBE6', duration: 0.5 });
    }
  } else if (stepNum === 3) {
    const el = document.getElementById('block-detection');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      gsap.fromTo(el, { scale: 0.98, backgroundColor: '#BAE7FF' }, { scale: 1, backgroundColor: '#E6F7FF', duration: 0.5 });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Body Hotspot Pins (2D Stage)
// ─────────────────────────────────────────────────────────────
function setupBodyHotspots() {
  const pins = document.querySelectorAll('.body-hotspot-pin');
  pins.forEach(pin => {
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = pin.getAttribute('data-id');
      selectHotspot(id, true);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Bottom Carousel Strip
// ─────────────────────────────────────────────────────────────
function setupCarousel() {
  const track = document.getElementById('carousel-items-track');
  const btnLeft = document.getElementById('btn-carousel-scroll-left');
  const btnRight = document.getElementById('btn-carousel-scroll-right');

  btnLeft?.addEventListener('click', () => {
    track.scrollBy({ left: -220, behavior: 'smooth' });
  });

  btnRight?.addEventListener('click', () => {
    track.scrollBy({ left: 220, behavior: 'smooth' });
  });

  const cards = document.querySelectorAll('.carousel-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      selectHotspot(id, true);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Select Hotspot & Update All Views
// ─────────────────────────────────────────────────────────────
function selectHotspot(id, animateLine = true) {
  const hs = hotspotsData.hotspots.find(h => h.id === id);
  if (!hs) return;

  currentHotspotId = id;
  visitedHotspots.add(id);
  updateProgressUI();

  // Update Body Hotspot Pin Highlight
  const pins = document.querySelectorAll('.body-hotspot-pin');
  pins.forEach(pin => {
    const pinId = pin.getAttribute('data-id');
    const badge = pin.querySelector('.pin-badge');
    if (pinId === id) {
      pin.classList.add('active');
      badge?.classList.add('gold-highlight');
    } else {
      pin.classList.remove('active');
      badge?.classList.remove('gold-highlight');
    }
  });

  // Update Carousel Selection & Scroll into view
  const cards = document.querySelectorAll('.carousel-card');
  cards.forEach(card => {
    if (card.getAttribute('data-id') === id) {
      card.classList.add('active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      card.classList.remove('active');
    }
  });

  // Update Right Detail Card
  renderDetailCard(hs);

  // Update Animated Wipe Connector Line
  updateConnectorLine(animateLine);
}

function renderDetailCard(hs) {
  const cardInner = document.getElementById('active-detail-card');
  if (cardInner) {
    cardInner.classList.add('content-refreshing');
  }

  // Header badges & title
  const tagBadge = document.getElementById('detail-tag-badge');
  const catBadge = document.getElementById('detail-cat-badge');
  const title = document.getElementById('detail-title');
  if (tagBadge) tagBadge.textContent = `MODUS #${hs.num}`;
  if (catBadge) catBadge.textContent = hs.categoryLabel.toUpperCase();
  if (title) title.textContent = hs.label;

  // Media & Description
  const mainImg = document.getElementById('detail-main-img');
  const desc = document.getElementById('detail-desc');
  if (mainImg) {
    mainImg.src = hs.mainIllustration || hs.thumb;
    mainImg.alt = hs.label;
  }
  if (desc) desc.textContent = hs.description;

  // Findings Thumbnails
  const findingsGrid = document.getElementById('findings-thumbnails-grid');
  if (findingsGrid) {
    findingsGrid.innerHTML = '';
    hs.findings.forEach((f, i) => {
      const a = document.createElement('a');
      a.href = f.full;
      a.className = 'finding-thumb-item glightbox';
      a.setAttribute('data-gallery', 'findings-gallery');
      a.setAttribute('data-title', `${f.caption} (${f.tag})`);
      a.innerHTML = `
        <img src="${f.thumb}" alt="${f.caption}" />
        <span class="finding-thumb-label">${f.tag}</span>
      `;
      findingsGrid.appendChild(a);
    });

    // Re-init GLightbox
    if (typeof window.GLightbox !== 'undefined') {
      if (glightboxInstance) glightboxInstance.destroy();
      glightboxInstance = window.GLightbox({
        selector: '.glightbox',
        touchNavigation: true,
        loop: true
      });
    }
  }

  // Two columns: Indicators & Detection
  const indList = document.getElementById('detail-indicators-list');
  if (indList) {
    indList.innerHTML = '';
    hs.indicators.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      indList.appendChild(li);
    });
  }

  const detList = document.getElementById('detail-detection-list');
  if (detList) {
    detList.innerHTML = '';
    hs.detection.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      detList.appendChild(li);
    });
  }

  // Medical Alert Strip
  const medRisk = document.getElementById('detail-medical-risk');
  if (medRisk) {
    medRisk.innerHTML = `<strong>Peringatan Medis:</strong> ${hs.medicalRisk}`;
  }

  setTimeout(() => {
    if (cardInner) {
      cardInner.classList.remove('content-refreshing');
      cardInner.classList.add('content-loaded');
    }
  }, 100);
}

// ─────────────────────────────────────────────────────────────
// Dynamic SVG Connector Line with Golden Wipe Animation
// ─────────────────────────────────────────────────────────────
function updateConnectorLine(animate = true) {
  if (is3DMode) {
    hideConnectorLine();
    return;
  }

  const wrapper = document.getElementById('body-canvas-wrapper');
  const activePin = document.querySelector(`.body-hotspot-pin[data-id="${currentHotspotId}"]`);
  const detailHeader = document.querySelector('.detail-header');

  if (!wrapper || !activePin || !detailHeader) {
    hideConnectorLine();
    return;
  }

  const wrapRect = wrapper.getBoundingClientRect();
  const pinPoint = activePin.querySelector('.pin-point') || activePin;
  const pinRect = pinPoint.getBoundingClientRect();
  const headerRect = detailHeader.getBoundingClientRect();

  // Calculate start coords relative to SVG wrapper (at pin point)
  const x1 = pinRect.left + pinRect.width / 2 - wrapRect.left;
  const y1 = pinRect.top + pinRect.height / 2 - wrapRect.top;

  // Calculate end dock coords directly at left edge of the detail card
  const x2 = headerRect.left - wrapRect.left;
  const y2 = headerRect.top + 20 - wrapRect.top;

  const lineGlow = document.getElementById('stage-line-glow');
  const lineCore = document.getElementById('stage-line-core');
  const cStart = document.getElementById('stage-circle-start');
  const cEnd = document.getElementById('stage-circle-end');

  if (!lineCore || !lineGlow || !cStart || !cEnd) return;

  // Position start and end pins
  cStart.setAttribute('cx', x1);
  cStart.setAttribute('cy', y1);
  cEnd.setAttribute('cx', x2);
  cEnd.setAttribute('cy', y2);

  // Set line coordinates
  lineGlow.setAttribute('x1', x1);
  lineGlow.setAttribute('y1', y1);
  lineGlow.setAttribute('x2', x2);
  lineGlow.setAttribute('y2', y2);

  lineCore.setAttribute('x1', x1);
  lineCore.setAttribute('y1', y1);
  lineCore.setAttribute('x2', x2);
  lineCore.setAttribute('y2', y2);

  lineGlow.style.opacity = '1';
  lineCore.style.opacity = '1';
  cStart.style.opacity = '1';
  cEnd.style.opacity = '1';

  // Wipe Animation
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  lineCore.style.strokeDasharray = `${length} ${length}`;
  lineGlow.style.strokeDasharray = `${length} ${length}`;

  if (animate) {
    lineCore.style.strokeDashoffset = length;
    lineGlow.style.strokeDashoffset = length;

    gsap.killTweensOf([lineCore, lineGlow, cStart, cEnd]);
    gsap.fromTo(cStart, { scale: 0.5, transformOrigin: 'center center' }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    gsap.to([lineCore, lineGlow], {
      strokeDashoffset: 0,
      duration: 0.45,
      ease: 'power2.out',
      onComplete: () => {
        gsap.fromTo(cEnd, { scale: 0.6, transformOrigin: 'center center' }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
      }
    });
  } else {
    lineCore.style.strokeDashoffset = 0;
    lineGlow.style.strokeDashoffset = 0;
  }
}

function hideConnectorLine() {
  const lineGlow = document.getElementById('stage-line-glow');
  const lineCore = document.getElementById('stage-line-core');
  const cStart = document.getElementById('stage-circle-start');
  const cEnd = document.getElementById('stage-circle-end');
  if (lineGlow) lineGlow.style.opacity = '0';
  if (lineCore) lineCore.style.opacity = '0';
  if (cStart) cStart.style.opacity = '0';
  if (cEnd) cEnd.style.opacity = '0';
}

// ─────────────────────────────────────────────────────────────
// Progress UI & SCORM
// ─────────────────────────────────────────────────────────────
function updateProgressUI() {
  const total = hotspotsData.hotspots.length;
  const visited = visitedHotspots.size;
  // Calculate percentage: base exploring 80%, quiz 20%
  const explorePct = Math.round((visited / total) * 75);
  const totalPct = Math.min(explorePct + (quiz?.score ? 25 : 5), 100);

  const text = document.getElementById('progress-percentage-text');
  const fill = document.getElementById('progress-fill-bar');

  if (text) text.textContent = `${totalPct}%`;
  if (fill) fill.style.width = `${totalPct}%`;

  if (scorm) {
    scorm.setScore(totalPct);
    if (totalPct >= 80) {
      scorm.complete(totalPct);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 2D Mockup / 3D Model Switcher
// ─────────────────────────────────────────────────────────────
function setupViewModeToggle() {
  const btn = document.getElementById('btn-toggle-viewmode');
  const label = document.getElementById('viewmode-label');
  const dualView = document.getElementById('dual-body-view');
  const threeStage = document.getElementById('three-stage-container');

  btn?.addEventListener('click', async () => {
    is3DMode = !is3DMode;

    if (is3DMode) {
      label.textContent = 'Mode: 3D Interaktif';
      dualView.classList.add('hidden');
      threeStage.classList.remove('hidden');
      hideConnectorLine();

      if (!threeInitialized) {
        await initThreeMode();
      }
    } else {
      label.textContent = 'Mode: Ilustrasi 2D';
      threeStage.classList.add('hidden');
      dualView.classList.remove('hidden');
      updateConnectorLine(true);
    }
  });
}

async function initThreeMode() {
  threeInitialized = true;
  try {
    const { SceneController } = await import('./modules/SceneController.js');
    const { HumanBodyViewer } = await import('./modules/HumanBodyViewer.js');
    const { XRayController } = await import('./modules/XRayController.js');
    const modelUrl = (await import('./assets/models/human_body.glb?url')).default;

    const canvas = document.getElementById('three-canvas');
    scene3D = new SceneController(canvas);
    bodyViewer = new HumanBodyViewer(scene3D.scene, () => {});
    const { bodyMeshes, organMeshes } = await bodyViewer.load(modelUrl);
    xrayCtrl = new XRayController(bodyMeshes, organMeshes);

    document.getElementById('btn-xray')?.addEventListener('click', () => {
      xrayCtrl?.toggle();
    });

    document.getElementById('btn-toggle-organs')?.addEventListener('click', () => {
      bodyViewer?.toggleOrgans();
    });
  } catch (err) {
    console.warn('3D mode loading fallback:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Help & Result Modals
// ─────────────────────────────────────────────────────────────
function setupHelpModal() {
  const btnHelp = document.getElementById('btn-help-modal');
  const overlay = document.getElementById('help-overlay');
  const btnClose = document.getElementById('btn-close-help');
  const btnOk = document.getElementById('btn-help-ok');

  btnHelp?.addEventListener('click', () => overlay.classList.remove('hidden'));
  btnClose?.addEventListener('click', () => overlay.classList.add('hidden'));
  btnOk?.addEventListener('click', () => overlay.classList.add('hidden'));
}

function setupResultModal() {
  const overlay = document.getElementById('result-overlay');
  const btnRetry = document.getElementById('btn-retry-quiz');
  const btnReview = document.getElementById('btn-review');

  btnRetry?.addEventListener('click', () => {
    overlay.classList.add('hidden');
    quiz.start();
  });

  btnReview?.addEventListener('click', () => {
    overlay.classList.add('hidden');
    switchStep(1);
    document.querySelectorAll('.step-pill').forEach(p => {
      if (p.getAttribute('data-step') === '1') p.classList.add('active');
      else p.classList.remove('active');
    });
  });
}

function showResult(score) {
  const overlay = document.getElementById('result-overlay');
  const scoreDisp = document.getElementById('result-score-display');
  const title = document.getElementById('result-title');
  const msg = document.getElementById('result-message');
  const icon = document.getElementById('result-icon');

  if (scoreDisp) scoreDisp.textContent = `${score} / 100`;

  if (score >= 70) {
    if (icon) icon.textContent = '🏆';
    if (title) title.textContent = 'Kompetensi Terpenuhi!';
    if (msg) msg.textContent = 'Selamat! Anda berhasil memahami prinsip deteksi, indikator risiko, dan standar operasional pemeriksaan penyelundupan narkotika pada tubuh kurir.';
  } else {
    if (icon) icon.textContent = '⚠️';
    if (title) title.textContent = 'Perlu Pendalaman Materi';
    if (msg) msg.textContent = 'Nilai Anda belum mencapai batas kelulusan 70%. Silakan pelajari kembali titik-titik rawan dan indikator fisik sebelum mengulang kuis.';
  }

  overlay?.classList.remove('hidden');
}
