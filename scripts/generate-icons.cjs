#!/usr/bin/env node

/**
 * Generate simple placeholder icons for the Chrome extension.
 * These are basic colored squares with the letter "S" - replace with proper icons for production.
 */

const fs = require('fs');
const path = require('path');

// Simple PNG generator for solid color squares with text
// This creates valid PNG files without external dependencies

function createPNG(size, color, text) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // Create raw pixel data (RGBA)
  const pixels = [];
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  for (let y = 0; y < size; y++) {
    pixels.push(0); // Filter byte for each row
    for (let x = 0; x < size; x++) {
      // Create a simple "S" pattern in white on colored background
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size * 0.35;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

      // Simple circle with S-like pattern
      let isLetter = false;
      const relX = (x - centerX) / radius;
      const relY = (y - centerY) / radius;

      // Draw a stylized "S" using curves
      if (dist < radius) {
        // Top curve of S
        if (relY < 0 && relY > -0.8) {
          const expectedX = Math.sin(relY * Math.PI * 1.5) * 0.5;
          if (Math.abs(relX - expectedX) < 0.25) isLetter = true;
        }
        // Bottom curve of S (mirrored)
        if (relY > 0 && relY < 0.8) {
          const expectedX = -Math.sin(relY * Math.PI * 1.5) * 0.5;
          if (Math.abs(relX - expectedX) < 0.25) isLetter = true;
        }
      }

      if (isLetter) {
        pixels.push(255, 255, 255, 255); // White
      } else if (dist < radius * 1.1) {
        pixels.push(r, g, b, 255); // Primary color
      } else {
        pixels.push(0, 0, 0, 0); // Transparent
      }
    }
  }

  // Compress with zlib
  const zlib = require('zlib');
  const rawData = Buffer.from(pixels);
  const compressed = zlib.deflateSync(rawData);

  // CRC32 function
  function crc32(data) {
    let crc = 0xffffffff;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function createChunk(type, data) {
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeData));
    return Buffer.concat([length, typeData, crc]);
  }

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr.writeUInt8(8, 8);        // bit depth
  ihdr.writeUInt8(6, 9);        // color type (RGBA)
  ihdr.writeUInt8(0, 10);       // compression
  ihdr.writeUInt8(0, 11);       // filter
  ihdr.writeUInt8(0, 12);       // interlace

  // IDAT chunk (compressed data)
  const idat = compressed;

  // IEND chunk (empty)
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', idat),
    createChunk('IEND', iend)
  ]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Primary color from the extension
const primaryColor = '#4a90d9';

// Generate icons at required sizes
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const png = createPNG(size, primaryColor, 'S');
  const filename = `icon${size}.png`;
  fs.writeFileSync(path.join(iconsDir, filename), png);
  console.log(`Created ${filename}`);
});

console.log('\nIcons generated successfully!');
console.log('Note: These are placeholder icons. Replace with professional icons for production.');
