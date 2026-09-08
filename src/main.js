import hotspotsData from './data/hotspots.json';
import { QuizModule } from './modules/QuizModule.js';
import { SCORMAdapter } from './modules/SCORMAdapter.js';

// ─────────────────────────────────────────────────────────────
// Application State
// ─────────────────────────────────────────────────────────────
let currentHotspotId = 'rongga-mulut';
const visitedHotspots = new Set();
let currentActiveTab = 'tab-modus';
let currentAngle = 0; // 0, 90, 180, 270
let isModalOpen = false;

let scorm;
let quiz;
let glightboxInstance = null;

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
  setupRotationControls();
  setupDetailModal();
  setupHelpModal();
  setupResultModal();
  setupQuizTrigger();

  // Initial body angle & default zoom 150%
  setBodyAngle(0, true);
  applyZoom(1.5);
  updateProgressUI();
}

// ─────────────────────────────────────────────────────────────
// 1. Camera Controls: 360° Pedestal Carousel, Angle Pills & Zoom
// ─────────────────────────────────────────────────────────────
const ANGLES = [0, 90, 180, 270];
let isAutoPlaying = false;
let autoPlayTimer = null;
let currentZoom = 1.5;

function setupRotationControls() {
  const btnPrev = document.getElementById('btn-carousel-prev');
  const btnPlay = document.getElementById('btn-carousel-play');
  const btnNext = document.getElementById('btn-carousel-next');
  const canvasWrap = document.getElementById('body-canvas-wrapper');

  // Putar ke sudut sebelumnya (‹)
  btnPrev?.addEventListener('click', () => {
    stopAutoPlay();
    const idx = ANGLES.indexOf(currentAngle);
    const prevIdx = (idx - 1 + ANGLES.length) % ANGLES.length;
    setBodyAngle(ANGLES[prevIdx]);
  });

  // Auto-play / Pause toggle (▶ / ⏸)
  btnPlay?.addEventListener('click', () => {
    toggleAutoPlay();
  });

  // Putar ke sudut berikutnya (›)
  btnNext?.addEventListener('click', () => {
    stopAutoPlay();
    const idx = ANGLES.indexOf(currentAngle);
    const nextIdx = (idx + 1) % ANGLES.length;
    setBodyAngle(ANGLES[nextIdx]);
  });

  // Drag / Swipe 360° gesture interaction
  let isDragging = false;
  let startX = 0;

  canvasWrap?.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.body-hotspot-pin') || e.target.closest('button')) return;
    stopAutoPlay();
    isDragging = true;
    startX = e.clientX;
    canvasWrap.setPointerCapture(e.pointerId);
  });

  canvasWrap?.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    if (Math.abs(deltaX) > 40) {
      const idx = ANGLES.indexOf(currentAngle);
      if (deltaX < 0) {
        // Drag left -> turn clockwise
        const nextIdx = (idx + 1) % ANGLES.length;
        setBodyAngle(ANGLES[nextIdx]);
      } else {
        // Drag right -> turn counter-clockwise
        const prevIdx = (idx - 1 + ANGLES.length) % ANGLES.length;
        setBodyAngle(ANGLES[prevIdx]);
      }
      startX = e.clientX;
    }
  });

  const endDrag = (e) => {
    if (isDragging) {
      isDragging = false;
      try { canvasWrap.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  canvasWrap?.addEventListener('pointerup', endDrag);
  canvasWrap?.addEventListener('pointercancel', endDrag);

  // Initialize Zoom Controls
  setupZoomControls();
}

function toggleAutoPlay() {
  if (isAutoPlaying) {
    stopAutoPlay();
  } else {
    startAutoPlay();
  }
}

function startAutoPlay() {
  isAutoPlaying = true;
  const btnPlay = document.getElementById('btn-carousel-play');
  const icon = document.getElementById('play-pause-icon');
  if (btnPlay) btnPlay.classList.add('playing');
  if (icon) icon.textContent = '⏸';

  autoPlayTimer = setInterval(() => {
    const idx = ANGLES.indexOf(currentAngle);
    const nextIdx = (idx + 1) % ANGLES.length;
    setBodyAngle(ANGLES[nextIdx]);
  }, 1600);
}

function stopAutoPlay() {
  if (!isAutoPlaying) return;
  isAutoPlaying = false;
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
  const btnPlay = document.getElementById('btn-carousel-play');
  const icon = document.getElementById('play-pause-icon');
  if (btnPlay) btnPlay.classList.remove('playing');
  if (icon) icon.textContent = '▶';
}

function setupZoomControls() {
  const btnIn = document.getElementById('btn-zoom-in');
  const btnOut = document.getElementById('btn-zoom-out');
  const btnReset = document.getElementById('btn-zoom-reset');
  const canvasWrap = document.getElementById('body-canvas-wrapper');

  btnIn?.addEventListener('click', () => applyZoom(currentZoom + 0.15));
  btnOut?.addEventListener('click', () => applyZoom(currentZoom - 0.15));
  btnReset?.addEventListener('click', () => applyZoom(1.5));

  // Wheel zoom over canvas wrapper
  canvasWrap?.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) applyZoom(currentZoom + 0.1);
    else applyZoom(currentZoom - 0.1);
  }, { passive: false });
}

function applyZoom(val) {
  currentZoom = Math.min(Math.max(val, 0.75), 2.2);
  const container = document.getElementById('body-image-container');
  const badge = document.getElementById('zoom-level-text');

  if (container) {
    container.style.transform = `scale(${currentZoom})`;
    container.style.transformOrigin = 'center center';
    container.style.transition = 'transform 0.15s ease';
    container.style.setProperty('--body-zoom', currentZoom);
  }
  document.documentElement.style.setProperty('--body-zoom', currentZoom);
  if (badge) {
    badge.textContent = `${Math.round(currentZoom * 100)}%`;
  }
}

function setBodyAngle(angle) {
  currentAngle = angle;

  // Find angle info
  const angleInfo = hotspotsData.viewAngles.find(a => a.angle === angle) || hotspotsData.viewAngles[0];

  // Update Angle Header Text
  const degText = document.getElementById('angle-deg-text');
  const nameText = document.getElementById('angle-name-text');
  const subText = document.getElementById('angle-sub-text');
  if (degText) degText.textContent = `${angle}°`;
  if (nameText) nameText.textContent = angleInfo.label;
  if (subText) subText.textContent = `(${angleInfo.sub})`;

  // Update Body Image
  const img = document.getElementById('main-body-img');
  if (img && !img.src.includes(angleInfo.image)) {
    img.style.opacity = '0.35';
    img.src = angleInfo.image;
    img.onload = () => {
      img.style.opacity = '1';
      renderHotspotsForCurrentAngle();
    };
  } else {
    renderHotspotsForCurrentAngle();
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Render Hotspots for Current Angle
// ─────────────────────────────────────────────────────────────
function renderHotspotsForCurrentAngle() {
  const layer = document.getElementById('hotspots-layer');
  if (!layer) return;

  layer.innerHTML = '';

  hotspotsData.hotspots.forEach(hs => {
    // Check if visible in current angle
    const isVisibleInAngle = hs.visibleAngles.includes(currentAngle);
    if (!isVisibleInAngle) return;

    const coords = hs.coordsByAngle[String(currentAngle)] || { x: 50, y: 50 };
    const isVisited = visitedHotspots.has(hs.id);
    const isActive = isModalOpen && hs.id === currentHotspotId;

    const pin = document.createElement('div');
    pin.className = `body-hotspot-pin ${isActive ? 'active' : ''} ${isVisited ? 'visited' : ''}`;
    pin.setAttribute('data-id', hs.id);
    pin.style.left = `${coords.x}%`;
    pin.style.top = `${coords.y}%`;

    const cleanName = hs.label.replace(/^\d+\.\s*/, '');

    pin.innerHTML = `
      <div class="pin-point">
        <div class="pin-pulse-ring"></div>
      </div>
      <div class="pin-tooltip" role="tooltip">
        <span class="pin-tooltip-num">${hs.badgeNum}</span>
        <span class="pin-tooltip-name">${cleanName}</span>
      </div>
    `;

    pin.setAttribute('tabindex', '0');
    pin.setAttribute('role', 'button');
    pin.setAttribute('aria-label', `Hotspot ${hs.badgeNum}: ${cleanName}`);

    pin.addEventListener('pointerenter', () => pin.classList.add('is-hovered'));
    pin.addEventListener('pointerleave', () => pin.classList.remove('is-hovered'));

    pin.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openHotspotModal(hs.id, true);
    });

    layer.appendChild(pin);
  });
}

// ─────────────────────────────────────────────────────────────
// 3. Tabbed Hotspot Modal Dialog
// ─────────────────────────────────────────────────────────────
function setupDetailModal() {
  const overlay = document.getElementById('hotspot-card-modal-overlay');
  if (overlay && overlay.parentNode !== document.body) {
    document.body.appendChild(overlay);
  }

  const btnClose = document.getElementById('btn-close-detail-modal');
  const btnFooterClose = document.getElementById('btn-modal-close-footer');
  const btnPrev = document.getElementById('btn-prev-hotspot');
  const btnNext = document.getElementById('btn-next-hotspot');

  btnClose?.addEventListener('click', closeHotspotModal);
  btnFooterClose?.addEventListener('click', closeHotspotModal);

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeHotspotModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isModalOpen) {
      closeHotspotModal();
    }
  });

  // Prev / Next Modus
  btnPrev?.addEventListener('click', () => {
    const idx = hotspotsData.hotspots.findIndex(h => h.id === currentHotspotId);
    const prevIdx = (idx - 1 + hotspotsData.hotspots.length) % hotspotsData.hotspots.length;
    openHotspotModal(hotspotsData.hotspots[prevIdx].id, true);
  });

  btnNext?.addEventListener('click', () => {
    const idx = hotspotsData.hotspots.findIndex(h => h.id === currentHotspotId);
    const nextIdx = (idx + 1) % hotspotsData.hotspots.length;
    openHotspotModal(hotspotsData.hotspots[nextIdx].id, true);
  });

  // Tab switching
  const tabBtns = document.querySelectorAll('.card-tabs-nav .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchCardTab(tabId);
    });
  });
}

function toggleHotspotModal(id) {
  // Toggle removed as requested: always open/show the modal card on hotspot click
  openHotspotModal(id, true);
}

function closeHotspotModal() {
  isModalOpen = false;
  const overlay = document.getElementById('hotspot-card-modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.style.removeProperty('display');
    overlay.style.removeProperty('opacity');
    overlay.style.removeProperty('visibility');
    overlay.style.removeProperty('pointer-events');
    overlay.style.setProperty('display', 'none', 'important');
    overlay.style.setProperty('opacity', '0', 'important');
    overlay.style.setProperty('visibility', 'hidden', 'important');
    overlay.style.setProperty('pointer-events', 'none', 'important');
  }

  renderHotspotsForCurrentAngle();
}

function switchCardTab(tabId) {
  currentActiveTab = tabId;

  document.querySelectorAll('.card-tabs-nav .tab-btn').forEach(b => {
    if (b.getAttribute('data-tab') === tabId) b.classList.add('active');
    else b.classList.remove('active');
  });

  document.querySelectorAll('.tab-content-container .tab-pane').forEach(p => {
    if (p.id === tabId) p.classList.add('active');
    else p.classList.remove('active');
  });
}

function openHotspotModal(id, syncAngle = false) {
  const hs = hotspotsData.hotspots.find(h => h.id === id);
  if (!hs) return;

  currentHotspotId = id;
  isModalOpen = true;
  visitedHotspots.add(id);

  // ── STEP 1: Show overlay immediately (topmost layer) ──────────
  const overlay = document.getElementById('hotspot-card-modal-overlay');
  if (overlay) {
    if (overlay.parentNode !== document.body) {
      document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden');
    overlay.style.removeProperty('display');
    overlay.style.removeProperty('opacity');
    overlay.style.removeProperty('visibility');
    overlay.style.removeProperty('pointer-events');
    overlay.style.setProperty('display', 'flex', 'important');
    overlay.style.setProperty('opacity', '1', 'important');
    overlay.style.setProperty('visibility', 'visible', 'important');
    overlay.style.setProperty('pointer-events', 'auto', 'important');
    overlay.style.setProperty('z-index', '2147483647', 'important');
  }

  // ── STEP 2: Render modal content ──────────────────────────────
  try {
    renderModalContent(hs);
  } catch (err) {
    console.error('Error rendering modal content:', err);
  }

  // ── STEP 3: Switch to first tab ───────────────────────────────
  switchCardTab('tab-modus');

  // ── STEP 4: Update progress UI safely ─────────────────────────
  try {
    updateProgressUI();
  } catch (err) {
    console.warn('Progress update error:', err);
  }

  // ── STEP 5: Sync body angle if needed ─────────────────────────
  if (syncAngle && !hs.visibleAngles.includes(currentAngle)) {
    setBodyAngle(hs.primaryAngle);
  } else {
    renderHotspotsForCurrentAngle();
  }

  // ── STEP 6: Update sidebar ────────────────────────────────────
  document.querySelectorAll('.sidebar-hotspot-item').forEach(item => {
    const itemHsId = item.getAttribute('data-hotspot-id');
    item.classList.toggle('active', itemHsId === id);
    if (visitedHotspots.has(itemHsId)) item.classList.add('visited');
  });

}

function renderModalContent(hs) {
  const idx = hotspotsData.hotspots.findIndex(h => h.id === hs.id);
  const counter = document.getElementById('card-nav-counter');
  if (counter) counter.textContent = `${idx + 1} / ${hotspotsData.hotspots.length}`;

  // Header badges & title
  const badgeRow = document.querySelector('.detail-badge-row');
  const tagBadge = document.getElementById('detail-tag-badge');
  const catBadge = document.getElementById('detail-cat-badge');
  const title = document.getElementById('detail-title');
  const sub = document.getElementById('detail-subtitle');

  if (badgeRow) badgeRow.className = `detail-badge-row cat-${hs.categoryId}`;
  if (tagBadge) {
    tagBadge.textContent = `MODUS #${hs.num}`;
    tagBadge.className = `detail-tag-badge cat-${hs.categoryId}`;
  }
  if (catBadge) {
    catBadge.textContent = hs.categoryLabel.toUpperCase();
    catBadge.className = `detail-cat-badge cat-${hs.categoryId}`;
  }
  if (title) title.textContent = hs.label;
  if (sub) sub.textContent = hs.tag;

  // TAB 1: Modus Operandi & Param Grid
  const mainImg = document.getElementById('detail-main-img');
  const desc = document.getElementById('detail-desc');
  const concealmentMethod = document.getElementById('detail-concealment-method');
  const bodyLocation = document.getElementById('detail-body-location');
  const drugTypes = document.getElementById('detail-drug-types');
  const packaging = document.getElementById('detail-packaging');
  const narrative = document.getElementById('detail-modus-narrative');
  const note = document.getElementById('detail-inspection-note');

  if (mainImg) {
    mainImg.src = hs.mainIllustration || hs.thumb;
    mainImg.alt = hs.label;
  }
  if (desc) desc.textContent = hs.description;
  if (concealmentMethod) concealmentMethod.textContent = hs.categoryLabel || 'Modus Penyembunyian Tubuh';
  if (bodyLocation) bodyLocation.textContent = `${hs.label} (Sudut Pandang Utama: ${hs.primaryAngle}°)`;
  if (drugTypes) drugTypes.textContent = hs.drugTypes || 'Narkotika Golongan I (Kokain, Sabu, Heroin)';
  if (packaging) packaging.textContent = hs.packagingTechnique || 'Kondom lateks berlapis, selotip kedap udara';
  if (narrative) narrative.textContent = hs.modusDetail || hs.description;
  if (note) note.textContent = hs.inspectionNote || 'Wajib dilakukan pemeriksaan sesuai SOP resmi DJBC.';

  // TAB 2: Foto Gambar Real
  const findingsGrid = document.getElementById('findings-thumbnails-grid');
  if (findingsGrid) {
    findingsGrid.innerHTML = '';
    hs.findings.forEach((f) => {
      const a = document.createElement('a');
      a.href = f.full;
      a.className = 'finding-thumb-item glightbox';
      a.setAttribute('data-gallery', `findings-gallery-${hs.id}`);
      a.setAttribute('data-title', `${f.caption} — [${f.tag}]`);
      a.innerHTML = `
        <img src="${f.thumb}" alt="${f.caption}" />
        <span class="finding-thumb-label">${f.tag}</span>
      `;
      findingsGrid.appendChild(a);
    });

    // Re-init GLightbox safely
    try {
      if (typeof window.GLightbox !== 'undefined') {
        if (glightboxInstance) glightboxInstance.destroy();
        glightboxInstance = window.GLightbox({
          selector: '.glightbox',
          touchNavigation: true,
          loop: true
        });
      }
    } catch (gErr) {
      console.warn('GLightbox init warning:', gErr);
    }
  }

  // TAB 3: Detection Indicators (Ciri Pelaku) & Actions (SOP)
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

  // TAB 4: Risk & Medical Alert
  const riskScoreVal = document.getElementById('risk-score-val');
  const riskBarFill = document.getElementById('risk-meter-bar-fill');
  const medRisk = document.getElementById('detail-medical-risk');

  if (riskScoreVal) riskScoreVal.textContent = `${hs.riskLevel.toUpperCase()} (${hs.riskScore}/100)`;
  if (riskBarFill) riskBarFill.style.width = `${hs.riskScore}%`;
  if (medRisk) medRisk.textContent = hs.medicalRisk;
}

// ─────────────────────────────────────────────────────────────
// 4. Sidebar Management
// ─────────────────────────────────────────────────────────────
function setupSidebar() {
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('app-sidebar');

  toggleBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  const hotspotItems = document.querySelectorAll('.sidebar-hotspot-item');
  hotspotItems.forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-hotspot-id');
      if (id) {
        openHotspotModal(id, true);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 5. Progress UI & SCORM
// ─────────────────────────────────────────────────────────────
function updateProgressUI() {
  const total = hotspotsData.hotspots.length;
  const visited = visitedHotspots.size;
  const explorePct = Math.round((visited / total) * 75);
  const totalPct = Math.min(explorePct + (quiz?.score ? 25 : 5), 100);

  const text = document.getElementById('progress-percentage-text');
  const fill = document.getElementById('progress-fill-bar');

  if (text) text.textContent = `${totalPct}%`;
  if (fill) fill.style.width = `${totalPct}%`;

  try {
    if (scorm) {
      if (typeof scorm.setProgress === 'function') {
        scorm.setProgress(visitedHotspots);
      }
      if (typeof scorm.setScore === 'function') {
        scorm.setScore(totalPct);
      }
      if (totalPct >= 80 && typeof scorm.complete === 'function') {
        scorm.complete(totalPct);
      }
    }
  } catch (sErr) {
    console.warn('SCORM update notice:', sErr);
  }
}

// ─────────────────────────────────────────────────────────────
// 6. Quiz & Help Modals
// ─────────────────────────────────────────────────────────────
function setupQuizTrigger() {
  const btnQuiz = document.getElementById('btn-open-quiz');
  btnQuiz?.addEventListener('click', () => {
    quiz.start();
  });
}

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
