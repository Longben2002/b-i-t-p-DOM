// Mốc thời gian (giây) dùng chung cho hình (ad.js) và tiếng (soundtrack.js)
window.AD_CUES = {
    duration: 52,

    // Cảnh 1 — mở đầu: mưa, chữ đánh máy, sấm
    loc1: { start: 0.55, step: 0.1, text: 'SÀI GÒN' },
    loc2: { start: 1.5, step: 0.085, text: '02:00 SÁNG' },
    lightning: 2.7,
    thunder: 3.05,

    // Cảnh 2 — lời dẫn
    l1: 4.2,
    l2: 7.1,
    l3a: 9.4,
    l3b: 10.5,
    narrOut: 11.6,

    // Cảnh 3 — đèn bật
    ledL: 12.2,
    ledR: 12.6,
    lightBar: 13.0,

    // Cảnh 4 — tên xe
    titleHit: 17.5,

    // Cảnh 5 — hồ sơ mật (nhịp 2.25 s/ô nhịp)
    barLen: 2.25,
    pulseStart: 20.75,
    stamps: [23.0, 27.5, 32.0],
    pulseEnd: 35.9,

    // Cảnh 6 — lời đề nghị
    offer1: 36.3,
    offer2: 38.2,
    priceHit: 40.45,

    // Cảnh 7 — kết
    endStart: 43.5,
    endLogo: 44.8,
    slogan: 46.0,
    cta: 47.4,
    fadeOut: 50.8,
};
