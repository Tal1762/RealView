import { describe, expect, it } from 'vitest';
import { homography, project, transformQuad, UNIT, validQuad, type Quad } from '../src/features/calibration/math';
describe('wall homography', () => {
  const wall: Quad = [[.13, .2], [.7, .1], [.8, .8], [.2, .65]];
  it('maps every source corner precisely to the calibrated wall', () => {
    const h = homography(UNIT, wall);
    UNIT.forEach((p, i) => project(h, p).forEach((v, axis) => expect(v).toBeCloseTo(wall[i][axis], 9)));
  });
  it('roundtrips interior points through the inverse projection', () => {
    const forward = homography(UNIT, wall), inverse = homography(wall, UNIT);
    for (let x = .1; x < 1; x += .2) for (let y = .1; y < 1; y += .2) {
      const p = project(inverse, project(forward, [x, y])); expect(p[0]).toBeCloseTo(x, 8); expect(p[1]).toBeCloseTo(y, 8);
    }
  });
  it('rejects bowties and degenerate rectangles', () => {
    expect(validQuad([[0, 0], [1, 1], [1, 0], [0, 1]])).toBe(false);
    expect(() => homography(UNIT, [[0, 0], [1, 0], [1, 0], [0, 0]])).toThrow();
  });
  it('accepts opposite winding for a mirrored calibration', () => expect(validQuad([[1, 0], [0, 0], [0, 1], [1, 1]])).toBe(true));
  it('translates, scales and rotates about the center', () => {
    expect(transformQuad(UNIT, .1, -.2)[0][0]).toBeCloseTo(.1, 10);
    expect(transformQuad(UNIT, .1, -.2)[0][1]).toBeCloseTo(-.2, 10);
    expect(transformQuad(UNIT, 0, 0, .5)[0]).toEqual([.25, .25]);
    const rotated = transformQuad(UNIT, 0, 0, 1, Math.PI / 2); expect(rotated[0][0]).toBeCloseTo(1); expect(rotated[0][1]).toBeCloseTo(0);
  });
});
