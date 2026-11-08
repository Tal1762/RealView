export type Point = [number, number];
export type Quad = [Point, Point, Point, Point];
export const UNIT: Quad = [[0, 0], [1, 0], [1, 1], [0, 1]];

/** A convex perimeter is required; winding may be clockwise or counterclockwise. */
export function validQuad(q: Quad): boolean {
  const cross = q.map((p, i) => {
    const b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    return (b[0] - p[0]) * (c[1] - b[1]) - (b[1] - p[1]) * (c[0] - b[0]);
  });
  return cross.every(v => v > 0.00001) || cross.every(v => v < -0.00001);
}

/** Solve the eight projective coefficients with pivoted Gaussian elimination. */
export function homography(from: Quad, to: Quad): number[] {
  if (!validQuad(from) || !validQuad(to)) throw new Error('Corners must form a nonzero convex quadrilateral.');
  const rows = from.flatMap(([x, y], i) => {
    const [u, v] = to[i];
    return [[x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]];
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const d = rows[col][col];
    if (Math.abs(d) < 1e-10) throw new Error('Degenerate wall calibration.');
    for (let k = col; k <= 8; k++) rows[col][k] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = rows[r][col];
      for (let k = col; k <= 8; k++) rows[r][k] -= f * rows[col][k];
    }
  }
  return [...rows.map(r => r[8]), 1];
}
export function project(h: number[], [x, y]: Point): Point {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}
export function transformQuad(q: Quad, dx = 0, dy = 0, scale = 1, radians = 0): Quad {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  return q.map(([x, y]) => {
    const a = (x - cx) * scale, b = (y - cy) * scale;
    return [cx + dx + a * Math.cos(radians) - b * Math.sin(radians), cy + dy + a * Math.sin(radians) + b * Math.cos(radians)];
  }) as Quad;
}
