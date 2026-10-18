import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePng(width, height, drawFn) {
  const rowBytes = width * 4;
  const rawData = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + rowBytes);
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Brand SVG for ParikshaSetu
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="50%" stop-color="#312e81" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- Background rounded rectangle -->
  <rect width="512" height="512" rx="112" fill="url(#bg)" />
  <rect width="512" height="512" rx="112" fill="none" stroke="rgba(255, 255, 255, 0.12)" stroke-width="4" />

  <g filter="url(#shadow)">
    <!-- Bridge & Arch Base (Setu) -->
    <path d="M128 352 Q256 280 384 352 L384 372 Q256 304 128 372 Z" fill="url(#primaryGrad)" />
    
    <!-- Open Book / Wings of Education -->
    <!-- Left Page -->
    <path d="M256 296 C216 270 160 268 128 274 L128 206 C164 200 220 204 256 226 Z" fill="#ffffff" opacity="0.95" />
    <!-- Right Page -->
    <path d="M256 296 C296 270 352 268 384 274 L384 206 C348 200 292 204 256 226 Z" fill="#f1f5f9" opacity="0.95" />
    <!-- Spine Accent -->
    <path d="M252 220 L260 220 L260 300 L252 300 Z" fill="url(#primaryGrad)" />

    <!-- Graduation Cap (Mortarboard) -->
    <polygon points="256,120 376,168 256,216 136,168" fill="url(#primaryGrad)" />
    <!-- Cap Underneath Base -->
    <path d="M184 190 L184 220 Q256 250 328 220 L328 190 Q256 214 184 190 Z" fill="#4338ca" />
    <!-- Golden Tassel & Victory Star -->
    <circle cx="256" cy="168" r="8" fill="url(#accentGrad)" />
    <path d="M256 168 C290 178 308 198 312 216" stroke="url(#accentGrad)" stroke-width="5" fill="none" stroke-linecap="round" />
    <circle cx="312" cy="218" r="7" fill="url(#accentGrad)" />
  </g>

  <!-- Brand Lettermark Badge -->
  <rect x="180" y="396" width="152" height="38" rx="19" fill="#0f172a" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
  <text x="256" y="421" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="#38bdf8" text-anchor="middle" letter-spacing="3">PARIKSHA</text>
</svg>`;

// Pixel drawing function for smooth, vibrant branding in raster PNG
function drawBrandPixel(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const scale = isMaskable ? 0.75 : 0.88; // safe zone margin for maskable
  const dx = (x - cx) / (w * 0.5 * scale);
  const dy = (y - cy) / (h * 0.5 * scale);
  const distSq = dx * dx + dy * dy;

  // Background deep gradient: Indigo (#1e1b4b) to Slate (#0f172a)
  const normY = y / h;
  const bgR = Math.round(30 + (15 - 30) * normY);
  const bgG = Math.round(27 + (23 - 27) * normY);
  const bgB = Math.round(75 + (42 - 75) * normY);

  if (isMaskable) {
    // Fill full bleed background for maskable
    // Draw emblem inside center
  }

  // Rounded squircle boundary if standard icon
  if (!isMaskable) {
    const cornerRadius = 0.22;
    const nx = Math.abs(x - cx) / (w * 0.5);
    const ny = Math.abs(y - cy) / (h * 0.5);
    if (Math.pow(nx, 4.5) + Math.pow(ny, 4.5) > 1.05) {
      return [0, 0, 0, 0]; // transparent outside squircle
    }
  }

  // Inside emblem logic (simplified geometric representation)
  // Mortarboard diamond: top at dy = -0.4, right at dx = 0.55, bottom at dy = 0.05, left at dx = -0.55
  const mTop = -0.42;
  const mCenterY = -0.22;
  const mBottom = -0.02;
  const capDist = Math.abs(dx) / 0.55 + Math.abs(dy - mCenterY) / 0.2;

  if (capDist <= 1.0) {
    // Graduation cap diamond in bright Cyan/Indigo gradient
    const t = (dx + 0.55) / 1.1;
    const cr = Math.round(56 + t * 43); // 56 -> 99
    const cg = Math.round(189 - t * 87); // 189 -> 102
    const cb = Math.round(248 - t * 7); // 248 -> 241
    return [cr, cg, cb, 255];
  }

  // Tassel
  if (dx > 0.15 && dx < 0.35 && dy > -0.25 && dy < 0.1) {
    const tasselDist = Math.abs((dy - (-0.25)) * 0.7 - (dx - 0.15));
    if (tasselDist < 0.04) {
      return [251, 146, 60, 255]; // Amber tassel
    }
  }

  // Open book pages: dy from 0.05 to 0.45, dx from -0.5 to 0.5
  if (dy >= 0.05 && dy <= 0.42 && Math.abs(dx) <= 0.52) {
    // Curve of pages
    const pageCurve = 0.08 * (1 - Math.abs(dx) / 0.52);
    if (dy >= 0.05 + pageCurve && dy <= 0.40 + pageCurve) {
      if (Math.abs(dx) < 0.03) {
        // Spine
        return [99, 102, 241, 255]; // Indigo
      }
      return [248, 250, 252, 255]; // White paper
    }
  }

  // Bridge arch (Setu): dy from 0.44 to 0.62, dx from -0.55 to 0.55
  if (dy >= 0.42 && dy <= 0.58 && Math.abs(dx) <= 0.56) {
    const archH = 0.12 * Math.cos((dx / 0.56) * (Math.PI / 2));
    if (dy >= 0.48 - archH && dy <= 0.58 - archH) {
      return [56, 189, 248, 255]; // Cyan bridge
    }
  }

  return [bgR, bgG, bgB, 255];
}

// Ensure public directory
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write SVG
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf8');
console.log('✓ Created public/icon.svg');

// Generate PWA icons
const pwa192 = makePng(192, 192, (x, y, w, h) => drawBrandPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), pwa192);
console.log('✓ Created public/pwa-192x192.png');

const pwa512 = makePng(512, 512, (x, y, w, h) => drawBrandPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), pwa512);
console.log('✓ Created public/pwa-512x512.png');

const pwaMaskable = makePng(512, 512, (x, y, w, h) => drawBrandPixel(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pwaMaskable);
console.log('✓ Created public/pwa-maskable-512x512.png');

const appleTouch = makePng(180, 180, (x, y, w, h) => drawBrandPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);
console.log('✓ Created public/apple-touch-icon.png');

const favicon = makePng(48, 48, (x, y, w, h) => drawBrandPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favicon);
console.log('✓ Created public/favicon.ico');

// Generate Android mipmap icons if android folder exists
const androidResDir = path.resolve('android/app/src/main/res');
if (fs.existsSync(androidResDir)) {
  const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const { dir, size } of mipmaps) {
    const targetDir = path.join(androidResDir, dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const iconBuf = makePng(size, size, (x, y, w, h) => drawBrandPixel(x, y, w, h, false));
    const roundIconBuf = makePng(size, size, (x, y, w, h) => drawBrandPixel(x, y, w, h, true));
    fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), iconBuf);
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), roundIconBuf);
    console.log(`✓ Updated Android launcher icons in ${dir} (${size}x${size})`);
  }
}

console.log('All icons generated successfully!');
