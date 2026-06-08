const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('package.json is valid and has expected fields', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.name, 'inception');
  assert.ok(pkg.version, 'version should be set');
  assert.strictEqual(pkg.main, 'main.js');
});

test('entry point files exist', () => {
  for (const file of ['main.js', 'preload.js', 'renderer.js', 'index.html']) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} should exist`);
  }
});
