const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const errors = [];
if (manifest.description.length > 132) errors.push('Manifest description exceeds 132 characters');
const files = ['autofill-core.js', 'autofill-runner.js', 'autofill-controller.js', 'followup-email.js', manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap(c => [...(c.js || []), ...(c.css || [])])];
for (const group of manifest.web_accessible_resources || []) {
  for (const file of group.resources) if (!file.includes('*')) files.push(file);
}
const html = fs.readFileSync(path.join(root, manifest.action.default_popup), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)) files.push(match[1]);
for (const file of new Set(files)) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing packaged resource: ${file}`);
  else if (file.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], {encoding: 'utf8'});
    if (result.status) errors.push(result.stderr);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Manifest and ${new Set(files).size} entry-point resources passed.`);
if (/YOUR_/.test(manifest.oauth2?.client_id || '')) {
  console.warn('Release blocker: configure Gmail OAuth client ID or remove OAuth-dependent features before store submission.');
  if (process.argv.includes('--strict')) process.exitCode = 1;
}
