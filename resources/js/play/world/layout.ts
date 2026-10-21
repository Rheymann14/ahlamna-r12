/**
 * Static world layout. NPC spots come from the database (locations.position_x/z, matched by slug);
 * this file only decides how each spot looks and where scenery and walls go.
 *
 * Coordinates: x = right, z = toward the camera (down the screen), y = up. 1 unit ≈ 1 meter.
 */

export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };

export type BuildingStyle = {
    size: [number, number, number]; // width, height, depth
    wall: string;
    roof: string;
    trim: string;
    sign: string;
    kind: 'house' | 'gazebo' | 'hut';
};

export const WORLD_HALF = 38;

export const PLAYER_SPAWN: [number, number] = [0, 6];

/** Look of each NPC location, keyed by location slug. Unknown slugs fall back to DEFAULT_BUILDING. */
export const BUILDINGS: Record<string, BuildingStyle> = {
    loc_school: { size: [10, 4.5, 6], wall: '#F1EFE8', roof: '#185FA5', trim: '#85B7EB', sign: '#378ADD', kind: 'house' },
    loc_health_center: { size: [8, 4, 6], wall: '#FFFFFF', roof: '#A32D2D', trim: '#F09595', sign: '#E24B4A', kind: 'house' },
    loc_home: { size: [6, 3.5, 5], wall: '#FAC775', roof: '#712B13', trim: '#854F0B', sign: '#BA7517', kind: 'house' },
    loc_plaza: { size: [5, 3.2, 5], wall: '#EEEDFE', roof: '#534AB7', trim: '#AFA9EC', sign: '#7F77DD', kind: 'gazebo' },
    loc_lakeside: { size: [4, 3, 4], wall: '#C0DD97', roof: '#3B6D11', trim: '#97C459', sign: '#1D9E75', kind: 'hut' },
};

export const DEFAULT_BUILDING: BuildingStyle = {
    size: [6, 3.5, 5],
    wall: '#D3D1C7',
    roof: '#5F5E5A',
    trim: '#B4B2A9',
    sign: '#888780',
    kind: 'house',
};

/** NPCs stand in front of their building (toward the camera). */
export function npcSpot(slug: string, position: [number, number]): [number, number] {
    const style = BUILDINGS[slug] ?? DEFAULT_BUILDING;
    return [position[0], position[1] + style.size[2] / 2 + (style.kind === 'gazebo' ? 1.2 : 1.6)];
}

/** Decorative houses that make the barangay feel lived-in. [x, z, w, h, d, wall, roof] */
export const HOUSES: [number, number, number, number, number, string, string][] = [
    [-28, -10, 5, 3, 4, '#F5C4B3', '#993C1D'],
    [-28, 2, 5, 3, 4, '#B5D4F4', '#0C447C'],
    [-6, -24, 6, 3.4, 4, '#FAEEDA', '#854F0B'],
    [8, -24, 5, 3, 4, '#E1F5EE', '#0F6E56'],
    [28, -10, 5, 3, 4, '#FBEAF0', '#993556'],
    [28, 2, 5, 3.2, 4, '#F1EFE8', '#444441'],
    [-6, 24, 5, 3, 4, '#EAF3DE', '#27500A'],
    [-28, 24, 5, 3, 4, '#FCEBEB', '#791F1F'],
];

/** Roads (flat strips): [x, z, width, depth] */
export const ROADS: [number, number, number, number][] = [
    [0, 0, WORLD_HALF * 2, 4], // east-west main road
    [0, -2, 4, 44], // north-south main road
    [20, 16, 4, 6], // road into the lakeside gate
];

export const PLAZA_RADIUS = 7.5;

export const LAKE = { x: 28, z: 30, rx: 7, rz: 5 };

/** The lakeside district: walled off until the player reaches its unlock level. */
export const LAKESIDE_AREA: Box = { minX: 8, maxX: WORLD_HALF, minZ: 16, maxZ: WORLD_HALF };
export const LAKESIDE_GATE: Box = { minX: 18, maxX: 22, minZ: 15.6, maxZ: 16.4 };

/** Fence segments around the lakeside, with a gap for the gate. */
export const FENCES: Box[] = [
    { minX: 8, maxX: 18, minZ: 15.7, maxZ: 16.3 },
    { minX: 22, maxX: WORLD_HALF, minZ: 15.7, maxZ: 16.3 },
    { minX: 7.7, maxX: 8.3, minZ: 16, maxZ: WORLD_HALF },
];

function boxAround(x: number, z: number, w: number, d: number, pad = 0): Box {
    return { minX: x - w / 2 - pad, maxX: x + w / 2 + pad, minZ: z - d / 2 - pad, maxZ: z + d / 2 + pad };
}

/** Deterministic pseudo-random numbers so the world looks the same for everyone. */
function seeded(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function onRoadOrPlaza(x: number, z: number): boolean {
    if (Math.hypot(x, z) < PLAZA_RADIUS + 1.5) return true;
    return ROADS.some(([rx, rz, w, d]) => Math.abs(x - rx) < w / 2 + 1.5 && Math.abs(z - rz) < d / 2 + 1.5);
}

/**
 * Tree positions: scattered, avoiding roads, the plaza, the lake and the given building boxes.
 */
export function treePositions(blocked: Box[], count: number): [number, number, number][] {
    const rand = seeded(1207);
    const trees: [number, number, number][] = [];
    let tries = 0;

    while (trees.length < count && tries < count * 40) {
        tries++;
        const x = (rand() * 2 - 1) * (WORLD_HALF - 2);
        const z = (rand() * 2 - 1) * (WORLD_HALF - 2);
        const scale = 0.8 + rand() * 0.6;

        if (onRoadOrPlaza(x, z)) continue;
        if (((x - LAKE.x) / (LAKE.rx + 2)) ** 2 + ((z - LAKE.z) / (LAKE.rz + 2)) ** 2 < 1) continue;
        if (blocked.some((b) => x > b.minX - 1.5 && x < b.maxX + 1.5 && z > b.minZ - 1.5 && z < b.maxZ + 1.5)) continue;
        if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 2.6)) continue;

        trees.push([x, z, scale]);
    }

    return trees;
}

/**
 * Everything the player bumps into. NPC buildings come from the live world data.
 */
export function buildColliders(locations: { slug: string; position: [number, number] }[], lakesideLocked: boolean): Box[] {
    const boxes: Box[] = [];

    for (const loc of locations) {
        const style = BUILDINGS[loc.slug] ?? DEFAULT_BUILDING;
        const [w, , d] = style.size;
        if (style.kind === 'gazebo') {
            // Gazebo posts only; the middle stays walkable.
            const hw = w / 2 - 0.3;
            const hd = d / 2 - 0.3;
            for (const [px, pz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
                boxes.push(boxAround(loc.position[0] + px, loc.position[1] + pz, 0.5, 0.5));
            }
        } else {
            boxes.push(boxAround(loc.position[0], loc.position[1], w, d, 0.2));
        }
    }

    for (const [x, z, w, , d] of HOUSES) boxes.push(boxAround(x, z, w, d, 0.2));
    boxes.push(boxAround(0, 0, 3.2, 3.2)); // fountain
    boxes.push(...FENCES);
    boxes.push(boxAround(LAKE.x, LAKE.z, LAKE.rx * 1.7, LAKE.rz * 1.7));
    if (lakesideLocked) boxes.push(LAKESIDE_GATE);

    return boxes;
}

/** Moves a circle (the player) by dx/dz, sliding along walls. Returns the new position. */
export function moveWithCollisions(x: number, z: number, dx: number, dz: number, radius: number, boxes: Box[]): [number, number] {
    const hits = (px: number, pz: number) =>
        boxes.some((b) => px + radius > b.minX && px - radius < b.maxX && pz + radius > b.minZ && pz - radius < b.maxZ);

    const limit = WORLD_HALF - radius;
    let nx = Math.max(-limit, Math.min(limit, x + dx));
    if (hits(nx, z)) nx = x;
    let nz = Math.max(-limit, Math.min(limit, z + dz));
    if (hits(nx, nz)) nz = z;

    return [nx, nz];
}
