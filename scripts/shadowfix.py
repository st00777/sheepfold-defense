#!/usr/bin/env python3
"""把去背後留下的淺灰軟陰影／純白洞，轉成半透明深色地面陰影。
用法：shadowfix.py <in.webp> <out.webp> [chroma_max] [light_min] [top_frac]
讀寫都經 magick（raw rgba），純 Python 不靠 PIL。"""
import subprocess, sys
from collections import deque

src, dst = sys.argv[1], sys.argv[2]
CH = int(sys.argv[3]) if len(sys.argv) > 3 else 14     # 彩度上限（max-min，0-255）
LM = int(sys.argv[4]) if len(sys.argv) > 4 else 150    # 亮度下限（平均值）
TOP = float(sys.argv[5]) if len(sys.argv) > 5 else .45  # 只處理這個比例以下的列
MAXA = 0.42                                            # 陰影最深的透明度

wh = subprocess.check_output(['magick', 'identify', '-format', '%w %h', src]).decode().split()
W, H = int(wh[0]), int(wh[1])
raw = bytearray(subprocess.check_output(['magick', src, '-depth', '8', 'rgba:-']))
N = W * H
y0 = int(H * TOP)

def px(i):
    o = i * 4; return raw[o], raw[o + 1], raw[o + 2], raw[o + 3]

cand = bytearray(N)   # 1＝候選（低彩、偏亮、不透明、在下半部）
for y in range(y0, H):
    for x in range(W):
        i = y * W + x; r, g, b, a = px(i)
        if a < 8: continue
        mx, mn = max(r, g, b), min(r, g, b)
        if mx - mn <= CH and (r + g + b) / 3 >= LM: cand[i] = 1

# 連通元件：只有「碰到透明區或影像邊界」的元件才算地面；完全被角色包住的洞，若平均亮度 > 235（純白）也算
seen = bytearray(N); changed = 0
for s in range(y0 * W, N):
    if not cand[s] or seen[s]: continue
    comp = []; q = deque([s]); seen[s] = 1; touches = False; lsum = 0
    while q:
        i = q.popleft(); comp.append(i); r, g, b, a = px(i); lsum += (r + g + b) / 3
        y, x = divmod(i, W)
        if x == 0 or x == W - 1 or y == H - 1: touches = True
        for j in (i - 1, i + 1, i - W, i + W):
            if j < 0 or j >= N: continue
            if abs((j % W) - x) > 1: continue
            if raw[j * 4 + 3] < 8: touches = True
            if cand[j] and not seen[j]: seen[j] = 1; q.append(j)
    if not touches and lsum / len(comp) < 200: continue
    for i in comp:
        r, g, b, a = px(i); L = (r + g + b) / 765
        na = int(a * min(MAXA, max(0, (1 - L) * 1.6)))
        o = i * 4; raw[o] = raw[o + 1] = raw[o + 2] = 0; raw[o + 3] = na; changed += 1

subprocess.run(['magick', '-size', f'{W}x{H}', '-depth', '8', 'rgba:-', '-quality', '88', dst], input=bytes(raw), check=True)
print(f'{src}: {changed} px')
