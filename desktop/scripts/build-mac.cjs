'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const project = path.join(__dirname, '..');
const manifest = require('../package.json');
const appName = 'Nest Pet';
const bundleName = `${appName}.app`;
const bundleId = 'com.hackthenest.nestpet';

function run(command, ...args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function plistValue(file, key) {
  return run('/usr/bin/plutil', '-extract', key, 'raw', '-o', '-', file);
}

function iconChunk(type, data) {
  const header = Buffer.alloc(8);
  header.write(type, 0, 'ascii');
  header.writeUInt32BE(header.length + data.length, 4);
  return Buffer.concat([header, data]);
}

function makeIcon(staging, resourceDir) {
  const original = path.join(project, 'src', 'renderer', 'assets', 'red-panda', 'andrew-original.png');
  const square = path.join(staging, 'reading-pose.png');
  // The center cell of Andrew's 2172 × 724 artwork is the reading pose.
  run('/usr/bin/sips', '-c', '724', '724', original, '--out', square);
  // Modern ICNS embeds PNG data. Sizes include the corresponding Retina
  // types, so Finder can use the artwork at both display densities.
  const pngTypes = {
    16: ['icp4'], 32: ['icp5', 'ic11'], 64: ['ic12'], 128: ['ic07'],
    256: ['ic08', 'ic13'], 512: ['ic09', 'ic14'], 1024: ['ic10']
  };
  const chunks = [];
  const icon = path.join(staging, 'icon-size.png');
  for (const [size, types] of Object.entries(pngTypes)) {
    run('/usr/bin/sips', '-z', size, size, square, '--out', icon);
    const png = fs.readFileSync(icon);
    for (const type of types) chunks.push(iconChunk(type, png));
  }
  fs.writeFileSync(path.join(resourceDir, 'NestPet.icns'), iconChunk('icns', Buffer.concat(chunks)));
}

function writeApp(staging, electronDist) {
  const bundle = path.join(staging, bundleName);
  const contents = path.join(bundle, 'Contents');
  const resources = path.join(contents, 'Resources');
  const payload = path.join(resources, 'app');
  const plist = path.join(contents, 'Info.plist');

  // ditto preserves Electron's framework symlinks and executable permissions.
  run('/usr/bin/ditto', path.join(electronDist, 'Electron.app'), bundle);
  fs.mkdirSync(payload);
  fs.copyFileSync(path.join(project, 'package.json'), path.join(payload, 'package.json'));
  fs.cpSync(path.join(project, 'src'), path.join(payload, 'src'), { recursive: true });
  fs.copyFileSync(path.join(project, 'THIRD_PARTY_NOTICES.md'), path.join(payload, 'THIRD_PARTY_NOTICES.md'));
  fs.copyFileSync(path.join(electronDist, 'LICENSE'), path.join(resources, 'LICENSE.electron'));
  fs.copyFileSync(path.join(electronDist, 'LICENSES.chromium.html'), path.join(resources, 'LICENSES.chromium.html'));
  fs.unlinkSync(path.join(resources, 'default_app.asar'));
  run('/usr/bin/plutil', '-remove', 'ElectronAsarIntegrity', plist);

  // Keep package.json's existing name for userData and Electron Safe Storage.
  // Finder and the Dock use the bundle's display name and artwork instead.
  const properties = {
    CFBundleDisplayName: appName,
    CFBundleName: appName,
    CFBundleIdentifier: bundleId,
    CFBundleShortVersionString: manifest.version,
    CFBundleVersion: manifest.version,
    CFBundleIconFile: 'NestPet.icns',
    LSApplicationCategoryType: 'public.app-category.lifestyle'
  };
  for (const [key, value] of Object.entries(properties)) {
    run('/usr/bin/plutil', '-replace', key, '-string', value, plist);
  }
  makeIcon(staging, resources);
  const frameworks = path.join(contents, 'Frameworks');
  for (const component of fs.readdirSync(frameworks)) {
    const bundlePath = path.join(frameworks, component);
    if (component.endsWith('.app')) {
      const helperPlist = path.join(bundlePath, 'Contents', 'Info.plist');
      // The helper executable paths follow Electron's built-in lookup.
      const helperName = path.basename(component, '.app').replace(/^Electron /, `${appName} `);
      run('/usr/bin/plutil', '-replace', 'CFBundleName', '-string', helperName, helperPlist);
      run('/usr/bin/plutil', '-replace', 'CFBundleIdentifier', '-string', `${bundleId}.helper`, helperPlist);
    }
    if (component.endsWith('.app') || component.endsWith('.framework')) {
      run('/usr/bin/codesign', '--force', '--sign', '-', bundlePath);
    }
  }
  run('/usr/bin/codesign', '--force', '--sign', '-', bundle);
  run('/usr/bin/codesign', '--verify', '--deep', '--strict', bundle);
  return bundle;
}

function installBundle(bundle, output, staging) {
  const prior = fs.lstatSync(output, { throwIfNoEntry: false });
  const backup = path.join(staging, 'previous.app');
  if (prior) {
    if (!prior.isDirectory() || plistValue(path.join(output, 'Contents', 'Info.plist'), 'CFBundleIdentifier') !== bundleId) {
      throw new Error(`Refusing to replace an unrelated item at ${output}`);
    }
    fs.renameSync(output, backup);
  }
  try {
    fs.renameSync(bundle, output);
  } catch (error) {
    if (prior) fs.renameSync(backup, output);
    throw error;
  }
}

function build() {
  if (process.platform !== 'darwin') throw new Error('The macOS bundle must be built on a Mac.');
  const { values } = parseArgs({ options: { 'electron-dist': { type: 'string' }, output: { type: 'string' } } });
  const electronDist = path.resolve(values['electron-dist'] ?? path.join(project, 'node_modules', 'electron', 'dist'));
  const output = path.resolve(values.output ?? path.join(project, 'dist', bundleName));
  if (path.basename(output) !== bundleName) throw new Error(`Output filename must be ${bundleName}.`);

  const electronPlist = path.join(electronDist, 'Electron.app', 'Contents', 'Info.plist');
  if (!fs.existsSync(electronPlist)) {
    throw new Error('Electron was not found. Run npm ci first or pass --electron-dist with a local Electron dist directory.');
  }
  if (plistValue(electronPlist, 'CFBundleShortVersionString') !== manifest.devDependencies.electron) {
    throw new Error(`Use Electron ${manifest.devDependencies.electron}, the version pinned for this project.`);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(output), '.nest-pet-build-'));
  let installed = false;
  try {
    installBundle(writeApp(staging, electronDist), output, staging);
    installed = true;
    console.log(output);
  } finally {
    const backup = path.join(staging, 'previous.app');
    if (installed || !fs.existsSync(backup)) fs.rmSync(staging, { recursive: true, force: true });
    else console.error(`The previous app was preserved at ${backup}`);
  }
}

try {
  build();
} catch (error) {
  console.error(`Could not build ${bundleName}. ${error.message}`);
  process.exitCode = 1;
}
