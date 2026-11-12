"""Sinh icon PNG cho PWA từ logo của FE (web/assets/favicon.svg). Chỉ dùng thư viện chuẩn của Python.

Logo: ô vuông bo góc màu chủ đạo + chữ E trắng, trên lưới 32×32 (cùng hình với favicon.svg).
- icon-*.png      : đúng hình favicon (góc bo, nền trong suốt) — "purpose": "any".
- maskable-*.png  : nền màu tràn viền, chữ E nằm gọn trong vùng an toàn (hình tròn 80%) — Android tự cắt theo hình máy.
- apple-touch-icon.png (180): nền tràn viền, iOS tự bo góc (iOS tô đen chỗ trong suốt nên không để trong suốt).

Đổi logo: sửa favicon.svg và các hằng số dưới đây cho khớp, rồi chạy lại:
    python -I tools/icons/build_icons.py
"""
import os
import sys
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'web', 'assets', 'icons')

BRAND = (0x1F, 0x5F, 0xBF)   # = fill của favicon.svg = --erp-accent mặc định
INK = (0xFF, 0xFF, 0xFF)
RADIUS = 7.0                 # rx của favicon.svg (đơn vị lưới 32)
# Chữ E của favicon.svg (M9 9h14v3H12.5v2.5H21v3h-8.5V20H23v3H9z) tách thành các hình chữ nhật không chồng nhau.
E_RECTS = [(9, 9, 12.5, 23), (12.5, 9, 23, 12), (12.5, 14.5, 21, 17.5), (12.5, 20, 23, 23)]


def overlap(a0, a1, b0, b1):
    return max(0.0, min(a1, b1) - max(a0, b0))


def rounded_cover(px, py, s, n=4):
    """Độ phủ (0..1) của ô vuông bo góc (cạnh 32 lưới, bán kính RADIUS) trên điểm ảnh (px, py), lấy mẫu n×n."""
    r = RADIUS * s
    size = 32 * s
    # Chỉ điểm ảnh chạm vùng góc mới cần lấy mẫu; còn lại phủ trọn.
    if (px < r or px + 1 > size - r) and (py < r or py + 1 > size - r):
        hits = 0
        for i in range(n):
            for j in range(n):
                x = px + (i + .5) / n
                y = py + (j + .5) / n
                cx = min(max(x, r), size - r)
                cy = min(max(y, r), size - r)
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    hits += 1
        return hits / (n * n)
    return 1.0


def e_cover(px, py, s):
    """Độ phủ chính xác của chữ E trên điểm ảnh (diện tích giao giữa điểm ảnh và các hình chữ nhật)."""
    total = 0.0
    for x0, y0, x1, y1 in E_RECTS:
        total += overlap(px, px + 1, x0 * s, x1 * s) * overlap(py, py + 1, y0 * s, y1 * s)
    return min(1.0, total)


def render(size, full_bleed):
    s = size / 32
    rows = []
    for py in range(size):
        row = bytearray([0])  # bộ lọc PNG: None
        for px in range(size):
            bg = 1.0 if full_bleed else rounded_cover(px, py, s)
            e = e_cover(px, py, s)
            rgb = [round(b + (k - b) * e) for b, k in zip(BRAND, INK)]
            row += bytes(rgb) + bytes([round(255 * bg)])
        rows.append(bytes(row))
    return png(size, size, b''.join(rows))


def png(w, h, raw):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)  # 8 bit, RGBA
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(OUT, exist_ok=True)
    jobs = [('icon-192.png', 192, False), ('icon-512.png', 512, False),
            ('maskable-192.png', 192, True), ('maskable-512.png', 512, True),
            ('apple-touch-icon.png', 180, True)]
    for name, size, full in jobs:
        data = render(size, full)
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(data)
        print(f'{name}: {size}×{size}, {len(data)} byte')


if __name__ == '__main__':
    main()
