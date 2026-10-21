/**
 * Driving and walking routes on the road network.
 *
 * Towns are the nodes of a graph whose edges are the road lines of region.ts, so a ride or a passing
 * jeepney can follow the real roads from town to town. Traffic keeps to the right (as in the
 * Philippines) and goes counter-clockwise, seen from above, around roundabouts.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { ROADS, TOWN_LAYOUTS, type TownLayout } from './layout';
import { ROAD_LINES, TOWNS, toWorld } from './region';

export type P = [number, number];

type Edge = { to: string; points: P[]; length: number };

function polylineLength(points: P[]): number {
    let len = 0;
    for (let i = 1; i < points.length; i++) len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    return len;
}

/** Road lines cut at every town they pass through. */
export const ROAD_GRAPH: Map<string, Edge[]> = (() => {
    const graph = new Map<string, Edge[]>(TOWNS.map((t) => [t.slug, []]));
    const townAt = (p: P) => TOWNS.find((t) => t.at[0] === p[0] && t.at[1] === p[1])?.slug;
    for (const line of ROAD_LINES) {
        let start = -1;
        line.points.forEach((p, i) => {
            const town = townAt(p);
            if (!town) return;
            if (start >= 0) {
                const from = townAt(line.points[start])!;
                const points = line.points.slice(start, i + 1).map((q) => toWorld(q));
                const length = polylineLength(points);
                graph.get(from)!.push({ to: town, points, length });
                graph.get(town)!.push({ to: from, points: [...points].reverse(), length });
            }
            start = i;
        });
    }
    return graph;
})();

/** Shortest road path between two town centres (Dijkstra; the graph is tiny). */
export function townRoute(from: string, to: string): P[] | null {
    const dist = new Map<string, number>([[from, 0]]);
    const prev = new Map<string, { town: string; edge: Edge }>();
    const open = new Set([from]);
    while (open.size) {
        let current = '';
        let best = Infinity;
        for (const t of open) {
            if ((dist.get(t) ?? Infinity) < best) {
                best = dist.get(t)!;
                current = t;
            }
        }
        open.delete(current);
        if (current === to) break;
        for (const edge of ROAD_GRAPH.get(current) ?? []) {
            const d = best + edge.length;
            if (d < (dist.get(edge.to) ?? Infinity)) {
                dist.set(edge.to, d);
                prev.set(edge.to, { town: current, edge });
                open.add(edge.to);
            }
        }
    }
    if (from === to || !prev.has(to)) return null;
    const edges: Edge[] = [];
    for (let t = to; t !== from; t = prev.get(t)!.town) edges.unshift(prev.get(t)!.edge);
    return joinEdges(edges.map((e) => e.points));
}

function joinEdges(parts: P[][]): P[] {
    return parts.flatMap((points, i) => (i === 0 ? points : points.slice(1)));
}

/** A random tour of `hops` towns from `start` (no immediate U-turns unless it is a dead end). */
export function randomTour(start: string, hops: number, rand: () => number): P[] {
    const parts: P[][] = [];
    let at = start;
    let came = '';
    for (let i = 0; i < hops; i++) {
        const edges = ROAD_GRAPH.get(at) ?? [];
        const choices = edges.length > 1 ? edges.filter((e) => e.to !== came) : edges;
        if (!choices.length) break;
        const edge = choices[Math.floor(rand() * choices.length)];
        parts.push(edge.points);
        came = at;
        at = edge.to;
    }
    return joinEdges(parts);
}

const ROUNDABOUT_TOWNS = TOWN_LAYOUTS.filter((t) => t.roundabout);

function roundaboutAt(p: P): TownLayout | undefined {
    return ROUNDABOUT_TOWNS.find((t) => Math.hypot(t.center[0] - p[0], t.center[1] - p[1]) < 0.01);
}

/** Replaces each roundabout centre on a path with the ring: drive in, go round counter-clockwise, drive out. */
export function viaRoundabouts(points: P[]): P[] {
    const out: P[] = [];
    points.forEach((p, i) => {
        const town = roundaboutAt(p);
        if (!town) {
            out.push(p);
            return;
        }
        const r = town.roundabout!;
        const [cx, cz] = town.center;
        const angleTo = (q: P) => Math.atan2(q[1] - cz, q[0] - cx);
        const ringPoint = (a: number): P => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
        const prev = points[i - 1];
        const next = points[i + 1];
        if (!prev || !next) {
            out.push(ringPoint(angleTo((prev ?? next)!)));
            return;
        }
        // Counter-clockwise on the map (north up) is a decreasing angle in world x/z.
        const a0 = angleTo(prev);
        let sweep = angleTo(next) - a0;
        while (sweep >= 0) sweep -= Math.PI * 2;
        const steps = Math.max(2, Math.ceil(-sweep / 0.35));
        for (let k = 0; k <= steps; k++) out.push(ringPoint(a0 + (sweep * k) / steps));
    });
    return out;
}

/** The path shifted `d` meters to the right of the direction of travel (the right lane, or the right sidewalk). */
export function offsetRight(points: P[], d: number): P[] {
    return points.map((p, i) => {
        const a = points[Math.max(0, i - 1)];
        const b = points[Math.min(points.length - 1, i + 1)];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [p[0] - ((b[1] - a[1]) / len) * d, p[1] + ((b[0] - a[0]) / len) * d];
    });
}

/** There and back again as one closed loop: right lane out, right lane back, U-turns at the ends. */
export function pingPong(points: P[], d: number): P[] {
    const back = [...points].reverse();
    return [...offsetRight(points, d), ...offsetRight(back, d)];
}

/** The longest stretch of a polyline inside a circle (cut exactly at the edge). */
export function clipToCircle(points: P[], cx: number, cz: number, r: number): P[] {
    let best: P[] = [];
    let run: P[] = [];
    const inside = (p: P) => Math.hypot(p[0] - cx, p[1] - cz) <= r;
    const edge = (a: P, b: P): P => {
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2;
            const q: P = [a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid];
            if (inside(q) === inside(a)) lo = mid;
            else hi = mid;
        }
        return [a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo];
    };
    const finish = () => {
        if (polylineLength(run) > polylineLength(best)) best = run;
        run = [];
    };
    points.forEach((p, i) => {
        const prev = points[i - 1];
        if (inside(p)) {
            if (prev && !inside(prev)) run.push(edge(prev, p));
            run.push(p);
        } else if (prev && inside(prev)) {
            run.push(edge(prev, p));
            finish();
        }
    });
    finish();
    return best;
}

/** Road centre lines inside a town (clipped to its built-up area), longest first. */
export function townRoads(town: TownLayout, radius = town.urban * 0.92): { points: P[]; width: number; length: number }[] {
    return ROADS.map((road) => {
        const points = clipToCircle(road.points, town.center[0], town.center[1], radius);
        return { points, width: road.width, length: polylineLength(points) };
    })
        .filter((r) => r.length > 24)
        .sort((a, b) => b.length - a.length);
}

export type Sample = { x: number; z: number; dx: number; dz: number };

const v = new Vector3();

/** A smooth path (Catmull-Rom through the points) sampled by distance travelled. */
export class Route {
    readonly length: number;
    private curve: CatmullRomCurve3;
    private readonly closed: boolean;

    constructor(points: P[], closed: boolean) {
        // Drop points that sit on top of each other: they make the curve kink.
        const clean = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 0.5);
        this.curve = new CatmullRomCurve3(
            clean.map(([x, z]) => new Vector3(x, 0, z)),
            closed,
            'centripetal',
        );
        this.curve.arcLengthDivisions = Math.max(200, Math.ceil(polylineLength(clean) / 1.5));
        this.length = this.curve.getLength();
        this.closed = closed;
    }

    /** Position and unit direction after `d` meters (wraps around on a closed loop, clamps otherwise). */
    sample(d: number, out: Sample): Sample {
        const L = this.length;
        const u = this.closed ? (((d % L) + L) % L) / L : Math.min(1, Math.max(0, d / L));
        this.curve.getPointAt(u, v);
        out.x = v.x;
        out.z = v.z;
        this.curve.getTangentAt(u, v);
        const len = Math.hypot(v.x, v.z) || 1;
        out.dx = v.x / len;
        out.dz = v.z / len;
        return out;
    }

    /** Distance along the route of the point closest to (x, z), searched at `step` meter spacing. */
    nearest(x: number, z: number, step = 2): number {
        const s: Sample = { x: 0, z: 0, dx: 0, dz: 0 };
        let best = 0;
        let bestD = Infinity;
        for (let d = 0; d <= this.length; d += step) {
            this.sample(d, s);
            const dd = (s.x - x) ** 2 + (s.z - z) ** 2;
            if (dd < bestD) {
                bestD = dd;
                best = d;
            }
        }
        return best;
    }
}

/** Heading (rotation.y) of a model that faces +X, for a direction of travel. */
export function headingX(dx: number, dz: number): number {
    return Math.atan2(-dz, dx);
}

/** Heading (rotation.y) of a character, which faces +Z. */
export function headingZ(dx: number, dz: number): number {
    return Math.atan2(dx, dz);
}

/** Turns `current` toward `target` by at most `rate` (radians), the short way round. */
export function turnToward(current: number, target: number, rate: number): number {
    let diff = target - current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return current + Math.max(-rate, Math.min(rate, diff));
}

/** Deterministic pseudo-random numbers. */
export function seeded(seed: number) {
    let s = Math.max(1, Math.floor(seed) % 2147483647);
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}
