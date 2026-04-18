#!/usr/bin/env python3
"""アプリアイコン（PNG）を生成するスクリプト。依存ライブラリ不要。"""
import struct, zlib, os, math

def make_png(size):
    W, H = size, size
    S = size / 192  # スケール係数

    # 色定義
    ORANGE   = (232, 120,  58, 255)  # #E8783A 背景
    WHITE    = (255, 255, 255, 255)  # 白
    DARK_ORG = (200,  90,  30, 255)  # 濃いオレンジ（カレンダーヘッダー）
    TRANSP   = (  0,   0,   0,   0)  # 透明

    def in_rounded_rect(x, y, x1, y1, x2, y2, r):
        """角丸矩形の内側判定"""
        if x < x1 or x > x2 or y < y1 or y > y2:
            return False
        # 四隅の角丸
        for cx, cy in [(x1+r, y1+r), (x2-r, y1+r), (x1+r, y2-r), (x2-r, y2-r)]:
            if x < x1+r and y < y1+r and (x-cx)**2+(y-cy)**2 > r*r and x<cx and y<cy:
                return False
            if x > x2-r and y < y1+r and (x-cx)**2+(y-cy)**2 > r*r and x>cx and y<cy:
                return False
            if x < x1+r and y > y2-r and (x-cx)**2+(y-cy)**2 > r*r and x<cx and y>cy:
                return False
            if x > x2-r and y > y2-r and (x-cx)**2+(y-cy)**2 > r*r and x>cx and y>cy:
                return False
        return True

    def in_circle(x, y, cx, cy, r):
        return (x-cx)**2 + (y-cy)**2 <= r*r

    pixels = []
    for y in range(H):
        row = []
        for x in range(W):
            px = TRANSP

            # ① アプリ背景（オレンジの角丸正方形）
            bg_margin = W * 0.04
            bg_radius = W * 0.22
            bx1, by1 = bg_margin, bg_margin
            bx2, by2 = W - bg_margin, H - bg_margin

            in_bg = False
            dx = max(0, max(bx1 + bg_radius - x, x - (bx2 - bg_radius)))
            dy = max(0, max(by1 + bg_radius - y, y - (by2 - bg_radius)))
            if dx*dx + dy*dy <= bg_radius*bg_radius and bx1<=x<=bx2 and by1<=y<=by2:
                in_bg = True

            if not in_bg:
                row.append(TRANSP)
                continue

            px = ORANGE

            # ② カレンダー本体（白い角丸矩形）
            cal_x1 = W * 0.13
            cal_y1 = H * 0.16
            cal_x2 = W * 0.87
            cal_y2 = H * 0.87
            cal_r  = W * 0.06

            dx2 = max(0, max(cal_x1 + cal_r - x, x - (cal_x2 - cal_r)))
            dy2 = max(0, max(cal_y1 + cal_r - y, y - (cal_y2 - cal_r)))
            in_cal = dx2*dx2 + dy2*dy2 <= cal_r*cal_r and cal_x1<=x<=cal_x2 and cal_y1<=y<=cal_y2

            if in_cal:
                px = WHITE

            # ③ カレンダーヘッダー（濃いオレンジ帯）
            hdr_y2 = H * 0.38
            dx3 = max(0, max(cal_x1 + cal_r - x, x - (cal_x2 - cal_r)))
            dy3_top = max(0, cal_y1 + cal_r - y)
            dy3_bot = max(0, y - hdr_y2)
            # ヘッダーは上角丸のみ
            if cal_x1<=x<=cal_x2 and cal_y1<=y<=hdr_y2:
                in_hdr_rounded = True
                # 上左角
                if x < cal_x1+cal_r and y < cal_y1+cal_r:
                    in_hdr_rounded = (x-(cal_x1+cal_r))**2+(y-(cal_y1+cal_r))**2 <= cal_r*cal_r
                # 上右角
                elif x > cal_x2-cal_r and y < cal_y1+cal_r:
                    in_hdr_rounded = (x-(cal_x2-cal_r))**2+(y-(cal_y1+cal_r))**2 <= cal_r*cal_r
                if in_hdr_rounded:
                    px = DARK_ORG

            # ④ ヘッダーに「日」マーク（白い小円 + 縦棒）
            # 月名の代わりにシンプルなドット3つで「・・・」
            if cal_y1+H*0.05 <= y <= hdr_y2 - H*0.04:
                dot_y = (cal_y1 + hdr_y2) / 2
                for dot_x in [W*0.35, W*0.50, W*0.65]:
                    if in_circle(x, y, dot_x, dot_y, W*0.025):
                        px = WHITE

            # ⑤ カレンダーの日付グリッド（白地に濃いオレンジのドット）
            grid_top = hdr_y2 + H * 0.03
            grid_bot = cal_y2 - H * 0.06
            grid_left  = cal_x1 + W * 0.04
            grid_right = cal_x2 - W * 0.04

            cols, rows_n = 4, 3  # 4列×3行
            cell_w = (grid_right - grid_left) / cols
            cell_h = (grid_bot - grid_top) / rows_n

            if grid_top <= y <= grid_bot and grid_left <= x <= grid_right:
                col_i = int((x - grid_left) / cell_w)
                row_i = int((y - grid_top) / cell_h)
                cx = grid_left + (col_i + 0.5) * cell_w
                cy = grid_top  + (row_i + 0.5) * cell_h
                dot_r = W * 0.028
                if in_circle(x, y, cx, cy, dot_r):
                    # 1つだけオレンジドット（今日）
                    if col_i == 2 and row_i == 1:
                        px = DARK_ORG
                    else:
                        px = (210, 210, 220, 255)  # 薄グレー

            # ⑥ リングの突起（カレンダー上部のリング×2）
            for ring_x in [W*0.34, W*0.66]:
                ring_y_top = H * 0.10
                ring_y_bot = H * 0.24
                ring_r_out = W * 0.045
                ring_r_in  = W * 0.025
                ring_cx = ring_x
                ring_cy = (ring_y_top + ring_y_bot) / 2
                dist2 = (x-ring_cx)**2 + (y-ring_cy)**2
                if ring_r_in*ring_r_in <= dist2 <= ring_r_out*ring_r_out:
                    px = WHITE

            row.append(px)
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

    sig  = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

if __name__ == '__main__':
    os.makedirs('icons', exist_ok=True)
    for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
        data = make_png(size)
        path = os.path.join('icons', name)
        with open(path, 'wb') as f:
            f.write(data)
        print(f'✓ {path} ({size}x{size})')
    print('アイコン生成完了！')
