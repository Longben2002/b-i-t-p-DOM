// Cấu hình phim: ảnh nguồn + danh sách cảnh theo nhịp nhạc (140 BPM).
// Toạ độ khung nhìn tính theo tỉ lệ ảnh: x, y = tâm khung (0..1), w = bề rộng nhìn thấy / bề rộng ảnh,
// r = góc xoay (độ). Mỗi cảnh chạy từ khung "from" sang "to".
// Kiểu chuyển cảnh vào (tin): cut | zoom | whip | spin | flash | fade ; dir = hướng (1 / -1).
(function () {
    'use strict';
    const BPM = 140;
    const BEAT = 60 / BPM;

    const IMAGES = {
        front34: { src: 'images/front-34.jpg', label: 'ẢNH 3/4 ĐẦU XE' },
        side: { src: 'images/side.jpg', label: 'ẢNH THÂN XE (NGANG)' },
        rear34: { src: 'images/rear-34.jpg', label: 'ẢNH 3/4 ĐUÔI XE' },
        front: { src: 'images/front.jpg', label: 'ẢNH CHÍNH DIỆN' },
        interior: { src: 'images/interior.jpg', label: 'ẢNH NỘI THẤT' },
    };

    const SHOTS = [
        // Intro: toàn cảnh, đẩy máy chậm
        { b: [0, 4], img: 'front34', from: { x: 0.5, y: 0.55, w: 1.0 }, to: { x: 0.5, y: 0.56, w: 0.74 }, tin: 'fade' },
        // DROP: cận đèn pha
        { b: [4, 6], img: 'front34', from: { x: 0.3, y: 0.5, w: 0.22, r: -3 }, to: { x: 0.32, y: 0.5, w: 0.19, r: 0 }, tin: 'zoom' },
        // Lia ngang thân xe
        { b: [6, 8], img: 'side', from: { x: 0.36, y: 0.55, w: 0.42 }, to: { x: 0.64, y: 0.55, w: 0.4 }, tin: 'whip', dir: 1 },
        // Cận mâm
        { b: [8, 9], img: 'side', from: { x: 0.78, y: 0.68, w: 0.17, r: 0 }, to: { x: 0.78, y: 0.68, w: 0.15, r: 8 }, tin: 'cut' },
        // 3/4 đuôi
        { b: [9, 11], img: 'rear34', from: { x: 0.5, y: 0.55, w: 0.55 }, to: { x: 0.52, y: 0.55, w: 0.46 }, tin: 'spin', dir: 1 },
        // Cận đèn hậu
        { b: [11, 12], img: 'rear34', from: { x: 0.45, y: 0.45, w: 0.2 }, to: { x: 0.5, y: 0.45, w: 0.18 }, tin: 'cut' },
        // Nội thất
        { b: [12, 14], img: 'interior', from: { x: 0.42, y: 0.5, w: 0.55 }, to: { x: 0.56, y: 0.5, w: 0.5 }, tin: 'whip', dir: -1 },
        // Cận màn hình / vô-lăng
        { b: [14, 15], img: 'interior', from: { x: 0.5, y: 0.45, w: 0.26 }, to: { x: 0.5, y: 0.45, w: 0.22 }, tin: 'zoom' },
        // Chính diện
        { b: [15, 17], img: 'front', from: { x: 0.5, y: 0.55, w: 0.6 }, to: { x: 0.5, y: 0.55, w: 0.48 }, tin: 'flash' },
        // Cận lưới tản nhiệt
        { b: [17, 18], img: 'front', from: { x: 0.5, y: 0.6, w: 0.18 }, to: { x: 0.5, y: 0.6, w: 0.16 }, tin: 'cut' },
        // Lia hông xe
        { b: [18, 20], img: 'front34', from: { x: 0.68, y: 0.55, w: 0.42 }, to: { x: 0.5, y: 0.55, w: 0.4 }, tin: 'whip', dir: -1 },
        // Cận mâm sau
        { b: [20, 21], img: 'rear34', from: { x: 0.7, y: 0.7, w: 0.18, r: 0 }, to: { x: 0.7, y: 0.7, w: 0.16, r: -8 }, tin: 'spin', dir: -1 },
        // Cận đèn pha bên kia
        { b: [21, 22], img: 'front', from: { x: 0.25, y: 0.48, w: 0.2 }, to: { x: 0.27, y: 0.48, w: 0.18 }, tin: 'cut' },
        // 3/4 đuôi kéo ra (chuẩn bị khoảng lặng)
        { b: [22, 24], img: 'rear34', from: { x: 0.5, y: 0.55, w: 0.36 }, to: { x: 0.5, y: 0.55, w: 0.62 }, tin: 'zoom' },
        // Hero chậm + tên xe
        { b: [24, 28], img: 'front34', from: { x: 0.5, y: 0.55, w: 0.62 }, to: { x: 0.5, y: 0.55, w: 0.56 }, tin: 'flash' },
        // Màn kết
        { b: [28, 36], img: 'side', from: { x: 0.5, y: 0.55, w: 0.95 }, to: { x: 0.5, y: 0.55, w: 0.86 }, tin: 'zoom', end: true },
    ];

    // Chữ (thời điểm tính theo nhịp)
    const TEXT = {
        stats: [
            { id: 'st1', b: [6, 8] },
            { id: 'st2', b: [9, 11] },
            { id: 'st3', b: [12, 14] },
        ],
        hero: { b: [24, 28] },
        end: { b: [28, 36] },
    };

    window.EDIT = { BPM, BEAT, DUR: 36 * BEAT, IMAGES, SHOTS, TEXT };
})();
