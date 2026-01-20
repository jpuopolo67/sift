#!/usr/bin/env node

/**
 * Package the extension for Chrome Web Store submission.
 * Creates a ZIP file containing the built extension.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageJson = require(path.join(rootDir, 'package.json'));
const version = packageJson.version;
const outputFile = path.join(rootDir, `sift-bookmark-manager-v${version}.zip`);

console.log('Packaging Sift Bookmark Manager for Chrome Web Store...\n');

// Step 1: Run build
console.log('Step 1: Building extension...');
try {
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
} catch (error) {
  console.error('Build failed!');
  process.exit(1);
}

// Step 2: Verify dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist after build');
  process.exit(1);
}

// Step 3: Verify manifest.json exists in dist
const manifestPath = path.join(distDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('Error: manifest.json not found in dist directory');
  process.exit(1);
}

// Step 4: Verify icons exist
const iconsDir = path.join(distDir, 'icons');
const requiredIcons = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];
let iconsOk = true;

if (!fs.existsSync(iconsDir)) {
  console.error('Error: icons directory not found in dist');
  iconsOk = false;
} else {
  for (const icon of requiredIcons) {
    if (!fs.existsSync(path.join(iconsDir, icon))) {
      console.error(`Error: ${icon} not found in dist/icons`);
      iconsOk = false;
    }
  }
}

if (!iconsOk) {
  console.error('\nMissing icons! Run: node scripts/generate-icons.cjs');
  process.exit(1);
}

// Step 5: Remove old zip if exists
if (fs.existsSync(outputFile)) {
  fs.unlinkSync(outputFile);
  console.log(`Removed existing ${path.basename(outputFile)}`);
}

// Step 6: Create ZIP file
console.log('\nStep 2: Creating ZIP file...');
try {
  // Use system zip command (available on macOS and Linux)
  execSync(`cd "${distDir}" && zip -r "${outputFile}" .`, { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to create ZIP file. Make sure zip command is available.');
  process.exit(1);
}

// Step 7: Verify ZIP was created
if (!fs.existsSync(outputFile)) {
  console.error('Error: ZIP file was not created');
  process.exit(1);
}

const stats = fs.statSync(outputFile);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log('\n========================================');
console.log('Package created successfully!');
console.log('========================================');
console.log(`\nFile: ${path.basename(outputFile)}`);
console.log(`Size: ${sizeMB} MB`);
console.log(`Location: ${outputFile}`);
console.log('\nNext steps:');
console.log('1. Go to https://chrome.google.com/webstore/devconsole');
console.log('2. Click "New Item" or select your existing extension');
console.log('3. Upload the ZIP file');
console.log('4. Fill in the store listing details');
console.log('5. Submit for review');
console.log('\nNote: Replace the placeholder icons with professional icons before publishing!');
