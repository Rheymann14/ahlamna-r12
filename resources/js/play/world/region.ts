/**
 * Region XII (SOCCSKSARGEN) as a stylized game map.
 *
 * Outlines are hand-traced approximations of the provinces (good enough to recognise the region,
 * not survey-accurate). They are written in "map pixels" from an 881x571 reference map and converted
 * to world units with toWorld(): Koronadal City is the world origin and 1 map pixel = 3 world units (meters).
 *
 * Province borders share the exact same points so there are no gaps between neighbours.
 */

export type MapPoint = [number, number];

export const MAP_SCALE = 3;
const ORIGIN: MapPoint = [457, 320]; // Koronadal City

export function toWorld([px, py]: MapPoint): [number, number] {
    return [(px - ORIGIN[0]) * MAP_SCALE, (py - ORIGIN[1]) * MAP_SCALE];
}

export function toMap(x: number, z: number): MapPoint {
    return [x / MAP_SCALE + ORIGIN[0], z / MAP_SCALE + ORIGIN[1]];
}

// Shared border points (map pixels).
const P = {
    A: [250, 262], B: [300, 258], C: [355, 250], D: [392, 232], E: [418, 228],
    F: [445, 255], G: [480, 256], H: [512, 258], I: [540, 262], J: [545, 300],
    K: [528, 310], L: [508, 308], M: [478, 298], N: [460, 292], O: [438, 298],
    PP: [408, 298], Q: [400, 322], R: [418, 355], S: [378, 356], T: [340, 350],
    U: [305, 357], V: [338, 398],
    X1: [522, 345], X2: [528, 378], X3: [541, 398],
    G1: [516, 398], G2: [506, 420], G3: [528, 428], G4: [546, 418],
    Y1: [380, 401], Y2: [420, 406], Y3: [470, 418],
    W1: [568, 318], W2: [600, 310], W9: [580, 556],
} satisfies Record<string, MapPoint>;

export type Province = {
    slug: string; // matches the zone slug in the database
    name: string;
    mapColor: string; // political colour on the minimap
    groundColor: string; // grass tint in the 3D world (and on the minimap)
    outline: MapPoint[];
    labelAt: MapPoint;
};

export const PROVINCES: Province[] = [
    {
        slug: 'general-santos',
        name: 'General Santos City',
        mapColor: '#F0997B',
        groundColor: '#A9D98A',
        outline: [P.X3, P.G1, P.G2, P.G3, P.G4],
        labelAt: [526, 410],
    },
    {
        slug: 'south-cotabato',
        name: 'South Cotabato',
        mapColor: '#5DCAA5',
        groundColor: '#8ED36A',
        outline: [P.U, P.T, P.S, P.R, P.Q, P.PP, P.O, P.N, P.M, P.L, P.K, P.J, P.X1, P.X2, P.X3, P.G1, P.G2, P.Y3, P.Y2, P.Y1, P.V],
        labelAt: [470, 370],
    },
    {
        slug: 'sultan-kudarat',
        name: 'Sultan Kudarat',
        mapColor: '#AFA9EC',
        groundColor: '#89CF66',
        outline: [
            P.A, P.B, P.C, P.D, P.E, P.F, P.G, P.H, P.I, P.J, P.K, P.L, P.M, P.N, P.O, P.PP, P.Q, P.R, P.S, P.T, P.U, P.V,
            [310, 385], [285, 365], [266, 335], [254, 300],
        ],
        labelAt: [320, 300],
    },
    {
        slug: 'sarangani',
        name: 'Sarangani',
        mapColor: '#F09595',
        groundColor: '#94D672',
        // West coastal strip (Kiamba, Maitum, Maasim) joined to the east side of Sarangani Bay (Alabel, Glan)
        // through General Santos' coast so it stays one walkable piece.
        outline: [
            P.V, P.Y1, P.Y2, P.Y3, P.G2, P.G3, [530, 460], [518, 480], [480, 474], [430, 460], [385, 442], [352, 420],
        ],
        labelAt: [430, 440],
    },
    {
        slug: 'sarangani',
        name: 'Sarangani',
        mapColor: '#F09595',
        groundColor: '#94D672',
        outline: [
            P.J, P.W1, P.W2, [616, 338], [630, 352], [620, 388], [632, 440], [614, 500], [598, 540], P.W9, [568, 520],
            [574, 470], [562, 432], P.G4, P.X3, P.X2, P.X1,
        ],
        labelAt: [598, 400],
    },
    {
        slug: 'cotabato',
        name: 'Cotabato',
        mapColor: '#97C459',
        groundColor: '#82C860',
        outline: [
            P.E, [425, 200], [415, 165], [395, 195], [372, 182], [350, 150], [332, 138], [348, 118], [352, 80], [350, 40],
            [378, 15], [408, 18], [440, 45], [470, 58], [505, 72], [548, 48], [565, 45], [555, 100], [548, 140], [572, 160],
            [565, 195], [545, 225], [520, 240], P.H, P.G, P.F,
        ],
        labelAt: [470, 120],
    },
];

/** Land outside Region XII: drawn lower and greyer, never walkable. */
export const NEIGHBOURS: { name: string; outline: MapPoint[]; labelAt?: MapPoint }[] = [
    {
        name: 'BARMM',
        outline: [
            [150, -80], [352, -80], [350, 40], [352, 80], [348, 118], [332, 138], [350, 150], [372, 182], [395, 195], [415, 165],
            [425, 200], P.E, P.D, P.C, P.B, P.A, [245, 240], [268, 200], [250, 160], [275, 120], [260, 80], [200, 60], [150, 60],
        ],
        labelAt: [300, 200],
    },
    {
        name: 'Region X',
        outline: [[352, -80], [820, -80], [700, 30], [565, 45], [548, 48], [505, 72], [470, 58], [440, 45], [408, 18], [378, 15], [350, 40]],
        labelAt: [520, 10],
    },
    {
        name: 'Region XI',
        outline: [
            [565, 45], [700, 30], [820, -80], [1000, -80], [1000, 230], [760, 230], [700, 190], [650, 190], [620, 250], P.W2, P.W1,
            P.J, P.I, P.H, [520, 240], [545, 225], [565, 195], [572, 160], [548, 140], [555, 100],
        ],
        labelAt: [700, 110],
    },
    {
        name: 'Davao Occidental',
        outline: [P.W2, [620, 250], [650, 190], [660, 260], [650, 330], [668, 420], [650, 500], [600, 575], P.W9, [598, 540], [614, 500], [632, 440], [620, 388], [630, 352], [616, 338]],
    },
    {
        name: 'Davao Oriental',
        outline: [[700, 190], [760, 230], [1000, 230], [1000, 650], [780, 650], [800, 480], [780, 330], [740, 260]],
    },
];

export type Town = {
    slug: string;
    name: string;
    province: string;
    at: MapPoint;
};

export const TOWNS: Town[] = [
    { slug: 'koronadal', name: 'Koronadal City', province: 'south-cotabato', at: [457, 320] },
    { slug: 'tacurong', name: 'Tacurong City', province: 'sultan-kudarat', at: [428, 293] },
    { slug: 'isulan', name: 'Isulan', province: 'sultan-kudarat', at: [396, 287] },
    { slug: 'lake-sebu', name: 'Lake Sebu', province: 'south-cotabato', at: [432, 380] },
    { slug: 'polomolok', name: 'Polomolok', province: 'south-cotabato', at: [495, 376] },
    { slug: 'general-santos', name: 'General Santos City', province: 'general-santos', at: [532, 410] },
    { slug: 'alabel', name: 'Alabel', province: 'sarangani', at: [572, 420] },
    { slug: 'glan', name: 'Glan', province: 'sarangani', at: [590, 505] },
    { slug: 'kiamba', name: 'Kiamba', province: 'sarangani', at: [440, 448] },
    { slug: 'kidapawan', name: 'Kidapawan City', province: 'cotabato', at: [520, 190] },
    { slug: 'kabacan', name: 'Kabacan', province: 'cotabato', at: [478, 112] },
];

export type RoadLine = { name: string; kind: 'highway' | 'road'; points: MapPoint[] };

/** The road network between towns, as map-pixel polylines. Lines meet at shared points (the town centres). */
export const ROAD_LINES: RoadLine[] = [
    { name: 'Koronadal–General Santos Highway', kind: 'highway', points: [[457, 320], [468, 334], [478, 350], [486, 364], [495, 376], [510, 392], [522, 402], [532, 410]] },
    { name: 'Koronadal–Isulan Highway', kind: 'highway', points: [[457, 320], [442, 306], [428, 293], [412, 292], [396, 287]] },
    { name: 'Koronadal–Kidapawan Highway', kind: 'highway', points: [[457, 320], [457, 304], [466, 292], [478, 276], [484, 258], [498, 228], [510, 205], [520, 190]] },
    { name: 'General Santos–Glan Road', kind: 'highway', points: [[532, 410], [552, 414], [572, 420], [578, 440], [580, 462], [579, 484], [590, 505]] },
    { name: 'Koronadal–Lake Sebu Road', kind: 'road', points: [[457, 320], [452, 336], [447, 348], [440, 364], [432, 380]] },
    { name: 'Lake Sebu–Kiamba Road', kind: 'road', points: [[432, 380], [436, 400], [440, 425], [440, 448]] },
    { name: 'Sarangani Coastal Road', kind: 'road', points: [[532, 410], [518, 418], [512, 432], [500, 452], [484, 462], [462, 458], [440, 448], [415, 440], [392, 428]] },
    { name: 'Isulan–Lebak Road', kind: 'road', points: [[396, 287], [372, 288], [340, 300], [306, 310], [278, 318]] },
    { name: 'Kidapawan–Kabacan Road', kind: 'road', points: [[520, 190], [506, 162], [490, 132], [478, 112]] },
    { name: 'Lake Agco Road', kind: 'road', points: [[520, 190], [530, 186], [538, 183]] },
];

/** Lakes and mountains: positions and radii in map pixels; height in world units. */
export const LAKES: { name: string; at: MapPoint; rx: number; rz: number }[] = [
    { name: 'Lake Sebu', at: [410, 392], rx: 16, rz: 9 },
    { name: 'Lake Buluan', at: [462, 268], rx: 15, rz: 8 },
];

export const MOUNTAINS: { name: string; at: MapPoint; radius: number; height: number; snow?: boolean }[] = [
    { name: 'Mt. Matutum', at: [515, 352], radius: 14, height: 62 },
    { name: 'Mt. Apo', at: [566, 160], radius: 30, height: 125, snow: true },
    { name: 'Mt. Parker', at: [395, 368], radius: 10, height: 40 },
];

/** Farm fields painted on the ground: centre in map pixels, size in meters, rotation in radians. */
export const FIELDS: { kind: 'rice' | 'pineapple'; at: MapPoint; size: [number, number]; rot: number }[] = [
    { kind: 'rice', at: [440, 250], size: [60, 36], rot: 0.1 },
    { kind: 'rice', at: [368, 312], size: [54, 40], rot: -0.2 },
    { kind: 'rice', at: [345, 280], size: [64, 40], rot: 0.15 },
    { kind: 'rice', at: [455, 195], size: [50, 36], rot: 0.3 },
    { kind: 'pineapple', at: [478, 392], size: [56, 40], rot: 0.5 },
    { kind: 'pineapple', at: [508, 375], size: [40, 30], rot: -0.4 },
];

export function pointInPolygon(x: number, y: number, poly: MapPoint[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** Which province a world position is in (null = sea or outside the region). */
export function provinceAt(x: number, z: number): Province | null {
    const [px, py] = toMap(x, z);
    return PROVINCES.find((p) => pointInPolygon(px, py, p.outline)) ?? null;
}

export function nearestTown(x: number, z: number, within = 90): Town | null {
    let best: Town | null = null;
    let bestD = within;
    for (const t of TOWNS) {
        const [tx, tz] = toWorld(t.at);
        const d = Math.hypot(tx - x, tz - z);
        if (d < bestD) {
            bestD = d;
            best = t;
        }
    }
    return best;
}
