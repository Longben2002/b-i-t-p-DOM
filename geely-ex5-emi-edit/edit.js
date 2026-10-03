// Bộ dựng video dọc 9:16 từ ảnh tĩnh: Ken Burns, rung tay máy, chuyển cảnh có motion blur,
// nháy theo nhịp, chỉnh màu, chữ động. Mọi khung hình tính từ t (giây) => xuất từng frame chính xác.
(function () {
    'use strict';

    const E = window.EDIT;
    const W = 1080;
    const H = 1920;
    const FPS = 30;
    const { BEAT, DUR, SHOTS, IMAGES, TEXT } = E;
    const RENDER = new URLSearchParams(location.search).has('render');
    if (RENDER) document.body.classList.add('render');

    // ---------- Toán ----------
    const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
    const lerp = (a, b, k) => a + (b - a) * k;
    const P = (t, a, b) => clamp((t - a) / (b - a));
    const outC = (x) => 1 - Math.pow(1 - x, 3);
    const inC = (x) => x * x * x;
    const outE = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
    function hash(n) {
        const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
        return x - Math.floor(x);
    }
    function vnoise(x) {
        const i = Math.floor(x);
        const f = x - i;
        return lerp(hash(i), hash(i + 1), f * f * (3 - 2 * f));
    }

    // ---------- DOM ----------
    const $ = (id) => document.getElementById(id);
    const stage = $('stage');
    const out = $('frame').getContext('2d');
    const grainCtx = $('grain').getContext('2d');
    const buf = document.createElement('canvas');
    buf.width = W;
    buf.height = H;
    const ctx = buf.getContext('2d');

    const imgs = {};
    let grainTiles = [];

    // ---------- Ảnh ----------
    function placeholder(key, label) {
        const c = document.createElement('canvas');
        c.width = 2400;
        c.height = 1600;
        const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 0, 1600);
        g.addColorStop(0, '#3a3f47');
        g.addColorStop(0.62, '#8d949e');
        g.addColorStop(0.63, '#d9dde2');
        g.addColorStop(1, '#f2f4f6');
        x.fillStyle = g;
        x.fillRect(0, 0, 2400, 1600);
        x.strokeStyle = 'rgba(255,255,255,0.18)';
        x.lineWidth = 3;
        for (let i = 0; i <= 2400; i += 120) {
            x.beginPath();
            x.moveTo(i, 0);
            x.lineTo(i, 1600);
            x.stroke();
        }
        for (let j = 0; j <= 1600; j += 120) {
            x.beginPath();
            x.moveTo(0, j);
            x.lineTo(2400, j);
            x.stroke();
        }
        x.fillStyle = 'rgba(20,22,26,0.85)';
        x.font = '700 120px Oswald, sans-serif';
        x.textAlign = 'center';
        x.fillText(label, 1200, 760);
        x.font = '400 60px Oswald, sans-serif';
        x.fillText(`thả ảnh vào: ${IMAGES[key].src}`, 1200, 860);
        return c;
    }

    function loadImage(key) {
        return new Promise((resolve) => {
            const im = new Image();
            im.onload = () => resolve({ img: im, w: im.naturalWidth, h: im.naturalHeight, real: true });
            im.onerror = () => {
                const c = placeholder(key, IMAGES[key].label);
                resolve({ img: c, w: c.width, h: c.height, real: false });
            };
            im.src = IMAGES[key].src;
        });
    }

    // Nền mờ (khi khung nhìn rộng hơn ảnh): bản thu nhỏ, làm mờ sẵn
    function makeBg(im) {
        const a = document.createElement('canvas');
        a.width = 108;
        a.height = 192;
        const x = a.getContext('2d');
        const s = Math.max(108 / im.w, 192 / im.h);
        x.drawImage(im.img, (108 - im.w * s) / 2, (192 - im.h * s) / 2, im.w * s, im.h * s);
        const b = document.createElement('canvas');
        b.width = 108;
        b.height = 192;
        const y = b.getContext('2d');
        y.filter = 'blur(7px)';
        y.drawImage(a, -10, -10, 128, 212);
        return b;
    }

    function makeGrain() {
        const tiles = [];
        let seed = 7;
        const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
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
                img.data[i + 3] = Math.round(a * a * 26);
            }
            x.putImageData(img, 0, 0);
            tiles.push(c);
        }
        return tiles;
    }

    // ---------- Cảnh ----------
    const shotT = (s) => [s.b[0] * BEAT, s.b[1] * BEAT];
    function shotAt(t) {
        for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].b[0] * BEAT) return i;
        return 0;
    }
    function viewAt(s, u) {
        // "speed ramp": vào cảnh nhanh rồi chậm dần
        const k = 0.6 * outC(u) + 0.4 * u;
        const a = s.from;
        const b = s.to;
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), r: lerp(a.r || 0, b.r || 0, k) };
    }

    const TIN = 0.16; // thời lượng hiệu ứng vào cảnh
    const TOUT = 0.12; // thời lượng hiệu ứng ra cảnh

    function effects(i, t) {
        const s = SHOTS[i];
        const [t0, t1] = shotT(s);
        const fx = { dx: 0, dy: 0, sc: 1, rot: 0, blur: null, flash: 0, fade: 1 };
        const add = (type, amt) => {
            if (!fx.blur || fx.blur.amt < amt) fx.blur = { type, amt };
        };
        // vào cảnh
        const di = t - t0;
        const kin = 1 - outC(clamp(di / TIN));
        switch (s.tin) {
            case 'zoom':
                fx.sc *= 1 + 0.4 * kin;
                add('zoom', 0.22 * kin);
                fx.flash = Math.max(fx.flash, 0.35 * Math.exp(-di / 0.05));
                break;
            case 'whip':
                fx.dx += (s.dir || 1) * W * 0.8 * kin;
                add('motion', W * 0.35 * kin);
                break;
            case 'spin':
                fx.rot += (s.dir || 1) * 32 * kin;
                fx.sc *= 1 + 0.15 * kin;
                add('spin', 16 * kin);
                break;
            case 'flash':
                fx.flash = Math.max(fx.flash, 0.9 * Math.exp(-di / 0.07));
                fx.sc *= 1 + 0.05 * Math.exp(-di / 0.1);
                break;
            case 'cut':
                fx.sc *= 1 + 0.06 * Math.exp(-di / 0.07);
                break;
            case 'fade':
                fx.fade = outC(P(t, 0, 0.6));
                break;
        }
        // ra cảnh (theo kiểu vào của cảnh kế tiếp)
        const nx = SHOTS[i + 1];
        if (nx) {
            const kout = inC(clamp(1 - (t1 - t) / TOUT));
            switch (nx.tin) {
                case 'zoom':
                    fx.sc *= 1 + 0.45 * kout;
                    add('zoom', 0.25 * kout);
                    break;
                case 'whip':
                    fx.dx -= (nx.dir || 1) * W * 0.8 * kout;
                    add('motion', W * 0.35 * kout);
                    break;
                case 'spin':
                    fx.rot -= (nx.dir || 1) * 32 * kout;
                    add('spin', 16 * kout);
                    break;
            }
        }
        // rung tay máy
        const amp = s.end ? 4 : 10;
        fx.dx += (vnoise(t * 1.4) - 0.5) * 2 * amp;
        fx.dy += (vnoise(t * 1.2 + 17) - 0.5) * 2 * amp;
        fx.rot += (vnoise(t * 0.9 + 33) - 0.5) * 0.7;
        // nhịp đập theo phách khi beat đầy đủ (ô 1–5 và 7–8)
        const bt = t / BEAT;
        const bar = Math.floor(bt / 4);
        if ((bar >= 1 && bar <= 5) || bar >= 7) {
            const ph = (bt % 1) * BEAT;
            fx.sc *= 1 + 0.012 * Math.exp(-ph / 0.08);
        }
        if (s.end) fx.dy -= 330;
        return fx;
    }

    function drawShot(i, t) {
        const s = SHOTS[i];
        const im = imgs[s.img];
        const [t0, t1] = shotT(s);
        const v = viewAt(s, P(t, t0, t1));
        const fx = effects(i, t);
        const scale = (W / (v.w * im.w)) * fx.sc;

        // nền mờ
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.drawImage(im.bg, -60 + fx.dx * 0.3, -100 + fx.dy * 0.3, W + 120, H + 200);
        ctx.fillStyle = `rgba(6,8,12,${s.end ? 0.72 : 0.45})`;
        ctx.fillRect(0, 0, W, H);

        // ảnh chính (+ nhiều bản chồng để tạo motion blur)
        const n = fx.blur && fx.blur.amt > 0.002 ? 10 : 1;
        for (let k = 0; k < n; k++) {
            const o = n === 1 ? 0 : k / (n - 1) - 0.5;
            let dx = fx.dx;
            let sc = scale;
            let rot = v.r + fx.rot;
            if (n > 1) {
                if (fx.blur.type === 'motion') dx += o * fx.blur.amt;
                else if (fx.blur.type === 'zoom') sc *= 1 + o * fx.blur.amt;
                else if (fx.blur.type === 'spin') rot += o * fx.blur.amt;
            }
            ctx.globalAlpha = 1 / (k + 1);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(W / 2 + dx, H / 2 + fx.dy);
            ctx.rotate((rot * Math.PI) / 180);
            ctx.scale(sc, sc);
            ctx.translate(-v.x * im.w, -v.y * im.h);
            ctx.drawImage(im.img, 0, 0);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        return fx;
    }

    // ---------- Chữ ----------
    function hide(el) {
        el.style.opacity = 0;
        el.style.visibility = 'hidden';
    }
    function show(el, o, tr, filter) {
        el.style.visibility = 'visible';
        el.style.opacity = o.toFixed(3);
        if (tr !== undefined) el.style.transform = tr;
        el.style.filter = filter || 'none';
    }

    function updateTexts(t) {
        for (const st of TEXT.stats) {
            const el = $(st.id);
            const a = st.b[0] * BEAT;
            const b = st.b[1] * BEAT;
            if (t < a || t >= b) {
                hide(el);
                continue;
            }
            const pin = outE(P(t, a + 0.02, a + 0.22));
            const pout = inC(P(t, b - 0.14, b));
            const o = clamp(pin * 1.5) * (1 - pout);
            show(el, o, `translateX(${(-pout * 60).toFixed(1)}px) scale(${lerp(1.35, 1, pin).toFixed(4)})`, pin < 0.98 ? `blur(${((1 - pin) * 10).toFixed(1)}px)` : 'none');
        }

        const hero = $('hero');
        {
            const a = TEXT.hero.b[0] * BEAT;
            const b = TEXT.hero.b[1] * BEAT;
            if (t < a + 0.25 || t >= b) hide(hero);
            else {
                const p = outC(P(t, a + 0.25, a + 1.1));
                const pout = inC(P(t, b - 0.12, b));
                show(hero, p * (1 - pout), `translateX(-50%) scale(${lerp(1.08, 1, p).toFixed(4)})`, p < 0.98 ? `blur(${((1 - p) * 14).toFixed(1)}px)` : 'none');
                $('hero-model').style.letterSpacing = `${lerp(0.4, 0.02, p).toFixed(3)}em`;
            }
        }

        const end = $('end');
        const shade = $('endshade');
        const a = TEXT.end.b[0] * BEAT;
        if (t < a) {
            hide(end);
            hide(shade);
            hide($('disclaimer'));
            return;
        }
        const fadeOut = 1 - P(t, DUR - 0.5, DUR);
        show(shade, outC(P(t, a, a + 0.4)) * fadeOut);
        show(end, fadeOut, 'translateX(-50%)');
        const items = end.querySelectorAll('[data-at]');
        items.forEach((el) => {
            const at = a + Number(el.dataset.at) * BEAT;
            const p = outC(P(t, at, at + 0.45));
            el.style.opacity = p.toFixed(3);
            el.style.transform = `translateY(${((1 - p) * 30).toFixed(1)}px)`;
        });
        const gold = end.querySelector('.price .gold');
        gold.style.backgroundPosition = `${lerp(100, 0, P(t, a + 2 * BEAT, a + 6 * BEAT)).toFixed(1)}% 0`;
        show($('disclaimer'), outC(P(t, a + 3 * BEAT, a + 4 * BEAT)) * fadeOut * 0.85);
    }

    // ---------- Khung hình ----------
    function render(t) {
        t = clamp(t, 0, DUR);
        const i = shotAt(t);
        const fx = drawShot(i, t);

        // chỉnh màu: tương phản cao, bớt bão hoà, ám lạnh
        out.setTransform(1, 0, 0, 1, 0, 0);
        out.globalCompositeOperation = 'source-over';
        out.globalAlpha = 1;
        out.filter = 'contrast(1.1) saturate(0.82) brightness(1.03)';
        out.drawImage(buf, 0, 0);
        out.filter = 'none';
        out.globalCompositeOperation = 'soft-light';
        out.fillStyle = 'rgba(70,110,160,0.35)';
        out.fillRect(0, 0, W, H);
        out.globalCompositeOperation = 'source-over';
        const vg = out.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.5)');
        out.fillStyle = vg;
        out.fillRect(0, 0, W, H);

        const black = 1 - fx.fade + P(t, DUR - 0.5, DUR);
        if (black > 0) {
            out.fillStyle = `rgba(0,0,0,${clamp(black).toFixed(3)})`;
            out.fillRect(0, 0, W, H);
        }
        $('flash').style.opacity = clamp(fx.flash).toFixed(3);

        updateTexts(t);

        grainCtx.clearRect(0, 0, W, H);
        const f = Math.floor(t * 24);
        const tile = grainTiles[f % grainTiles.length];
        const ox = -Math.floor(hash(f + 0.5) * 384);
        const oy = -Math.floor(hash(f + 9.5) * 384);
        for (let y = oy; y < H; y += 384) for (let x = ox; x < W; x += 384) grainCtx.drawImage(tile, x, y, 384, 384);
    }

    // ---------- Khởi tạo ----------
    function fit() {
        const s = Math.min(window.innerWidth / W, window.innerHeight / H);
        stage.style.transform = `translate(${(window.innerWidth - W * s) / 2}px, ${(window.innerHeight - H * s) / 2}px) scale(${s})`;
    }

    async function init() {
        try {
            const sample = 'ĐÀÁẢÃẠĂÂÊÔƠƯđàáảãạăâêôơư Ab';
            await Promise.all(['300 30px Oswald', '500 30px Oswald', '700 30px Oswald', 'italic 400 40px "Playfair Display"', '900 40px "Playfair Display"'].map((f) => document.fonts.load(f, sample)));
        } catch (e) {
            console.warn(e);
        }
        const keys = Object.keys(IMAGES);
        const loaded = await Promise.all(keys.map(loadImage));
        keys.forEach((k, i) => {
            imgs[k] = loaded[i];
            imgs[k].bg = makeBg(loaded[i]);
        });
        grainTiles = makeGrain();
        fit();
        window.addEventListener('resize', fit);
        render(0);
        return keys.filter((k) => !imgs[k].real);
    }

    // ---------- Trình phát ----------
    function setupPlayer(missing) {
        const btn = $('play-btn');
        const splash = $('splash');
        const toggle = $('toggle');
        const scrub = $('scrub');
        const clockEl = $('clock');
        scrub.max = DUR.toFixed(2);
        if (missing.length) $('missing').textContent = `Chưa có ${missing.length} ảnh — đang dùng khung giữ chỗ.`;
        const fmt = (s) => `0:${String(Math.floor(s)).padStart(2, '0')}`;
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
            pos = from >= DUR - 0.05 ? 0 : from;
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
            } else startPerf = performance.now();
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
            if (t >= DUR - 0.02) {
                pause();
                pos = DUR;
                return;
            }
            requestAnimationFrame(loop);
        }
        const ready = () => {
            btn.disabled = false;
            btn.textContent = '▶  XEM';
        };
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
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && splash.classList.contains('hidden')) {
                e.preventDefault();
                playing ? pause() : play(pos);
            }
        });
        const el = new Audio();
        el.preload = 'auto';
        el.addEventListener('canplaythrough', () => {
            audioEl = el;
            ready();
        }, { once: true });
        el.addEventListener('error', () => {
            window.Beat.renderBuffer(44100)
                .then((b) => (audioBuf = b))
                .catch((e) => console.warn(e))
                .finally(ready);
        }, { once: true });
        el.src = 'beat.m4a';
    }

    // ---------- API cho bộ xuất ----------
    window.__ad = {
        duration: DUR,
        fps: FPS,
        width: W,
        height: H,
        ready: false,
        missing: [],
        seek: (t) => render(t),
        async audioWavBase64() {
            const b = await window.Beat.renderBuffer(48000);
            const bytes = new Uint8Array(window.Beat.toWav(b));
            let s = '';
            for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
            return btoa(s);
        },
    };

    init().then((missing) => {
        window.__ad.missing = missing;
        window.__ad.ready = true;
        if (!RENDER) setupPlayer(missing);
    });
})();
