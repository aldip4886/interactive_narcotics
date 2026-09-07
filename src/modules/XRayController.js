import * as THREE from 'three';
import { xrayVert, xrayFrag } from '../shaders/xray.glsl.js';

export class XRayController {
  constructor(bodyMeshes, organMeshes = []) {
    this.bodyMeshes = bodyMeshes || [];
    this.organMeshes = organMeshes || [];
    this.isXRay = false;
    this._origMaterials = new Map();
    this._origOrganProps = new Map();

    // Create X-Ray shader material (Fresnel glow, cyan)
    this.xrayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x00d4ff) },
        opacity:   { value: 0.72 }
      },
      vertexShader:   xrayVert,
      fragmentShader: xrayFrag,
      transparent:    true,
      depthWrite:     false,
      side:           THREE.DoubleSide,
      blending:       THREE.AdditiveBlending
    });

    // Store original body materials
    this.bodyMeshes.forEach(mesh => {
      this._origMaterials.set(mesh.uuid, mesh.material);
    });

    // Store original organ material properties
    this.organMeshes.forEach(mesh => {
      if (mesh.material) {
        this._origOrganProps.set(mesh.uuid, {
          opacity: mesh.material.opacity !== undefined ? mesh.material.opacity : 1.0,
          emissive: mesh.material.emissive ? mesh.material.emissive.clone() : null,
          emissiveIntensity: mesh.material.emissiveIntensity !== undefined ? mesh.material.emissiveIntensity : 0.0
        });
      }
    });
  }

  enable(gsap) {
    this.isXRay = true;
    const xray = this.xrayMaterial;
    // Start from 0 opacity, animate up
    xray.uniforms.opacity.value = 0;
    this.bodyMeshes.forEach(mesh => { mesh.material = xray; });
    gsap.to(xray.uniforms.opacity, { value: 0.72, duration: 1.2, ease: 'power2.out' });

    // Internal organs: illuminate with radioactive X-Ray radio-opacity
    this.organMeshes.forEach(mesh => {
      if (mesh.material) {
        mesh.material.transparent = true;
        gsap.to(mesh.material, { opacity: 1.0, duration: 1.0, ease: 'power2.out' });
        if (mesh.material.emissive) {
          // Intestine & stomach highlighted in amber/cyan for contrast
          const isIntestine = mesh.userData.organName === 'intestine';
          mesh.material.emissive.set(isIntestine ? 0xff6622 : 0x00aaff);
          gsap.to(mesh.material, { emissiveIntensity: 0.65, duration: 1.2, ease: 'power2.out' });
        }
      }
    });
  }

  disable(gsap) {
    this.isXRay = false;
    const xray = this.xrayMaterial;
    const origMap = this._origMaterials;
    const meshes  = this.bodyMeshes;

    gsap.to(xray.uniforms.opacity, {
      value: 0, duration: 0.6, ease: 'power2.in',
      onComplete: () => {
        meshes.forEach(mesh => {
          mesh.material = origMap.get(mesh.uuid);
        });
      }
    });

    // Restore organ materials
    this.organMeshes.forEach(mesh => {
      if (mesh.material && this._origOrganProps.has(mesh.uuid)) {
        const orig = this._origOrganProps.get(mesh.uuid);
        gsap.to(mesh.material, {
          opacity: orig.opacity,
          duration: 0.6,
          ease: 'power2.in'
        });
        if (mesh.material.emissive && orig.emissive) {
          mesh.material.emissive.copy(orig.emissive);
          gsap.to(mesh.material, {
            emissiveIntensity: orig.emissiveIntensity,
            duration: 0.6,
            ease: 'power2.in'
          });
        }
      }
    });
  }

  toggle(gsap) {
    this.isXRay ? this.disable(gsap) : this.enable(gsap);
  }
}
