# 사냥꾼 손님 초상 4종족 (Scenario Seedream 1024 → 64×64, 기존 g_* 초상과 같은 남색 배경 · 40색)
from PIL import Image
SRC = 'asset_raw/hunter'
MAP = {0: 'halfling', 1: 'dwarf', 2: 'elf', 3: 'human'}
BG = Image.open('public/assets/portraits/g_rogue_human.png').convert('RGB').getpixel((1, 1))
outs = []
for i, race in MAP.items():
    im = Image.open(f'{SRC}/h_{i}.png').convert('RGB')
    w, h = im.size
    s = int(w * 0.86); x0 = (w - s) // 2; y0 = int((h - s) * 0.2)
    sm = im.crop((x0, y0, x0 + s, y0 + s)).resize((64, 64), Image.LANCZOS)
    corner = sm.getpixel((0, 0)); px = sm.load()
    for y in range(64):
        for x in range(64):
            c = px[x, y]
            if sum(abs(c[k] - corner[k]) for k in range(3)) < 46: px[x, y] = BG
    q = sm.quantize(colors=40, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    q.save(f'{SRC}/g_hunter_{race}.png'); outs.append(q)
ref = [Image.open(f'public/assets/portraits/g_rogue_{r}.png').convert('RGB') for r in ['human', 'elf', 'dwarf', 'halfling']]
new = [Image.open(f'{SRC}/g_hunter_{r}.png') for r in ['human', 'elf', 'dwarf', 'halfling']]
S = 4; c = Image.new('RGB', (4 * (64 * S + 8), 2 * (64 * S + 8)), (12, 12, 20))
for r, row in enumerate([ref, new]):
    for k, im in enumerate(row): c.paste(im.resize((64 * S, 64 * S), Image.NEAREST), (k * (64 * S + 8), r * (64 * S + 8)))
c.save(f'{SRC}/_compare.png'); print('ok')
