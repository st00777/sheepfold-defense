#!/usr/bin/env python3
"""用主體遮罩重新去背：recut.py <原圖> <遮罩> <舊圖(判斷要不要左右翻)> <輸出.webp> <邊長> <trim|full>
遮罩來自 subject-mask.swift（macOS 內建主體去背）。邊緣半透明的像素把混進去的白底扣掉，免得留一圈白邊。
trim＝裁到角色邊框、補成正方形再縮（立繪、Q 版）；full＝整張縮（頭像）。"""
import subprocess, sys

src, msk, old, dst, size, mode = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]), sys.argv[6]
W, H = map(int, subprocess.check_output(['magick', 'identify', '-format', '%w %h', src]).decode().split())
rgb = subprocess.check_output(['magick', src, '-alpha', 'off', '-depth', '8', 'rgb:-'])
m = subprocess.check_output(['magick', msk, '-resize', f'{W}x{H}!', '-depth', '8', 'gray:-'])

# 補洞：主體去背偶爾會把角色身上一塊挖空（狼頭像的耳朵、蝗蟲半透明的翅膀）。
# 判法：被主體整圈包住、而且原圖那塊九成以上不是白的，就當成角色的一部分補回來；包住的白洞（腿縫）照樣挖掉。
from collections import deque
m = bytearray(m); seen = bytearray(W * H); q = deque()
def spread(start, keep=None):
    seen[start] = 1; q.append(start)
    while q:
        p = q.popleft(); x = p % W
        if keep is not None: keep.append(p)
        for d in (-W, W, -1 if x else 0, 1 if x < W - 1 else 0):
            n = p + d
            if d and 0 <= n < W * H and m[n] < 128 and not seen[n]: seen[n] = 1; q.append(n)
for i in range(W):
    for p in (i, (H - 1) * W + i):
        if m[p] < 128 and not seen[p]: spread(p)
for j in range(H):
    for p in (j * W, j * W + W - 1):
        if m[p] < 128 and not seen[p]: spread(p)
filled = 0
for p0 in range(W * H):
    if m[p0] >= 128 or seen[p0]: continue
    comp = []; spread(p0, comp)
    solid = sum(1 for p in comp if 765 - rgb[p * 3] - rgb[p * 3 + 1] - rgb[p * 3 + 2] > 90)
    if len(comp) >= 20 and solid * 10 >= len(comp) * 9:
        filled += len(comp); edge = comp
        for _ in range(5):       # 洞緣那圈半透明也一起補實，不然會留一圈淡痕
            nxt = []
            for p in edge:
                m[p] = 255; x = p % W
                for d in (-W, W, -1 if x else 0, 1 if x < W - 1 else 0):
                    n = p + d
                    if d and 0 <= n < W * H and m[n] < 255: m[n] = 255; nxt.append(n)
            edge = nxt
if filled: print(f'  補洞 {filled}px')

out = bytearray(W * H * 4)
x0, y0, x1, y1 = W, H, -1, -1
for i in range(W * H):
    a = m[i]
    if a < 10: continue          # 遮罩外：全透明
    if a > 245: a = 255
    o, s = i * 4, i * 3
    if a == 255:
        out[o], out[o + 1], out[o + 2] = rgb[s], rgb[s + 1], rgb[s + 2]
    else:                        # 邊緣：原圖是「角色色 × a ＋ 白 ×（1−a）」，把白扣回去
        for c in range(3):
            v = 255 - (255 - rgb[s + c]) * 255 // a
            out[o + c] = 0 if v < 0 else v
    out[o + 3] = a
    if a > 12:
        y, x = divmod(i, W)
        if x < x0: x0 = x
        if x > x1: x1 = x
        if y < y0: y0 = y
        if y > y1: y1 = y

base = ['magick', '-size', f'{W}x{H}', '-depth', '8', 'rgba:-']
if mode == 'trim':
    bw, bh = x1 - x0 + 1, y1 - y0 + 1; side = max(bw, bh)
    base += ['-crop', f'{bw}x{bh}+{x0}+{y0}', '+repage', '-background', 'none', '-gravity', 'center', '-extent', f'{side}x{side}']
base += ['-resize', f'{size}x{size}']

def thumb(cmd, stdin=None):      # 48px、鋪灰底，拿來跟舊圖比方向
    return subprocess.run(cmd + ['-background', 'gray', '-flatten', '-resize', '48x48!', '-depth', '8', 'rgb:-'], input=stdin, stdout=subprocess.PIPE, check=True).stdout

flop = False
try:
    o = thumb(['magick', old]); n = thumb(base, bytes(out)); f = thumb(base + ['-flop'], bytes(out))
    d1 = sum((a - b) ** 2 for a, b in zip(o, n)); d2 = sum((a - b) ** 2 for a, b in zip(o, f))
    flop = d2 < d1
except Exception as e:
    print('比不了方向，照原圖方向', e)
subprocess.run(base + (['-flop'] if flop else []) + ['-quality', '92', '-define', 'webp:alpha-quality=100', dst], input=bytes(out), check=True)
print(dst.split('/')[-1], '翻' if flop else '不翻')
