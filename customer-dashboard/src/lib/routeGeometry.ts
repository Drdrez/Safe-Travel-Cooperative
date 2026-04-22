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

export function polylinePlanarLength(polyline: LatLng[]): number {
  return segmentLengths(polyline).reduce((s, l) => s + l, 0);
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function polylineLengthMeters(polyline: LatLng[]): number {
  let m = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    m += haversineMeters(polyline[i], polyline[i + 1]);
  }
  return m;
}

/** Parameter t in [0, 1] moves along the polyline by accumulated planar segment length. */
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

function distSq(a: LatLng, b: LatLng): number {
  const dLat = a[0] - b[0];
  const dLng = a[1] - b[1];
  return dLat * dLat + dLng * dLng;
}

function closestPointOnSegment(p: LatLng, a: LatLng, b: LatLng): { t: number; point: LatLng } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { t: 0, point: a };
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { t, point: [a[0] + t * dx, a[1] + t * dy] };
}

/** Planar arc length from start of polyline to the closest point to `point` (for snapping POIs to the driven path). */
export function arcLengthAtClosestPoint(polyline: LatLng[], point: LatLng): number {
  let bestDist = Infinity;
  let arcAtBest = 0;
  let cum = 0;
  const lengths = segmentLengths(polyline);
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const { t, point: q } = closestPointOnSegment(point, a, b);
    const d = distSq(point, q);
    const len = lengths[i];
    if (d < bestDist) {
      bestDist = d;
      arcAtBest = cum + t * len;
    }
    cum += len;
  }
  return arcAtBest;
}

/** Cumulative distance along `polyline` at each stop (ordered, non-decreasing). */
export function stopArcLengthsOnRoute(stops: LatLng[], polyline: LatLng[]): number[] {
  const arcs = stops.map((s) => arcLengthAtClosestPoint(polyline, s));
  for (let i = 1; i < arcs.length; i++) {
    if (arcs[i] < arcs[i - 1]) arcs[i] = arcs[i - 1];
  }
  return arcs;
}

export function getActiveLegByArcLength(
  progressPct: number,
  stopArcs: number[],
  polylinePlanarTotal: number,
): { from: number; to: number } {
  const n = stopArcs.length;
  if (n < 2) return { from: 0, to: 0 };
  const total = polylinePlanarTotal || 1;
  const vehicleArc = (Math.min(100, Math.max(0, progressPct)) / 100) * total;

  if (vehicleArc <= stopArcs[0] + 1e-8) return { from: 0, to: 1 };
  if (vehicleArc >= stopArcs[n - 1] - 1e-8) return { from: n - 2, to: n - 1 };

  for (let i = 0; i < n - 1; i++) {
    if (vehicleArc >= stopArcs[i] - 1e-8 && vehicleArc < stopArcs[i + 1]) {
      return { from: i, to: i + 1 };
    }
  }

  for (let j = 0; j < n - 1; j++) {
    if (vehicleArc < stopArcs[j + 1]) return { from: j, to: j + 1 };
  }
  return { from: n - 2, to: n - 1 };
}

/** Rough ETA from remaining road distance (urban shuttle ~32 km/h average). */
export function formatEtaMinutesFromRemainingKm(remainingKm: number): string {
  if (remainingKm <= 0) return 'Arrived';
  const hours = remainingKm / 32;
  const mins = Math.max(1, Math.round(hours * 60));
  return `${mins} mins`;
}
