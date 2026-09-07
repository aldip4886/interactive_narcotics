import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * HotspotManager — places and manages clickable 3D hotspot markers.
 * Uses CSS2DObject for crisp HTML labels that always face the camera.
 */
export class HotspotManager {
  constructor(scene, camera, renderer, hotspots, categories, onHotspotClick, parentGroup = null) {
    this.scene          = scene;
    this.parentGroup    = parentGroup || scene;
    this.camera         = camera;
    this.renderer       = renderer;
    this.hotspots       = hotspots;
    this.categories     = categories;
    this.onHotspotClick = onHotspotClick;
    this.visited        = new Set();
    this._markers       = [];
    this._raycaster     = new THREE.Raycaster();
    this._mouse         = new THREE.Vector2();

    // CSS2D renderer for HTML labels
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top       = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    renderer.domElement.parentElement.appendChild(this.labelRenderer.domElement);

    this._buildMarkers();
    this._setupClickDetection(renderer.domElement);
    this._handleResize = this._handleResize.bind(this, renderer);
    window.addEventListener('resize', this._handleResize);
  }

  // ── Build sphere markers + CSS2D label ─────────────────────
  _buildMarkers() {
    this.hotspots.forEach(hs => {
      const cat = this.categories.find(c => c.id === hs.categoryId);
      const color = cat ? cat.color : '#00d4ff';

      // Invisible sphere for raycasting
      const geo  = new THREE.SphereGeometry(0.065, 12, 12);
      const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(hs.position3D.x, hs.position3D.y, hs.position3D.z);
      mesh.userData.hotspotId = hs.id;
      this.parentGroup.add(mesh);

      // Visible CSS2D marker (HTML element)
      const el = document.createElement('div');
      el.className = 'hotspot-marker';
      el.dataset.id = hs.id;
      el.style.setProperty('--hs-color', color);
      el.innerHTML = `
        <div class="hs-pulse"></div>
        <div class="hs-dot"></div>
        <div class="hs-label">${hs.label}</div>
      `;
      el.addEventListener('click', () => this.onHotspotClick(hs.id));
      el.addEventListener('pointerdown', e => e.stopPropagation());

      const label = new CSS2DObject(el);
      label.position.set(hs.position3D.x, hs.position3D.y, hs.position3D.z);
      this.parentGroup.add(label);

      this._markers.push({ id: hs.id, mesh, label, el, color });
    });

    this._injectMarkerStyles();
  }

  // ── Raycasting click ───────────────────────────────────────
  _setupClickDetection(canvas) {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      this._mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      this._mouse.y = -((e.clientY - rect.top)    / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._mouse, this.camera);
      const meshes   = this._markers.map(m => m.mesh);
      const intersects = this._raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        const id = intersects[0].object.userData.hotspotId;
        this.onHotspotClick(id);
      }
    });
  }

  markVisited(id) {
    this.visited.add(id);
    const marker = this._markers.find(m => m.id === id);
    if (marker) {
      marker.el.classList.add('visited');
      marker.el.querySelector('.hs-pulse').style.display = 'none';
    }
  }

  setActive(id) {
    this._markers.forEach(m => {
      m.el.classList.toggle('active', m.id === id);
    });
  }

  getMarkerScreenPosition(id) {
    const marker = this._markers.find(m => m.id === id);
    if (!marker) return null;

    // 1. Direct DOM measurement of the rendered CSS2D marker dot element
    if (marker.el && typeof marker.el.getBoundingClientRect === 'function') {
      const dot = marker.el.querySelector('.hs-dot') || marker.el;
      const rect = dot.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      }
    }

    // 2. Fallback: 3D NDC projection accounting for canvas bounding rect
    const worldPos = new THREE.Vector3();
    marker.mesh.getWorldPosition(worldPos);

    const projected = worldPos.clone().project(this.camera);
    if (projected.z > 1) return null;

    const canvas = this.renderer ? this.renderer.domElement : document.getElementById('three-canvas');
    if (canvas) {
      const canvasRect = canvas.getBoundingClientRect();
      return {
        x: canvasRect.left + ((projected.x + 1) * 0.5) * canvasRect.width,
        y: canvasRect.top + ((-projected.y + 1) * 0.5) * canvasRect.height
      };
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: ((projected.x + 1) * 0.5) * w,
      y: ((-projected.y + 1) * 0.5) * h
    };
  }

  render(camera) {
    this.labelRenderer.render(this.scene, camera);
  }

  _handleResize(renderer) {
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    this.labelRenderer.setSize(w, h);
  }

  _injectMarkerStyles() {
    if (document.getElementById('hotspot-marker-styles')) return;
    const style = document.createElement('style');
    style.id = 'hotspot-marker-styles';
    style.textContent = `
      .hotspot-marker {
        position: relative;
        cursor: pointer;
        transform: translate(-50%, -50%);
        user-select: none;
        pointer-events: all;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
      }
      .hs-dot {
        width: 14px; height: 14px;
        border-radius: 50%;
        background: #ffffff;
        border: 3.5px solid var(--hs-color);
        box-shadow: 0 0 10px var(--hs-color), inset 0 0 6px var(--hs-color), 0 2px 8px rgba(11,44,110,0.25);
        transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative; z-index: 2;
      }
      .hotspot-marker:hover .hs-dot,
      .hotspot-marker.active .hs-dot {
        transform: scale(1.4);
        background: var(--hs-color);
        border-color: #ffffff;
      }
      .hs-pulse {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 20px; height: 20px;
        border-radius: 50%;
        border: 2px solid var(--hs-color);
        background: transparent;
        animation: hsRingPulse 2s ease-out infinite;
        z-index: 1;
        pointer-events: none;
      }
      @keyframes hsRingPulse {
        0%   { transform: translate(-50%,-50%) scale(0.8); opacity: 0.9; }
        60%  { transform: translate(-50%,-50%) scale(2.2); opacity: 0.3; }
        100% { transform: translate(-50%,-50%) scale(3.0); opacity: 0; }
      }
      .hs-label {
        position: absolute;
        left: 28px; top: 50%;
        transform: translateY(-50%);
        white-space: nowrap;
        font-size: 11px;
        font-weight: 800;
        color: #0b2c6e;
        background: #ffffff;
        border: 1.5px solid var(--hs-color);
        box-shadow: 0 4px 12px rgba(11,44,110,0.12);
        padding: 3px 10px;
        border-radius: 20px;
        pointer-events: none;
        letter-spacing: 0.3px;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .hotspot-marker:hover .hs-label,
      .hotspot-marker.active .hs-label {
        opacity: 1;
        transform: translateY(-50%) translateX(2px);
      }
      .hotspot-marker.visited .hs-dot {
        border-color: #10b981;
      }
    `;
    document.head.appendChild(style);
  }
}
