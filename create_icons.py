#!/usr/bin/env python3
"""アプリアイコン（PNG）を生成するスクリプト。依存ライブラリ不要。"""
import struct, zlib, os

def make_png(size, bg, fg):
    """シンプルな吹き出しアイコンの PNG を返す。"""
    W, H = size, size
    # ピクセルデータを作成
    pixels = []
    for y in range(H):
        row = []
        for x in range(W):
            # 角丸の背景
            margin = size * 0.08
            corner = size * 0.22
            dx = max(0, max(margin + corner - x, x - (W - margin - corner)))
            dy = max(0, max(margin + corner - y, y - (H - margin - corner)))
            in_bg = (dx*dx + dy*dy) <= corner*corner and margin <= x <= W-margin and margin <= y <= H-margin

            # 吹き出し本体
            bx1, by1 = int(W*0.15), int(H*0.15)
            bx2, by2 = int(W*0.85), int(H*0.72)
            in_bubble = bx1 <= x <= bx2 and by1 <= y <= by2

            # 吹き出しの三角（左下）
            tx, ty = int(W*0.25), int(H*0.72)
            tp = int(H*0.18)
            in_tri = (ty <= y <= ty+tp) and (x >= tx - (y-ty)*0.6) and (x <= tx + (y-ty)*0.3)

            if in_bg:
                row.append(bg)
            elif in_bubble or in_tri:
                row.append(fg)
            else:
                row.append((0,0,0,0))  # 透明
        pixels.append(row)

    # PNG エンコード（RGBA）
    raw = b''
    for row in pixels:
        raw += b'\x00'
        for r,g,b,a in row:
            raw += bytes([r,g,b,a])

    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)

    sig   = b'\x89PNG\r\n\x1a\n'
    ihdr  = chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
    idat  = chunk(b'IDAT', zlib.compress(raw, 9))
    iend  = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

if __name__ == '__main__':
    os.makedirs('icons', exist_ok=True)
    orange = (232, 120, 58, 255)   # #E8783A
    white  = (255, 255, 255, 255)
    for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
        data = make_png(size, orange, white)
        path = os.path.join('icons', name)
        with open(path, 'wb') as f:
            f.write(data)
        print(f'✓ {path} ({size}x{size})')
    print('アイコン生成完了！')
