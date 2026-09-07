// scripts/pack-scorm.js — Build SCORM 2004 zip package
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root      = path.resolve(__dirname, '..');
const distDir   = path.join(root, 'dist');
const manifestSrc = path.join(root, 'scorm', 'imsmanifest.xml');
const outPath   = path.join(root, 'DJBC_NarkoticsModule_SCORM2004.zip');

// Copy manifest into dist
fs.copyFileSync(manifestSrc, path.join(distDir, 'imsmanifest.xml'));
console.log('✅ Copied imsmanifest.xml to dist/');

// Create ZIP
const output = fs.createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const size = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ SCORM package created: DJBC_NarkoticsModule_SCORM2004.zip (${size} MB)`);
  console.log('📦 Upload file ini ke LMS DJBC Anda.');
});
archive.on('error', err => { throw err; });

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
