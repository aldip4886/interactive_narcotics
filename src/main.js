import hotspotsData from './data/hotspots.json';
import { QuizModule } from './modules/QuizModule.js';
import { SCORMAdapter } from './modules/SCORMAdapter.js';

// ─────────────────────────────────────────────────────────────
// Application State
// ─────────────────────────────────────────────────────────────
let currentHotspotId = 'saluran-cerna';
const visitedHotspots = new Set();
let currentActiveTab = 'tab-modus';
let currentAngle = 0; // 0, 90, 180, 270

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

  // Initial body angle
  setBodyAngle(0, true);
  updateProgressUI();
}

// ─────────────────────────────────────────────────────────────
// 1. 4-Angle Body Rotation Navigation Controls (Left, Reset, Right)
// ─────────────────────────────────────────────────────────────
const ANGLES = [0, 90, 180, 270];

function setupRotationControls() {
  const btnLeft = document.getElementById('btn-rotate-left');
  const btnReset = document.getElementById('btn-rotate-reset');
  const btnRight = document.getElementById('btn-rotate-right');
  const canvasWrap = document.getElementById('body-canvas-wrapper');

  // Ke Kiri (Putar Berlawanan Jarum Jam: 0 -> 270 -> 180 -> 90 -> 0)
  btnLeft?.addEventListener('click', () => {
    const idx = ANGLES.indexOf(currentAngle);
    const prevIdx = (idx - 1 + ANGLES.length) % ANGLES.length;
    setBodyAngle(ANGLES[prevIdx]);
  });

  // Reset (Kembali ke Tampak Depan 0°)
  btnReset?.addEventListener('click', () => {
    setBodyAngle(0);
  });

  // Ke Kanan (Putar Searah Jarum Jam: 0 -> 90 -> 180 -> 270 -> 0)
  btnRight?.addEventListener('click', () => {
    const idx = ANGLES.indexOf(currentAngle);
    const nextIdx = (idx + 1) % ANGLES.length;
    setBodyAngle(ANGLES[nextIdx]);
  });

  // Interactive Drag / Touch Swipe to spin body
  let isDragging = false;
  let startX = 0;

  canvasWrap?.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.body-hotspot-pin')) return;
    isDragging = true;
    startX = e.clientX;
    canvasWrap.setPointerCapture(e.pointerId);
  });

  canvasWrap?.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    if (Math.abs(deltaX) > 45) {
      const idx = ANGLES.indexOf(currentAngle);
      if (deltaX < 0) {
        // Dragging left -> turn body clockwise
        const nextIdx = (idx + 1) % ANGLES.length;
        setBodyAngle(ANGLES[nextIdx]);
      } else {
        // Dragging right -> turn body counter-clockwise
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
  if (img && img.src !== angleInfo.image) {
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

    const pin = document.createElement('div');
    pin.className = `body-hotspot-pin ${hs.id === currentHotspotId ? 'active' : ''}`;
    pin.setAttribute('data-id', hs.id);
    pin.style.left = `${coords.x}%`;
    pin.style.top = `${coords.y}%`;

    pin.innerHTML = `
      <div class="pin-badge">
        <span class="pin-num">${hs.badgeNum}</span>
        <span class="pin-title">${hs.shortName}</span>
      </div>
      <div class="pin-point"></div>
    `;

    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      openHotspotModal(hs.id);
    });

    layer.appendChild(pin);
  });
}

// ─────────────────────────────────────────────────────────────
// 3. Tabbed Hotspot Modal Dialog
// ─────────────────────────────────────────────────────────────
function setupDetailModal() {
  const overlay = document.getElementById('hotspot-card-modal-overlay');
  const btnClose = document.getElementById('btn-close-detail-modal');
  const btnFooterClose = document.getElementById('btn-modal-close-footer');
  const btnPrev = document.getElementById('btn-prev-hotspot');
  const btnNext = document.getElementById('btn-next-hotspot');

  // Close handlers
  const closeModal = () => {
    overlay?.classList.add('hidden');
  };

  btnClose?.addEventListener('click', closeModal);
  btnFooterClose?.addEventListener('click', closeModal);

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      closeModal();
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
  visitedHotspots.add(id);
  updateProgressUI();

  // If syncAngle is requested or hotspot is not in current angle
  if (syncAngle && !hs.visibleAngles.includes(currentAngle)) {
    setBodyAngle(hs.primaryAngle, true);
  }

  // Update pin active state
  renderHotspotsForCurrentAngle();

  // Render Modal Content
  renderModalContent(hs);

  // Default to Tab 1
  switchCardTab('tab-modus');

  // Show Modal
  const overlay = document.getElementById('hotspot-card-modal-overlay');
  overlay?.classList.remove('hidden');
}

function renderModalContent(hs) {
  const idx = hotspotsData.hotspots.findIndex(h => h.id === hs.id);
  const counter = document.getElementById('card-nav-counter');
  if (counter) counter.textContent = `${idx + 1} / ${hotspotsData.hotspots.length}`;

  // Header badges & title
  const tagBadge = document.getElementById('detail-tag-badge');
  const catBadge = document.getElementById('detail-cat-badge');
  const riskBadge = document.getElementById('detail-risk-badge');
  const title = document.getElementById('detail-title');
  const sub = document.getElementById('detail-subtitle');

  if (tagBadge) tagBadge.textContent = `MODUS #${hs.num}`;
  if (catBadge) catBadge.textContent = hs.categoryLabel.toUpperCase();
  if (riskBadge) {
    riskBadge.textContent = `${hs.riskLevel.toUpperCase()} (${hs.riskScore})`;
    riskBadge.className = `detail-risk-pill risk-${hs.riskLevel}`;
  }
  if (title) title.textContent = hs.label;
  if (sub) sub.textContent = hs.tag;

  // TAB 1: Modus Operandi
  const mainImg = document.getElementById('detail-main-img');
  const desc = document.getElementById('detail-desc');
  const drugTypes = document.getElementById('detail-drug-types');
  const packaging = document.getElementById('detail-packaging');
  const narrative = document.getElementById('detail-modus-narrative');
  const note = document.getElementById('detail-inspection-note');

  if (mainImg) {
    mainImg.src = hs.mainIllustration || hs.thumb;
    mainImg.alt = hs.label;
  }
  if (desc) desc.textContent = hs.description;
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

  // TAB 3: Detection Indicators & Actions
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

  const moduleItems = document.querySelectorAll('.module-item');
  moduleItems.forEach(item => {
    item.addEventListener('click', () => {
      moduleItems.forEach(m => m.classList.remove('active'));
      item.classList.add('active');
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

  if (scorm) {
    scorm.setScore(totalPct);
    if (totalPct >= 80) {
      scorm.complete(totalPct);
    }
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
