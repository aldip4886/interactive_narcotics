import GLightbox from 'glightbox';
import { gsap } from 'gsap';
import * as THREE from 'three';

const RISK_CONFIG = {
  critical: { label: '🔴 KRITIS',  cssClass: 'risk-critical', score: 100 },
  high:     { label: '🟠 TINGGI',  cssClass: 'risk-high',     score: 70  },
  medium:   { label: '🟡 SEDANG',  cssClass: 'risk-medium',   score: 40  },
  low:      { label: '🟢 RENDAH',  cssClass: 'risk-low',      score: 15  }
};

export class HotspotCard {
  constructor(hotspots, categories, { onVisited, onNavigate, camera, getMarkerScreenPos }) {
    this.hotspots          = hotspots;
    this.categories        = categories;
    this.onVisited         = onVisited         || (() => {});
    this.onNavigate        = onNavigate        || (() => {});
    this.camera            = camera            || null;
    this.getMarkerScreenPos= getMarkerScreenPos|| null;

    this.currentId  = null;
    this.lightbox   = null;
    this.isOpen     = false;

    this._overlay     = document.getElementById('hotspot-card-overlay');
    this._card        = document.getElementById('hotspot-card');
    this._svg         = document.getElementById('connector-svg');
    this._line        = document.getElementById('connector-line');
    this._lineGlow    = document.getElementById('connector-line-glow');
    this._pulseStart  = document.getElementById('connector-pulse-start');
    this._circleStart = document.getElementById('connector-circle-start');
    this._circleEnd   = document.getElementById('connector-circle-end');

    this._wipeTween = null;
    this._wipeProgress = 0;
    this._wipeFinished = false;

    this._bindUI();
    this._bindTabs();

    window.addEventListener('resize', () => {
      if (this.isOpen) this.updateConnector();
    });
  }

  // ── Open card for a hotspot id ─────────────────────────────
  open(id) {
    const hs = this.hotspots.find(h => h.id === id);
    if (!hs) return;
    this.currentId = id;
    this.isOpen    = true;

    this._populate(hs);
    this._updateProgress();
    this._switchTab('tab-methods'); // Default to Modus tab

    // Show overlay
    this._overlay.classList.remove('hidden');
    this._overlay.style.display = 'flex';

    // Animate card in from right
    gsap.fromTo(this._card,
      { opacity: 0, x: 50, scale: 0.94 },
      { opacity: 1, x: 0,  scale: 1.0, duration: 0.35, ease: 'power3.out' }
    );

    // Initial wipe animation for straight connector line
    this._animateConnectorWipe();

    this.onVisited(id);
    this.onNavigate(id);

    // Rebuild lightbox for this card's images
    setTimeout(() => this._initLightbox(), 100);
  }

  close() {
    this.isOpen = false;
    this._clearConnector();

    gsap.to(this._card, {
      opacity: 0, x: 40, scale: 0.94, duration: 0.22, ease: 'power2.in',
      onComplete: () => {
        this._overlay.classList.add('hidden');
        this._overlay.style.display = '';
        if (this.lightbox) { this.lightbox.destroy(); this.lightbox = null; }
      }
    });
  }

  // ── Straight Connector Line with Wipe Animation ─────────────
  _getCoordinates() {
    let startX = 0, startY = 0;

    // Get 2D screen coordinate of active hotspot marker
    if (typeof this.getMarkerScreenPos === 'function') {
      const pos = this.getMarkerScreenPos(this.currentId);
      if (pos && !isNaN(pos.x) && !isNaN(pos.y)) {
        startX = pos.x;
        startY = pos.y;
        this._lastValidPos = { x: startX, y: startY };
      }
    }

    if (!startX && !startY) {
      if (this._lastValidPos) {
        startX = this._lastValidPos.x;
        startY = this._lastValidPos.y;
      } else {
        startX = window.innerWidth * 0.45;
        startY = window.innerHeight * 0.45;
      }
    }

    // Target point on card: left edge of card, vertically centered at the header area
    const cardRect = this._card.getBoundingClientRect();
    const endX = cardRect.left + 1;
    let endY = cardRect.top + Math.min(56, cardRect.height * 0.2);

    const header = document.getElementById('card-header');
    if (header) {
      const hRect = header.getBoundingClientRect();
      if (hRect.height > 0) {
        endY = hRect.top + hRect.height / 2;
      }
    }

    return { startX, startY, endX, endY };
  }

  _animateConnectorWipe() {
    if (!this._line) return;

    if (this._wipeTween) {
      this._wipeTween.kill();
      this._wipeTween = null;
    }
    this._wipeProgress = 0;
    this._wipeFinished = false;

    const { startX, startY, endX, endY } = this._getCoordinates();

    // Radar pulse ring on active hotspot
    if (this._pulseStart) {
      this._pulseStart.setAttribute('cx', startX);
      this._pulseStart.setAttribute('cy', startY);
      gsap.fromTo(this._pulseStart,
        { r: 6, opacity: 0.9, strokeWidth: 2.5 },
        { r: 26, opacity: 0, strokeWidth: 0.5, duration: 0.65, ease: 'power2.out' }
      );
    }

    // Start circle at hotspot marker
    if (this._circleStart) {
      this._circleStart.setAttribute('cx', startX);
      this._circleStart.setAttribute('cy', startY);
      gsap.fromTo(this._circleStart,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.25, transformOrigin: 'center center' }
      );
    }

    // End circle hidden initially
    if (this._circleEnd) {
      this._circleEnd.setAttribute('cx', endX);
      this._circleEnd.setAttribute('cy', endY);
      this._circleEnd.style.opacity = '0';
    }

    // Set initial lines collapsed at hotspot position
    this._line.setAttribute('x1', startX);
    this._line.setAttribute('y1', startY);
    this._line.setAttribute('x2', startX);
    this._line.setAttribute('y2', startY);
    this._line.style.opacity = '0';

    if (this._lineGlow) {
      this._lineGlow.setAttribute('x1', startX);
      this._lineGlow.setAttribute('y1', startY);
      this._lineGlow.setAttribute('x2', startX);
      this._lineGlow.setAttribute('y2', startY);
      this._lineGlow.style.opacity = '0';
    }

    // Animate progress 0 -> 1: sweeps directly from hotspot outward to card
    const anim = { p: 0 };
    this._wipeTween = gsap.to(anim, {
      p: 1,
      duration: 0.44,
      delay: 0.04,
      ease: 'power2.out',
      onUpdate: () => {
        this._wipeProgress = anim.p;
        this.updateConnector();
      },
      onComplete: () => {
        this._wipeProgress = 1;
        this._wipeFinished = true;
        this.updateConnector();
        if (this._circleEnd) {
          gsap.fromTo(this._circleEnd,
            { scale: 1.5, opacity: 1 },
            { scale: 1.0, opacity: 1, duration: 0.25, ease: 'back.out(2)', transformOrigin: 'center center' }
          );
        }
      }
    });
  }

  updateConnector() {
    if (!this.isOpen || !this.currentId || !this._line) return;

    const { startX, startY, endX, endY } = this._getCoordinates();

    // Anchor start circle to hotspot marker
    if (this._circleStart) {
      this._circleStart.setAttribute('cx', startX);
      this._circleStart.setAttribute('cy', startY);
    }

    if (this._wipeFinished) {
      // Completed wipe: full straight connection from hotspot to card
      this._line.setAttribute('x1', startX);
      this._line.setAttribute('y1', startY);
      this._line.setAttribute('x2', endX);
      this._line.setAttribute('y2', endY);
      this._line.style.opacity = '1';

      if (this._lineGlow) {
        this._lineGlow.setAttribute('x1', startX);
        this._lineGlow.setAttribute('y1', startY);
        this._lineGlow.setAttribute('x2', endX);
        this._lineGlow.setAttribute('y2', endY);
        this._lineGlow.style.opacity = '1';
      }

      if (this._circleEnd) {
        this._circleEnd.setAttribute('cx', endX);
        this._circleEnd.setAttribute('cy', endY);
        this._circleEnd.style.opacity = '1';
      }
    } else {
      const p = Math.max(0, Math.min(1, this._wipeProgress || 0));
      if (p <= 0.005) {
        this._line.setAttribute('x1', startX);
        this._line.setAttribute('y1', startY);
        this._line.setAttribute('x2', startX);
        this._line.setAttribute('y2', startY);
        this._line.style.opacity = '0';

        if (this._lineGlow) {
          this._lineGlow.setAttribute('x1', startX);
          this._lineGlow.setAttribute('y1', startY);
          this._lineGlow.setAttribute('x2', startX);
          this._lineGlow.setAttribute('y2', startY);
          this._lineGlow.style.opacity = '0';
        }
      } else {
        // Wipe towards card: tip advances from (startX, startY) towards (endX, endY)
        const curX = startX + (endX - startX) * p;
        const curY = startY + (endY - startY) * p;

        this._line.setAttribute('x1', startX);
        this._line.setAttribute('y1', startY);
        this._line.setAttribute('x2', curX);
        this._line.setAttribute('y2', curY);
        this._line.style.opacity = '1';

        if (this._lineGlow) {
          this._lineGlow.setAttribute('x1', startX);
          this._lineGlow.setAttribute('y1', startY);
          this._lineGlow.setAttribute('x2', curX);
          this._lineGlow.setAttribute('y2', curY);
          this._lineGlow.style.opacity = '1';
        }

        if (this._circleEnd) {
          this._circleEnd.setAttribute('cx', curX);
          this._circleEnd.setAttribute('cy', curY);
          this._circleEnd.style.opacity = p > 0.8 ? `${(p - 0.8) / 0.2}` : '0';
        }
      }
    }
  }

  _clearConnector() {
    if (this._wipeTween) {
      this._wipeTween.kill();
      this._wipeTween = null;
    }
    this._wipeProgress = 0;
    this._wipeFinished = false;

    if (this._line) {
      this._line.setAttribute('x1', 0);
      this._line.setAttribute('y1', 0);
      this._line.setAttribute('x2', 0);
      this._line.setAttribute('y2', 0);
      this._line.style.opacity = '0';
    }
    if (this._lineGlow) {
      this._lineGlow.setAttribute('x1', 0);
      this._lineGlow.setAttribute('y1', 0);
      this._lineGlow.setAttribute('x2', 0);
      this._lineGlow.setAttribute('y2', 0);
      this._lineGlow.style.opacity = '0';
    }
    if (this._pulseStart) {
      this._pulseStart.setAttribute('cx', -100);
      this._pulseStart.setAttribute('cy', -100);
      this._pulseStart.style.opacity = '0';
    }
    if (this._circleStart) {
      this._circleStart.setAttribute('cx', -100);
      this._circleStart.setAttribute('cy', -100);
      this._circleStart.style.opacity = '0';
    }
    if (this._circleEnd) {
      this._circleEnd.setAttribute('cx', -100);
      this._circleEnd.setAttribute('cy', -100);
      this._circleEnd.style.opacity = '0';
    }
  }

  // ── Tab Management ─────────────────────────────────────────
  _bindTabs() {
    const tabBtns = document.querySelectorAll('.card-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        this._switchTab(targetTab);
      });
    });
  }

  _switchTab(tabId) {
    // Buttons
    const tabBtns = document.querySelectorAll('.card-tab-btn');
    tabBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });

    // Panes
    const panes = document.querySelectorAll('.card-tab-pane');
    panes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    // If switching to risk, re-trigger risk bar animation
    if (tabId === 'tab-risk') {
      const hs = this.hotspots.find(h => h.id === this.currentId);
      if (hs) {
        const risk  = RISK_CONFIG[hs.riskLevel] || RISK_CONFIG.medium;
        const score = hs.riskScore || risk.score;
        const bar   = document.getElementById('risk-bar');
        if (bar) {
          bar.style.width = '0%';
          setTimeout(() => {
            bar.style.width = score + '%';
          }, 60);
        }
      }
    }
  }

  // ── Populate all card sections ─────────────────────────────
  _populate(hs) {
    const cat  = this.categories.find(c => c.id === hs.categoryId);
    const risk = RISK_CONFIG[hs.riskLevel] || RISK_CONFIG.medium;

    // Header
    const catBadge = document.getElementById('card-category-badge');
    if (catBadge) {
      catBadge.textContent = cat ? `${cat.icon} ${cat.label}` : hs.categoryId;
      catBadge.style.color       = cat ? cat.color : 'var(--navy-dark)';
      catBadge.style.borderColor = cat ? cat.color : 'var(--border-light)';
    }

    const titleEl = document.getElementById('card-title');
    if (titleEl) titleEl.textContent = hs.label;

    const riskBadge = document.getElementById('card-risk-badge');
    if (riskBadge) {
      riskBadge.textContent = risk.label;
      riskBadge.className   = `risk-badge ${risk.cssClass}`;
    }

    // Methods Tab
    this._buildList('methods-list', hs.methods || []);
    const noteEl = document.getElementById('inspection-note-box');
    if (noteEl) noteEl.innerHTML = hs.inspectionNote || '—';

    // Indicators Tab
    this._buildList('indicators-list', hs.indicators || []);

    // Detection Tab
    this._buildList('detection-list', hs.detection || []);

    // Gallery Tab
    this._buildGallery(hs.images || []);

    // Risk Tab
    const score = hs.riskScore || risk.score;
    const bar   = document.getElementById('risk-bar');
    if (bar) {
      bar.style.width = '0%';
      setTimeout(() => {
        bar.style.width = score + '%';
      }, 100);
    }

    const riskDesc = document.getElementById('risk-description');
    if (riskDesc) riskDesc.textContent = hs.medicalRisk || '—';

    // Nav buttons
    const idx = this.hotspots.findIndex(h => h.id === hs.id);
    const prevBtn = document.getElementById('card-prev');
    const nextBtn = document.getElementById('card-next');
    if (prevBtn) prevBtn.disabled = (idx === 0);
    if (nextBtn) nextBtn.disabled = (idx === this.hotspots.length - 1);
  }

  _buildGallery(images) {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const displayImages = images.length > 0 ? images : this._placeholders();

    displayImages.forEach((img) => {
      const thumb = document.createElement('div');
      thumb.className = 'gallery-thumb';

      if (img.isPlaceholder) {
        thumb.innerHTML = `
          <div class="gallery-placeholder">
            <span>${img.icon || '🖼️'}</span>
            <span>${img.caption}</span>
          </div>`;
      } else {
        thumb.innerHTML = `
          <a href="${img.src}" class="glightbox"
             data-gallery="hotspot-gallery"
             data-description="${img.caption || ''}"
             data-type="image">
            <img src="${img.src}" alt="${img.caption || ''}"
                 onerror="this.parentElement.parentElement.querySelector('.gallery-placeholder') && (this.parentElement.style.display='none')">
            <div class="gallery-placeholder" style="display:none">
              <span>🖼️</span><span>Foto tidak tersedia</span>
            </div>
          </a>
          <div class="thumb-type-badge">${this._typeLabel(img.type)}</div>`;
      }
      grid.appendChild(thumb);
    });
  }

  _placeholders() {
    return [
      { isPlaceholder: true, icon: '📋', caption: 'Dokumentasi' },
      { isPlaceholder: true, icon: '🖼️', caption: 'Ilustrasi' }
    ];
  }

  _typeLabel(type) {
    const map = {
      'x-ray': 'X-RAY', 'ct-scan': 'CT-SCAN', illustration: 'ILUSTRASI',
      evidence: 'BARANG BUKTI', procedure: 'PROSEDUR',
      scanner: 'SCANNER', thermal: 'THERMAL', equipment: 'PERALATAN'
    };
    return map[type] || type?.toUpperCase() || 'FOTO';
  }

  _buildList(elId, items) {
    const ul = document.getElementById(elId);
    if (!ul) return;
    ul.innerHTML = '';
    items.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
  }

  _updateProgress() {
    const total = this.hotspots.length;
    const idx   = this.hotspots.findIndex(h => h.id === this.currentId);

    const dotsEl = document.getElementById('card-progress-dots');
    if (dotsEl) {
      dotsEl.innerHTML = '';
      this.hotspots.forEach((h, i) => {
        const dot = document.createElement('div');
        dot.className = 'progress-dot';
        if (i === idx) dot.classList.add('current');
        dotsEl.appendChild(dot);
      });
    }

    const progText = document.getElementById('card-progress-text');
    if (progText) {
      progText.textContent = `${idx + 1} / ${total} hotspot`;
    }
  }

  _initLightbox() {
    if (this.lightbox) this.lightbox.destroy();
    this.lightbox = GLightbox({
      selector: '.glightbox[data-gallery="hotspot-gallery"]',
      touchNavigation: true,
      loop: false,
      closeButton: true
    });
  }

  // ── UI event bindings ──────────────────────────────────────
  _bindUI() {
    document.getElementById('card-close').addEventListener('click', () => this.close());
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.close();
    });

    document.getElementById('card-prev').addEventListener('click', () => this._navigate(-1));
    document.getElementById('card-next').addEventListener('click', () => this._navigate(+1));

    document.addEventListener('keydown', (e) => {
      if (this._overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape')     this.close();
      if (e.key === 'ArrowLeft')  this._navigate(-1);
      if (e.key === 'ArrowRight') this._navigate(+1);
    });

    window.addEventListener('resize', () => {
      if (this.isOpen) this.updateConnector();
    });
  }

  _navigate(dir) {
    const idx    = this.hotspots.findIndex(h => h.id === this.currentId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= this.hotspots.length) return;

    gsap.to(this._card, {
      x: dir < 0 ? 30 : -30, opacity: 0, duration: 0.16, ease: 'power2.in',
      onComplete: () => {
        gsap.set(this._card, { x: dir < 0 ? -30 : 30 });
        this.open(this.hotspots[newIdx].id);
        gsap.to(this._card, { x: 0, opacity: 1, duration: 0.2, ease: 'power2.out' });
      }
    });
  }
}

