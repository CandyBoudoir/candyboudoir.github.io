# Small geometry helpers for the motif generator: cubic chains, normals,
# offsets, and path output.
import math

def cubic(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1])

def chain(start, segs, n=40):
    """segs: list of (c1, c2, end). Returns sampled points."""
    pts = [start]; p = start
    for c1, c2, e in segs:
        for i in range(1, n + 1):
            pts.append(cubic(p, c1, c2, e, i / n))
        p = e
    return pts

def resample(pts, step):
    out = [pts[0]]; acc = 0.0
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b); acc += d
        while acc >= step:
            k = 1 - (acc - step) / d if d else 0
            out.append((a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)); acc -= step
    out.append(pts[-1])
    return out

def tangents(pts):
    T = []
    for i in range(len(pts)):
        a = pts[max(0, i - 1)]; b = pts[min(len(pts) - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dy) or 1
        T.append((dx / l, dy / l))
    return T

def offset(pts, d):
    """Offset to the left of travel (screen coords): n = (ty, -tx)."""
    T = tangents(pts)
    return [(p[0] + t[1] * d, p[1] - t[0] * d) for p, t in zip(pts, T)]

def poly(pts, close=True, prec=2):
    f = lambda v: f'{v:.{prec}f}'.rstrip('0').rstrip('.')
    s = 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in pts)
    return s + ('Z' if close else '')

def rot(p, a, c=(0, 0)):
    s, co = math.sin(a), math.cos(a)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * co - y * s, c[1] + x * s + y * co)

def fmt(v):
    return f'{v:.2f}'.rstrip('0').rstrip('.')
