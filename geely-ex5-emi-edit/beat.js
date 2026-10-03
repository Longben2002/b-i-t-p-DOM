// Beat phonk 140 BPM (sáng tác gốc) + SFX chuyển cảnh, tổng hợp bằng Web Audio.
// Cần window.EDIT (do edit.js khai báo trước): BEAT, DUR, SHOTS.
(function () {
    'use strict';

    function rng(seed) {
        return function () {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Fa thứ
    const N = {
        Db1: 34.65, F1: 43.65, Ab1: 51.91, C2: 65.41, Db2: 69.3, Eb2: 77.78, F2: 87.31,
        F5: 698.46, G5: 783.99, Ab5: 830.61, Bb5: 932.33, C6: 1046.5, Db6: 1108.73, Eb6: 1244.51,
    };

    class Beat {
        constructor(ctx, E) {
            this.ctx = ctx;
            this.E = E;
            this.rand = rng(140);
            this.noise = this.makeNoise(2);
            this.curve = this.makeCurve(3.5);

            this.comp = ctx.createDynamicsCompressor();
            this.comp.threshold.value = -10;
            this.comp.ratio.value = 4;
            this.comp.attack.value = 0.003;
            this.comp.release.value = 0.15;
            this.master = ctx.createGain();
            this.master.gain.value = 0.85;
            this.comp.connect(this.master).connect(ctx.destination);

            this.bus = ctx.createGain();
            this.bus.connect(this.comp);
            this.verb = ctx.createConvolver();
            this.verb.buffer = this.makeIR(2.2);
            const wet = ctx.createGain();
            wet.gain.value = 0.4;
            this.verb.connect(wet).connect(this.comp);

            // Kênh cowbell có lowpass để làm intro "bị bóp"
            this.bellBus = ctx.createBiquadFilter();
            this.bellBus.type = 'lowpass';
            this.bellBus.frequency.value = 18000;
            this.bellBus.connect(this.bus);
            const bs = ctx.createGain();
            bs.gain.value = 0.35;
            this.bellBus.connect(bs).connect(this.verb);
        }

        makeNoise(sec) {
            const b = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * sec), this.ctx.sampleRate);
            const d = b.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = this.rand() * 2 - 1;
            return b;
        }
        makeIR(sec) {
            const len = Math.floor(this.ctx.sampleRate * sec);
            const b = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
            for (let c = 0; c < 2; c++) {
                const d = b.getChannelData(c);
                for (let i = 0; i < len; i++) d[i] = (this.rand() * 2 - 1) * Math.pow(1 - i / len, 3);
            }
            return b;
        }
        makeCurve(k) {
            const c = new Float32Array(1024);
            for (let i = 0; i < 1024; i++) {
                const x = (i / 1023) * 2 - 1;
                c[i] = Math.tanh(k * x) / Math.tanh(k);
            }
            return c;
        }
        out(node, dry = 1, wet = 0, dest = this.bus) {
            if (dry) {
                const g = this.ctx.createGain();
                g.gain.value = dry;
                node.connect(g).connect(dest);
            }
            if (wet) {
                const g = this.ctx.createGain();
                g.gain.value = wet;
                node.connect(g).connect(this.verb);
            }
        }
        osc(type, f, t0, t1) {
            const o = this.ctx.createOscillator();
            o.type = type;
            o.frequency.value = f;
            o.start(t0);
            o.stop(t1);
            return o;
        }
        nsrc(t0, t1) {
            const s = this.ctx.createBufferSource();
            s.buffer = this.noise;
            s.loop = true;
            s.start(t0, this.rand());
            s.stop(t1);
            return s;
        }
        filt(type, f, q = 0.7) {
            const x = this.ctx.createBiquadFilter();
            x.type = type;
            x.frequency.value = f;
            x.Q.value = q;
            return x;
        }
        env(t, a, peak, dec, end = 0.0005) {
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(peak, t + a);
            g.gain.exponentialRampToValueAtTime(end, t + a + dec);
            return g;
        }

        // ---------- Nhạc cụ ----------
        kick(t, lv = 1) {
            const o = this.osc('sine', 160, t, t + 0.5);
            o.frequency.setValueAtTime(170, t);
            o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
            const g = this.env(t, 0.002, 0.95 * lv, 0.32);
            const ws = this.ctx.createWaveShaper();
            ws.curve = this.curve;
            o.connect(ws).connect(g);
            this.out(g, 0.9);
            const c = this.nsrc(t, t + 0.03);
            const hp = this.filt('highpass', 2500);
            const g2 = this.env(t, 0.001, 0.25 * lv, 0.015);
            c.connect(hp).connect(g2);
            this.out(g2, 1);
        }
        snare(t, lv = 1) {
            const s = this.nsrc(t, t + 0.3);
            const bp = this.filt('bandpass', 2200, 0.6);
            const g = this.env(t, 0.001, 0.55 * lv, 0.18);
            s.connect(bp).connect(g);
            this.out(g, 1, 0.25);
            const o = this.osc('triangle', 210, t, t + 0.15);
            o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
            const g2 = this.env(t, 0.001, 0.4 * lv, 0.09);
            o.connect(g2);
            this.out(g2, 1);
            // clap phụ
            for (const d of [0.008, 0.019]) {
                const c = this.nsrc(t + d, t + d + 0.05);
                const b2 = this.filt('bandpass', 1400, 1.2);
                const g3 = this.env(t + d, 0.001, 0.3 * lv, 0.03);
                c.connect(b2).connect(g3);
                this.out(g3, 1, 0.2);
            }
        }
        hat(t, lv = 0.3, open = false) {
            const s = this.nsrc(t, t + 0.3);
            const hp = this.filt('highpass', 7500);
            const g = this.env(t, 0.001, lv, open ? 0.16 : 0.035);
            s.connect(hp).connect(g);
            this.out(g, 1, 0.05);
        }
        // 808 có trượt nốt + méo
        bass(t, f, dur, glideTo = 0, lv = 0.75) {
            const o = this.osc('sine', f, t, t + dur + 0.05);
            if (glideTo) {
                o.frequency.setValueAtTime(f, t + dur * 0.55);
                o.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.85);
            }
            const ws = this.ctx.createWaveShaper();
            ws.curve = this.curve;
            const pre = this.ctx.createGain();
            pre.gain.value = 1.6;
            const lp = this.filt('lowpass', 900);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(lv, t + 0.006);
            g.gain.setTargetAtTime(lv * 0.7, t + 0.05, 0.25);
            g.gain.setValueAtTime(lv * 0.6, t + dur - 0.03);
            g.gain.linearRampToValueAtTime(0, t + dur);
            o.connect(pre).connect(ws).connect(lp).connect(g);
            this.out(g, 0.85);
        }
        // cowbell 808 lên giọng
        bell(t, f, lv = 0.3) {
            const bp = this.filt('bandpass', f * 1.6, 1.4);
            const g = this.env(t, 0.002, lv, 0.32);
            this.osc('square', f, t, t + 0.4).connect(bp);
            this.osc('square', f * 1.48, t, t + 0.4).connect(bp);
            const ws = this.ctx.createWaveShaper();
            ws.curve = this.curve;
            bp.connect(ws).connect(g);
            this.out(g, 0.55, 0, this.bellBus);
        }
        boom(t, lv = 1) {
            const o = this.osc('sine', 90, t, t + 2.2);
            o.frequency.exponentialRampToValueAtTime(30, t + 0.7);
            const g = this.env(t, 0.004, lv, 1.9);
            o.connect(g);
            this.out(g, 1, 0.3);
            const s = this.nsrc(t, t + 0.3);
            const lp = this.filt('lowpass', 700);
            const g2 = this.env(t, 0.002, 0.6 * lv, 0.2);
            s.connect(lp).connect(g2);
            this.out(g2, 1, 0.3);
        }
        crash(t, lv = 0.25) {
            const s = this.nsrc(t, t + 2.4);
            const hp = this.filt('highpass', 5000);
            const g = this.env(t, 0.003, lv, 2.2);
            s.connect(hp).connect(g);
            this.out(g, 0.8, 0.5);
        }
        riser(t0, t1, lv = 0.35) {
            const s = this.nsrc(t0, t1 + 0.02);
            const bp = this.filt('bandpass', 400, 1);
            bp.frequency.setValueAtTime(400, t0);
            bp.frequency.exponentialRampToValueAtTime(9000, t1);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0005, t0);
            g.gain.exponentialRampToValueAtTime(lv, t1 - 0.01);
            g.gain.linearRampToValueAtTime(0, t1);
            s.connect(bp).connect(g);
            this.out(g, 1, 0.4);
        }
        whoosh(t, lv = 0.35, dur = 0.28) {
            const s = this.nsrc(t - dur * 0.6, t + dur * 0.5);
            const bp = this.filt('bandpass', 600, 1.4);
            bp.frequency.setValueAtTime(500, t - dur * 0.6);
            bp.frequency.exponentialRampToValueAtTime(5000, t);
            bp.frequency.exponentialRampToValueAtTime(900, t + dur * 0.5);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0005, t - dur * 0.6);
            g.gain.exponentialRampToValueAtTime(lv, t - 0.01);
            g.gain.exponentialRampToValueAtTime(0.0005, t + dur * 0.5);
            s.connect(bp).connect(g);
            this.out(g, 1, 0.2);
        }
        shutter(t, lv = 0.35) {
            for (const d of [0, 0.045]) {
                const s = this.nsrc(t + d, t + d + 0.05);
                const bp = this.filt('bandpass', 3800, 2);
                const g = this.env(t + d, 0.001, lv, 0.025);
                s.connect(bp).connect(g);
                this.out(g, 1, 0.1);
            }
        }

        // ---------- Tổng phổ ----------
        compose() {
            const { BEAT, DUR, SHOTS } = this.E;
            const S = BEAT / 4; // nốt móc kép
            const bar = (n) => n * 4 * BEAT;

            // Giai điệu cowbell (16 bước / ô nhịp)
            const bellA = { 0: N.C6, 3: N.C6, 6: N.Ab5, 8: N.Bb5, 10: N.Ab5, 11: N.G5, 12: N.F5, 14: N.Ab5 };
            const bellB = { 0: N.C6, 3: N.C6, 6: N.Eb6, 8: N.Db6, 10: N.C6, 11: N.Bb5, 12: N.Ab5, 14: N.G5 };
            // 808: [bước, nốt, độ dài (bước), trượt tới]
            const bassBars = [
                [[0, N.F1, 6], [7, N.F1, 3], [10, N.Ab1, 6, N.F1]],
                [[0, N.F1, 6], [7, N.F1, 3], [10, N.C2, 6, N.Ab1]],
                [[0, N.Db2, 6], [7, N.Db2, 3], [10, N.Eb2, 6]],
                [[0, N.Eb2, 6], [7, N.Eb2, 3], [10, N.F2, 6, N.F1]],
            ];

            // Intro (ô 0): cowbell bị bóp lowpass rồi mở dần
            this.bellBus.frequency.setValueAtTime(700, 0);
            this.bellBus.frequency.exponentialRampToValueAtTime(5000, bar(1) - 0.05);
            this.bellBus.frequency.setValueAtTime(18000, bar(1));
            this.riser(bar(0.5), bar(1), 0.3);

            // Ô 1–5: beat đầy đủ; ô 6: half-time (cảnh hero); ô 7–8: kết
            for (let b = 0; b < 9; b++) {
                const t0 = bar(b);
                const pat = b % 2 === 0 ? bellA : bellB;
                const full = b >= 1 && b <= 5;
                const hero = b === 6;
                const outro = b >= 7;
                for (let s = 0; s < 16; s++) {
                    const t = t0 + s * S;
                    if (t >= DUR - 0.05) break;
                    if (pat[s] && (b !== 5 || s < 12)) this.bell(t, pat[s], hero ? 0.22 : 0.3);
                    if (full || outro) {
                        if (s === 0 || s === 10 || (b % 2 === 1 && s === 13)) this.kick(t, s === 0 ? 1 : 0.8);
                        if (s === 8) this.snare(t);
                        if (b === 5 && s >= 12) continue; // khoảng lặng trước cảnh hero
                        if (s % 2 === 0) this.hat(t, s % 4 === 0 ? 0.24 : 0.16);
                        if ((b === 3 || b === 7) && s >= 12) this.hat(t + S / 2, 0.14);
                    }
                    if (hero && s === 8) this.snare(t, 0.7);
                }
                if (full || outro || hero) {
                    for (const [st, f, len, glide] of bassBars[(b - 1 + 4) % 4]) {
                        if (b === 5 && st >= 12) continue;
                        const t = t0 + st * S;
                        if (t < DUR - 0.1) this.bass(t, f, Math.min(len * S, DUR - t), glide, hero ? 0.6 : 0.75);
                    }
                }
            }
            // Tam liên hi-hat cuối ô 4
            for (let k = 0; k < 6; k++) this.hat(bar(5) - BEAT + (k * BEAT) / 6, 0.12 + k * 0.02);
            this.riser(bar(5) + 3 * BEAT, bar(6), 0.4);

            // Điểm nhấn
            this.boom(bar(1), 1);
            this.crash(bar(1), 0.28);
            this.boom(bar(6), 0.7);
            this.boom(bar(7), 1);
            this.crash(bar(7), 0.25);

            // SFX theo từng điểm cắt cảnh
            for (let i = 1; i < SHOTS.length; i++) {
                const t = SHOTS[i].b[0] * BEAT;
                const tin = SHOTS[i].tin;
                if (tin === 'whip' || tin === 'spin') this.whoosh(t, 0.32);
                else if (tin === 'zoom') this.whoosh(t, 0.28, 0.22);
                else if (tin === 'flash') this.shutter(t, 0.3);
            }

            this.master.gain.setValueAtTime(0.85, DUR - 0.9);
            this.master.gain.linearRampToValueAtTime(0, DUR);
        }
    }

    async function renderBuffer(sampleRate = 48000) {
        const E = window.EDIT;
        const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * E.DUR), sampleRate);
        new Beat(ctx, E).compose();
        const buf = await ctx.startRendering();
        let peak = 0;
        for (let c = 0; c < buf.numberOfChannels; c++) {
            const d = buf.getChannelData(c);
            for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
        }
        const k = peak ? 0.89 / peak : 1;
        for (let c = 0; c < buf.numberOfChannels; c++) {
            const d = buf.getChannelData(c);
            for (let i = 0; i < d.length; i++) d[i] *= k;
        }
        return buf;
    }

    function toWav(buf) {
        const ch = buf.numberOfChannels;
        const len = buf.length;
        const v = new DataView(new ArrayBuffer(44 + len * ch * 2));
        const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
        str(0, 'RIFF');
        v.setUint32(4, 36 + len * ch * 2, true);
        str(8, 'WAVEfmt ');
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, ch, true);
        v.setUint32(24, buf.sampleRate, true);
        v.setUint32(28, buf.sampleRate * ch * 2, true);
        v.setUint16(32, ch * 2, true);
        v.setUint16(34, 16, true);
        str(36, 'data');
        v.setUint32(40, len * ch * 2, true);
        const data = [];
        for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
        let o = 44;
        for (let i = 0; i < len; i++) {
            for (let c = 0; c < ch; c++) {
                const s = Math.max(-1, Math.min(1, data[c][i]));
                v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
                o += 2;
            }
        }
        return v.buffer;
    }

    window.Beat = { renderBuffer, toWav };
})();
