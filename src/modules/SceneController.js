import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneController {
  constructor(canvas) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setClearColor(0x000000, 0); // Transparent canvas to let radial gradient css show through
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.01, 100);
    this.camera.position.set(0, 1.0, 3.8);

    // Studio Lights matching reference clean white look
    const ambient = new THREE.AmbientLight(0xffffff, 1.3);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(1.5, 3.5, 2.5);
    const fillLight = new THREE.DirectionalLight(0xd5e8fc, 0.9);
    fillLight.position.set(-2.5, 2.0, 1.5);
    const backRimLight = new THREE.DirectionalLight(0xbad7f5, 0.7);
    backRimLight.position.set(0, 2.5, -3.0);
    this.scene.add(ambient, keyLight, fillLight, backRimLight);

    // Clean Studio Pedestal Cylinder under the model feet (feet ground at y=0)
    const pedestalGroup = new THREE.Group();
    const cylinderGeo = new THREE.CylinderGeometry(1.25, 1.32, 0.16, 64);
    const cylinderMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.05
    });
    const pedestalMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
    pedestalMesh.position.y = -0.08;
    pedestalMesh.receiveShadow = true;
    pedestalGroup.add(pedestalMesh);

    // Subtle edge ring on pedestal top
    const ringGeo = new THREE.RingGeometry(1.23, 1.25, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd8e6f5, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.001;
    pedestalGroup.add(ringMesh);

    this.scene.add(pedestalGroup);
    this.pedestalGroup = pedestalGroup;

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance  = 1.2;
    this.controls.maxDistance  = 6.5;
    this.controls.minPolarAngle = Math.PI * 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.92;
    this.controls.target.set(0, 0.9, 0);
    this.controls.update();

    // Preset camera targets
    this.presets = {
      'front-head':   { pos: [0, 1.65, 1.8], target: [0, 1.65, 0] },
      'front-torso':  { pos: [0, 1.05, 2.2], target: [0, 1.05, 0] },
      'front-lower':  { pos: [0, 0.45, 2.2], target: [0, 0.45, 0] },
      'front-pelvis': { pos: [0, 0.70, 2.0], target: [0, 0.70, 0] },
      'back-pelvis':  { pos: [0, 0.70,-2.0], target: [0, 0.70, 0] },
      'default':      { pos: [0, 1.00, 3.8], target: [0, 0.90, 0] }
    };

    this._handleResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._handleResize);
  }

  goToPreset(name, gsap) {
    const preset = this.presets[name] || this.presets['default'];
    const cam = this.camera;
    const ctrl = this.controls;
    gsap.to(cam.position, { x: preset.pos[0], y: preset.pos[1], z: preset.pos[2], duration: 1.0, ease: 'power2.inOut' });
    gsap.to(ctrl.target,  { x: preset.target[0], y: preset.target[1], z: preset.target[2], duration: 1.0, ease: 'power2.inOut',
      onUpdate: () => ctrl.update()
    });
  }

  _handleResize() {
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
