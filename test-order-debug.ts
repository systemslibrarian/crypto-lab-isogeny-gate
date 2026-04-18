import { ECPoint, Curve, pointAdd, scalarMul, allPoints } from './src/ec';

const curve: Curve = { a: 1n, b: 1n, p: 7n };
const pts = allPoints(curve);
const p = pts[1];

console.log('Point:', p);

let current: ECPoint = p;
for (let i = 1; i <= 6; i++) {
  console.log(`${i}*P = (${current?.x}, ${current?.y})`);
  current = pointAdd(current, p, curve);
}
