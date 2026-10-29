'use strict';
const fs = require('fs'),
  path = require('path'),
  sharp = require('sharp');
const escapeHtml = (s) =>
  String(s || '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function inside(base, rel) {
  const file = path.resolve(base, rel),
    r = path.relative(base, file);
  if (r.startsWith('..') || path.isAbsolute(r))
    throw new Error('Asset path outside allowed directory');
  return file;
}
function resolveAsset(root, data, src) {
  if (typeof src !== 'string') throw new Error('Invalid asset');
  if (src.startsWith('runtime/')) return inside(data, src.slice(8));
  if (!/^(rehearsal\/assets\/|demo-assets\/)/.test(src)) throw new Error('Unsupported asset path');
  return inside(root, src);
}
async function sampleParticles({ sourcePath, outPath, step = 4 }) {
  const { data, info } = await sharp(sourcePath, { limitInputPixels: 20000000 })
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const points = [];
  for (let y = step / 2; y < info.height; y += step)
    for (let x = step / 2; x < info.width; x += step) {
      const n = (y * info.width + x) * 4;
      if (data[n + 3] < 128) continue;
      points.push([
        x,
        y,
        Math.round(0.2126 * data[n] + 0.7152 * data[n + 1] + 0.0722 * data[n + 2]),
      ]);
    }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `window.PARTICLE_DATA=window.PARTICLE_DATA||{};window.PARTICLE_DATA.avatar=${JSON.stringify({ w: 256, h: 256, step, points })};`,
  );
  return points;
}
async function exportSite({
  rootDir,
  dataDir = path.join(rootDir, 'platform/data'),
  config,
  configPath,
  outPath,
  keepImageUrls = false,
}) {
  const cfg = config || JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const themes = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'platform/config/lesson-4.json')),
  ).presets.map((p) => p.id);
  if (!themes.includes(cfg.theme)) throw new Error('Unknown theme');
  let html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const images = {};
  for (const [key, img] of Object.entries(cfg.images || {})) {
    if (keepImageUrls) throw new Error('Exports require embedded images');
    const abs = resolveAsset(rootDir, dataDir, img.src);
    const b = await sharp(abs).toBuffer();
    const meta = await sharp(b).metadata();
    images[key] = {
      src: `data:image/${meta.format === 'jpeg' ? 'jpeg' : meta.format};base64,${b.toString('base64')}`,
      alt: img.alt || '',
    };
  }
  const json = JSON.stringify({
    theme: cfg.theme,
    pageTitle: cfg.pageTitle,
    slots: cfg.slots,
    images,
  }).replace(/</g, '\\u003c');
  const css = fs.readFileSync(path.join(rootDir, 'styles.css'), 'utf8');
  const scripts = [
    `window.SITE_DATA=${json};`,
    fs.readFileSync(path.join(rootDir, 'tools/fill-slots.js'), 'utf8'),
    ...Object.values(cfg.particles || {}).map((src) =>
      fs.readFileSync(resolveAsset(rootDir, dataDir, src), 'utf8'),
    ),
    ...['motion.js', 'particles.js', 'flight.js', 'carousel.js'].map((f) =>
      fs.readFileSync(path.join(rootDir, f), 'utf8'),
    ),
  ];
  html = html
    .replace(/data-theme="[^"]+"/, `data-theme="${cfg.theme}"`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(cfg.pageTitle)}</title>`)
    .replace(/<link rel="stylesheet" href="styles.css">/, () => `<style>\n${css}\n</style>`);
  const block = /<!-- Production modules -->[\s\S]*?<script src="dev-preview.js"><\/script>/;
  if (!block.test(html)) throw new Error('Template script block missing');
  html = html.replace(block, () =>
    scripts.map((code) => `<script>\n${code}\n</script>`).join('\n'),
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  return { outPath, sizeBytes: Buffer.byteLength(html) };
}
module.exports = { exportSite, sampleParticles, resolveAsset, escapeHtml };
if (require.main === module) {
  const root = path.join(__dirname, '..'),
    args = process.argv.slice(2),
    file = args[args.indexOf('--config') + 1] || 'demo-export.json';
  const cfg = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  exportSite({ rootDir: root, config: cfg, outPath: path.join(root, 'dist', cfg.name + '.html') })
    .then((r) => console.log(r.outPath))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
