// Board geometry on a 15x15 grid. Cells are [row, col]; positions returned as [x, y] cell centers.
import type { Color } from './engine';

type Cell = [number, number];

// 52-cell main loop, clockwise, starting at red's entry square.
export const PATH: Cell[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];

export const HOME_COLUMN: Record<Color, Cell[]> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

// Top-left corner of each 6x6 yard.
export const YARD: Record<Color, Cell> = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] };

const YARD_SPOTS: [number, number][] = [[1.8, 1.8], [4.2, 1.8], [1.8, 4.2], [4.2, 4.2]];
const FINISH: Record<Color, [number, number]> = {
  red: [6.55, 7.5], green: [7.5, 6.55], yellow: [8.45, 7.5], blue: [7.5, 8.45],
};
const FINISH_SPREAD: [number, number][] = [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]];

const center = ([r, c]: Cell): [number, number] => [c + 0.5, r + 0.5];

export function tokenXY(color: Color, start: number, progress: number, idx: number): [number, number] {
  if (progress < 0) {
    const [r, c] = YARD[color];
    const [sx, sy] = YARD_SPOTS[idx];
    return [c + sx, r + sy];
  }
  if (progress <= 50) return center(PATH[(start + progress) % 52]);
  if (progress <= 55) return center(HOME_COLUMN[color][progress - 51]);
  const [fx, fy] = FINISH[color];
  const [dx, dy] = FINISH_SPREAD[idx];
  return [fx + dx * 0.6, fy + dy * 0.6];
}
