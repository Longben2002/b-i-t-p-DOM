// Phim quảng cáo Geely EX5 EM-i — phong cách "ông trùm".
// Toàn bộ khung hình được tính từ thời gian t (giây) => có thể tua / xuất từng frame chính xác.
(function () {
    'use strict';

    const C = window.AD_CUES;
    const W = 1920;
    const H = 1080;
    const FPS = 30;
    const DUR = C.duration;
    const TOP = 138; // mép dưới thanh letterbox trên
    const BOT = 942; // mép trên thanh letterbox dưới
    const RENDER = new URLSearchParams(location.search).has('render');
    if (RENDER) document.body.classList.add('render');

    // ---------- Toán ----------
    const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
    const lerp = (a, b, k) => a + (b - a) * k;
    const P = (t, a, b) => clamp((t - a) / (b - a));
    const mod = (a, n) => ((a % n) + n) % n;
    const ease = {
        inC: (x) => x * x * x,
        outC: (x) => 1 - Math.pow(1 - x, 3),
        ioC: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
        outE: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
        ioS: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    };
    function env(t, a, b, c, d, ei = ease.outC, eo = ease.ioS) {
        if (t <= a || t >= d) return 0;
        if (t < b) return ei((t - a) / (b - a));
        if (t <= c) return 1;
        return 1 - eo((t - c) / (d - c));
    }
    function hash(n) {
        const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
        return x - Math.floor(x);
    }
    function vnoise(x) {
        const i = Math.floor(x);
        const f = x - i;
        return lerp(hash(i), hash(i + 1), f * f * (3 - 2 * f));
    }
    function rng(seed) {
        return function () {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    const mix = (a, b, k) => [0, 1, 2].map((i) => Math.round(lerp(a[i], b[i], k)));

    // ---------- DOM ----------
    const $ = (id) => document.getElementById(id);
    const stage = $('stage');
    const bg = $('bg').getContext('2d');
    const fx = $('fx').getContext('2d');
    const grain = $('grain').getContext('2d');

    const carSide = $('car-side');
    const carFront = $('car-front');
    const carRear = $('car-rear');
    const spokes = document.querySelector('#wheel .spokes');
    const sideLights = $('side-lights');
    const sideRim = $('side-rim');
    const sheen = [
        { grad: $('sheen1'), rect: $('sheen-a') },
        { grad: $('sheen2'), rect: $('sheen-b') },
    ];

    const front = {
        car: $('front-car'),
        rim: $('front-rim'),
        ledL: [$('f-led-l'), $('f-led-l-g')],
        ledR: [$('f-led-r'), $('f-led-r-g')],
        bar: [$('f-bar'), $('f-bar-g')],
        bloomL: $('f-bloom-l'),
        bloomR: $('f-bloom-r'),
        flare: $('f-flare'),
        flare2: $('f-flare2'),
        spill: $('f-spill'),
        wet: [$('f-wet-l'), $('f-wet-r')],
        wetC: $('f-wet-c'),
    };
    const rearLights = $('rear-lights');

    const ui = {
        loc: $('loc'),
        l1: $('l1'),
        l2: $('l2'),
        l3a: $('l3a'),
        l3b: $('l3b'),
        title: $('title'),
        tBrand: document.querySelector('#title .brand'),
        tModel: document.querySelector('#title .model'),
        tRule: document.querySelector('#title .rule'),
        tSub: document.querySelector('#title .sub'),
        dossiers: [$('d1'), $('d2'), $('d3')],
        o1: $('o1'),
        o2: $('o2'),
        price: $('price'),
        pFrom: document.querySelector('#price .from'),
        pAmount: document.querySelector('#price .amount'),
        pGold: document.querySelector('#price .amount .gold-text'),
        pVar: document.querySelector('#price .variants'),
        end: $('endcard'),
        eBrand: document.querySelector('#endcard .brand'),
        eModel: document.querySelector('#endcard .model'),
        eSlogan: document.querySelector('#endcard .slogan'),
        cta: $('cta'),
        disclaimer: $('disclaimer'),
        flash: $('flash'),
        vignette: $('vignette'),
    };

    // ---------- Tài nguyên dựng sẵn ----------
    let skyline;
    let smokeCool;
    let smokeWarm;
    let smokeGold;
    let grainTiles = [];
    let bolt = [];

    function makeSkyline() {
        const c = document.createElement('canvas');
        c.width = 2400;
        c.height = 420;
        const x = c.getContext('2d');
        const r = rng(77);
        const lit = [];
        let px = 0;
        while (px < 2400) {
            const w = 46 + r() * 120;
            let h = 70 + r() * 210;
            if (r() < 0.14) h += 110;
            x.fillStyle = r() < 0.5 ? '#030406' : '#040508';
            x.fillRect(px, 420 - h, w, h);
            if (h > 300 && r() < 0.6) x.fillRect(px + w / 2 - 2, 420 - h - 40, 4, 40);
            for (let wy = 420 - h + 10; wy < 410; wy += 15) {
                for (let wx = px + 7; wx < px + w - 9; wx += 12) {
                    if (r() < 0.085) lit.push([wx, wy, r() < 0.75]);
                }
            }
            px += w + r() * 8;
        }
        for (const [wx, wy, warm] of lit) {
            x.fillStyle = warm ? 'rgba(255,186,110,0.55)' : 'rgba(170,200,255,0.42)';
            x.fillRect(wx, wy, 4, 6);
        }
        return c;
    }

    function makeSmoke(seed, tint) {
        const s = 512;
        const a = document.createElement('canvas');
        a.width = a.height = s;
        const x = a.getContext('2d');
        const r = rng(seed);
        for (let i = 0; i < 70; i++) {
            const ang = r() * Math.PI * 2;
            const d = Math.pow(r(), 0.7) * 105;
            const px = s / 2 + Math.cos(ang) * d * 1.3;
            const py = s / 2 + Math.sin(ang) * d * 0.8;
            const rad = 36 + r() * 70;
            const g = x.createRadialGradient(px, py, 0, px, py, rad);
            g.addColorStop(0, rgba(tint, (0.05 + r() * 0.09).toFixed(3)));
            g.addColorStop(1, rgba(tint, 0));
            x.fillStyle = g;
            x.beginPath();
            x.arc(px, py, rad, 0, Math.PI * 2);
            x.fill();
        }
        const b = document.createElement('canvas');
        b.width = b.height = s;
        const y = b.getContext('2d');
        y.filter = 'blur(12px)';
        y.drawImage(a, 0, 0);
        return b;
    }

    function makeGrain() {
        const tiles = [];
        const r = rng(11);
        for (let k = 0; k < 6; k++) {
            const c = document.createElement('canvas');
            c.width = c.height = 256;
            const x = c.getContext('2d');
            const img = x.createImageData(256, 256);
            for (let i = 0; i < img.data.length; i += 4) {
                const v = r();
                const white = v > 0.5;
                const a = Math.abs(v - 0.5) * 2;
                img.data[i] = img.data[i + 1] = img.data[i + 2] = white ? 255 : 0;
                img.data[i + 3] = Math.round(a * a * (white ? 22 : 40));
            }
            x.putImageData(img, 0, 0);
            tiles.push(c);
        }
        return tiles;
    }

    function makeBolt() {
        const r = rng(5);
        const main = [[1480, TOP - 10]];
        let x = 1480;
        let y = TOP - 10;
        const branches = [];
        while (y < 560) {
            y += 18 + r() * 22;
            x += (r() - 0.5) * 56;
            main.push([x, y]);
            if (r() < 0.22) {
                const br = [[x, y]];
                let bx = x;
                let by = y;
                const dir = r() < 0.5 ? -1 : 1;
                for (let i = 0; i < 5; i++) {
                    by += 14 + r() * 16;
                    bx += dir * (10 + r() * 26);
                    br.push([bx, by]);
                }
                branches.push(br);
            }
        }
        return [main, ...branches];
    }

    // ---------- Hàm vẽ dùng chung ----------
    function polyline(ctx, pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    }

    function glow(ctx, x, y, r, c, a) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(c, a));
        g.addColorStop(0.35, rgba(c, a * 0.35));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Vệt phản chiếu dài trên mặt đường ướt (elip mờ từ điểm (x, y) kéo xuống)
    function streak(ctx, x, y, w, h, c, a) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(w / 2, h);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, rgba(c, a));
        g.addColorStop(0.35, rgba(c, a * 0.35));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-1, 0, 2, 1);
        ctx.restore();
    }

    // Côn sáng mềm (vẽ nhiều lớp để viền mờ)
    function cone(ctx, cx, y0, y1, w0, w1, c, alpha) {
        for (let i = 0; i < 6; i++) {
            const k = 0.5 + i * 0.13;
            const g = ctx.createLinearGradient(0, y0, 0, y1);
            g.addColorStop(0, rgba(c, (alpha / 6) * 1.7));
            g.addColorStop(1, rgba(c, (alpha / 6) * 0.3));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(cx - (w0 * k) / 2, y0);
            ctx.lineTo(cx + (w0 * k) / 2, y0);
            ctx.lineTo(cx + (w1 * k) / 2, y1);
            ctx.lineTo(cx - (w1 * k) / 2, y1);
            ctx.fill();
        }
    }

    function smoke(ctx, t, o) {
        const n = o.n;
        for (let i = 0; i < n; i++) {
            const h1 = hash(o.seed + i * 7.13);
            const h2 = hash(o.seed + i * 3.31);
            const h3 = hash(o.seed + i * 5.77);
            const sz = o.size * (0.7 + 0.8 * h3);
            const spanX = o.x1 - o.x0 + sz;
            const px = o.x0 - sz / 2 + mod(h1 * spanX + o.vx * (0.6 + 0.8 * h2) * t, spanX);
            let py;
            if (o.vy) {
                const spanY = o.y1 - o.y0 + sz;
                py = o.y1 + sz / 2 - mod(h2 * spanY + -o.vy * (0.6 + 0.8 * h3) * t, spanY);
            } else {
                py = o.y0 + (o.y1 - o.y0) * h2;
            }
            const rot = (h3 - 0.5) * 0.6 + (h1 - 0.5) * 0.08 * t;
            const a = o.alpha * (0.65 + 0.35 * Math.sin(t * 0.6 + i * 1.7));
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(px, py);
            ctx.rotate(rot);
            ctx.drawImage(o.sprite, -sz / 2, -sz / 2, sz, sz * (o.squash || 1));
            ctx.restore();
        }
    }

    function rain(ctx, t, o) {
        const base = o.base || [165, 176, 198];
        const lc = o.lightColor || [255, 222, 170];
        const speed = o.speed || 1;
        const slant = o.slant || 0;
        ctx.lineCap = 'round';
        for (let i = 0; i < o.count; i++) {
            const z = hash(i * 3.17 + 1.3);
            const sp = (1150 + 1500 * z) * speed;
            const len = (16 + 54 * z) * (0.75 + 0.25 * speed);
            const spanY = H + 200;
            const y = mod(hash(i * 7.31 + 2.1) * spanY + sp * t, spanY) - 100;
            const spanX = W + 600;
            const x = mod(hash(i * 1.93 + 5.7) * spanX + slant * y, spanX) - 300;
            const il = o.light ? o.light(x, y) : 0;
            const a = clamp(o.alpha * (0.05 + 0.15 * z) * (1 + 5 * il), 0, 0.85);
            if (a < 0.01) continue;
            const col = il > 0.02 ? mix(base, lc, clamp(il * 1.5)) : base;
            ctx.strokeStyle = rgba(col, a.toFixed(3));
            ctx.lineWidth = 0.7 + 1.5 * z;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - slant * len, y - len);
            ctx.stroke();
        }
    }

    function motes(ctx, t, o) {
        for (let i = 0; i < o.n; i++) {
            const h1 = hash(o.seed + i * 1.71);
            const h2 = hash(o.seed + i * 2.93);
            const h3 = hash(o.seed + i * 4.47);
            const x = o.x0 + (o.x1 - o.x0) * h1 + Math.sin(t * (0.3 + h3) + i) * 30;
            const y = o.y1 - mod(h2 * (o.y1 - o.y0) + o.rise * (0.4 + h3) * t, o.y1 - o.y0);
            const il = o.light ? o.light(x, y) : 1;
            const tw = 0.5 + 0.5 * Math.sin(t * (2 + 3 * h3) + i * 2.1);
            const a = o.alpha * il * tw;
            if (a < 0.01) continue;
            ctx.fillStyle = rgba(o.color, a.toFixed(3));
            ctx.beginPath();
            ctx.arc(x, y, 0.8 + 2.2 * h3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ---------- Các đại lượng theo thời gian ----------
    function lightning(t) {
        let f = 0;
        for (const [t0, pk, dec] of [[C.lightning - 0.08, 0.25, 0.05], [C.lightning, 1, 0.16], [C.lightning + 0.17, 0.65, 0.33]]) {
            if (t >= t0) f += pk * Math.exp(-(t - t0) / dec) * clamp((t - t0) / 0.015);
        }
        return clamp(f);
    }

    function ledState(t) {
        const pL = ease.outC(P(t, C.ledL, C.ledL + 0.28));
        const pR = ease.outC(P(t, C.ledR, C.ledR + 0.28));
        const pB = ease.ioC(P(t, C.lightBar, C.lightBar + 0.5));
        let spike = 0;
        for (const t0 of [C.ledL, C.ledR, C.lightBar]) if (t >= t0) spike += Math.exp(-(t - t0) / 0.2);
        return { pL, pR, pB, L: (pL + pR + pB) / 3, spike: clamp(spike) };
    }

    // Vị trí xe theo cảnh (để đồng bộ ánh sáng trên canvas)
    function frontPose(t) {
        const s = lerp(0.9, 1.0, ease.ioS(P(t, 12.0, 17.4)));
        const ground = 896;
        return { s, x: 960 - 500 * s, y: ground - 740 * s };
    }
    function sidePose(t) {
        const s = 1.02;
        const bob = Math.sin(t * 8.1) * 1.1 + Math.sin(t * 13.7) * 0.5;
        const x = lerp(110, 170, ease.ioS(P(t, 21.4, 36)));
        return { s, x, y: 818 - 340 * s + bob };
    }
    function rearPose(t) {
        const k = ease.outC(P(t, 43.5, 52.5));
        const s = lerp(0.74, 0.47, k);
        const ground = lerp(905, 772, k);
        return { s, x: 960 - 500 * s, y: ground - 740 * s };
    }
    const LAMP_SP = 760;
    const LAMP_V = 640;
    function roadLamps(t) {
        const tt = t - 21.4;
        const out = [];
        for (let k = 0; k < 4; k++) out.push(mod(k * LAMP_SP - LAMP_V * tt + 300, LAMP_SP * 4) - 400 + 86);
        return out;
    }

    // ---------- Cảnh: phông nền (bg) + hiệu ứng (fx) ----------
    function bgOpen(ctx, t) {
        const f = lightning(t);
        const hz = 650;
        const g = ctx.createLinearGradient(0, TOP, 0, hz);
        g.addColorStop(0, rgba(mix([4, 6, 10], [150, 165, 200], f), 1));
        g.addColorStop(1, rgba(mix([11, 14, 21], [82, 92, 122], f), 1));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, hz);
        if (f > 0.02) smoke(ctx, t, { n: 7, seed: 3, x0: 0, x1: W, y0: TOP, y1: 420, vx: 8, size: 900, sprite: smokeCool, alpha: 0.9 * f, squash: 0.5 });
        if (f > 0.3 && t < C.lightning + 0.3) {
            ctx.save();
            ctx.shadowColor = '#bcd0ff';
            ctx.shadowBlur = 30;
            ctx.lineJoin = 'round';
            bolt.forEach((b, i) => {
                ctx.strokeStyle = rgba([240, 244, 255], (f * (i ? 0.6 : 1)).toFixed(3));
                ctx.lineWidth = i ? 1.6 : 3.2;
                polyline(ctx, b);
                ctx.stroke();
            });
            ctx.restore();
        }
        ctx.drawImage(skyline, -120, hz - 340, 2400, 340);
        const gg = ctx.createLinearGradient(0, hz, 0, BOT);
        gg.addColorStop(0, rgba(mix([7, 8, 11], [70, 78, 100], f), 1));
        gg.addColorStop(1, '#020203');
        ctx.fillStyle = gg;
        ctx.fillRect(0, hz, W, BOT - hz);
        // đèn đường xa nhấp nháy
        const fl = 0.75 + 0.25 * vnoise(t * 7) - (hash(Math.floor(t * 9)) > 0.93 ? 0.5 : 0);
        ctx.fillStyle = '#050506';
        ctx.fillRect(255, 380, 6, 330);
        ctx.fillRect(255, 380, 60, 5);
        glow(ctx, 315, 390, 190, [255, 180, 100], 0.5 * fl);
        cone(ctx, 315, 392, 720, 30, 420, [255, 180, 100], 0.08 * fl);
        streak(ctx, 315, 712, 70, 220, [255, 170, 90], 0.28 * fl);
    }
    function fxOpen(ctx, t) {
        const f = lightning(t);
        const fl = 0.75 + 0.25 * vnoise(t * 7);
        rain(ctx, t, {
            count: 650,
            slant: 0.1,
            alpha: clamp(t / 1.2),
            light: (x, y) => f * 0.7 + (y > 390 && y < 720 ? clamp(1 - Math.abs(x - 315) / (30 + (y - 390) * 0.6)) * 0.5 * fl : 0),
        });
    }

    function bgNarr(ctx, t) {
        const fl = 0.9 + 0.1 * vnoise(t * 9) - (hash(Math.floor(t * 12) + 3) > 0.975 ? 0.35 : 0);
        cone(ctx, 960, TOP - 30, BOT, 80, 1000, [255, 188, 118], 0.13 * fl);
        glow(ctx, 960, TOP - 10, 320, [255, 190, 120], 0.42 * fl);
        const pool = ctx.createRadialGradient(960, 905, 0, 960, 905, 560);
        pool.addColorStop(0, rgba([255, 180, 110], 0.16 * fl));
        pool.addColorStop(1, rgba([255, 180, 110], 0));
        ctx.save();
        ctx.translate(0, 905);
        ctx.scale(1, 0.12);
        ctx.translate(0, -905);
        ctx.fillStyle = pool;
        ctx.fillRect(300, 300, 1320, 1200);
        ctx.restore();
        smoke(ctx, t, { n: 7, seed: 21, x0: 300, x1: 1620, y0: 320, y1: 820, vx: 22, size: 1150, sprite: smokeWarm, alpha: 0.17 * fl, squash: 0.55 });
    }
    function narrLight(x, y) {
        if (y < TOP - 30) return 0;
        const hw = lerp(40, 500, (y - TOP) / (BOT - TOP));
        return Math.pow(clamp(1 - Math.abs(x - 960) / hw), 1.4) * 0.8;
    }
    function fxNarr(ctx, t) {
        rain(ctx, t, { count: 520, slant: 0.06, alpha: 0.9, light: narrLight });
    }

    function bgIgnition(ctx, t) {
        const s = ledState(t);
        const p = frontPose(t);
        const hy = p.y + 445 * p.s;
        glow(ctx, 960, hy, 980, [120, 150, 210], 0.1 * s.L);
        smoke(ctx, t, { n: 8, seed: 41, x0: 0, x1: W, y0: 560, y1: 900, vx: 14, size: 1300, sprite: smokeCool, alpha: 0.06 + 0.2 * s.L, squash: 0.45 });
    }
    function fxIgnition(ctx, t) {
        const s = ledState(t);
        const p = frontPose(t);
        const lx = p.x + 263 * p.s;
        const rx = p.x + 737 * p.s;
        const ly = p.y + 443 * p.s;
        const gauss = (x, y, cx, cy) => Math.exp(-((x - cx) ** 2) / (2 * 330 * 330) - ((y - cy) ** 2) / (2 * 260 * 260));
        rain(ctx, t, {
            count: 650,
            slant: 0.05,
            alpha: 0.7,
            lightColor: [225, 236, 255],
            light: (x, y) => s.pL * gauss(x, y, lx, ly) + s.pR * gauss(x, y, rx, ly) + s.pB * 0.6 * gauss(x, y, 960, ly),
        });
    }

    function bgTitle(ctx, t) {
        glow(ctx, 960, 540, 760, [140, 100, 40], 0.12);
        smoke(ctx, t, { n: 7, seed: 61, x0: 0, x1: W, y0: 320, y1: 780, vx: 16, size: 1400, sprite: smokeGold, alpha: 0.15, squash: 0.45 });
    }
    function fxTitle(ctx, t) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        motes(ctx, t, { n: 110, seed: 5, x0: 200, x1: 1720, y0: TOP, y1: BOT, rise: 22, color: [232, 196, 120], alpha: 0.55 });
        ctx.restore();
    }

    function bgRoad(ctx, t) {
        const tt = t - 21.4;
        const hz = 604;
        const sky = ctx.createLinearGradient(0, TOP, 0, hz);
        sky.addColorStop(0, '#04060a');
        sky.addColorStop(0.75, '#0b0e16');
        sky.addColorStop(1, '#1d140e');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, hz);
        const off = mod(-36 * tt, 2400);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(skyline, off - 2400, hz - 250, 2400, 250);
        ctx.drawImage(skyline, off, hz - 250, 2400, 250);
        ctx.globalAlpha = 1;
        // bokeh thành phố
        for (let i = 0; i < 46; i++) {
            const h1 = hash(i * 2.7 + 1);
            const h2 = hash(i * 5.1 + 2);
            const x = mod(h1 * 2400 - 150 * tt, 2400) - 240;
            const y = hz - 40 + h2 * 50;
            const r = 4 + 16 * hash(i * 9.7);
            const c = h2 < 0.55 ? [255, 180, 100] : h2 < 0.8 ? [210, 225, 255] : [255, 70, 60];
            glow(ctx, x, y, r * 2.2, c, 0.35 + 0.3 * hash(i * 3.3));
        }
        // vỉa hè + mặt đường
        ctx.fillStyle = '#0a0b0e';
        ctx.fillRect(0, hz, W, 26);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, hz + 26, W, 2);
        const road = ctx.createLinearGradient(0, hz + 28, 0, BOT);
        road.addColorStop(0, '#0b0c0f');
        road.addColorStop(1, '#040405');
        ctx.fillStyle = road;
        ctx.fillRect(0, hz + 28, W, BOT - hz - 28);
        // vạch kẻ đường
        ctx.fillStyle = 'rgba(210,210,200,0.10)';
        for (let i = 0; i < 9; i++) ctx.fillRect(mod(i * 300 - 900 * tt, 2700) - 300, 668, 90, 3);
        ctx.fillStyle = 'rgba(220,220,210,0.2)';
        for (let i = 0; i < 6; i++) ctx.fillRect(mod(i * 460 - 1500 * tt, 2760) - 400, 902, 170, 7);
        // cột đèn đường
        for (const hx of roadLamps(t)) {
            const px = hx - 86;
            ctx.fillStyle = '#060607';
            ctx.fillRect(px - 4, 252, 8, hz + 22 - 252);
            ctx.strokeStyle = '#060607';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(px, 262);
            ctx.quadraticCurveTo(px + 30, 244, hx, 252);
            ctx.stroke();
            ctx.fillStyle = '#121214';
            ctx.beginPath();
            ctx.ellipse(hx, 256, 28, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            glow(ctx, hx, 262, 200, [255, 184, 100], 0.55);
            cone(ctx, hx, 262, hz + 26, 40, 440, [255, 184, 100], 0.07);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            streak(ctx, hx, hz + 32, 90, BOT - hz - 32, [255, 170, 90], 0.32);
            ctx.restore();
        }
    }
    function fxRoad(ctx, t) {
        const lamps = roadLamps(t);
        const p = sidePose(t);
        const fxp = p.x + 930 * p.s;
        const fyp = p.y + 174 * p.s;
        // đèn pha chiếu về phía trước
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const beam = ctx.createLinearGradient(fxp, 0, fxp + 900, 0);
        beam.addColorStop(0, 'rgba(220,232,255,0.20)');
        beam.addColorStop(1, 'rgba(220,232,255,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(fxp, fyp - 8);
        ctx.lineTo(fxp + 950, fyp - 70);
        ctx.lineTo(fxp + 950, fyp + 230);
        ctx.lineTo(fxp, fyp + 10);
        ctx.fill();
        const pool = ctx.createRadialGradient(fxp + 420, 840, 0, fxp + 420, 840, 420);
        pool.addColorStop(0, 'rgba(210,225,255,0.10)');
        pool.addColorStop(1, 'rgba(210,225,255,0)');
        ctx.fillStyle = pool;
        ctx.fillRect(fxp, 780, 840, 120);
        ctx.restore();
        rain(ctx, t, {
            count: 720,
            slant: -0.42,
            speed: 1.25,
            alpha: 0.85,
            light: (x, y) => {
                let il = 0;
                for (const hx of lamps) {
                    if (y > 262) il = Math.max(il, clamp(1 - Math.abs(x - hx) / (20 + (y - 262) * 0.55)) * 0.6);
                }
                const dx = x - fxp;
                if (dx > 0 && dx < 950 && y > fyp - 8 - dx * 0.07 && y < fyp + dx * 0.23) il = Math.max(il, 0.55 * (1 - dx / 950));
                return il;
            },
        });
    }

    // Bóng lưng "ông trùm" đội mũ fedora, ngược sáng
    function drawDon(ctx, cx, base, s, rim) {
        ctx.save();
        ctx.translate(cx, base);
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(-370, 0);
        ctx.bezierCurveTo(-360, -95, -325, -152, -232, -176);
        ctx.bezierCurveTo(-170, -192, -102, -200, -64, -214);
        ctx.lineTo(-54, -250);
        ctx.bezierCurveTo(-78, -272, -82, -318, -70, -350);
        ctx.bezierCurveTo(-96, -350, -126, -350, -142, -356);
        ctx.bezierCurveTo(-156, -362, -150, -370, -128, -371);
        ctx.lineTo(-72, -374);
        ctx.bezierCurveTo(-74, -410, -66, -438, -40, -452);
        ctx.bezierCurveTo(-22, -444, -10, -440, 0, -440);
        ctx.bezierCurveTo(10, -440, 22, -444, 40, -452);
        ctx.bezierCurveTo(66, -438, 74, -410, 72, -374);
        ctx.lineTo(128, -371);
        ctx.bezierCurveTo(150, -370, 156, -362, 142, -356);
        ctx.bezierCurveTo(126, -350, 96, -350, 70, -350);
        ctx.bezierCurveTo(82, -318, 78, -272, 54, -250);
        ctx.lineTo(64, -214);
        ctx.bezierCurveTo(102, -200, 170, -192, 232, -176);
        ctx.bezierCurveTo(325, -152, 360, -95, 370, 0);
        ctx.closePath();
        ctx.fillStyle = '#000';
        ctx.fill();
        const g = ctx.createLinearGradient(0, -455, 0, -60);
        g.addColorStop(0, rgba([255, 200, 130], 0.85 * rim));
        g.addColorStop(0.45, rgba([255, 180, 110], 0.35 * rim));
        g.addColorStop(1, rgba([255, 180, 110], 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255,170,90,0.9)';
        ctx.shadowBlur = 22;
        ctx.stroke();
        // dải băng mũ
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba([150, 110, 60], 0.45 * rim);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-72, -388);
        ctx.quadraticCurveTo(0, -382, 72, -388);
        ctx.stroke();
        ctx.restore();
    }

    function bgOffer(ctx, t) {
        const fl = 0.92 + 0.08 * vnoise(t * 6);
        cone(ctx, 960, TOP - 20, BOT, 90, 820, [255, 186, 110], 0.14 * fl);
        glow(ctx, 960, TOP - 4, 300, [255, 190, 120], 0.45 * fl);
        smoke(ctx, t, { n: 6, seed: 81, x0: 820, x1: 1240, y0: 220, y1: 760, vx: 6, vy: -26, size: 560, sprite: smokeWarm, alpha: 0.2 * fl, squash: 1.4 });
        const rim = fl * (1 - 0.55 * ease.outC(P(t, C.priceHit, C.priceHit + 0.6)));
        drawDon(ctx, 960, BOT + 112, 0.8, rim);
    }
    function offerLight(x, y) {
        if (y < TOP - 20) return 0;
        const hw = lerp(45, 410, (y - TOP) / (BOT - TOP));
        return Math.pow(clamp(1 - Math.abs(x - 960) / hw), 1.2);
    }
    function fxOffer(ctx, t) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        motes(ctx, t, { n: 140, seed: 9, x0: 560, x1: 1360, y0: TOP, y1: BOT, rise: 9, color: [255, 214, 160], alpha: 0.7, light: offerLight });
        ctx.restore();
    }

    function bgEnd(ctx, t) {
        const hz = 548;
        const sky = ctx.createLinearGradient(0, TOP, 0, hz);
        sky.addColorStop(0, '#040507');
        sky.addColorStop(1, '#0e1015');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, hz);
        glow(ctx, 960, hz, 1000, [120, 130, 150], 0.12);
        const road = ctx.createLinearGradient(0, hz, 0, BOT);
        road.addColorStop(0, '#0d0e12');
        road.addColorStop(1, '#040405');
        ctx.fillStyle = road;
        ctx.beginPath();
        ctx.moveTo(900, hz);
        ctx.lineTo(1020, hz);
        ctx.lineTo(W + 700, BOT);
        ctx.lineTo(-700, BOT);
        ctx.fill();
        ctx.fillStyle = '#060608';
        ctx.beginPath();
        ctx.moveTo(0, hz);
        ctx.lineTo(900, hz);
        ctx.lineTo(-700, BOT);
        ctx.lineTo(0, BOT);
        ctx.moveTo(W, hz);
        ctx.lineTo(1020, hz);
        ctx.lineTo(W + 700, BOT);
        ctx.lineTo(W, BOT);
        ctx.fill();
        // vạch giữa đường (phối cảnh)
        ctx.fillStyle = 'rgba(220,220,210,0.16)';
        for (let i = 0; i < 12; i++) {
            const z0 = 1 + i * 1.1;
            const z1 = z0 + 0.55;
            const y0 = hz + 400 / z0;
            const y1 = hz + 400 / z1;
            const w0 = 26 / z0;
            const w1 = 26 / z1;
            ctx.beginPath();
            ctx.moveTo(960 - w0 / 2, y0);
            ctx.lineTo(960 + w0 / 2, y0);
            ctx.lineTo(960 + w1 / 2, y1);
            ctx.lineTo(960 - w1 / 2, y1);
            ctx.fill();
        }
        // đèn đường hai bên
        for (let i = 9; i >= 1; i--) {
            const z = 0.7 + i * 1.05;
            const s = 1 / z;
            for (const side of [-1, 1]) {
                const x = 960 + side * 1150 * s;
                const top = hz - 560 * s;
                ctx.strokeStyle = '#050506';
                ctx.lineWidth = Math.max(1, 9 * s);
                ctx.beginPath();
                ctx.moveTo(x, hz + 120 * s);
                ctx.lineTo(x, top);
                ctx.lineTo(x - side * 90 * s, top - 6 * s);
                ctx.stroke();
                const fl = 0.85 + 0.15 * vnoise(t * 5 + i * 3 + side);
                glow(ctx, x - side * 90 * s, top, 260 * s, [255, 184, 104], 0.55 * fl);
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                streak(ctx, x - side * 90 * s, hz + 124 * s, 80 * s, 640 * s, [255, 170, 90], 0.24 * fl);
                ctx.restore();
            }
        }
        smoke(ctx, t, { n: 9, seed: 101, x0: 0, x1: W, y0: hz - 110, y1: hz + 110, vx: 10, size: 1500, sprite: smokeCool, alpha: 0.2, squash: 0.35 });
        const p = rearPose(t);
        glow(ctx, 960, p.y + 400 * p.s, 900 * p.s, [255, 40, 30], 0.2);
    }
    function fxEnd(ctx, t) {
        const p = rearPose(t);
        const ly = p.y + 400 * p.s;
        rain(ctx, t, {
            count: 600,
            slant: 0.06,
            alpha: 0.8,
            lightColor: [255, 90, 80],
            light: (x, y) => 0.8 * Math.exp(-((x - 960) ** 2) / (2 * (520 * p.s) ** 2) - ((y - ly) ** 2) / (2 * (300 * p.s) ** 2)),
        });
        // sương mù phía trước
        smoke(ctx, t, { n: 6, seed: 131, x0: 0, x1: W, y0: 800, y1: 960, vx: 20, size: 1500, sprite: smokeCool, alpha: 0.12, squash: 0.3 });
    }

    const SCENES = [
        { a: 0, b: 0.35, c: 3.5, d: 4.0, bg: bgOpen, fx: fxOpen },
        { a: 3.9, b: 4.6, c: 11.75, d: 12.05, bg: bgNarr, fx: fxNarr },
        { a: 12.0, b: 12.05, c: 17.3, d: 17.42, bg: bgIgnition, fx: fxIgnition },
        { a: 17.42, b: 17.5, c: 21.0, d: 21.5, bg: bgTitle, fx: fxTitle },
        { a: 21.4, b: 21.9, c: 35.6, d: 36.0, bg: bgRoad, fx: fxRoad },
        { a: 36.0, b: 36.5, c: 43.1, d: 43.5, bg: bgOffer, fx: fxOffer },
        { a: 43.45, b: 44.3, c: 50.8, d: 51.9, bg: bgEnd, fx: fxEnd },
    ];
    function sceneAt(t) {
        let best = null;
        let ba = 0;
        for (const s of SCENES) {
            const a = env(t, s.a, s.b, s.c, s.d, ease.ioS, ease.ioS);
            if (a > ba) {
                ba = a;
                best = s;
            }
        }
        return { scene: best, a: ba };
    }

    // ---------- Xe ----------
    function place(el, p, op) {
        el.style.visibility = op > 0.002 ? 'visible' : 'hidden';
        el.style.opacity = op.toFixed(3);
        el.style.transform = `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) scale(${p.s.toFixed(4)})`;
    }

    function setDash(el, k) {
        const L = el._len || (el._len = el.getTotalLength());
        el.style.strokeDasharray = `${L} ${L}`;
        el.style.strokeDashoffset = (L * (1 - k)).toFixed(2);
        el.style.visibility = k > 0.001 ? 'visible' : 'hidden';
    }

    function updateCars(t) {
        // Góc ngang: bóng xe trong ánh chớp (cảnh 1) và chạy trên phố (cảnh 5)
        const aOpen = env(t, 0, 0.35, 3.5, 4.0);
        const aRoad = env(t, 21.4, 21.9, 35.6, 36.0);
        if (aOpen > 0) {
            const f = lightning(t);
            place(carSide, { x: 510, y: 846 - 340 * 0.9, s: 0.9 }, aOpen);
            carSide.style.filter = 'brightness(0.32)';
            sideLights.style.opacity = 0;
            sideRim.style.opacity = (0.15 + 0.85 * f).toFixed(3);
            sheen.forEach((s) => (s.rect.style.opacity = 0));
            spokes.setAttribute('transform', 'rotate(0)');
        } else if (aRoad > 0) {
            const p = sidePose(t);
            place(carSide, p, aRoad);
            carSide.style.filter = 'none';
            sideLights.style.opacity = 1;
            sideRim.style.opacity = 0.6;
            spokes.setAttribute('transform', `rotate(${((t * 520) % 360).toFixed(2)})`);
            const lamps = roadLamps(t)
                .map((hx) => ({ hx, d: Math.abs(hx - (p.x + 500 * p.s)) }))
                .sort((a, b) => a.d - b.d);
            sheen.forEach((s, i) => {
                const l = lamps[i];
                // đổi sang toạ độ bên trong #side-shell (scale 0.92 quanh x=500)
                const cx = 500 + ((l.hx - p.x) / p.s - 500) / 0.92;
                s.grad.setAttribute('x1', (cx - 150).toFixed(1));
                s.grad.setAttribute('x2', (cx + 150).toFixed(1));
                s.rect.style.opacity = clamp(1 - l.d / 900).toFixed(3);
            });
        } else {
            place(carSide, { x: 0, y: 0, s: 1 }, 0);
        }

        // Góc trước: bật đèn
        const aIgn = env(t, 12.0, 12.05, 17.3, 17.42);
        if (aIgn > 0) {
            const s = ledState(t);
            place(carFront, frontPose(t), aIgn);
            front.car.style.opacity = (0.3 + 0.7 * s.L).toFixed(3);
            front.rim.style.opacity = (0.12 + 0.8 * s.L).toFixed(3);
            front.ledL.forEach((el) => setDash(el, s.pL));
            front.ledR.forEach((el) => setDash(el, s.pR));
            front.bar.forEach((el) => {
                el.style.transformOrigin = '500px 454px';
                el.style.transform = `scaleX(${s.pB.toFixed(4)})`;
                el.style.visibility = s.pB > 0.001 ? 'visible' : 'hidden';
            });
            const shimmer = 0.94 + 0.06 * vnoise(t * 11);
            front.bloomL.style.opacity = clamp(s.pL * (0.62 + 0.5 * s.spike) * shimmer).toFixed(3);
            front.bloomR.style.opacity = clamp(s.pR * (0.62 + 0.5 * s.spike) * shimmer).toFixed(3);
            front.flare.style.opacity = clamp((0.4 * s.L + 0.6 * s.spike * Math.max(s.pL, s.pR)) * shimmer).toFixed(3);
            front.flare2.style.opacity = (0.25 * s.L).toFixed(3);
            front.spill.style.opacity = s.L.toFixed(3);
            front.wet[0].style.opacity = (0.8 * s.pL).toFixed(3);
            front.wet[1].style.opacity = (0.8 * s.pR).toFixed(3);
            front.wetC.style.opacity = (0.5 * s.pB).toFixed(3);
        } else {
            place(carFront, { x: 0, y: 0, s: 1 }, 0);
        }

        // Góc sau: rời đi trong sương
        const aEnd = env(t, 43.45, 44.3, 50.8, 51.9);
        if (aEnd > 0) {
            place(carRear, rearPose(t), aEnd);
            const brake = t > C.slogan ? Math.exp(-(t - C.slogan) / 0.35) : 0;
            rearLights.style.opacity = clamp(0.78 + 0.22 * brake + 0.04 * vnoise(t * 9)).toFixed(3);
        } else {
            place(carRear, { x: 0, y: 0, s: 1 }, 0);
        }
    }

    // ---------- Chữ ----------
    function hide(el) {
        el.style.visibility = 'hidden';
        el.style.opacity = 0;
    }

    function line(el, t, a, b, c, d, y = 0) {
        const k = env(t, a, b, c, d);
        if (k <= 0.002) return hide(el);
        const pin = ease.outC(P(t, a, b));
        const pout = ease.ioS(P(t, c, d));
        const blur = (1 - pin) * 16 + pout * 12;
        const dy = (1 - pin) * 22 - pout * 14;
        const sc = 1 + 0.04 * P(t, a, d);
        el.style.visibility = 'visible';
        el.style.opacity = k.toFixed(3);
        el.style.filter = blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : 'none';
        el.style.letterSpacing = `${((1 - pin) * 0.06).toFixed(3)}em`;
        el.style.transform = `translate(-50%, -50%) translateY(${(y + dy).toFixed(1)}px) scale(${sc.toFixed(4)})`;
    }

    function updateLoc(t) {
        const k = env(t, 0.4, 0.5, 3.4, 3.9);
        ui.loc.style.opacity = k.toFixed(3);
        if (k <= 0) return;
        const n1 = clamp(Math.floor((t - C.loc1.start) / C.loc1.step) + 1, 0, C.loc1.text.length);
        const n2 = clamp(Math.floor((t - C.loc2.start) / C.loc2.step) + 1, 0, C.loc2.text.length);
        const typing = (n1 > 0 && n1 < C.loc1.text.length) || (n2 > 0 && n2 < C.loc2.text.length);
        const caretOn = typing || Math.floor(t * 2.4) % 2 === 0;
        const caret = `<i id="caret" style="opacity:${caretOn ? 1 : 0}"></i>`;
        const html = `<span>${C.loc1.text.slice(0, n1)}</span>${n2 === 0 ? caret : ''}<br><span id="loc2">${C.loc2.text.slice(0, n2)}</span>${n2 > 0 ? caret : ''}`;
        if (ui.loc._html !== html) {
            ui.loc.innerHTML = html;
            ui.loc._html = html;
        }
    }

    function updateTitle(t) {
        const T0 = C.titleHit;
        const k = env(t, T0 - 0.02, T0 + 0.04, 21.0, 21.5);
        if (k <= 0.002) return hide(ui.title);
        const out = ease.ioS(P(t, 21.0, 21.5));
        ui.title.style.visibility = 'visible';
        ui.title.style.opacity = k.toFixed(3);
        ui.title.style.filter = out > 0.01 ? `blur(${(out * 14).toFixed(1)}px)` : 'none';
        ui.title.style.transform = `translate(-50%, -50%) scale(${(1 + 0.045 * P(t, T0, 21.5)).toFixed(4)})`;
        ui.tBrand.style.opacity = ease.outC(P(t, T0 + 0.35, T0 + 1.0)).toFixed(3);
        const pm = ease.outE(P(t, T0, T0 + 0.9));
        ui.tModel.style.transform = `scale(${lerp(1.22, 1, pm).toFixed(4)})`;
        ui.tModel.style.filter = pm < 0.99 ? `blur(${((1 - pm) * 20).toFixed(1)}px)` : 'none';
        ui.tModel.style.opacity = clamp(pm * 1.4).toFixed(3);
        ui.tModel.style.backgroundPosition = `${lerp(100, 0, ease.ioS(P(t, T0 + 0.5, T0 + 2.6))).toFixed(1)}% 0`;
        ui.tRule.style.width = `${(560 * ease.ioC(P(t, T0 + 0.5, T0 + 1.4))).toFixed(1)}px`;
        const ps = ease.outC(P(t, T0 + 1.0, T0 + 1.8));
        ui.tSub.style.opacity = ps.toFixed(3);
        ui.tSub.style.letterSpacing = `${lerp(1.0, 0.62, ps).toFixed(3)}em`;
    }

    function updateDossier(el, t, tin, tstamp, tout) {
        const pin = ease.outC(P(t, tin, tin + 0.5));
        const pout = ease.inC(P(t, tout, tout + 0.38));
        const k = pin * (1 - pout);
        if (k <= 0.002) return hide(el);
        let jy = 0;
        let js = 1;
        if (t >= tstamp) {
            const dt = t - tstamp;
            const e = Math.exp(-dt * 16);
            jy = Math.sin(dt * 70) * 7 * e;
            js = 1 - 0.018 * e;
        }
        const x = (1 - pin) * 170 - pout * 130;
        const rot = lerp(7, -2.2, pin) - pout * 5;
        el.style.visibility = 'visible';
        el.style.opacity = k.toFixed(3);
        el.style.transform = `translate(${x.toFixed(1)}px, -50%) translateY(${jy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${js.toFixed(4)})`;
        const st = el._stamp || (el._stamp = el.querySelector('.stamp'));
        const ps = P(t, tstamp, tstamp + 0.11);
        st.style.opacity = (ps * 0.9).toFixed(3);
        st.style.transform = `rotate(-14deg) scale(${lerp(2.6, 1, ease.inC(ps)).toFixed(4)})`;
    }

    function updatePrice(t) {
        const T = C.priceHit;
        const k = env(t, T - 0.2, T, 43.1, 43.5);
        if (k <= 0.002) return hide(ui.price);
        ui.price.style.visibility = 'visible';
        ui.price.style.opacity = k.toFixed(3);
        const dt = t - T;
        const amp = dt > 0 ? 16 * Math.exp(-dt * 9) : 0;
        const sx = (vnoise(dt * 45) - 0.5) * 2 * amp;
        const sy = (vnoise(dt * 45 + 50) - 0.5) * 2 * amp;
        ui.price.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${(1 + 0.035 * P(t, T, 43.5)).toFixed(4)})`;
        ui.pFrom.style.opacity = ease.outC(P(t, T - 0.2, T + 0.25)).toFixed(3);
        const pa = P(t, T, T + 0.15);
        ui.pAmount.style.opacity = clamp(pa * 1.6).toFixed(3);
        ui.pAmount.style.transform = `scale(${lerp(1.9, 1, ease.inC(pa)).toFixed(4)})`;
        ui.pGold.style.backgroundPosition = `${lerp(100, 0, ease.ioS(P(t, T + 0.3, T + 2.2))).toFixed(1)}% 0`;
        ui.pVar.style.opacity = ease.outC(P(t, T + 0.7, T + 1.3)).toFixed(3);
    }

    function updateEnd(t) {
        const k = env(t, C.endLogo, C.endLogo + 0.9, 50.8, 51.6);
        if (k <= 0.002) {
            hide(ui.end);
        } else {
            ui.end.style.visibility = 'visible';
            ui.end.style.opacity = k.toFixed(3);
            ui.end.style.transform = 'translateX(-50%)';
            const pm = ease.outC(P(t, C.endLogo, C.endLogo + 1.0));
            ui.eBrand.style.opacity = pm.toFixed(3);
            ui.eModel.style.opacity = pm.toFixed(3);
            ui.eModel.style.filter = pm < 0.99 ? `blur(${((1 - pm) * 12).toFixed(1)}px)` : 'none';
            ui.eModel.style.backgroundPosition = `${lerp(100, 0, ease.ioS(P(t, C.endLogo + 0.4, C.endLogo + 2.6))).toFixed(1)}% 0`;
            const ps = ease.outC(P(t, C.slogan, C.slogan + 0.9));
            ui.eSlogan.style.opacity = ps.toFixed(3);
            ui.eSlogan.style.letterSpacing = `${lerp(0.55, 0.18, ps).toFixed(3)}em`;
            ui.eSlogan.style.paddingLeft = `${lerp(0.55, 0.18, ps).toFixed(3)}em`;
        }
        const kc = ease.outC(P(t, C.cta, C.cta + 0.7)) * (1 - P(t, 50.8, 51.6));
        ui.cta.style.opacity = kc.toFixed(3);
        ui.disclaimer.style.opacity = (kc * 0.9).toFixed(3);
    }

    function updateTexts(t) {
        updateLoc(t);
        line(ui.l1, t, C.l1, C.l1 + 0.8, C.l2 - 0.65, C.l2 - 0.1);
        line(ui.l2, t, C.l2, C.l2 + 0.7, C.l3a - 0.55, C.l3a - 0.1);
        line(ui.l3a, t, C.l3a, C.l3a + 0.7, C.narrOut, C.narrOut + 0.45, -44);
        line(ui.l3b, t, C.l3b, C.l3b + 0.6, C.narrOut, C.narrOut + 0.45, 46);
        updateTitle(t);
        const [s1, s2, s3] = C.stamps;
        updateDossier(ui.dossiers[0], t, s1 - 1.3, s1, s2 - 1.5);
        updateDossier(ui.dossiers[1], t, s2 - 1.2, s2, s3 - 1.5);
        updateDossier(ui.dossiers[2], t, s3 - 1.2, s3, 35.4);
        line(ui.o1, t, C.offer1, C.offer1 + 0.8, 40.0, 40.4, -150);
        line(ui.o2, t, C.offer2, C.offer2 + 0.7, 40.0, 40.4, -62);
        updatePrice(t);
        updateEnd(t);
    }

    // ---------- Lớp phủ ----------
    function updateOverlays(t) {
        let f = 0;
        let color = '#ffffff';
        if (t < 4) f = lightning(t) * 0.16;
        for (const t0 of [C.ledL, C.ledR]) if (t >= t0) f = Math.max(f, 0.12 * Math.exp(-(t - t0) / 0.08));
        if (t >= C.titleHit) f = Math.max(f, 0.55 * Math.exp(-(t - C.titleHit) / 0.09));
        for (const s of C.stamps) if (t >= s) f = Math.max(f, 0.06 * Math.exp(-(t - s) / 0.06));
        if (t >= C.priceHit && t < C.priceHit + 1) {
            const v = 0.4 * Math.exp(-(t - C.priceHit) / 0.1);
            if (v > f) {
                f = v;
                color = '#ffe3a6';
            }
        }
        ui.flash.style.opacity = f.toFixed(3);
        ui.flash.style.background = color;
        ui.vignette.style.opacity = (0.9 + 0.1 * vnoise(t * 3)).toFixed(3);
    }

    function drawGrain(t) {
        grain.clearRect(0, 0, W, H);
        const fade = 1 - P(t, 51.2, DUR);
        if (fade <= 0) return;
        const f = Math.floor(t * 24);
        const tile = grainTiles[f % grainTiles.length];
        // hạt phóng to x2 cho mềm như phim nhựa (và để video nén gọn hơn)
        const ox = -Math.floor(hash(f + 0.5) * 512);
        const oy = -Math.floor(hash(f + 9.5) * 512);
        grain.globalAlpha = fade;
        grain.imageSmoothingEnabled = true;
        for (let y = oy; y < H; y += 512) for (let x = ox; x < W; x += 512) grain.drawImage(tile, x, y, 512, 512);
        grain.globalAlpha = 1;
    }

    // ---------- Khung hình ----------
    function render(t) {
        t = clamp(t, 0, DUR);
        const { scene, a } = sceneAt(t);
        bg.globalAlpha = 1;
        bg.globalCompositeOperation = 'source-over';
        bg.fillStyle = '#000';
        bg.fillRect(0, 0, W, H);
        fx.clearRect(0, 0, W, H);
        if (scene) {
            scene.bg(bg, t);
            scene.fx(fx, t);
            if (a < 1) {
                bg.fillStyle = `rgba(0,0,0,${(1 - a).toFixed(3)})`;
                bg.fillRect(0, 0, W, H);
                fx.save();
                fx.globalCompositeOperation = 'destination-out';
                fx.fillStyle = `rgba(0,0,0,${(1 - a).toFixed(3)})`;
                fx.fillRect(0, 0, W, H);
                fx.restore();
            }
        }
        updateCars(t);
        updateTexts(t);
        updateOverlays(t);
        drawGrain(t);
    }

    // ---------- Khởi tạo ----------
    async function loadFonts() {
        const sample = 'ĐÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ đàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ Ab…';
        const faces = [
            'italic 400 68px "Playfair Display"',
            '700 44px "Playfair Display"',
            '900 200px "Playfair Display"',
            '300 30px "Oswald"',
            '500 30px "Oswald"',
            '700 30px "Oswald"',
            '400 20px "IBM Plex Mono"',
            '600 20px "IBM Plex Mono"',
        ];
        try {
            await Promise.all(faces.map((f) => document.fonts.load(f, sample)));
            await document.fonts.ready;
        } catch (e) {
            console.warn('Font load issue', e);
        }
    }

    function fit() {
        const s = Math.min(window.innerWidth / W, window.innerHeight / H);
        const x = (window.innerWidth - W * s) / 2;
        const y = (window.innerHeight - H * s) / 2;
        stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    }

    async function init() {
        skyline = makeSkyline();
        smokeCool = makeSmoke(1, [150, 162, 185]);
        smokeWarm = makeSmoke(2, [255, 200, 140]);
        smokeGold = makeSmoke(3, [200, 160, 90]);
        grainTiles = makeGrain();
        bolt = makeBolt();
        await loadFonts();
        fit();
        window.addEventListener('resize', fit);
        render(0);
    }

    // ---------- Trình phát (xem trực tiếp) ----------
    // Dùng file nhạc đã dựng sẵn (soundtrack.m4a, do render/export.cjs tạo).
    // Nếu thiếu file, tự tổng hợp lại bằng Web Audio (chậm hơn, ~vài chục giây).
    function setupPlayer() {
        const btn = $('play-btn');
        const splash = $('splash');
        const toggle = $('toggle');
        const scrub = $('scrub');
        const clockEl = $('clock');
        const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
        let audioEl = null;
        let audioBuf = null;
        let actx = null;
        let src = null;
        let playing = false;
        let startAt = 0;
        let startPerf = 0;
        let pos = 0;

        const now = () => {
            if (!playing) return pos;
            if (audioEl) return audioEl.currentTime;
            if (audioBuf) return actx.currentTime - startAt;
            return (performance.now() - startPerf) / 1000 + pos;
        };

        function play(from) {
            pos = from >= DUR ? 0 : from;
            if (audioEl) {
                audioEl.currentTime = pos;
                audioEl.play().catch(() => {
                    audioEl = null;
                    startPerf = performance.now();
                });
            } else if (audioBuf) {
                actx = actx || new AudioContext();
                actx.resume();
                src = actx.createBufferSource();
                src.buffer = audioBuf;
                src.connect(actx.destination);
                startAt = actx.currentTime - pos;
                src.start(0, pos);
            } else {
                startPerf = performance.now();
            }
            playing = true;
            toggle.textContent = '❚❚';
            requestAnimationFrame(loop);
        }
        function pause() {
            pos = Math.min(now(), DUR);
            playing = false;
            if (audioEl) audioEl.pause();
            if (src) {
                src.stop();
                src = null;
            }
            toggle.textContent = '▶';
        }
        function loop() {
            if (!playing) return;
            const t = now();
            render(t);
            scrub.value = t;
            clockEl.textContent = `${fmt(t)} / ${fmt(DUR)}`;
            if (t >= DUR - 0.02 || (audioEl && audioEl.ended)) {
                pause();
                pos = DUR;
                return;
            }
            requestAnimationFrame(loop);
        }
        function ready() {
            btn.disabled = false;
            btn.textContent = '▶  XEM PHIM';
        }

        btn.addEventListener('click', () => {
            splash.classList.add('hidden');
            play(0);
        });
        toggle.addEventListener('click', () => (playing ? pause() : play(pos)));
        scrub.addEventListener('input', () => {
            if (playing) pause();
            pos = parseFloat(scrub.value);
            render(pos);
            clockEl.textContent = `${fmt(pos)} / ${fmt(DUR)}`;
        });
        $('full').addEventListener('click', () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen().catch(() => {});
        });
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && splash.classList.contains('hidden')) {
                e.preventDefault();
                playing ? pause() : play(pos);
            }
        });
        let hideTimer;
        document.addEventListener('mousemove', () => {
            document.body.classList.add('show-controls');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => document.body.classList.remove('show-controls'), 2200);
        });

        const el = new Audio();
        el.preload = 'auto';
        el.addEventListener('canplaythrough', () => {
            audioEl = el;
            ready();
        }, { once: true });
        el.addEventListener('error', () => {
            window.Soundtrack.renderBuffer(44100)
                .then((b) => (audioBuf = b))
                .catch((e) => console.warn('Không dựng được âm thanh:', e))
                .finally(ready);
        }, { once: true });
        el.src = 'soundtrack.m4a';
    }

    // ---------- API cho bộ xuất video (render/export.cjs) ----------
    window.__ad = {
        duration: DUR,
        fps: FPS,
        ready: false,
        seek(t) {
            render(t);
        },
        async audioWavBase64() {
            const buf = await window.Soundtrack.renderBuffer(48000);
            const bytes = new Uint8Array(window.Soundtrack.toWav(buf));
            let s = '';
            for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
            return btoa(s);
        },
    };

    init().then(() => {
        window.__ad.ready = true;
        if (!RENDER) setupPlayer();
    });
})();
