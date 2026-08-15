#!/usr/bin/env python3
"""生成应用图标。

设计取自游戏本身：宣纸底、水墨云海、望仙峰的剪影、一枚朱砂印。
在 1024 上画，再降采样到各尺寸——小尺寸下细节会糊，所以形要够简。

用法：python3 tools/make_icons.py
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')
S = 1024

PAPER = (245, 241, 232)
INK = (43, 43, 43)
PALE = (122, 117, 112)
STONE = (74, 110, 138)
CINNABAR = (184, 74, 62)

CJK = '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf'


def paper_bg(size):
    """宣纸底：暖白 + 极淡的纤维噪点"""
    im = Image.new('RGB', (size, size), PAPER)
    noise = Image.effect_noise((size, size), 22).convert('L')
    noise = noise.filter(ImageFilter.GaussianBlur(0.6))
    im = Image.composite(Image.new('RGB', (size, size), (236, 231, 220)), im, noise.point(lambda v: 255 if v > 145 else 0))
    return im


def cloud_band(size, y, height, alpha, seed):
    """一条水墨云带。用多个椭圆叠出起伏，再整体模糊。"""
    layer = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(layer)
    n = 6
    rnd = random.Random(seed * 977)
    # 云头要比间距窄、还要上下错开，上缘才有起伏。
    # 早期版本椭圆宽 0.3×size、间距只有 0.11×size，全糊成一块板砖，
    # 描出来的边就是一条笔直的横线。
    for i in range(n + 1):
        cx = size * (i - 0.1) / (n - 1) + rnd.uniform(-0.03, 0.03) * size
        w = size * rnd.uniform(0.17, 0.27)
        h = height * rnd.uniform(0.90, 1.40)
        cy = y + rnd.uniform(-0.30, 0.15) * height
        d.ellipse([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], fill=alpha)
    # 云带下方填实，免得山脚从云缝里漏出来。
    # 抖动范围与椭圆高度是配着调的：最靠上的那个云头底边（y-0.30h+0.45h）
    # 也要压过这条线，否则云头之间会留出缝，描边时那道缝会被当成轮廓，
    # 在画面底部画出一个莫名其妙的方桶。
    d.rectangle([0, y + height * 0.12, size, size], fill=alpha)
    layer = layer.filter(ImageFilter.GaussianBlur(size * 0.016))
    return layer


def cloud_edge(band, weight=0.010, ink=150):
    """云带的上缘。
    纸色的云压在纸色的底上是看不见的——必须给它一道浅墨的边，云才显形，
    否则整个下半张就只是一片莫名其妙的渐隐。
    直接对模糊的云带做错位相减是不行的（云带本身有 36px 的高斯羽化，
    相减出来的差值淡到看不出来）。先把它二值化成硬边，再和「整体下移
    一个笔画宽度」的版本相减，留下的就是紧贴顶部轮廓的一条实边。"""
    size = band.width
    hi = band.getextrema()[1]
    solid = band.point(lambda v: 255 if v > hi * 0.5 else 0)
    w = max(2, int(size * weight))
    down = solid.transform((size, size), Image.AFFINE, (1, 0, 0, 0, 1, -w),
                           resample=Image.NEAREST)
    edge = ImageChops.subtract(solid, down)          # 只留上缘，下缘会被下一层云盖住
    edge = edge.point(lambda v: ink if v > 127 else 0)
    # 最下面那条云带的云头会垂到画面底部，描出来是个突兀的"桶底"。
    # 底部一成留白，边线一律不画。
    ImageDraw.Draw(edge).rectangle([0, int(size * 0.865), size, size], fill=0)
    return edge.filter(ImageFilter.GaussianBlur(size * 0.0022))


def peak(size):
    """望仙峰：一主一次两座剪影，主峰偏左。
    山脊不用直线——加两处折点，才有山的样子而不是三角形。"""
    layer = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(layer)
    base = size * 0.72
    # 主峰：左坡陡、右坡带一处肩
    d.polygon([
        (size * 0.17, base),
        (size * 0.30, size * 0.44),
        (size * 0.42, size * 0.17),
        (size * 0.52, size * 0.36),
        (size * 0.60, size * 0.31),
        (size * 0.71, base),
    ], fill=225)
    # 次峰
    d.polygon([
        (size * 0.60, base),
        (size * 0.73, size * 0.33),
        (size * 0.81, size * 0.45),
        (size * 0.92, base),
    ], fill=155)
    layer = layer.filter(ImageFilter.GaussianBlur(size * 0.0035))
    return layer


def seal(size, glyph='霄'):
    """朱砂印：圆角方框 + 阴刻的字。全图唯一的高饱和色。"""
    box = int(size * 0.265)
    im = Image.new('RGBA', (box, box), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(box * 0.16)
    d.rounded_rectangle([0, 0, box - 1, box - 1], radius=r, fill=CINNABAR + (255,))

    if os.path.exists(CJK):
        for fs in range(int(box * 0.82), int(box * 0.4), -2):
            f = ImageFont.truetype(CJK, fs)
            l, t, rr, b = d.textbbox((0, 0), glyph, font=f)
            if rr - l <= box * 0.68 and b - t <= box * 0.68:
                break
        l, t, rr, b = d.textbbox((0, 0), glyph, font=f)
        d.text(((box - (rr - l)) / 2 - l, (box - (b - t)) / 2 - t), glyph, font=f, fill=PAPER + (255,))
    else:
        # 没有中文字体时退回一个抽象印记，不至于开天窗
        d.rectangle([box * 0.28, box * 0.30, box * 0.72, box * 0.38], fill=PAPER + (255,))
        d.rectangle([box * 0.28, box * 0.46, box * 0.72, box * 0.54], fill=PAPER + (255,))
        d.rectangle([box * 0.44, box * 0.30, box * 0.56, box * 0.72], fill=PAPER + (255,))
    return im


def ink_wash(size, top=(38, 38, 38), bottom=(96, 100, 106)):
    """一块自上而下由浓转淡的墨——山用它填色，比纯灰有笔意"""
    g = Image.new('RGB', (1, size))
    px = g.load()
    for y in range(size):
        t = y / size
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return g.resize((size, size))


def build(size=S):
    im = paper_bg(size).convert('RGBA')

    # 远山：淡青，压在云带下面
    far = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(far)
    d.polygon([(0, size * 0.62), (size * 0.22, size * 0.40), (size * 0.46, size * 0.62)], fill=90)
    d.polygon([(size * 0.62, size * 0.62), (size * 0.86, size * 0.44), (size, size * 0.62)], fill=70)
    far = far.filter(ImageFilter.GaussianBlur(size * 0.02))
    im.paste(Image.new('RGB', (size, size), STONE), (0, 0), far)

    # 主峰：用墨色渐变填，峰顶浓、山脚淡
    im.paste(ink_wash(size), (0, 0), peak(size))

    # 云海：三层，越往下越实，把山脚吃掉。
    # 每层先描一道浅墨上缘再铺纸色，云才立得住。
    for i, (y, h, a) in enumerate([
        (size * 0.60, size * 0.13, 105),
        (size * 0.70, size * 0.15, 165),
        (size * 0.80, size * 0.17, 225),
    ]):
        band = cloud_band(size, y, h, a, i + 1)
        im.paste(Image.new('RGB', (size, size), PAPER), (0, 0), band)
        im.paste(Image.new('RGB', (size, size), STONE), (0, 0),
                 cloud_edge(band, ink=120 + i * 30))

    # 底部收边，让图标在圆角遮罩下也干净
    grad = Image.new('L', (size, size), 0)
    g = ImageDraw.Draw(grad)
    for y in range(int(size * 0.88), size):
        t = (y - size * 0.88) / (size * 0.12)
        g.line([(0, y), (size, y)], fill=int(255 * min(1, t * 1.2)))
    im.paste(Image.new('RGB', (size, size), PAPER), (0, 0), grad)

    # 朱砂印，压在右下角。留出约一成的边距，
    # 免得安卓的圆角遮罩把印章啃掉一角。
    sl = seal(size)
    im.alpha_composite(sl, (int(size * 0.635), int(size * 0.635)))

    return im.convert('RGB')


def rounded(im, radius_ratio=0.2237):
    """带圆角的版本，给 favicon 和 manifest 的 maskable 之外的场景用"""
    size = im.width
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1],
                                           radius=int(size * radius_ratio), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im.convert('RGBA'), (0, 0), mask)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    master = build(S)

    # iOS 的 apple-touch-icon 由系统自己加圆角，必须给方图，否则会出现双重圆角
    square_sizes = [180, 167, 152, 120]
    for s in square_sizes:
        master.resize((s, s), Image.LANCZOS).save(os.path.join(OUT, f'apple-touch-icon-{s}.png'))
    master.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'))

    # Android / PWA
    for s in [192, 512]:
        master.resize((s, s), Image.LANCZOS).save(os.path.join(OUT, f'icon-{s}.png'))

    # maskable：安全区在中间 80%，所以把画面整体缩一圈，四周留白
    for s in [192, 512]:
        pad = Image.new('RGB', (S, S), PAPER)
        inner = master.resize((int(S * 0.78), int(S * 0.78)), Image.LANCZOS)
        pad.paste(inner, (int(S * 0.11), int(S * 0.11)))
        pad.resize((s, s), Image.LANCZOS).save(os.path.join(OUT, f'icon-maskable-{s}.png'))

    # favicon：小尺寸下细节全糊，单独重画一版（去掉远山，只留主峰＋印）
    for s in [32, 48]:
        f = master.resize((s * 8, s * 8), Image.LANCZOS).filter(ImageFilter.SHARPEN)
        rounded(f.resize((s, s), Image.LANCZOS), 0.18).save(os.path.join(OUT, f'favicon-{s}.png'))

    # 启动画面用的纯色底（iOS standalone 冷启动时的底色）
    master.resize((1024, 1024), Image.LANCZOS).save(os.path.join(OUT, 'icon-1024.png'))

    files = sorted(os.listdir(OUT))
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in files)
    print(f'生成 {len(files)} 个图标，合计 {total/1024:.0f} KB')
    for f in files:
        print(f'  {f:<32} {os.path.getsize(os.path.join(OUT, f))/1024:>6.1f} KB')


if __name__ == '__main__':
    main()
