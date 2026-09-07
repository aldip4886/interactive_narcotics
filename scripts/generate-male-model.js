import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../src/assets/models');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'human_body_male.glb');

// Mock FileReader for Node environment required by Three.js GLTFExporter
class MockFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
    });
  }
}
globalThis.FileReader = MockFileReader;

const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');

console.log('🏗️ Generating anatomical 3D Human Body Male model...');

const scene = new THREE.Scene();
scene.name = "HumanBodyMaleScene";

// PBR Materials
const skinMaterial = new THREE.MeshStandardMaterial({
  color: 0x8ea2b4,
  roughness: 0.55,
  metalness: 0.15,
  name: "SkinMaterial"
});

const muscleMaterial = new THREE.MeshStandardMaterial({
  color: 0x7c90a3,
  roughness: 0.6,
  metalness: 0.2,
  name: "MuscleToneMaterial"
});

const boneMaterial = new THREE.MeshStandardMaterial({
  color: 0xd8e8f5,
  roughness: 0.4,
  metalness: 0.1,
  emissive: 0x003b5c,
  emissiveIntensity: 0.3,
  name: "BoneMaterial"
});

const organMaterial = new THREE.MeshStandardMaterial({
  color: 0x4da6ff,
  roughness: 0.3,
  metalness: 0.2,
  emissive: 0x0077b6,
  emissiveIntensity: 0.5,
  name: "OrganMaterial"
});

const bodyRoot = new THREE.Group();
bodyRoot.name = "HumanMale";
scene.add(bodyRoot);

// Helper for adding mesh with transform
function addPart(parent, geom, mat, pos, rot = [0, 0, 0], scale = [1, 1, 1], name = "") {
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = name;
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// ─────────────────────────────────────────────────────────────
// 1. HEAD & FACE
// ─────────────────────────────────────────────────────────────
const headGroup = new THREE.Group();
headGroup.name = "HeadGroup";
bodyRoot.add(headGroup);

// Cranium (top of head ~1.82m)
const craniumGeom = new THREE.SphereGeometry(0.12, 24, 24);
addPart(headGroup, craniumGeom, skinMaterial, [0, 1.76, 0.01], [0, 0, 0], [1.0, 1.15, 1.1], "Cranium");

// Face / Jaw structure
const jawGeom = new THREE.CylinderGeometry(0.08, 0.065, 0.13, 16);
addPart(headGroup, jawGeom, skinMaterial, [0, 1.67, 0.05], [0.15, 0, 0], [1.0, 1.0, 1.1], "Jaw");

// Chin prominence
const chinGeom = new THREE.SphereGeometry(0.032, 12, 12);
addPart(headGroup, chinGeom, skinMaterial, [0, 1.61, 0.09], [0, 0, 0], [1.1, 0.9, 1.0], "Chin");

// Nose
const noseGeom = new THREE.ConeGeometry(0.022, 0.055, 8);
addPart(headGroup, noseGeom, skinMaterial, [0, 1.71, 0.135], [Math.PI * 0.45, 0, 0], [0.8, 1.0, 0.7], "Nose");

// Brow ridge / Forehead
const browGeom = new THREE.BoxGeometry(0.13, 0.03, 0.04);
addPart(headGroup, browGeom, skinMaterial, [0, 1.75, 0.10], [0, 0, 0], [1, 1, 1], "BrowRidge");

// Ears
const earGeom = new THREE.SphereGeometry(0.026, 12, 12);
addPart(headGroup, earGeom, skinMaterial, [ 0.115, 1.72, -0.01], [0, 0.3, -0.1], [0.4, 1.2, 0.8], "Ear_R");
addPart(headGroup, earGeom, skinMaterial, [-0.115, 1.72, -0.01], [0, -0.3, 0.1], [0.4, 1.2, 0.8], "Ear_L");

// Neck & Adam's apple
const neckGeom = new THREE.CylinderGeometry(0.068, 0.082, 0.14, 20);
addPart(headGroup, neckGeom, skinMaterial, [0, 1.56, 0.01], [0.05, 0, 0], [1.0, 1.0, 1.1], "Neck");
const adamsApple = new THREE.SphereGeometry(0.015, 8, 8);
addPart(headGroup, adamsApple, muscleMaterial, [0, 1.57, 0.085], [0, 0, 0], [1, 1.2, 1], "AdamsApple");

// ─────────────────────────────────────────────────────────────
// 2. TORSO & ABDOMEN
// ─────────────────────────────────────────────────────────────
const torsoGroup = new THREE.Group();
torsoGroup.name = "TorsoGroup";
bodyRoot.add(torsoGroup);

// Upper Torso / Chest (V-shape)
const upperChestGeom = new THREE.CylinderGeometry(0.24, 0.20, 0.32, 24);
addPart(torsoGroup, upperChestGeom, skinMaterial, [0, 1.35, 0.01], [0, 0, 0], [1.25, 1.0, 0.95], "UpperChest");

// Pectoral Muscles (Chest bulges)
const pecGeom = new THREE.SphereGeometry(0.095, 16, 16);
addPart(torsoGroup, pecGeom, muscleMaterial, [ 0.10, 1.34, 0.09], [0.1, -0.1, -0.15], [1.2, 0.85, 0.6], "Pectoral_R");
addPart(torsoGroup, pecGeom, muscleMaterial, [-0.10, 1.34, 0.09], [0.1, 0.1, 0.15], [1.2, 0.85, 0.6], "Pectoral_L");

// Clavicles / Collarbones
const clavicleGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.34, 12);
addPart(torsoGroup, clavicleGeom, muscleMaterial, [0, 1.47, 0.06], [0, 0, Math.PI * 0.5], [1, 1, 0.8], "Clavicles");

// Mid-Torso / Waist / Abdomen
const abdomenGeom = new THREE.CylinderGeometry(0.19, 0.18, 0.30, 24);
addPart(torsoGroup, abdomenGeom, skinMaterial, [0, 1.09, 0.01], [0, 0, 0], [1.12, 1.0, 0.96], "Abdomen");

// Rectus Abdominis (Abs / 6-Pack Definition)
const abTileGeom = new THREE.BoxGeometry(0.065, 0.055, 0.025);
const abY = [1.20, 1.12, 1.04];
abY.forEach((y, i) => {
  addPart(torsoGroup, abTileGeom, muscleMaterial, [ 0.042, y, 0.095], [0, 0, 0], [1, 1, 1], `Ab_${i}_R`);
  addPart(torsoGroup, abTileGeom, muscleMaterial, [-0.042, y, 0.095], [0, 0, 0], [1, 1, 1], `Ab_${i}_L`);
});

// Trapezius / Upper Back
const trapGeom = new THREE.BoxGeometry(0.30, 0.16, 0.08);
addPart(torsoGroup, trapGeom, muscleMaterial, [0, 1.43, -0.06], [0.1, 0, 0], [1, 1, 1], "Trapezius");

// Latissimus Dorsi (Lats V-Taper)
const latGeom = new THREE.ConeGeometry(0.12, 0.35, 12);
addPart(torsoGroup, latGeom, muscleMaterial, [ 0.17, 1.25, -0.04], [0, 0, -0.3], [1.0, 1.0, 0.6], "Lat_R");
addPart(torsoGroup, latGeom, muscleMaterial, [-0.17, 1.25, -0.04], [0, 0, 0.3], [1.0, 1.0, 0.6], "Lat_L");

// ─────────────────────────────────────────────────────────────
// 3. PELVIS & GLUTEALS
// ─────────────────────────────────────────────────────────────
const pelvisGroup = new THREE.Group();
pelvisGroup.name = "PelvisGroup";
bodyRoot.add(pelvisGroup);

// Pelvis core
const pelvisGeom = new THREE.CylinderGeometry(0.18, 0.17, 0.22, 24);
addPart(pelvisGroup, pelvisGeom, skinMaterial, [0, 0.85, 0.01], [0, 0, 0], [1.18, 1.0, 1.0], "Pelvis");

// Gluteal Muscles (Buttocks)
const gluteGeom = new THREE.SphereGeometry(0.11, 16, 16);
addPart(pelvisGroup, gluteGeom, muscleMaterial, [ 0.088, 0.77, -0.085], [0.15, 0, 0], [1.0, 1.15, 1.0], "Glute_R");
addPart(pelvisGroup, gluteGeom, muscleMaterial, [-0.088, 0.77, -0.085], [0.15, 0, 0], [1.0, 1.15, 1.0], "Glute_L");

// Inguinal/Groin
const groinGeom = new THREE.SphereGeometry(0.08, 12, 12);
addPart(pelvisGroup, groinGeom, skinMaterial, [0, 0.73, 0.05], [0, 0, 0], [1.1, 0.8, 0.9], "GroinArea");

// ─────────────────────────────────────────────────────────────
// 4. LEGS & FEET
// ─────────────────────────────────────────────────────────────
const legsGroup = new THREE.Group();
legsGroup.name = "LegsGroup";
bodyRoot.add(legsGroup);

function createLeg(side) {
  const s = side === 'R' ? 1 : -1;
  const leg = new THREE.Group();
  leg.name = `Leg_${side}`;

  // Thigh (Quadriceps)
  const thighGeom = new THREE.CapsuleGeometry(0.098, 0.28, 12, 20);
  addPart(leg, thighGeom, skinMaterial, [s * 0.125, 0.54, 0.015], [0.03, 0, s * -0.03], [1.05, 1.0, 1.1], `Thigh_${side}`);

  // Vastus Medialis (teardrop muscle inner knee)
  const tearGeom = new THREE.SphereGeometry(0.05, 12, 12);
  addPart(leg, tearGeom, muscleMaterial, [s * 0.09, 0.44, 0.045], [0, 0, 0], [0.8, 1.2, 0.8], `VastusMed_${side}`);

  // Knee / Patella
  const kneeGeom = new THREE.SphereGeometry(0.045, 12, 12);
  addPart(leg, kneeGeom, muscleMaterial, [s * 0.125, 0.38, 0.035], [0, 0, 0], [1.0, 1.1, 0.9], `Patella_${side}`);

  // Calf (Gastrocnemius bulge at back)
  const calfGeom = new THREE.CapsuleGeometry(0.075, 0.24, 12, 20);
  addPart(leg, calfGeom, skinMaterial, [s * 0.125, 0.21, -0.01], [-0.04, 0, s * 0.02], [1.0, 1.0, 1.15], `Calf_${side}`);

  const calfBulgeGeom = new THREE.SphereGeometry(0.065, 12, 12);
  addPart(leg, calfBulgeGeom, muscleMaterial, [s * 0.125, 0.26, -0.045], [0, 0, 0], [1.0, 1.3, 0.9], `CalfBulge_${side}`);

  // Ankle
  const ankleGeom = new THREE.CylinderGeometry(0.045, 0.048, 0.08, 16);
  addPart(leg, ankleGeom, skinMaterial, [s * 0.125, 0.07, 0.0], [0, 0, 0], [1.1, 1, 1], `Ankle_${side}`);

  // Foot & Toes
  const footGeom = new THREE.BoxGeometry(0.085, 0.055, 0.22);
  addPart(leg, footGeom, skinMaterial, [s * 0.125, 0.028, 0.04], [0, s * 0.08, 0], [1, 1, 1], `Foot_${side}`);

  legsGroup.add(leg);
}

createLeg('R');
createLeg('L');

// ─────────────────────────────────────────────────────────────
// 5. ARMS & HANDS
// ─────────────────────────────────────────────────────────────
const armsGroup = new THREE.Group();
armsGroup.name = "ArmsGroup";
bodyRoot.add(armsGroup);

function createArm(side) {
  const s = side === 'R' ? 1 : -1;
  const arm = new THREE.Group();
  arm.name = `Arm_${side}`;

  // Shoulder / Deltoid
  const deltoidGeom = new THREE.SphereGeometry(0.075, 16, 16);
  addPart(arm, deltoidGeom, muscleMaterial, [s * 0.26, 1.44, 0.01], [0, 0, s * -0.2], [1.0, 1.2, 1.0], `Deltoid_${side}`);

  // Upper Arm (Biceps/Triceps)
  const bicepGeom = new THREE.CapsuleGeometry(0.058, 0.20, 12, 16);
  addPart(arm, bicepGeom, skinMaterial, [s * 0.29, 1.28, 0.00], [0, 0, s * -0.12], [1.0, 1.0, 1.05], `UpperArm_${side}`);

  // Elbow
  const elbowGeom = new THREE.SphereGeometry(0.042, 12, 12);
  addPart(arm, elbowGeom, muscleMaterial, [s * 0.32, 1.13, -0.01], [0, 0, 0], [1, 1, 1], `Elbow_${side}`);

  // Forearm
  const forearmGeom = new THREE.CapsuleGeometry(0.048, 0.20, 12, 16);
  addPart(arm, forearmGeom, skinMaterial, [s * 0.35, 0.98, 0.01], [0, 0, s * -0.08], [1.1, 1.0, 0.9], `Forearm_${side}`);

  // Hand & Fingers
  const handGeom = new THREE.BoxGeometry(0.035, 0.12, 0.07);
  addPart(arm, handGeom, skinMaterial, [s * 0.37, 0.81, 0.02], [0, s * 0.1, s * -0.05], [1, 1, 1], `Hand_${side}`);

  armsGroup.add(arm);
}

createArm('R');
createArm('L');

// ─────────────────────────────────────────────────────────────
// 6. INTERNAL X-RAY SKELETAL & ORGAN STRUCTURES
// ─────────────────────────────────────────────────────────────
const internalGroup = new THREE.Group();
internalGroup.name = "InternalStructures";
bodyRoot.add(internalGroup);

// Spine / Vertebral Column
const spineGeom = new THREE.CylinderGeometry(0.022, 0.026, 0.70, 12);
addPart(internalGroup, spineGeom, boneMaterial, [0, 1.20, -0.05], [0.08, 0, 0], [1, 1, 1], "SpineColumn");

// Ribcage
for (let r = 0; r < 6; r++) {
  const ribGeom = new THREE.TorusGeometry(0.12 + r * 0.008, 0.012, 8, 20, Math.PI * 1.5);
  addPart(internalGroup, ribGeom, boneMaterial, [0, 1.40 - r * 0.045, 0.0], [Math.PI * 0.55, 0, Math.PI * 0.25], [1.2, 0.8, 1], `Rib_${r}`);
}

// Pelvic Bone
const pelvicBoneGeom = new THREE.TorusGeometry(0.11, 0.022, 8, 16, Math.PI * 1.4);
addPart(internalGroup, pelvicBoneGeom, boneMaterial, [0, 0.84, -0.01], [Math.PI * 0.45, 0, Math.PI * 0.3], [1.2, 0.9, 1], "PelvicBone");

// Stomach (Anatomical Digestive Organ — matches stomach hotspot!)
const stomachGeom = new THREE.SphereGeometry(0.068, 16, 16);
addPart(internalGroup, stomachGeom, organMaterial, [0.02, 1.05, 0.05], [0.2, 0.3, -0.4], [1.2, 0.9, 1.4], "StomachOrgan");

// Intestines (Digestive loops in lower abdomen)
const intGeom = new THREE.TorusGeometry(0.075, 0.025, 8, 16);
addPart(internalGroup, intGeom, organMaterial, [0, 0.94, 0.04], [Math.PI * 0.4, 0.2, 0], [1.1, 0.8, 1], "Intestines");

// Femur Bones (Inside thighs)
const femurGeom = new THREE.CylinderGeometry(0.02, 0.024, 0.38, 12);
addPart(internalGroup, femurGeom, boneMaterial, [ 0.125, 0.55, 0.01], [0, 0, -0.05], [1, 1, 1], "Femur_R");
addPart(internalGroup, femurGeom, boneMaterial, [-0.125, 0.55, 0.01], [0, 0,  0.05], [1, 1, 1], "Femur_L");

console.log('📦 Exporting to GLB binary format...');

const exporter = new GLTFExporter();
const glbBuffer = await exporter.parseAsync(scene, { binary: true });

fs.writeFileSync(outPath, Buffer.from(glbBuffer));
const kb = (glbBuffer.byteLength / 1024).toFixed(1);
console.log(`✅ Success! Created: ${outPath} (${kb} KB)`);
