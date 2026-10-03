// Nhạc nền + hiệu ứng âm thanh, tổng hợp hoàn toàn bằng Web Audio API.
// Giai điệu là sáng tác gốc (Rê thứ, mandolin tremolo kiểu phim mafia).
(function () {
    'use strict';

    const C = window.AD_CUES;

    // Tần số nốt
    const N = {
        G1: 49.0, A1: 55.0, Bb1: 58.27, D1: 36.71,
        D2: 73.42, F2: 87.31, G2: 98.0, A2: 110.0, Bb2: 116.54,
        C3: 130.81, D3: 146.83, F3: 174.61, G3: 196.0, A3: 220.0, Bb3: 233.08,
        Cs4: 277.18, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, Bb4: 466.16,
        C5: 523.25, Cs5: 554.37, D5: 587.33, E5: 659.26, F5: 698.46,
        B5: 987.77, E6: 1318.51,
    };

    function rng(seed) {
        return function () {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    class Score {
        constructor(ctx) {
            this.ctx = ctx;
            this.rand = rng(20260327);

            this.comp = ctx.createDynamicsCompressor();
            this.comp.threshold.value = -12;
            this.comp.knee.value = 10;
            this.comp.ratio.value = 3;
            this.comp.attack.value = 0.004;
            this.comp.release.value = 0.25;

            this.master = ctx.createGain();
            this.master.gain.value = 0.9;
            this.comp.connect(this.master).connect(ctx.destination);

            this.bus = ctx.createGain();
            this.bus.connect(this.comp);

            this.reverb = ctx.createConvolver();
            this.reverb.buffer = this.impulse(3.4, 2.6);
            const wet = ctx.createGain();
            wet.gain.value = 0.55;
            this.reverb.connect(wet).connect(this.comp);

            this.noise = this.noiseBuffer(4);
            this.shaper = this.curve(2.6);
        }

        noiseBuffer(seconds) {
            const ctx = this.ctx;
            const buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const d = buf.getChannelData(ch);
                for (let i = 0; i < d.length; i++) d[i] = this.rand() * 2 - 1;
            }
            return buf;
        }

        impulse(seconds, decay) {
            const ctx = this.ctx;
            const len = Math.floor(ctx.sampleRate * seconds);
            const buf = ctx.createBuffer(2, len, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const d = buf.getChannelData(ch);
                let lp = 0;
                for (let i = 0; i < len; i++) {
                    const k = i / len;
                    lp += (this.rand() * 2 - 1 - lp) * (0.55 - 0.4 * k);
                    d[i] = lp * Math.pow(1 - k, decay) * (i < 90 ? i / 90 : 1);
                }
            }
            return buf;
        }

        curve(k) {
            const n = 1024;
            const c = new Float32Array(n);
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * 2 - 1;
                c[i] = Math.tanh(k * x) / Math.tanh(k);
            }
            return c;
        }

        // Nối node vào bus khô + reverb
        out(node, dry = 1, wet = 0.2, pan = 0) {
            const ctx = this.ctx;
            let n = node;
            if (pan && ctx.createStereoPanner) {
                const p = ctx.createStereoPanner();
                p.pan.value = pan;
                n.connect(p);
                n = p;
            }
            if (dry) {
                const g = ctx.createGain();
                g.gain.value = dry;
                n.connect(g).connect(this.bus);
            }
            if (wet) {
                const g = ctx.createGain();
                g.gain.value = wet;
                n.connect(g).connect(this.reverb);
            }
        }

        osc(type, freq, t0, t1, detune = 0) {
            const o = this.ctx.createOscillator();
            o.type = type;
            o.frequency.value = freq;
            o.detune.value = detune;
            o.start(t0);
            o.stop(t1);
            return o;
        }

        noiseSrc(t0, t1) {
            const s = this.ctx.createBufferSource();
            s.buffer = this.noise;
            s.loop = true;
            s.start(t0, this.rand() * 3);
            s.stop(t1);
            return s;
        }

        filter(type, freq, q = 0.7) {
            const f = this.ctx.createBiquadFilter();
            f.type = type;
            f.frequency.value = freq;
            f.Q.value = q;
            return f;
        }

        gain(v = 0) {
            const g = this.ctx.createGain();
            g.gain.value = v;
            return g;
        }

        // Đường bao: danh sách [thời gian, giá trị] nội suy tuyến tính
        automate(param, points) {
            param.setValueAtTime(points[0][1], points[0][0]);
            for (let i = 1; i < points.length; i++) param.linearRampToValueAtTime(points[i][1], points[i][0]);
        }

        // ---------- Nhạc cụ / hiệu ứng ----------

        rain(points) {
            const end = C.duration;
            const src = this.noiseSrc(0, end);
            const hp = this.filter('highpass', 900);
            const lp = this.filter('lowpass', 7500);
            const g = this.gain();
            this.automate(g.gain, points);
            src.connect(hp).connect(lp).connect(g);
            this.out(g, 1, 0.12);

            // tiếng mưa rơi lộp độp (dải trung)
            const src2 = this.noiseSrc(0, end);
            const bp = this.filter('bandpass', 2400, 0.9);
            const g2 = this.gain();
            this.automate(g2.gain, points.map(([t, v]) => [t, v * 0.6]));
            const lfo = this.osc('sine', 0.23, 0, end);
            const lg = this.gain(500);
            lfo.connect(lg).connect(bp.frequency);
            src2.connect(bp).connect(g2);
            this.out(g2, 1, 0.2, 0.2);
        }

        rumble(points) {
            const src = this.noiseSrc(0, C.duration);
            const lp = this.filter('lowpass', 140);
            const g = this.gain();
            this.automate(g.gain, points);
            src.connect(lp).connect(g);
            this.out(g, 1, 0);
        }

        thunder(t) {
            const crack = this.noiseSrc(t, t + 1);
            const hp = this.filter('highpass', 1200);
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.55, t + 0.012);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
            crack.connect(hp).connect(g);
            this.out(g, 0.7, 0.6, -0.3);

            const rum = this.noiseSrc(t, t + 6.5);
            const lp1 = this.filter('lowpass', 220, 0.9);
            const lp2 = this.filter('lowpass', 140, 0.7);
            const g2 = this.gain();
            g2.gain.setValueAtTime(0, t);
            g2.gain.linearRampToValueAtTime(1.6, t + 0.2);
            g2.gain.setTargetAtTime(0.7, t + 0.5, 0.3);
            g2.gain.linearRampToValueAtTime(1.3, t + 1.4);
            g2.gain.setTargetAtTime(0.0001, t + 1.6, 1.1);
            rum.connect(lp1).connect(lp2).connect(g2);
            this.out(g2, 1, 0.4, -0.2);
        }

        click(t, level = 0.4) {
            const s = this.noiseSrc(t, t + 0.08);
            const bp = this.filter('bandpass', 2600 + this.rand() * 900, 1.3);
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(level, t + 0.001);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
            s.connect(bp).connect(g);
            this.out(g, 1, 0.15, -0.4);

            const o = this.osc('sine', 170, t, t + 0.06);
            const g2 = this.gain();
            g2.gain.setValueAtTime(level * 0.35, t);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            o.connect(g2);
            this.out(g2, 1, 0, -0.4);
        }

        tick(t, level = 0.06, high = true) {
            const s = this.noiseSrc(t, t + 0.06);
            const bp = this.filter('bandpass', high ? 5200 : 3300, 5);
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(level, t + 0.001);
            g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03);
            s.connect(bp).connect(g);
            this.out(g, 1, 0.35, high ? 0.25 : -0.25);
        }

        drone(t0, t1, freqs, level, cut0 = 180, cut1 = 600) {
            const lp = this.filter('lowpass', cut0, 1.2);
            lp.frequency.setValueAtTime(cut0, t0);
            lp.frequency.linearRampToValueAtTime(cut1, t1);
            const lfo = this.osc('sine', 0.17, t0, t1);
            const lg = this.gain(cut0 * 0.25);
            lfo.connect(lg).connect(lp.frequency);
            const g = this.gain();
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(level, t0 + 2.0);
            g.gain.setValueAtTime(level, t1 - 0.06);
            g.gain.linearRampToValueAtTime(0, t1);
            for (const f of freqs) {
                this.osc('sawtooth', f, t0, t1, -6).connect(lp);
                this.osc('sawtooth', f, t0, t1, 6).connect(lp);
            }
            lp.connect(g);
            this.out(g, 1, 0.3);
        }

        braam(t, notes, dur, level) {
            const ws = this.ctx.createWaveShaper();
            ws.curve = this.shaper;
            const lp = this.filter('lowpass', 120, 2);
            lp.frequency.setValueAtTime(120, t);
            lp.frequency.exponentialRampToValueAtTime(2400, t + 0.09);
            lp.frequency.exponentialRampToValueAtTime(260, t + dur);
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(level, t + 0.03);
            g.gain.setTargetAtTime(level * 0.55, t + 0.15, 0.5);
            g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
            const pre = this.gain(0.32);
            for (const f of notes) {
                for (const d of [-9, 0, 9]) this.osc('sawtooth', f, t, t + dur + 0.05, d).connect(pre);
            }
            pre.connect(ws).connect(lp).connect(g);
            this.out(g, 1, 0.45);
        }

        boom(t, level = 1, dur = 2.4) {
            const o = this.osc('sine', 110, t, t + dur);
            o.frequency.setValueAtTime(115, t);
            o.frequency.exponentialRampToValueAtTime(33, t + 0.55);
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(level, t + 0.006);
            g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
            o.connect(g);
            this.out(g, 1, 0.22);

            const s = this.noiseSrc(t, t + 0.4);
            const lp = this.filter('lowpass', 500);
            const g2 = this.gain();
            g2.gain.setValueAtTime(level * 0.9, t);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            s.connect(lp).connect(g2);
            this.out(g2, 1, 0.3);
        }

        crash(t, level = 0.3, dur = 3) {
            const s = this.noiseSrc(t, t + dur);
            const hp = this.filter('highpass', 3800);
            const g = this.gain();
            g.gain.setValueAtTime(level, t);
            g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
            s.connect(hp).connect(g);
            this.out(g, 0.7, 0.6, 0.15);
        }

        swell(t0, t1, level) {
            const s = this.noiseSrc(t0, t1 + 0.02);
            const bp = this.filter('bandpass', 300, 0.8);
            bp.frequency.setValueAtTime(300, t0);
            bp.frequency.exponentialRampToValueAtTime(7000, t1);
            const g = this.gain();
            g.gain.setValueAtTime(0.0005, t0);
            g.gain.exponentialRampToValueAtTime(level, t1 - 0.01);
            g.gain.linearRampToValueAtTime(0, t1);
            s.connect(bp).connect(g);
            this.out(g, 1, 0.5);

            const o = this.osc('sawtooth', 80, t0, t1);
            o.frequency.exponentialRampToValueAtTime(320, t1);
            const lp = this.filter('lowpass', 900);
            const g2 = this.gain();
            g2.gain.setValueAtTime(0.0005, t0);
            g2.gain.exponentialRampToValueAtTime(level * 0.35, t1 - 0.01);
            g2.gain.linearRampToValueAtTime(0, t1);
            o.connect(lp).connect(g2);
            this.out(g2, 1, 0.3);
        }

        evWake(t) {
            const lp = this.filter('lowpass', 2600, 2);
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.13, t + 0.35);
            g.gain.exponentialRampToValueAtTime(0.0008, t + 1.9);
            for (const [mul, type] of [[1, 'triangle'], [1.5, 'sine'], [2.01, 'sine']]) {
                const o = this.osc(type, 160 * mul, t, t + 2);
                o.frequency.exponentialRampToValueAtTime(660 * mul, t + 1.2);
                o.connect(lp);
            }
            lp.connect(g);
            this.out(g, 1, 0.5);
            this.bell(t + 0.95, N.B5, 0.07);
            this.bell(t + 1.18, N.E6, 0.07);
        }

        bell(t, f, level) {
            for (const [mul, lv, dec] of [[1, 1, 1.8], [2.76, 0.35, 0.7], [5.4, 0.12, 0.35]]) {
                const o = this.osc('sine', f * mul, t, t + dec + 0.1);
                const g = this.gain();
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(level * lv, t + 0.004);
                g.gain.exponentialRampToValueAtTime(0.0005, t + dec);
                o.connect(g);
                this.out(g, 1, 0.6, 0.1);
            }
        }

        pluck(t, f, vel, decay = 0.2, pan = 0.1) {
            const lp = this.filter('lowpass', 900, 1.5);
            lp.frequency.setValueAtTime(1800 + 3600 * vel, t);
            lp.frequency.exponentialRampToValueAtTime(800, t + Math.min(decay, 0.25));
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(vel * 0.15, t + 0.003);
            g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
            this.osc('sawtooth', f, t, t + decay + 0.02, -4).connect(lp);
            this.osc('sawtooth', f, t, t + decay + 0.02, 5).connect(lp);
            lp.connect(g);
            this.out(g, 0.8, 0.4, pan);
        }

        // mandolin tremolo
        trem(t, dur, f, vel = 0.7) {
            const rate = 1 / 13;
            const n = Math.max(1, Math.floor(dur / rate));
            for (let i = 0; i < n; i++) {
                const k = i / n;
                const shape = 0.65 + 0.35 * Math.sin(Math.PI * Math.min(1, k * 1.4));
                const v = vel * shape * (0.82 + 0.18 * this.rand());
                const last = i === n - 1;
                this.pluck(t + i * rate + (this.rand() - 0.5) * 0.006, f, v, last ? 0.55 : 0.16, 0.12);
            }
        }

        pad(t, dur, freqs, level) {
            const lp = this.filter('lowpass', 1300, 0.6);
            const g = this.gain();
            const att = Math.min(1.2, dur * 0.4);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(level, t + att);
            g.gain.setValueAtTime(level, t + dur);
            g.gain.linearRampToValueAtTime(0, t + dur + 1.6);
            const vib = this.osc('sine', 4.8, t, t + dur + 1.7);
            const vg = this.gain(5);
            vib.connect(vg);
            for (const f of freqs) {
                for (const d of [-7, 7]) {
                    const o = this.osc('sawtooth', f, t, t + dur + 1.7, d);
                    vg.connect(o.detune);
                    o.connect(lp);
                }
            }
            lp.connect(g);
            this.out(g, 0.6, 0.65);
        }

        cello(t, dur, f, level, release = 0.8) {
            const lp = this.filter('lowpass', 650, 0.8);
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(level, t + 0.35);
            g.gain.setValueAtTime(level, t + dur);
            g.gain.linearRampToValueAtTime(0, t + dur + release);
            const vib = this.osc('sine', 5.2, t, t + dur + release + 0.1);
            const vg = this.gain(7);
            vib.connect(vg);
            for (const d of [-5, 5]) {
                const o = this.osc('sawtooth', f, t, t + dur + release + 0.1, d);
                vg.connect(o.detune);
                o.connect(lp);
            }
            lp.connect(g);
            this.out(g, 0.9, 0.4);
        }

        stacc(t, f, vel) {
            const lp = this.filter('lowpass', 1200, 1);
            lp.frequency.setValueAtTime(600 + 900 * vel, t);
            lp.frequency.exponentialRampToValueAtTime(250, t + 0.18);
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(vel * 0.4, t + 0.006);
            g.gain.exponentialRampToValueAtTime(0.0008, t + 0.24);
            this.osc('sawtooth', f, t, t + 0.26, -6).connect(lp);
            this.osc('sawtooth', f * 2, t, t + 0.26, 6).connect(lp);
            lp.connect(g);
            this.out(g, 1, 0.15);
        }

        timpani(t, f, level) {
            const o = this.osc('sine', f, t, t + 1.6);
            o.frequency.setValueAtTime(f * 1.06, t);
            o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(level, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.0008, t + 1.5);
            o.connect(g);
            this.out(g, 1, 0.3);
            const s = this.noiseSrc(t, t + 0.15);
            const lp = this.filter('lowpass', 380);
            const g2 = this.gain();
            g2.gain.setValueAtTime(level * 0.6, t);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            s.connect(lp).connect(g2);
            this.out(g2, 1, 0.2);
        }

        stamp(t) {
            const o = this.osc('sine', 150, t, t + 0.5);
            o.frequency.exponentialRampToValueAtTime(52, t + 0.22);
            const g = this.gain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.85, t + 0.004);
            g.gain.exponentialRampToValueAtTime(0.0008, t + 0.45);
            o.connect(g);
            this.out(g, 1, 0.25);
            const s = this.noiseSrc(t, t + 0.25);
            const bp = this.filter('bandpass', 1100, 0.8);
            const g2 = this.gain();
            g2.gain.setValueAtTime(0, t);
            g2.gain.linearRampToValueAtTime(0.7, t + 0.003);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
            s.connect(bp).connect(g2);
            this.out(g2, 1, 0.45, 0.25);
        }

        lighter(t) {
            this.click(t, 0.35);
            const s = this.noiseSrc(t + 0.05, t + 0.9);
            const bp = this.filter('bandpass', 1500, 0.6);
            const g = this.gain();
            g.gain.setValueAtTime(0, t + 0.05);
            g.gain.linearRampToValueAtTime(0.18, t + 0.12);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
            s.connect(bp).connect(g);
            this.out(g, 1, 0.3, 0.3);
        }

        tireHiss(t0, t1, level) {
            const s = this.noiseSrc(t0, t1);
            const bp = this.filter('bandpass', 1300, 0.5);
            const g = this.gain();
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(level, t0 + 0.8);
            g.gain.setValueAtTime(level, t1 - 0.3);
            g.gain.linearRampToValueAtTime(0, t1);
            const lfo = this.osc('sine', 0.6, t0, t1);
            const lg = this.gain(level * 0.35);
            lfo.connect(lg).connect(g.gain);
            s.connect(bp).connect(g);
            this.out(g, 1, 0.1);
        }

        // ---------- Tổng phổ ----------
        compose() {
            const B = C.barLen;
            const beat = B / 4;

            // Không khí: mưa + tiếng thành phố
            this.rain([
                [0, 0], [1.5, 0.1], [3.8, 0.1], [4.2, 0.06], [11.85, 0.06], [12.05, 0.025],
                [17.3, 0.035], [17.5, 0.01], [21.0, 0.01], [21.7, 0.055], [35.8, 0.055], [36.0, 0.0],
                [43.4, 0.0], [44.2, 0.065], [50.5, 0.055], [52, 0],
            ]);
            this.rumble([[0, 0], [2, 0.12], [11.8, 0.12], [12.0, 0.04], [43.4, 0.04], [52, 0]]);

            // Cảnh 1: đánh máy + sấm
            for (const loc of [C.loc1, C.loc2]) {
                [...loc.text].forEach((ch, i) => {
                    if (ch !== ' ') this.click(loc.start + i * loc.step, 0.32);
                });
            }
            this.thunder(C.thunder);
            this.drone(2.2, 11.95, [N.D1, N.A1], 0.12, 160, 520);

            // Cảnh 2: lời dẫn
            this.cello(C.l1, 2.6, N.D2, 0.1);
            this.cello(C.l2, 2.1, N.Bb1, 0.1);
            this.cello(C.l3a, 2.45, N.A1, 0.12, 0.15);
            this.trem(4.4, 1.3, N.A3, 0.5);
            this.trem(5.9, 0.9, N.D4, 0.5);
            this.trem(7.2, 1.5, N.F4, 0.55);
            this.trem(8.9, 0.45, N.E4, 0.45);
            this.trem(9.5, 1.7, N.Cs4, 0.55);
            this.swell(10.3, 11.95, 0.28);

            // Cảnh 3: bật đèn
            this.braam(C.ledL, [N.D1, N.D2, N.A2, N.D3], 3.2, 0.2);
            this.boom(C.ledL, 0.9);
            this.braam(C.ledR, [N.D1, N.D2, N.F2, N.A2], 3.4, 0.2);
            this.boom(C.ledR, 0.75);
            this.evWake(C.lightBar);
            this.drone(13.0, 17.35, [N.D1, N.D2], 0.1, 140, 900);
            this.pad(13.6, 3.6, [N.D3, N.F3, N.A3], 0.045);
            this.cello(15.0, 2.2, N.A2, 0.08, 0.2);
            this.swell(16.2, 17.45, 0.42);

            // Cảnh 4: tên xe
            this.braam(C.titleHit, [N.D1, N.D2, N.A2, N.D3, N.F3], 4.2, 0.24);
            this.boom(C.titleHit, 1.0);
            this.crash(C.titleHit, 0.26);
            this.pad(C.titleHit, 3.4, [N.D3, N.F3, N.A3, N.D4], 0.05);
            this.trem(18.3, 1.5, N.D5, 0.6);
            this.trem(19.9, 0.75, N.A4, 0.5);

            // Cảnh 5: hồ sơ mật — ostinato + giai điệu mandolin
            const roots = [N.D2, N.D2, N.D2, N.Bb1, N.Bb1, N.G1, N.A1];
            const chords = [
                [N.D3, N.F3, N.A3], [N.D3, N.F3, N.A3], [N.D3, N.F3, N.A3],
                [N.Bb2, N.D3, N.F3], [N.Bb2, N.D3, N.F3], [N.G2, N.Bb3, N.D4], [N.A2, N.Cs4, N.E4],
            ];
            const accents = [1, 0, 0, 1, 0, 0, 1, 0];
            for (let b = 0; b < roots.length; b++) {
                const t0 = C.pulseStart + b * B;
                for (let e = 0; e < 8; e++) {
                    const t = t0 + e * (B / 8);
                    if (t >= C.pulseEnd) break;
                    const fade = b === 0 ? 0.45 + 0.55 * (e / 8) : 1;
                    this.stacc(t, roots[b], (accents[e] ? 1 : 0.5) * fade);
                }
                for (let q = 0; q < 4; q++) {
                    const t = t0 + q * beat;
                    if (t < C.pulseEnd) this.tick(t, 0.05, q % 2 === 0);
                }
                if (b > 0) this.timpani(t0, roots[b], 0.3);
                const padEnd = Math.min(t0 + B, C.pulseEnd) - t0;
                if (b > 0) this.pad(t0, padEnd - 0.2, chords[b], 0.04);
            }
            const melody = [
                [23.0, 2, N.A4], [0, 1, N.D5], [0, 1, N.F5],
                [25.25, 2, N.E5], [0, 1, N.D5], [0, 1, N.C5],
                [27.5, 2, N.D5], [0, 1, N.Bb4], [0, 1, N.A4],
                [29.75, 3, N.G4], [0, 1, N.A4],
                [32.0, 2, N.Bb4], [0, 1, N.A4], [0, 1, N.G4],
                [34.25, 2, N.A4], [0, 0.9, N.Cs5],
            ];
            let tm = 0;
            for (const [start, beats, f] of melody) {
                if (start) tm = start;
                this.trem(tm, beats * beat - 0.03, f, 0.75);
                tm += beats * beat;
            }
            for (const s of C.stamps) {
                this.stamp(s);
                this.boom(s, 0.5, 1.4);
            }
            this.tireHiss(21.6, 35.9, 0.03);

            // Cảnh 6: lời đề nghị
            this.lighter(36.15);
            for (let t = 36.6; t < 40.3; t += 1.0) this.tick(t, 0.11, Math.round(t) % 2 === 0);
            this.cello(C.offer1, 3.9, N.D2, 0.12, 0.25);
            this.cello(C.offer2, 2.0, N.A1, 0.07, 0.25);
            this.swell(39.25, C.priceHit - 0.02, 0.5);
            this.braam(C.priceHit, [N.D1, N.D2, N.A2, N.D3, N.F3], 3.0, 0.26);
            this.boom(C.priceHit, 1.1);
            this.crash(C.priceHit, 0.3);
            this.stamp(C.priceHit);
            for (const f of [N.D4, N.F4, N.A4]) this.trem(40.7, 1.9, f, 0.42);
            this.pad(C.priceHit, 2.7, [N.D3, N.F3, N.A3], 0.045);

            // Cảnh 7: kết
            this.pad(43.5, 2.3, [N.D3, N.F3, N.A3], 0.05);
            this.pad(46.0, 1.6, [N.Bb2, N.D3, N.F3], 0.05);
            this.pad(47.8, 1.4, [N.G2, N.Bb3, N.D4], 0.05);
            this.pad(49.4, 1.8, [N.D3, N.F3, N.A3, N.D4], 0.055);
            this.cello(43.5, 2.3, N.D2, 0.1);
            this.cello(46.0, 1.6, N.Bb1, 0.1);
            this.cello(47.8, 1.4, N.G1, 0.1);
            this.cello(49.4, 1.6, N.D2, 0.11, 1.0);
            const coda = [[44.2, 1.0, N.A4], [45.3, 0.6, N.D5], [46.0, 1.6, N.F5], [47.8, 0.8, N.E5], [48.7, 0.6, N.C5], [49.4, 1.9, N.D5]];
            for (const [t, d, f] of coda) this.trem(t, d, f, 0.62);
            this.boom(C.slogan, 0.65);
            this.timpani(C.slogan, N.D2, 0.4);
            this.boom(49.4, 0.6, 2.6);
            this.crash(49.4, 0.12, 2.5);

            // Fade tổng
            this.master.gain.setValueAtTime(0.9, 0);
            this.master.gain.setValueAtTime(0.9, 50.6);
            this.master.gain.linearRampToValueAtTime(0, C.duration);
        }
    }

    async function renderBuffer(sampleRate = 48000) {
        const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const ctx = new OAC(2, Math.ceil(sampleRate * C.duration), sampleRate);
        new Score(ctx).compose();
        const buf = await ctx.startRendering();
        // Chuẩn hoá đỉnh về -1 dBFS
        let peak = 0;
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < d.length; i++) {
                const a = Math.abs(d[i]);
                if (a > peak) peak = a;
            }
        }
        const k = peak > 0 ? 0.89 / peak : 1;
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < d.length; i++) d[i] *= k;
        }
        return buf;
    }

    function toWav(buf) {
        const ch = buf.numberOfChannels;
        const len = buf.length;
        const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
        const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
        str(0, 'RIFF');
        out.setUint32(4, 36 + len * ch * 2, true);
        str(8, 'WAVE');
        str(12, 'fmt ');
        out.setUint32(16, 16, true);
        out.setUint16(20, 1, true);
        out.setUint16(22, ch, true);
        out.setUint32(24, buf.sampleRate, true);
        out.setUint32(28, buf.sampleRate * ch * 2, true);
        out.setUint16(32, ch * 2, true);
        out.setUint16(34, 16, true);
        str(36, 'data');
        out.setUint32(40, len * ch * 2, true);
        const data = [];
        for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
        let o = 44;
        for (let i = 0; i < len; i++) {
            for (let c = 0; c < ch; c++) {
                const s = Math.max(-1, Math.min(1, data[c][i]));
                out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
                o += 2;
            }
        }
        return out.buffer;
    }

    window.Soundtrack = { renderBuffer, toWav };
})();
