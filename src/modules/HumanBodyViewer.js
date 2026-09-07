import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * HumanBodyViewer — loads the 3D GLB model and internal organs
 * (from thebuggeddev/anatomy), or generates a stylized parametric
 * body if base model is not found.
 */
export class HumanBodyViewer {
  constructor(scene, onProgress) {
    this.scene = scene;
    this.onProgress = onProgress || (() => {});
    this.bodyGroup = new THREE.Group();
    this.internalOrgansGroup = new THREE.Group();
    this.bodyGroup.add(this.internalOrgansGroup);

    this.meshes = []; // all skin/body meshes (for X-Ray outer dissolve)
    this.organMeshes = []; // internal organ meshes (illuminated in X-Ray)
    scene.add(this.bodyGroup);
  }

  async load(glbPath) {
    try {
      await this._loadGLB(glbPath);
    } catch (err) {
      console.warn('[HumanBodyViewer] GLB not found, generating parametric body:', err.message);
      this._buildParametricBody();
    }

    // Load internal organs from thebuggeddev/anatomy repository
    await this._loadInternalOrgans();

    this.onProgress(100);
    return {
      bodyMeshes: this.meshes,
      organMeshes: this.organMeshes
    };
  }

  // ── Base Body GLB Loader ──────────────────────────────────
  _loadGLB(path) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        path,
        (gltf) => {
          gltf.scene.traverse(child => {
            if (child.isMesh) {
              child.castShadow    = true;
              child.receiveShadow = true;
              this.meshes.push(child);

              // Apply realistic anatomical human skin material inspired by thebuggeddev/anatomy
              if (child.material) {
                child.material.side = THREE.FrontSide;
                if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
                  child.material.roughness = THREE.MathUtils.clamp(child.material.roughness ?? 0.52, 0.44, 0.62);
                  child.material.metalness = 0.05;
                  child.material.envMapIntensity = 0.4;
                }
              }
            }
          });
          // Center X/Z and align feet to floor (y=0)
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = new THREE.Vector3();
          box.getSize(size);
          const targetHeight = 1.82;
          const scale = size.y > 0 ? (targetHeight / size.y) : 1;
          gltf.scene.scale.setScalar(scale);

          const scaledBox = new THREE.Box3().setFromObject(gltf.scene);
          const center = new THREE.Vector3();
          scaledBox.getCenter(center);

          gltf.scene.position.x = -center.x;
          gltf.scene.position.z = -center.z;
          gltf.scene.position.y = -scaledBox.min.y; // Ground feet at y = 0

          this.bodyGroup.add(gltf.scene);
          resolve();
        },
        (xhr) => { this.onProgress(Math.round((xhr.loaded / (xhr.total || 1)) * 60)); },
        reject
      );
    });
  }

  // ── Internal Organs Loader (thebuggeddev/anatomy) ───────────
  async _loadInternalOrgans() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const organConfigs = [
      {
        name: 'lungs',
        file: 'models/lungs.glb',
        targetHeight: 0.28,
        pos: new THREE.Vector3(0.0, 1.38, 0.0),
        rotY: 0
      },
      {
        name: 'heart',
        file: 'models/heart.glb',
        targetHeight: 0.15,
        pos: new THREE.Vector3(0.02, 1.36, 0.03),
        rotY: 0
      },
      {
        name: 'liver',
        file: 'models/liver.glb',
        targetHeight: 0.16,
        pos: new THREE.Vector3(0.06, 1.25, 0.02),
        rotY: 0
      },
      {
        name: 'kidneys',
        file: 'models/kidneys.glb',
        targetHeight: 0.14,
        pos: new THREE.Vector3(0.0, 1.20, -0.03),
        rotY: 0
      },
      {
        name: 'intestine',
        file: 'models/intestine.glb',
        targetHeight: 0.30,
        pos: new THREE.Vector3(0.0, 1.12, 0.02),
        rotY: 0
      }
    ];

    for (const cfg of organConfigs) {
      try {
        await new Promise((res) => {
          loader.load(
            cfg.file,
            (gltf) => {
              const root = gltf.scene;

              // Compute bounding box to normalize scale
              const box = new THREE.Box3().setFromObject(root);
              const size = new THREE.Vector3();
              box.getSize(size);
              const center = new THREE.Vector3();
              box.getCenter(center);

              // Center organ at local (0,0,0)
              root.position.sub(center);

              const pivot = new THREE.Group();
              pivot.name = `organ_${cfg.name}`;
              pivot.add(root);

              const scale = size.y > 0 ? (cfg.targetHeight / size.y) : 1;
              pivot.scale.setScalar(scale);
              pivot.position.copy(cfg.pos);
              if (cfg.rotY) pivot.rotation.y = cfg.rotY;

              // Configure materials following thebuggeddev/anatomy guidelines
              root.traverse(child => {
                if (child.isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                  child.userData.organName = cfg.name;
                  this.organMeshes.push(child);

                  if (child.material) {
                    child.material.transparent = true;
                    child.material.opacity = 0.92;
                    child.material.depthWrite = true;
                    if (child.material.isMeshStandardMaterial) {
                      child.material.roughness = THREE.MathUtils.clamp(child.material.roughness ?? 0.5, 0.42, 0.62);
                      child.material.metalness = 0;
                      child.material.envMapIntensity = 0.35;
                    }
                  }
                }
              });

              this.internalOrgansGroup.add(pivot);
              res();
            },
            undefined,
            (err) => {
              console.warn(`[HumanBodyViewer] Could not load organ ${cfg.name}:`, err.message);
              res(); // non-blocking
            }
          );
        });
      } catch (e) {
        console.warn(`[HumanBodyViewer] Failed processing organ ${cfg.name}:`, e);
      }
    }
  }

  // ── Parametric Fallback Body ────────────────────────────────
  _buildParametricBody() {
    const skin = new THREE.MeshPhongMaterial({
      color: 0x8a9ba8, emissive: 0x0a1520, shininess: 30,
      transparent: false, side: THREE.FrontSide
    });

    const parts = [
      // [name, geometry, posX, posY, posZ]
      ['head',        new THREE.SphereGeometry(0.14, 24, 24),               0,    1.78, 0],
      ['neck',        new THREE.CylinderGeometry(0.07, 0.08, 0.14, 16),     0,    1.60, 0],
      ['torso',       new THREE.CylinderGeometry(0.22, 0.18, 0.70, 20),     0,    1.18, 0],
      ['hips',        new THREE.CylinderGeometry(0.20, 0.18, 0.28, 20),     0,    0.78, 0],
      ['upper-arm-l', new THREE.CylinderGeometry(0.07, 0.06, 0.36, 12),     0.33, 1.28, 0],
      ['upper-arm-r', new THREE.CylinderGeometry(0.07, 0.06, 0.36, 12),    -0.33, 1.28, 0],
      ['lower-arm-l', new THREE.CylinderGeometry(0.055,0.045,0.32, 12),     0.36, 0.96, 0],
      ['lower-arm-r', new THREE.CylinderGeometry(0.055,0.045,0.32, 12),    -0.36, 0.96, 0],
      ['thigh-l',     new THREE.CylinderGeometry(0.10, 0.085, 0.45, 16),    0.12, 0.40, 0],
      ['thigh-r',     new THREE.CylinderGeometry(0.10, 0.085, 0.45, 16),   -0.12, 0.40, 0],
      ['calf-l',      new THREE.CylinderGeometry(0.075,0.060, 0.40, 16),    0.12, 0.00, 0],
      ['calf-r',      new THREE.CylinderGeometry(0.075,0.060, 0.40, 16),   -0.12, 0.00, 0],
      ['foot-l',      new THREE.BoxGeometry(0.10, 0.06, 0.22),              0.12,-0.22, 0.05],
      ['foot-r',      new THREE.BoxGeometry(0.10, 0.06, 0.22),             -0.12,-0.22, 0.05],
    ];

    parts.forEach(([name, geom, x, y, z]) => {
      const mesh = new THREE.Mesh(geom, skin.clone());
      mesh.name = name;
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      this.bodyGroup.add(mesh);
      this.meshes.push(mesh);
    });

    // Slight auto-rotate animation flag
    this.bodyGroup.userData.autoRotate = true;
  }

  // ── Auto idle rotation ─────────────────────────────────────
  tick(delta, interacting) {
    if (!interacting && this.bodyGroup.userData.autoRotate) {
      this.bodyGroup.rotation.y += delta * 0.12;
    }
  }
}
