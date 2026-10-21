/**
 * Town layouts, roads, scenery placement and collision for the Region XII world.
 * NPC spots come from the database (locations.position_x/z, matched by slug);
 * landmarks and street plans come from landmarks.ts; this file turns them into world data.
 *
 * Coordinates: x = east, z = south (down the map), y = up. 1 unit ≈ 1 meter. Koronadal is (0, 0).
 */
import { LANDMARKS, LANDMARK_KINDS, TOWN_PLANS, landmarkPoint, landmarkWorld, type Landmark } from './landmarks';
import { FIELDS, LAKES, MAP_SCALE, MOUNTAINS, PROVINCES, ROAD_LINES, TOWNS, pointInPolygon, provinceAt, toMap, toWorld, type MapPoint } from './region';

export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Circle = { x: number; z: number; r: number };

export type BuildingStyle = {
    size: [number, number, number]; // width, height, depth
    wall: string;
    roof: string;
    trim: string;
    sign: string;
    kind: 'house' | 'gazebo' | 'hut';
};

/** South of the Koronadal roundabout, beside the plaza. */
export const PLAYER_SPAWN: [number, number] = [3, 24];

/** Look of each NPC location, keyed by location slug. Unknown slugs fall back to DEFAULT_BUILDING. */
export const BUILDINGS: Record<string, BuildingStyle> = {
    loc_school: { size: [10, 4.5, 6], wall: '#F1EFE8', roof: '#185FA5', trim: '#85B7EB', sign: '#378ADD', kind: 'house' },
    loc_health_center: { size: [8, 4, 6], wall: '#FFFFFF', roof: '#A32D2D', trim: '#F09595', sign: '#E24B4A', kind: 'house' },
    loc_home: { size: [6, 3.5, 5], wall: '#FAC775', roof: '#712B13', trim: '#854F0B', sign: '#BA7517', kind: 'house' },
    loc_plaza: { size: [5, 3.2, 5], wall: '#EEEDFE', roof: '#534AB7', trim: '#AFA9EC', sign: '#7F77DD', kind: 'gazebo' },
    loc_lake_sebu: { size: [4, 3, 4], wall: '#C0DD97', roof: '#3B6D11', trim: '#97C459', sign: '#1D9E75', kind: 'hut' },
    loc_gensan_port: { size: [9, 4, 6], wall: '#E6F1FB', roof: '#0C447C', trim: '#85B7EB', sign: '#378ADD', kind: 'house' },
    loc_isulan_youth: { size: [8, 4, 6], wall: '#EEEDFE', roof: '#3C3489', trim: '#AFA9EC', sign: '#7F77DD', kind: 'house' },
    loc_alabel_capitol: { size: [10, 5, 6], wall: '#F1EFE8', roof: '#993C1D', trim: '#F5C4B3', sign: '#D85A30', kind: 'house' },
    loc_kidapawan_hub: { size: [8, 4, 6], wall: '#EAF3DE', roof: '#27500A', trim: '#C0DD97', sign: '#639922', kind: 'house' },
};

export const DEFAULT_BUILDING: BuildingStyle = { size: [6, 3.5, 5], wall: '#D3D1C7', roof: '#5F5E5A', trim: '#B4B2A9', sign: '#888780', kind: 'house' };

/** NPCs stand in front of their building (south side, toward the default camera). */
export function npcSpot(slug: string, position: [number, number]): [number, number] {
    const style = BUILDINGS[slug] ?? DEFAULT_BUILDING;
    return [position[0], position[1] + style.size[2] / 2 + (style.kind === 'gazebo' ? 1.2 : 1.6)];
}

export type TownLayout = {
    slug: string;
    name: string;
    province: string;
    center: [number, number];
    terminal: [number, number]; // jeepney terminal shed, relative to the centre
    urban: number;
    roundabout?: number;
    /** Provincial bus terminal: world centre and rotation (front faces +Z before rot). */
    bus?: { x: number; z: number; rot: number };
};

export const TOWN_LAYOUTS: TownLayout[] = TOWNS.map((t) => {
    const plan = TOWN_PLANS[t.slug] ?? { terminal: [10, -12], streets: [], urban: 45 };
    const center = toWorld(t.at);
    const bus = plan.bus && { x: center[0] + plan.bus[0], z: center[1] + plan.bus[1], rot: plan.bus[2] };
    return { slug: t.slug, name: t.name, province: t.province, center, terminal: plan.terminal, urban: plan.urban, roundabout: plan.roundabout, bus };
});

export type TravelMode = 'jeepney' | 'bus';

/** Where the jeepney parks at a town's terminal (it faces east). */
export function jeepneyBay(town: TownLayout): [number, number] {
    return [town.center[0] + town.terminal[0] + 6.2, town.center[1] + town.terminal[1] + 0.5];
}

/**
 * Bus terminal layout in its own frame (front, where buses park, faces +Z):
 * a waiting shed along the back, a ticket booth, and two bays along the front curb with buses facing +X.
 */
export const BUS_TERMINAL = {
    size: [30, 18] as [number, number],
    /** Solid boxes [x, z, w, d]: back wall, ticket booth, shed pillars, benches and the parked buses. */
    boxes: [
        [0, -8.4, 28, 0.6], [-11, -5.5, 3.6, 3.2], [-13, 1.2, 0.5, 0.5], [-4.5, 1.2, 0.5, 0.5], [4.5, 1.2, 0.5, 0.5], [13, 1.2, 0.5, 0.5],
        [-5, -5.6, 4, 0.8], [5, -5.6, 4, 0.8], [6.5, 5.2, 11, 2.6], [-7.5, 5.2, 11, 2.6],
    ] as [number, number, number, number][],
    /** Bus bays (bus centre). The first one is the departing bus. */
    bays: [[6.5, 5.2], [-7.5, 5.2]] as [number, number][],
    /** Ticket window: where the player talks to get a ride. */
    spot: [0, -1.5] as [number, number],
    spawn: [0, 1] as [number, number],
};

/** A point in a bus terminal's own frame, in the world. */
export function busPoint(bus: NonNullable<TownLayout['bus']>, x: number, z: number): [number, number] {
    const c = Math.cos(bus.rot);
    const s = Math.sin(bus.rot);
    return [bus.x + x * c + z * s, bus.z - x * s + z * c];
}

/** Where the player appears after a ride. */
export function townSpawn(slug: string, mode: TravelMode = 'jeepney'): [number, number] {
    const town = TOWN_LAYOUTS.find((t) => t.slug === slug);
    if (!town) return PLAYER_SPAWN;
    if (mode === 'bus' && town.bus) return busPoint(town.bus, ...BUS_TERMINAL.spawn);
    return [town.center[0] + town.terminal[0], town.center[1] + town.terminal[1] + 3.5];
}

/* ---------------------------------------------------------------- roads */

export type RoadKind = 'highway' | 'road' | 'street';
export type Road = { kind: RoadKind; width: number; points: [number, number][] };

export const ROAD_WIDTH: Record<RoadKind, number> = { highway: 8, road: 6.5, street: 5.5 };

/** Highways stop at the outer edge of a roundabout's ring instead of crossing its island. */
function trimAtRoundabouts(points: [number, number][]): [number, number][] {
    const out = points.map((p) => [...p] as [number, number]);
    for (const town of TOWN_LAYOUTS) {
        if (!town.roundabout) continue;
        const [cx, cz] = town.center;
        for (const [end, next] of [[0, 1], [out.length - 1, out.length - 2]]) {
            if (Math.hypot(out[end][0] - cx, out[end][1] - cz) > 0.01) continue;
            const dx = out[next][0] - cx;
            const dz = out[next][1] - cz;
            const len = Math.hypot(dx, dz);
            out[end] = [cx + (dx / len) * town.roundabout, cz + (dz / len) * town.roundabout];
        }
    }
    return out;
}

export const ROADS: Road[] = [
    ...ROAD_LINES.map((line) => ({ kind: line.kind, width: ROAD_WIDTH[line.kind], points: trimAtRoundabouts(line.points.map((p) => toWorld(p))) })),
    ...TOWN_LAYOUTS.flatMap((town) =>
        (TOWN_PLANS[town.slug]?.streets ?? []).map((street) => ({
            kind: 'street' as const,
            width: ROAD_WIDTH.street,
            points: street.map(([x, z]) => [town.center[0] + x, town.center[1] + z] as [number, number]),
        })),
    ),
];

export function distToSegment(px: number, pz: number, [ax, az]: [number, number], [bx, bz]: [number, number]): number {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** True when (x, z) is within `margin` meters of a road's edge (or a roundabout ring). */
export function nearRoad(x: number, z: number, margin: number): boolean {
    for (const town of TOWN_LAYOUTS) {
        if (town.roundabout && Math.abs(Math.hypot(x - town.center[0], z - town.center[1]) - town.roundabout) < ROAD_WIDTH.highway / 2 + margin) return true;
    }
    return ROADS.some((road) => road.points.some((p, i) => i > 0 && distToSegment(x, z, road.points[i - 1], p) < road.width / 2 + margin));
}

/* ---------------------------------------------------------------- nature */

export function lakeWorld(lake: (typeof LAKES)[number]) {
    const [x, z] = toWorld(lake.at);
    return { x, z, rx: lake.rx * MAP_SCALE, rz: lake.rz * MAP_SCALE };
}

export function mountainWorld(m: (typeof MOUNTAINS)[number]) {
    const [x, z] = toWorld(m.at);
    return { x, z, r: m.radius * MAP_SCALE, h: m.height };
}

export function inLake(x: number, z: number, pad: number): boolean {
    return LAKES.some((lake) => {
        const l = lakeWorld(lake);
        return ((x - l.x) / (l.rx + pad)) ** 2 + ((z - l.z) / (l.rz + pad)) ** 2 < 1;
    });
}

export type Field = { kind: 'rice' | 'pineapple'; x: number; z: number; w: number; d: number; rot: number };

/** Painted farm fields: the decorative ones from region.ts plus the landmark fields. */
export const FIELD_PATCHES: Field[] = [
    ...FIELDS.map((f) => {
        const [x, z] = toWorld(f.at);
        return { kind: f.kind, x, z, w: f.size[0], d: f.size[1], rot: f.rot };
    }),
    ...LANDMARKS.filter((l) => l.kind === 'fields').map((l) => {
        const [x, z] = landmarkWorld(l);
        return { kind: 'pineapple' as const, x, z, w: 40, d: 30, rot: l.rot };
    }),
];

export function inField(x: number, z: number, pad: number): boolean {
    return FIELD_PATCHES.some((f) => {
        const c = Math.cos(f.rot);
        const s = Math.sin(f.rot);
        const lx = (x - f.x) * c - (z - f.z) * s;
        const lz = (x - f.x) * s + (z - f.z) * c;
        return Math.abs(lx) < f.w / 2 + pad && Math.abs(lz) < f.d / 2 + pad;
    });
}

/** Deterministic pseudo-random numbers so the world looks the same for everyone. */
function seeded(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

const BOUNDS: [MapPoint, MapPoint] = [
    [Math.min(...PROVINCES.flatMap((p) => p.outline.map((q) => q[0]))), Math.min(...PROVINCES.flatMap((p) => p.outline.map((q) => q[1])))],
    [Math.max(...PROVINCES.flatMap((p) => p.outline.map((q) => q[0]))), Math.max(...PROVINCES.flatMap((p) => p.outline.map((q) => q[1])))],
];

function scatter(seed: number, count: number, ok: (x: number, z: number) => boolean, spacing: number): [number, number, number][] {
    const rand = seeded(seed);
    const out: [number, number, number][] = [];
    for (let tries = 0; out.length < count && tries < count * 30; tries++) {
        const px = BOUNDS[0][0] + rand() * (BOUNDS[1][0] - BOUNDS[0][0]);
        const py = BOUNDS[0][1] + rand() * (BOUNDS[1][1] - BOUNDS[0][1]);
        const [x, z] = toWorld([px, py]);
        const scale = 0.8 + rand() * 0.7;
        if (!ok(x, z)) continue;
        if (out.some(([ox, oz]) => Math.abs(ox - x) < spacing && Math.abs(oz - z) < spacing)) continue;
        out.push([x, z, scale]);
    }
    return out;
}

function nearLandmark(x: number, z: number, pad: number): boolean {
    return LANDMARKS.some((l) => {
        const [lx, lz] = landmarkWorld(l);
        return Math.hypot(lx - x, lz - z) < LANDMARK_KINDS[l.kind].radius + pad;
    });
}

function nearBusTerminal(x: number, z: number, pad: number): boolean {
    return TOWN_LAYOUTS.some((t) => t.bus && Math.hypot(t.bus.x - x, t.bus.z - z) < BUS_TERMINAL.size[0] / 2 + 3 + pad);
}

function clearOfLandmarks(x: number, z: number, townPad: number): boolean {
    if (!provinceAt(x, z)) return false;
    if (nearBusTerminal(x, z, 2)) return false;
    if (nearRoad(x, z, 2.5)) return false;
    if (inLake(x, z, 6)) return false;
    if (inField(x, z, 3)) return false;
    if (nearLandmark(x, z, 4)) return false;
    if (TOWN_LAYOUTS.some((t) => Math.hypot(t.center[0] - x, t.center[1] - z) < townPad)) return false;
    if (MOUNTAINS.some((m) => {
        const w = mountainWorld(m);
        return Math.hypot(w.x - x, w.z - z) < w.r + 4;
    })) return false;
    return true;
}

/** Broadleaf, coconut palm or pine. */
export type TreeKind = 0 | 1 | 2;
export type Tree = [number, number, number, TreeKind];

/** Coconut palms on the coast and in the lowlands, pines in the Cotabato and Lake Sebu highlands. */
function treeKind(x: number, z: number, roll: number): TreeKind {
    const [, py] = toMap(x, z);
    const coastal = !provinceAt(x + 30, z) || !provinceAt(x - 30, z) || !provinceAt(x, z + 30) || !provinceAt(x, z - 30);
    if (coastal) return roll < 0.8 ? 1 : 0;
    const province = provinceAt(x, z)?.slug;
    if (province === 'cotabato' && py < 230) return roll < 0.5 ? 2 : 0;
    if (province === 'sarangani' || province === 'general-santos') return roll < 0.55 ? 1 : 0;
    return roll < 0.18 ? 1 : 0;
}

export function treePositions(count: number): Tree[] {
    const rand = seeded(77);
    return scatter(1207, count, (x, z) => clearOfLandmarks(x, z, 26), 3.2).map(([x, z, s]) => [x, z, s, treeKind(x, z, rand())]);
}

/** Rolling hills, mostly in the uplands of Cotabato and Sultan Kudarat. */
export function hillPositions(count: number): [number, number, number][] {
    return scatter(4409, count, (x, z) => {
        const p = provinceAt(x, z);
        return !!p && p.slug !== 'general-santos' && clearOfLandmarks(x, z, 90) && !nearRoad(x, z, 22);
    }, 36);
}

/* ---------------------------------------------------------------- collision */

/**
 * Collision world: solid boxes, round obstacles (trees, hills, mountains) in a grid for fast lookup,
 * lakes and the sea. Every province can be walked into (free roam); quests stay level-locked on the server.
 */
export class CollisionWorld {
    private grid = new Map<string, Circle[]>();
    private readonly cell = 12;
    boxes: Box[];

    constructor(boxes: Box[], circles: Circle[]) {
        this.boxes = boxes;
        for (const c of circles) this.addCircle(c);
    }

    /** Adds more solids after the world is built (e.g. props placed by the town life planner). */
    add(boxes: Box[], circles: Circle[]) {
        this.boxes.push(...boxes);
        for (const c of circles) this.addCircle(c);
    }

    private addCircle(c: Circle) {
        const minCx = Math.floor((c.x - c.r) / this.cell);
        const maxCx = Math.floor((c.x + c.r) / this.cell);
        const minCz = Math.floor((c.z - c.r) / this.cell);
        const maxCz = Math.floor((c.z + c.r) / this.cell);
        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cz = minCz; cz <= maxCz; cz++) {
                const key = `${cx},${cz}`;
                const list = this.grid.get(key);
                if (list) list.push(c);
                else this.grid.set(key, [c]);
            }
        }
    }

    /** Null if the spot is free; otherwise why it is blocked. */
    blocked(x: number, z: number, radius: number): null | 'solid' | 'water' {
        if (!provinceAt(x, z)) return 'water';
        if (inLake(x, z, radius)) return 'water';

        for (const b of this.boxes) {
            if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) return 'solid';
        }
        const list = this.grid.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`);
        if (list) {
            for (const c of list) if (Math.hypot(c.x - x, c.z - z) < c.r + radius) return 'solid';
        }
        return null;
    }

    /** Moves a circle by dx/dz, sliding along walls. Returns the new position and what stopped it, if anything. */
    move(x: number, z: number, dx: number, dz: number, radius: number): { pos: [number, number]; hit: ReturnType<CollisionWorld['blocked']> } {
        let hit: ReturnType<CollisionWorld['blocked']> = null;
        let nx = x + dx;
        const bx = this.blocked(nx, z, radius);
        if (bx) {
            hit = bx;
            nx = x;
        }
        let nz = z + dz;
        const bz = this.blocked(nx, nz, radius);
        if (bz) {
            hit = hit ?? bz;
            nz = z;
        }
        return { pos: [nx, nz], hit };
    }
}

function boxAround(x: number, z: number, w: number, d: number, pad = 0): Box {
    return { minX: x - w / 2 - pad, maxX: x + w / 2 + pad, minZ: z - d / 2 - pad, maxZ: z + d / 2 + pad };
}

/** A landmark's solid parts in world space (boxes become the axis-aligned box around them). */
export function landmarkSolids(l: Landmark): { boxes: Box[]; circles: Circle[] } {
    const kind = LANDMARK_KINDS[l.kind];
    const c = Math.abs(Math.cos(l.rot));
    const s = Math.abs(Math.sin(l.rot));
    return {
        boxes: kind.boxes.map(([x, z, w, d]) => {
            const [wx, wz] = landmarkPoint(l, x, z);
            return boxAround(wx, wz, w * c + d * s, w * s + d * c);
        }),
        circles: kind.circles.map(([x, z, r]) => {
            const [wx, wz] = landmarkPoint(l, x, z);
            return { x: wx, z: wz, r };
        }),
    };
}

/** Solid boxes of an NPC building. */
export function buildingBoxes(slug: string, [x, z]: [number, number]): Box[] {
    const style = BUILDINGS[slug] ?? DEFAULT_BUILDING;
    const [w, , d] = style.size;
    if (style.kind !== 'gazebo') return [boxAround(x, z, w, d, 0.2)];
    const hw = w / 2 - 0.3;
    const hd = d / 2 - 0.3;
    return [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].map(([px, pz]) => boxAround(x + px, z + pz, 0.5, 0.5));
}

/** Terminal shed back wall and the parked jeepney, plus the bus terminal if the town has one. */
export function terminalBoxes(town: TownLayout): Box[] {
    const [cx, cz] = town.center;
    const [jx, jz] = jeepneyBay(town);
    const boxes = [boxAround(cx + town.terminal[0], cz + town.terminal[1] - 1.2, 5, 1.2), boxAround(jx, jz, 6.4, 2.3)];
    const bus = town.bus;
    if (bus) {
        const c = Math.abs(Math.cos(bus.rot));
        const s = Math.abs(Math.sin(bus.rot));
        for (const [x, z, w, d] of BUS_TERMINAL.boxes) {
            const [wx, wz] = busPoint(bus, x, z);
            boxes.push(boxAround(wx, wz, w * c + d * s, w * s + d * c));
        }
    }
    return boxes;
}

export function buildCollisionWorld(locations: { slug: string; position: [number, number] }[], trees: Tree[], hills: [number, number, number][]): CollisionWorld {
    const boxes: Box[] = [];
    const circles: Circle[] = [];

    for (const loc of locations) boxes.push(...buildingBoxes(loc.slug, loc.position));
    for (const town of TOWN_LAYOUTS) boxes.push(...terminalBoxes(town));
    for (const l of LANDMARKS) {
        const solids = landmarkSolids(l);
        boxes.push(...solids.boxes);
        circles.push(...solids.circles);
    }

    circles.push(
        ...trees.map(([x, z, s]) => ({ x, z, r: 0.45 * s })),
        ...hills.map(([x, z, s]) => ({ x, z, r: 9 * s })),
        ...MOUNTAINS.map((m) => {
            const w = mountainWorld(m);
            return { x: w.x, z: w.z, r: w.r * 0.8 };
        }),
    );

    return new CollisionWorld(boxes, circles);
}

/** True if any part of the world-space point is on land inside Region XII. */
export function onRegionLand(x: number, z: number): boolean {
    const [px, py] = toMap(x, z);
    return PROVINCES.some((p) => pointInPolygon(px, py, p.outline));
}
