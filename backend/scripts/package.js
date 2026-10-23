// Zips the built app for upload to the server (see docs/DEPLOY.md).
// Run via `npm run package`, which builds first.
//
// Uses Windows' own bsdtar (which writes real zip files) or `zip` elsewhere.
// A bare `tar` is not safe: Git Bash puts GNU tar first on PATH, and it writes
// a plain tar archive even when the name ends in .zip.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const out = path.join(root, '..', 'hadaf-payments-deploy.zip');
const entries = [
  'package.json',
  'package-lock.json',
  'dist',
  'public',
  'prisma/schema.prisma',
  'prisma/migrations',
  'scripts/prisma.js',
];

fs.rmSync(out, { force: true });

if (process.platform === 'win32') {
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  execFileSync(tar, ['--format', 'zip', '-c', '-f', out, ...entries], { cwd: root, stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', '-q', out, ...entries], { cwd: root, stdio: 'inherit' });
}

// Refuse to hand over anything that isn't a zip.
const magic = fs.readFileSync(out).subarray(0, 4).toString('binary');
if (magic !== 'PK\x03\x04') {
  fs.rmSync(out, { force: true });
  throw new Error('Packaging produced something that is not a zip file');
}

console.log(`Created ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
