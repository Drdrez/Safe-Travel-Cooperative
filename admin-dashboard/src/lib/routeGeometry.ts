export type LatLng = [number, number];

export function segmentLengths(polyline: LatLng[]): number[] {
  const lengths: number[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const [a, b] = [polyline[i], polyline[i + 1]];
    const dLat = a[0] - b[0];
    const dLng = a[1] - b[1];
    lengths.push(Math.sqrt(dLat * dLat + dLng * dLng));
  }
  return lengths;
}

export function positionAlongPolyline(polyline: LatLng[], t: number): LatLng {
  if (polyline.length < 2) return polyline[0];
  const clamped = Math.min(1, Math.max(0, t));
  const lengths = segmentLengths(polyline);
  const total = lengths.reduce((s, l) => s + l, 0);
  if (total === 0) return polyline[0];
  let remaining = clamped * total;
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i];
    if (remaining <= len || i === lengths.length - 1) {
      const segT = len === 0 ? 0 : remaining / len;
      return [
        polyline[i][0] + (polyline[i + 1][0] - polyline[i][0]) * segT,
        polyline[i][1] + (polyline[i + 1][1] - polyline[i][1]) * segT,
      ];
    }
    remaining -= len;
  }
  return polyline[polyline.length - 1];
}
