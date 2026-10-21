/**
 * Town layouts, scenery placement and collision for the Region XII world.
 * NPC spots come from the database (locations.position_x/z, matched by slug);
 * this file decides how each spot looks and where scenery goes.
 *
 * Coordinates: x = east, z = south (down the map), y = up. 1 unit ≈ 1 meter. Koronadal is (0, 0).
 */
import { LAKES, MAP_SCALE, MOUNTAINS, PROVINCES, ROAD_LINES, TOWNS, pointInPolygon, provinceAt, toMap, toWorld, type MapPoint, type Province } from './region';

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

export const PLAYER_SPAWN: [number, number] = [0, 8];

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

/** Decorative house: [x, z, w, h, d, wall, roof] in world units. */
export type House = [number, number, number, number, number, string, string];

const HOUSE_COLORS: [string, string][] = [
    ['#F5C4B3', '#993C1D'], ['#B5D4F4', '#0C447C'], ['#FAEEDA', '#854F0B'], ['#E1F5EE', '#0F6E56'],
    ['#FBEAF0', '#993556'], ['#F1EFE8', '#444441'], ['#EAF3DE', '#27500A'], ['#FCEBEB', '#791F1F'],
];

export type TownLayout = {
    slug: string;
    name: string;
    province: string;
    center: [number, number];
    plazaRadius: number;
    houses: House[];
    streets: [number, number, number, number][]; // [x, z, width, depth], axis-aligned
    terminal: [number, number]; // jeepney terminal shed position
};

function townLayout(slug: string): Omit<TownLayout, 'slug' | 'name' | 'province' | 'center'> {
    if (slug === 'koronadal') {
        // The hand-made starting town (NPC buildings come from the database).
        return {
            plazaRadius: 7.5,
            houses: [
                [-28, -10, 5, 3, 4, ...HOUSE_COLORS[0]], [-28, 2, 5, 3, 4, ...HOUSE_COLORS[1]],
                [-6, -24, 6, 3.4, 4, ...HOUSE_COLORS[2]], [8, -24, 5, 3, 4, ...HOUSE_COLORS[3]],
                [28, -10, 5, 3, 4, ...HOUSE_COLORS[4]], [28, 2, 5, 3.2, 4, ...HOUSE_COLORS[5]],
                [-6, 24, 5, 3, 4, ...HOUSE_COLORS[6]], [-28, 24, 5, 3, 4, ...HOUSE_COLORS[7]],
            ],
            streets: [[0, 0, 76, 4], [0, -2, 4, 44]],
            terminal: [-12, 6],
        };
    }
    // Other towns: a plaza ringed by houses.
    const houses: House[] = [];
    const seed = slug.length;
    for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2 + seed;
        const r = 20 + (i % 2) * 6;
        const x = Math.round(Math.cos(angle) * r);
        const z = Math.round(Math.sin(angle) * r);
        if (z > 4 && Math.abs(x) < 9) continue; // keep the front of the NPC building clear
        houses.push([x, z, 5, 3, 4, ...HOUSE_COLORS[(i + seed) % HOUSE_COLORS.length]]);
    }
    return { plazaRadius: 9, houses, streets: [[0, 0, 50, 4]], terminal: [-12, 7] };
}

export const TOWN_LAYOUTS: TownLayout[] = TOWNS.map((t) => {
    const center = toWorld(t.at);
    const layout = townLayout(t.slug);
    // Drop generated houses that would land in a lake or the sea.
    const houses = layout.houses.filter(([x, z]) => provinceAt(center[0] + x, center[1] + z) && !inLake(center[0] + x, center[1] + z, 4));
    return { slug: t.slug, name: t.name, province: t.province, center, ...layout, houses };
});

/** Where the player appears after a jeepney ride. */
export function townSpawn(slug: string): [number, number] {
    const town = TOWN_LAYOUTS.find((t) => t.slug === slug);
    if (!town) return PLAYER_SPAWN;
    return [town.center[0] + town.terminal[0], town.center[1] + town.terminal[1] + 3.5];
}

/** Road polylines in world units. */
export const ROADS: [number, number][][] = ROAD_LINES.map((line) => line.map((p) => toWorld(p)));

function distToSegment(px: number, pz: number, [ax, az]: [number, number], [bx, bz]: [number, number]): number {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function nearRoad(x: number, z: number, margin: number): boolean {
    return ROADS.some((line) => line.some((p, i) => i > 0 && distToSegment(x, z, line[i - 1], p) < margin));
}

export function lakeWorld(lake: (typeof LAKES)[number]) {
    const [x, z] = toWorld(lake.at);
    return { x, z, rx: lake.rx * MAP_SCALE, rz: lake.rz * MAP_SCALE };
}

export function mountainWorld(m: (typeof MOUNTAINS)[number]) {
    const [x, z] = toWorld(m.at);
    return { x, z, r: m.radius * MAP_SCALE, h: m.height };
}

function inLake(x: number, z: number, pad: number): boolean {
    return LAKES.some((lake) => {
        const l = lakeWorld(lake);
        return ((x - l.x) / (l.rx + pad)) ** 2 + ((z - l.z) / (l.rz + pad)) ** 2 < 1;
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

function clearOfLandmarks(x: number, z: number, townPad: number): boolean {
    if (!provinceAt(x, z)) return false;
    if (nearRoad(x, z, 6)) return false;
    if (inLake(x, z, 6)) return false;
    if (TOWN_LAYOUTS.some((t) => Math.hypot(t.center[0] - x, t.center[1] - z) < townPad)) return false;
    if (MOUNTAINS.some((m) => {
        const w = mountainWorld(m);
        return Math.hypot(w.x - x, w.z - z) < w.r + 4;
    })) return false;
    return true;
}

export function treePositions(count: number): [number, number, number][] {
    return scatter(1207, count, (x, z) => clearOfLandmarks(x, z, 42), 3);
}

/** Rolling hills, mostly in the uplands of Cotabato and Sultan Kudarat. */
export function hillPositions(count: number): [number, number, number][] {
    return scatter(4409, count, (x, z) => {
        const p = provinceAt(x, z);
        return !!p && p.slug !== 'general-santos' && clearOfLandmarks(x, z, 70) && !nearRoad(x, z, 18);
    }, 24);
}

/**
 * Collision world: solid boxes, round obstacles (trees, hills, mountains) in a grid for fast lookup,
 * lakes, and which provinces may be entered.
 */
export class CollisionWorld {
    private grid = new Map<string, Circle[]>();
    private readonly cell = 12;

    constructor(
        public boxes: Box[],
        circles: Circle[],
        private lockedProvinces: Set<string>,
    ) {
        for (const c of circles) {
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
    }

    /** Null if the spot is free; otherwise why it is blocked ("locked" carries the province). */
    blocked(x: number, z: number, radius: number): null | 'solid' | 'water' | { locked: Province } {
        const province = provinceAt(x, z);
        if (!province) return 'water';
        if (this.lockedProvinces.has(province.slug)) return { locked: province };
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

export function buildCollisionWorld(
    locations: { slug: string; position: [number, number] }[],
    trees: [number, number, number][],
    hills: [number, number, number][],
    lockedProvinces: Set<string>,
): CollisionWorld {
    const boxes: Box[] = [];

    for (const loc of locations) {
        const style = BUILDINGS[loc.slug] ?? DEFAULT_BUILDING;
        const [w, , d] = style.size;
        if (style.kind === 'gazebo') {
            const hw = w / 2 - 0.3;
            const hd = d / 2 - 0.3;
            for (const [px, pz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) boxes.push(boxAround(loc.position[0] + px, loc.position[1] + pz, 0.5, 0.5));
        } else {
            boxes.push(boxAround(loc.position[0], loc.position[1], w, d, 0.2));
        }
    }

    for (const town of TOWN_LAYOUTS) {
        const [cx, cz] = town.center;
        for (const [x, z, w, , d] of town.houses) boxes.push(boxAround(cx + x, cz + z, w, d, 0.2));
        boxes.push(boxAround(cx, cz, 3.2, 3.2)); // fountain / monument
        boxes.push(boxAround(cx + town.terminal[0], cz + town.terminal[1] - 1.2, 5, 1.2)); // terminal shed back wall
        boxes.push(boxAround(cx + town.terminal[0] + 6.2, cz + town.terminal[1] + 0.5, 6, 2.2)); // parked jeepney
    }

    const circles: Circle[] = [
        ...trees.map(([x, z, s]) => ({ x, z, r: 0.45 * s })),
        ...hills.map(([x, z, s]) => ({ x, z, r: 9 * s })),
        ...MOUNTAINS.map((m) => {
            const w = mountainWorld(m);
            return { x: w.x, z: w.z, r: w.r * 0.8 };
        }),
    ];

    return new CollisionWorld(boxes, circles, lockedProvinces);
}

/** True if any part of the world-space point is on land inside Region XII. */
export function onRegionLand(x: number, z: number): boolean {
    const [px, py] = toMap(x, z);
    return PROVINCES.some((p) => pointInPolygon(px, py, p.outline));
}
