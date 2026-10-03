#!/usr/bin/env node
// Xuất phim quảng cáo ra MP4 (1920x1080, H.264 + AAC).
//
//   node render/export.cjs                       -> geely-ex5-emi-ong-trum.mp4
//   node render/export.cjs --fps 24 --out a.mp4
//   node render/export.cjs --stills 4.5,19,24,41  (chỉ chụp ảnh tĩnh để duyệt khung hình)
//   node render/export.cjs --audio-only           (chỉ dựng lại soundtrack.m4a cho trình phát)
//
// Yêu cầu: Node 18+, Playwright (Chromium) và ffmpeg trong PATH.
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { once } = require('events');

function loadPlaywright() {
    try {
        return require('playwright');
    } catch (e) {
        const globalRoot = execSync('npm root -g').toString().trim();
        return require(path.join(globalRoot, 'playwright'));
    }
}

function args() {
    const a = process.argv.slice(2);
    const o = {};
    for (let i = 0; i < a.length; i++) {
        if (a[i].startsWith('--')) {
            const k = a[i].slice(2);
            const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
            o[k] = v;
        }
    }
    return o;
}

const ROOT = path.resolve(__dirname, '..');
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
};

function serve() {
    const server = http.createServer((req, res) => {
        const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = path.join(ROOT, p === '/' ? 'index.html' : p);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404);
            return res.end();
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function run(cmd, argv) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
        let err = '';
        p.stderr.on('data', (d) => (err += d));
        p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`${cmd} lỗi ${code}\n${err.slice(-2000)}`))));
    });
}

// Chuẩn hoá độ lớn về TARGET LUFS (tăng/giảm tuyến tính + limiter chặn đỉnh -1 dBTP)
async function masterAudio(wav, m4a, target = -15) {
    const log = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
    const json = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
    const gain = target - Number(json.input_i);
    await run('ffmpeg', [
        '-y', '-i', wav,
        '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:attack=4:release=60:level=disabled`,
        '-c:a', 'aac', '-b:a', '192k', m4a,
    ]);
    console.log(`Âm thanh: ${Number(json.input_i).toFixed(1)} LUFS -> ${target} LUFS (${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB)`);
}

async function main() {
    const opt = args();
    const fps = Number(opt.fps || 30);
    const out = path.resolve(opt.out || path.join(ROOT, 'geely-ex5-emi-ong-trum.mp4'));
    const { chromium } = loadPlaywright();

    const server = await serve();
    const url = `http://127.0.0.1:${server.address().port}/index.html?render`;
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
    page.on('pageerror', (e) => console.error('[page error]', e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__ad && window.__ad.ready, null, { timeout: 60000 });
    const duration = await page.evaluate(() => window.__ad.duration);

    try {
        if (opt.stills) {
            const dir = path.resolve(opt.dir || path.join(ROOT, 'render', 'stills'));
            fs.mkdirSync(dir, { recursive: true });
            for (const s of String(opt.stills).split(',')) {
                const t = Number(s);
                await page.evaluate((x) => window.__ad.seek(x), t);
                const file = path.join(dir, `frame-${t.toFixed(2).padStart(5, '0')}.jpg`);
                await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
                console.log('still', file);
            }
            return;
        }

        const from = Number(opt.from || 0);
        const to = Math.min(Number(opt.to || duration), duration);
        const frames = Math.round((to - from) * fps);

        console.log('Dựng âm thanh…');
        const wav = path.join(ROOT, '.soundtrack.wav');
        const m4a = path.join(ROOT, 'soundtrack.m4a');
        const b64 = await page.evaluate(() => window.__ad.audioWavBase64());
        fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
        await masterAudio(wav, m4a);
        fs.unlinkSync(wav);
        if (opt['audio-only']) return;

        console.log(`Dựng ${frames} khung hình @ ${fps}fps…`);
        const ff = spawn(
            'ffmpeg',
            [
                '-y', '-loglevel', 'error',
                '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
                '-ss', String(from), '-i', m4a,
                '-map', '0:v', '-map', '1:a',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt.crf || 20),
                '-maxrate', String(opt.maxrate || '5M'), '-bufsize', '10M',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'copy',
                '-movflags', '+faststart', '-t', String(to - from),
                out,
            ],
            { stdio: ['pipe', 'inherit', 'inherit'] }
        );
        const started = Date.now();
        for (let i = 0; i < frames; i++) {
            await page.evaluate((x) => window.__ad.seek(x), from + i / fps);
            const png = await page.screenshot({ type: 'png' });
            if (!ff.stdin.write(png)) await once(ff.stdin, 'drain');
            if (i % fps === 0 || i === frames - 1) {
                const el = (Date.now() - started) / 1000;
                const eta = (el / (i + 1)) * (frames - i - 1);
                process.stdout.write(`\r  ${i + 1}/${frames}  (${el.toFixed(0)}s, còn ~${eta.toFixed(0)}s)   `);
            }
        }
        ff.stdin.end();
        const [code] = await once(ff, 'close');
        if (code !== 0) throw new Error(`ffmpeg thoát với mã ${code}`);
        console.log(`\nXong: ${out}`);
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
