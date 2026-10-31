#!/usr/bin/env python3
"""把被角色完全包住、去背時填不到的純白封閉區挖成透明（例如弓身與弓弦之間）。
用法：holefix.py <in.webp> <out.webp> [min_rgb] [min_px] [skip]
只動「不碰到透明區也不碰到邊界」的近白連通元件；周圍一圈像素依白度羽化。
skip：逗號分隔、從 1 數的洞編號（依列印順序），這些是眼白／火光等正當的白，不挖。"""
import subprocess, sys
from collections import deque

src, dst = sys.argv[1], sys.argv[2]
WT = int(sys.argv[3]) if len(sys.argv) > 3 else 215   # 近白：r,g,b 最小值 ≥ WT
MINPX = int(sys.argv[4]) if len(sys.argv) > 4 else 40  # 太小的（眼白等）不動
SKIP = {int(t) for t in sys.argv[5].split(',') if t} if len(sys.argv) > 5 else set()

wh = subprocess.check_output(['magick', 'identify', '-format', '%w %h', src]).decode().split()
W, H = int(wh[0]), int(wh[1])
raw = bytearray(subprocess.check_output(['magick', src, '-depth', '8', 'rgba:-']))
N = W * H

def px(i):
    o = i * 4; return raw[o], raw[o + 1], raw[o + 2], raw[o + 3]

def nb(i):
    y, x = divmod(i, W)
    if x > 0: yield i - 1
    if x < W - 1: yield i + 1
    if y > 0: yield i - W
    if y < H - 1: yield i + W

cand = bytearray(N)
for i in range(N):
    r, g, b, a = px(i)
    if a >= 8 and min(r, g, b) >= WT and max(r, g, b) - min(r, g, b) <= 40: cand[i] = 1

seen = bytearray(N); holes = []; nskip = 0
for s in range(N):
    if not cand[s] or seen[s]: continue
    comp = []; q = deque([s]); seen[s] = 1; touches = False
    while q:
        i = q.popleft(); comp.append(i)
        y, x = divmod(i, W)
        if x == 0 or x == W - 1 or y == 0 or y == H - 1: touches = True
        for j in nb(i):
            if raw[j * 4 + 3] < 8: touches = True
            if cand[j] and not seen[j]: seen[j] = 1; q.append(j)
    if touches or len(comp) < MINPX: continue
    xs = [i % W for i in comp]; ys = [i // W for i in comp]
    n = len(holes) + nskip + 1
    print(f'  hole{n} {len(comp)} px  x{min(xs)}-{max(xs)} y{min(ys)}-{max(ys)}' + ('  (skip)' if n in SKIP else ''))
    if n in SKIP: nskip += 1; continue
    holes.append(comp)

inhole = bytearray(N)
for comp in holes:
    for i in comp: inhole[i] = 1
ring = set()
for comp in holes:
    for i in comp:
        for j in nb(i):
            if not inhole[j]: ring.add(j)
for i in ring:                      # 羽化：越白越透
    r, g, b, a = px(i); m = (r + g + b) / 3
    k = min(1.0, max(0.0, (255 - m) / 60))
    raw[i * 4 + 3] = int(a * k)
for comp in holes:
    for i in comp: raw[i * 4 + 3] = 0

subprocess.run(['magick', '-size', f'{W}x{H}', '-depth', '8', 'rgba:-', '-quality', '88', dst], input=bytes(raw), check=True)
print(f'{src}: {len(holes)} holes, {sum(len(c) for c in holes)} px')
