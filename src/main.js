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
let currentActiveTab = 'tab-modus';
let currentAngle = 0; // 0, 90, 180, 270
let isAutoRotating = false;
let autoRotateInterval = null;
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
  setupCardTabs();
  setupCardNavigation();
  setupRotationControls();
  setupCarousel();
  setupViewModeToggle();
  setupHelpModal();
  setupResultModal();

  // Initial display
  setBodyAngle(0, false);
  selectHotspot('saluran-cerna', false, false);
  updateProgressUI();

  // Resize listener to re-align connector line
  window.addEventListener('resize', () => {
    updateConnectorLine(false);
  });

  // Initial connector line animation after slight layout settle
  setTimeout(() => {
    updateConnectorLine(true);
  }, 300);
}

// ─────────────────────────────────────────────────────────────
// 1. 4-Angle Body Rotation Engine & Slider Controls
// ─────────────────────────────────────────────────────────────
function setupRotationControls() {
  const slider = document.getElementById('body-rotation-slider');
  const canvasWrap = document.getElementById('body-canvas-wrapper');
  const quickBtns = document.querySelectorAll('.angle-quick-btn');
  const autoBtn = document.getElementById('btn-toggle-autorotate');

  // Slider change & input
  slider?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    applySliderAngle(val);
  });

  // Quick Angle Buttons (0, 90, 180, 270)
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      stopAutoRotate();
      const deg = parseInt(btn.getAttribute('data-angle'), 10);
      if (slider) slider.value = deg;
      setBodyAngle(deg, true);
    });
  });

  // Auto-Rotate 360° Toggle
  autoBtn?.addEventListener('click', () => {
    if (isAutoRotating) {
      stopAutoRotate();
    } else {
      startAutoRotate();
    }
  });

  // Interactive Drag / Touch Swipe to spin body
  let isDragging = false;
  let startX = 0;
  let startAngle = 0;

  canvasWrap?.addEventListener('pointerdown', (e) => {
    // Only drag if not clicking a hotspot pin
    if (e.target.closest('.body-hotspot-pin')) return;
    isDragging = true;
    startX = e.clientX;
    startAngle = currentAngle;
    canvasWrap.setPointerCapture(e.pointerId);
  });

  canvasWrap?.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    // 300px drag = 360 deg
    let newAngle = Math.round((startAngle + (deltaX / 280) * 360) % 360);
    if (newAngle < 0) newAngle += 360;
    if (slider) slider.value = newAngle;
    applySliderAngle(newAngle);
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

function applySliderAngle(val) {
  // Determine closest discrete view angle: 0, 90, 180, 270
  let targetAngle = 0;
  if (val >= 45 && val < 135) {
    targetAngle = 90;
  } else if (val >= 135 && val < 225) {
    targetAngle = 180;
  } else if (val >= 225 && val < 315) {
    targetAngle = 270;
  } else {
    targetAngle = 0;
  }

  setBodyAngle(targetAngle, false, val);
}

function setBodyAngle(angle, syncSlider = true, rawSliderVal = null) {
  currentAngle = angle;
  const slider = document.getElementById('body-rotation-slider');
  if (syncSlider && slider) {
    slider.value = angle;
  }

  // Find angle info
  const angleInfo = hotspotsData.viewAngles.find(a => a.angle === angle) || hotspotsData.viewAngles[0];

  // Update Angle Header Text
  const degText = document.getElementById('angle-deg-text');
  const nameText = document.getElementById('angle-name-text');
  const subText = document.getElementById('angle-sub-text');
  if (degText) degText.textContent = `${rawSliderVal !== null ? rawSliderVal : angle}°`;
  if (nameText) nameText.textContent = angleInfo.label;
  if (subText) subText.textContent = `(${angleInfo.sub})`;

  // Update Quick Angle Buttons
  document.querySelectorAll('.angle-quick-btn').forEach(b => {
    const a = parseInt(b.getAttribute('data-angle'), 10);
    if (a === angle) b.classList.add('active');
    else b.classList.remove('active');
  });

  // Update Body Image
  const img = document.getElementById('main-body-img');
  if (img && img.src !== angleInfo.image) {
    img.style.opacity = '0.4';
    img.src = angleInfo.image;
    img.onload = () => {
      img.style.opacity = '1';
      renderHotspotsForCurrentAngle();
      updateConnectorLine(true);
    };
  } else {
    renderHotspotsForCurrentAngle();
    updateConnectorLine(false);
  }
}

function startAutoRotate() {
  isAutoRotating = true;
  const btn = document.getElementById('btn-toggle-autorotate');
  const icon = document.getElementById('autorotate-icon');
  btn?.classList.add('active');
  if (icon) icon.textContent = '⏸';

  const angles = [0, 90, 180, 270];
  let idx = angles.indexOf(currentAngle);
  autoRotateInterval = setInterval(() => {
    idx = (idx + 1) % angles.length;
    setBodyAngle(angles[idx], true);
  }, 3500);
}

function stopAutoRotate() {
  isAutoRotating = false;
  clearInterval(autoRotateInterval);
  const btn = document.getElementById('btn-toggle-autorotate');
  const icon = document.getElementById('autorotate-icon');
  btn?.classList.remove('active');
  if (icon) icon.textContent = '▶';
}

// ─────────────────────────────────────────────────────────────
// 2. Render Hotspots for Current Angle
// ─────────────────────────────────────────────────────────────
function renderHotspotsForCurrentAngle() {
  const layer = document.getElementById('hotspots-layer');
  if (!layer) return;

  layer.innerHTML = '';

  hotspotsData.hotspots.forEach(hs => {
    // Check if visible in this angle
    const isVisibleInAngle = hs.visibleAngles.includes(currentAngle);
    if (!isVisibleInAngle) return;

    // Check if matches category filter
    const matchesCategory = currentCategory === 'all' || hs.categoryId === currentCategory;

    const coords = hs.coordsByAngle[String(currentAngle)] || { x: 50, y: 50 };
    const isActive = hs.id === currentHotspotId;

    const pin = document.createElement('div');
    pin.className = `body-hotspot-pin ${isActive ? 'active' : ''}`;
    pin.setAttribute('data-id', hs.id);
    pin.style.left = `${coords.x}%`;
    pin.style.top = `${coords.y}%`;
    pin.style.opacity = matchesCategory ? '1' : '0.35';

    pin.innerHTML = `
      <div class="pin-badge">
        <span class="pin-num">${hs.badgeNum}</span>
        <span class="pin-title">${hs.shortName}</span>
      </div>
      <div class="pin-point"></div>
    `;

    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      selectHotspot(hs.id, true, false);
    });

    layer.appendChild(pin);
  });
}

// ─────────────────────────────────────────────────────────────
// 3. Card Tab Switching Logic
// ─────────────────────────────────────────────────────────────
function setupCardTabs() {
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

  // Update Tab Buttons
  document.querySelectorAll('.card-tabs-nav .tab-btn').forEach(b => {
    if (b.getAttribute('data-tab') === tabId) b.classList.add('active');
    else b.classList.remove('active');
  });

  // Update Tab Panes
  document.querySelectorAll('.tab-content-container .tab-pane').forEach(p => {
    if (p.id === tabId) p.classList.add('active');
    else p.classList.remove('active');
  });

  // Synchronize Step Pills on Top-Right
  document.querySelectorAll('#step-nav-pills .step-pill').forEach(pill => {
    const target = pill.getAttribute('data-tab-target');
    if (target === tabId) pill.classList.add('active');
    else if (target) pill.classList.remove('active');
  });
}

function setupStepNav() {
  const stepPills = document.querySelectorAll('#step-nav-pills .step-pill');
  stepPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const targetTab = pill.getAttribute('data-tab-target');
      if (targetTab) {
        switchCardTab(targetTab);
      }
    });
  });

  const quizBtn = document.getElementById('btn-open-quiz');
  quizBtn?.addEventListener('click', () => {
    quiz.start();
  });
}

// ─────────────────────────────────────────────────────────────
// 4. Card Sequential Navigation (Prev / Next)
// ─────────────────────────────────────────────────────────────
function setupCardNavigation() {
  const btnPrev = document.getElementById('btn-prev-hotspot');
  const btnNext = document.getElementById('btn-next-hotspot');

  btnPrev?.addEventListener('click', () => {
    const idx = hotspotsData.hotspots.findIndex(h => h.id === currentHotspotId);
    const prevIdx = (idx - 1 + hotspotsData.hotspots.length) % hotspotsData.hotspots.length;
    selectHotspot(hotspotsData.hotspots[prevIdx].id, true, true);
  });

  btnNext?.addEventListener('click', () => {
    const idx = hotspotsData.hotspots.findIndex(h => h.id === currentHotspotId);
    const nextIdx = (idx + 1) % hotspotsData.hotspots.length;
    selectHotspot(hotspotsData.hotspots[nextIdx].id, true, true);
  });
}

// ─────────────────────────────────────────────────────────────
// 5. Select Hotspot & Update Tabbed Card
// ─────────────────────────────────────────────────────────────
function selectHotspot(id, animateLine = true, autoRotateBody = true) {
  const hs = hotspotsData.hotspots.find(h => h.id === id);
  if (!hs) return;

  currentHotspotId = id;
  visitedHotspots.add(id);
  updateProgressUI();

  // If hotspot is not visible in current angle, automatically rotate to its primary angle!
  if (autoRotateBody && !hs.visibleAngles.includes(currentAngle)) {
    setBodyAngle(hs.primaryAngle, true);
  }

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

  // Re-render pins so active class updates
  renderHotspotsForCurrentAngle();

  // Render Tabbed Detail Card
  renderTabbedDetailCard(hs);

  // Update Animated Wipe Connector Line
  setTimeout(() => updateConnectorLine(animateLine), 80);
}

function renderTabbedDetailCard(hs) {
  // Counter
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
// 6. Dynamic Straight SVG Connector with Golden Wipe Animation
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

  // Start at pin point
  const x1 = pinRect.left + pinRect.width / 2 - wrapRect.left;
  const y1 = pinRect.top + pinRect.height / 2 - wrapRect.top;

  // End directly at left border of detail card
  const x2 = headerRect.left - wrapRect.left;
  const y2 = headerRect.top + 26 - wrapRect.top;

  const lineGlow = document.getElementById('stage-line-glow');
  const lineCore = document.getElementById('stage-line-core');
  const cStart = document.getElementById('stage-circle-start');
  const cEnd = document.getElementById('stage-circle-end');

  if (!lineCore || !lineGlow || !cStart || !cEnd) return;

  // Set positions
  cStart.setAttribute('cx', x1);
  cStart.setAttribute('cy', y1);
  cEnd.setAttribute('cx', x2);
  cEnd.setAttribute('cy', y2);

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
    gsap.fromTo(cStart, { scale: 0.5, transformOrigin: 'center center' }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
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
// 7. Filter Pills (Fokus Area Tubuh)
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

  // Re-render pins with category dimming
  renderHotspotsForCurrentAngle();

  // If currently active hotspot doesn't match, select first matching
  const currentHs = hotspotsData.hotspots.find(h => h.id === currentHotspotId);
  if (catId !== 'all' && currentHs && currentHs.categoryId !== catId) {
    const match = hotspotsData.hotspots.find(h => h.categoryId === catId);
    if (match) {
      selectHotspot(match.id, true, true);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 8. Bottom Carousel Strip
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
      selectHotspot(id, true, true);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 9. Sidebar Management
// ─────────────────────────────────────────────────────────────
function setupSidebar() {
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('app-sidebar');

  toggleBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    setTimeout(() => updateConnectorLine(false), 260);
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
// 10. Progress UI & SCORM
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
// 11. 2D / 3D Mode Switcher
// ─────────────────────────────────────────────────────────────
function setupViewModeToggle() {
  const btn = document.getElementById('btn-toggle-viewmode');
  const label = document.getElementById('viewmode-label');
  const rotatableView = document.getElementById('rotatable-body-view');
  const threeStage = document.getElementById('three-stage-container');

  btn?.addEventListener('click', async () => {
    is3DMode = !is3DMode;

    if (is3DMode) {
      label.textContent = 'Mode: 3D Interaktif';
      rotatableView.classList.add('hidden');
      threeStage.classList.remove('hidden');
      hideConnectorLine();

      if (!threeInitialized) {
        await initThreeMode();
      }
    } else {
      label.textContent = 'Mode: Anatomi 4-Sisi';
      threeStage.classList.add('hidden');
      rotatableView.classList.remove('hidden');
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
// 12. Help & Result Modals
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
    switchCardTab('tab-modus');
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
