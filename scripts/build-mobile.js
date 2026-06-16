const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'www');

const files = [
  'index.html',
  'style.css',
  'script.js',
  'firebase-storage.js',
  'community-submissions.js',
  'community_data.json',
  'library-index.json',
  'favicon.ico',
  'mobile-billing-config.js',
  'mobile-iap.js',
  'mobile-iap.css'
];

const dirs = ['library'];

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(relativePath) {
  const src = path.join(rootDir, relativePath);
  const dest = path.join(outDir, relativePath);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(relativePath) {
  const src = path.join(rootDir, relativePath);
  const dest = path.join(outDir, relativePath);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

resetDir(outDir);
for (const file of files) copyFile(file);
for (const dir of dirs) copyDir(dir);

console.log(`Mobile web bundle written to ${outDir}`);
