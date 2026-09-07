import { gsap } from 'gsap';
import { SceneController }    from './modules/SceneController.js';
import { HumanBodyViewer }    from './modules/HumanBodyViewer.js';
import { XRayController }     from './modules/XRayController.js';
import { HotspotManager }     from './modules/HotspotManager.js';
import { HotspotCard }        from './modules/HotspotCard.js';
import { CategoryNavigator }  from './modules/CategoryNavigator.js';
import { QuizModule }         from './modules/QuizModule.js';
import { SCORMAdapter }       from './modules/SCORMAdapter.js';
import hotspotsData           from './data/hotspots.json';
import modelUrl               from './assets/models/human_body.glb?url';

// ─────────────────────────────────────────────────────────────
// App State
// ─────────────────────────────────────────────────────────────
let scene3D, bodyViewer, xrayCtrl, hotspotMgr, hotspotCard, categoryNav, quiz, scorm;
let interacting = false;
let clock;

// ─────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────
async function init() {
  scorm = new SCORMAdapter();

  // Animate loading bar from 0→40 while modules set up
  gsap.to('#loading-bar', { width: '40%', duration: 0.6 });

  // Init Three.js scene
  const canvas = document.getElementById('three-canvas');
  scene3D = new SceneController(canvas);

  // Load body model (GLB or parametric fallback)
  bodyViewer = new HumanBodyViewer(scene3D.scene, (pct) => {
    document.getElementById('loading-bar').style.width = (40 + pct * 0.5) + '%';
  });

  const { bodyMeshes, organMeshes } = await bodyViewer.load(modelUrl);
  gsap.to('#loading-bar', { width: '95%', duration: 0.3 });

  // X-Ray controller (uses body meshes for Fresnel dissolve and organs for internal highlight)
  xrayCtrl = new XRayController(bodyMeshes, organMeshes);

  // Category Navigator (sidebar)
  categoryNav = new CategoryNavigator(
    hotspotsData.categories,
    hotspotsData.hotspots,
    {
      onCategoryClick: (catId) => {
        const firstHs = hotspotsData.hotspots.find(h => h.categoryId === catId);
        if (firstHs) scene3D.goToPreset(firstHs.cameraAngle, gsap);
      },
      onHotspotClick: (id) => openHotspot(id)
    }
  );

  // Hotspot Manager (3D markers anchored to body)
  hotspotMgr = new HotspotManager(
    scene3D.scene, scene3D.camera, scene3D.renderer,
    hotspotsData.hotspots, hotspotsData.categories,
    (id) => openHotspot(id),
    bodyViewer.bodyGroup
  );

  // Hotspot Card (compact modal with connector line & tabs)
  hotspotCard = new HotspotCard(
    hotspotsData.hotspots, hotspotsData.categories,
    {
      camera: scene3D.camera,
      getMarkerScreenPos: (id) => hotspotMgr?.getMarkerScreenPosition(id),
      onVisited:  (id) => onHotspotVisited(id),
      onNavigate: (id) => {
        const hs = hotspotsData.hotspots.find(h => h.id === id);
        if (hs) scene3D.goToPreset(hs.cameraAngle, gsap);
        hotspotMgr.setActive(id);
        categoryNav.setActive(id);
      }
    }
  );

  // Quiz
  quiz = new QuizModule({
    onComplete: (score, answers) => {
      showResult(score);
      scorm.complete(score);
    }
  });

  // HUD buttons
  bindHUD();

  // Hide loading screen, show intro
  gsap.to('#loading-bar', { width: '100%', duration: 0.2, onComplete: () => {
    const ls = document.getElementById('loading-screen');
    ls.classList.add('fade-out');
    setTimeout(() => { ls.style.display = 'none'; }, 700);
  }});

  // Start render loop
  import('three').then(({ Clock }) => {
    clock = new Clock();
    animate();
  });
}

// ─────────────────────────────────────────────────────────────
// Render loop
// ─────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock ? clock.getDelta() : 0.016;
  bodyViewer.tick(delta, interacting);
  scene3D.render();
  hotspotMgr?.render(scene3D.camera);
  if (hotspotCard?.isOpen) {
    hotspotCard.updateConnector();
  }
}

// ─────────────────────────────────────────────────────────────
// Hotspot interaction
// ─────────────────────────────────────────────────────────────
function openHotspot(id) {
  const hs = hotspotsData.hotspots.find(h => h.id === id);
  if (!hs) return;
  scene3D.goToPreset(hs.cameraAngle, gsap);
  hotspotCard.open(id);
  hotspotMgr.setActive(id);
  categoryNav.setActive(id);
}

function onHotspotVisited(id) {
  hotspotMgr.markVisited(id);
  categoryNav.markVisited(id);
  scorm.setProgress(categoryNav.visited);

  // Once all visited, show quiz prompt
  if (categoryNav.allVisited) {
    setTimeout(promptQuiz, 1800);
  }
}

// ─────────────────────────────────────────────────────────────
// HUD & Carousel bindings
// ─────────────────────────────────────────────────────────────
function bindHUD() {
  document.getElementById('btn-start').addEventListener('click', () => {
    gsap.to('#intro-overlay', {
      opacity: 0, duration: 0.4,
      onComplete: () => { document.getElementById('intro-overlay').style.display = 'none'; }
    });
    // Disable auto-rotate on start
    bodyViewer.bodyGroup.userData.autoRotate = false;
  });

  // X-Ray Toggle
  const xrayBtn = document.getElementById('btn-xray');
  if (xrayBtn) {
    xrayBtn.addEventListener('click', () => {
      xrayCtrl.toggle(gsap);
      const label = document.getElementById('xray-label');
      xrayBtn.classList.toggle('active');
      label.textContent = xrayCtrl.isXRay ? 'Mode Normal' : 'Mode X-Ray';
    });
  }

  // Anatomy Organs Toggle
  const toggleOrgansBtn = document.getElementById('btn-toggle-organs');
  if (toggleOrgansBtn) {
    toggleOrgansBtn.addEventListener('click', () => {
      const isVisible = bodyViewer.internalOrgansGroup.visible;
      bodyViewer.internalOrgansGroup.visible = !isVisible;
      toggleOrgansBtn.classList.toggle('off', isVisible);
      document.getElementById('organs-label').textContent = isVisible ? 'Organ Anatomi: OFF' : 'Organ Anatomi: ON';
    });
  }

  // Carousel 360 Rotation Controls (Bottom Center)
  let isAutoRotating = false;
  const playBtn = document.getElementById('btn-carousel-play');
  const prevBtn = document.getElementById('btn-carousel-prev');
  const nextBtn = document.getElementById('btn-carousel-next');

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      isAutoRotating = !isAutoRotating;
      bodyViewer.bodyGroup.userData.autoRotate = isAutoRotating;
      playBtn.textContent = isAutoRotating ? '⏸' : '▶';
      playBtn.classList.toggle('active', isAutoRotating);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      bodyViewer.bodyGroup.userData.autoRotate = false;
      if (playBtn) playBtn.textContent = '▶';
      gsap.to(bodyViewer.bodyGroup.rotation, {
        y: bodyViewer.bodyGroup.rotation.y - Math.PI / 4,
        duration: 0.6,
        ease: 'power2.out'
      });
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      bodyViewer.bodyGroup.userData.autoRotate = false;
      if (playBtn) playBtn.textContent = '▶';
      gsap.to(bodyViewer.bodyGroup.rotation, {
        y: bodyViewer.bodyGroup.rotation.y + Math.PI / 4,
        duration: 0.6,
        ease: 'power2.out'
      });
    });
  }

  // Camera Angle Switcher Pills (Bottom Right)
  const viewFrontBtn = document.getElementById('btn-view-front');
  const viewSideBtn  = document.getElementById('btn-view-side');
  const viewBackBtn  = document.getElementById('btn-view-back');
  const anglePills   = [viewFrontBtn, viewSideBtn, viewBackBtn];

  function setActiveAnglePill(btn) {
    anglePills.forEach(p => p && p.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  if (viewFrontBtn) {
    viewFrontBtn.addEventListener('click', () => {
      setActiveAnglePill(viewFrontBtn);
      bodyViewer.bodyGroup.rotation.y = 0;
      scene3D.goToPreset('default', gsap);
    });
  }

  if (viewSideBtn) {
    viewSideBtn.addEventListener('click', () => {
      setActiveAnglePill(viewSideBtn);
      bodyViewer.bodyGroup.rotation.y = 0;
      gsap.to(scene3D.camera.position, { x: 2.8, y: 1.0, z: 0.2, duration: 1.0, ease: 'power2.inOut' });
      gsap.to(scene3D.controls.target,  { x: 0, y: 0.9, z: 0, duration: 1.0, ease: 'power2.inOut',
        onUpdate: () => scene3D.controls.update()
      });
    });
  }

  if (viewBackBtn) {
    viewBackBtn.addEventListener('click', () => {
      setActiveAnglePill(viewBackBtn);
      bodyViewer.bodyGroup.rotation.y = 0;
      scene3D.goToPreset('back-pelvis', gsap);
    });
  }

  // Track orbit interaction
  scene3D.controls.addEventListener('start', () => { interacting = true; });
  scene3D.controls.addEventListener('end',   () => { interacting = false; });
}

// ─────────────────────────────────────────────────────────────
// Quiz & Result
// ─────────────────────────────────────────────────────────────
function promptQuiz() {
  if (confirm('✅ Anda telah mempelajari semua 9 modus penyembunyian narkotika!\n\nMulai Kuis Penilaian Kompetensi sekarang?')) {
    quiz.start();
  }
}

function showResult(score) {
  const passed = score >= 70;
  const overlay = document.getElementById('result-overlay');
  document.getElementById('result-icon').textContent     = passed ? '🏆' : '📚';
  document.getElementById('result-title').textContent    = passed ? 'Selamat! Anda Lulus' : 'Perlu Ditingkatkan';
  document.getElementById('result-score-display').textContent = score + '%';
  document.getElementById('result-message').textContent  = passed
    ? `Anda berhasil melewati ambang batas 70%. Kompetensi deteksi penyembunyian narkotika telah terverifikasi.`
    : `Skor Anda belum mencapai 70%. Silakan tinjau kembali materi dan coba kuis ulang.`;

  overlay.classList.remove('hidden');
  gsap.fromTo('#result-card', { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.3)' });

  document.getElementById('btn-retry-quiz').onclick = () => {
    overlay.classList.add('hidden');
    quiz.start();
  };
  document.getElementById('btn-review').onclick = () => {
    overlay.classList.add('hidden');
  };
}

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────
init().catch(console.error);
