/**
 * Landmarks ("best spots") and town street plans.
 *
 * Like Pokémon GO, the world is a map: towns are road junctions, and only notable places get a 3D
 * structure. Positions are meters relative to the town centre (x = east, z = south). Every landmark
 * model faces +Z before `rot` is applied (rot = π/2 faces east, -π/2 faces west).
 *
 * The world is a stylized, scaled-down Region XII: places are in the right town and roughly the right
 * direction, not survey-accurate.
 */
import { TOWNS, toWorld } from './region';

export type LandmarkKind =
    | 'roundabout'
    | 'cityhall'
    | 'capitol'
    | 'office'
    | 'cathedral'
    | 'birds'
    | 'waterfall'
    | 'fields'
    | 'fishport'
    | 'plaza'
    | 'beach'
    | 'hotspring'
    | 'campus';

export type LandmarkCategory = 'civic' | 'nature' | 'culture' | 'livelihood';

/** Pin colour of each category, in the world and on the maps. */
export const CATEGORY_COLORS: Record<LandmarkCategory, string> = {
    civic: '#2F80ED',
    nature: '#27AE60',
    culture: '#9B51E0',
    livelihood: '#F2994A',
};

export type Landmark = {
    slug: string;
    name: string;
    blurb: string;
    town: string;
    kind: LandmarkKind;
    category: LandmarkCategory;
    at: [number, number];
    rot: number;
    /** Wall / roof / accent colours for the civic buildings. */
    palette?: [string, string, string];
};

/** Solid parts in the model's own frame: boxes [x, z, w, d] and circles [x, z, r]. */
export type Solids = { boxes: [number, number, number, number][]; circles: [number, number, number][] };

export const LANDMARK_KINDS: Record<LandmarkKind, Solids & { radius: number }> = {
    roundabout: { radius: 16, boxes: [], circles: [[0, 0, 7.9]] },
    cityhall: { radius: 16, boxes: [[0, 0, 24, 12], [0, 7.5, 10, 3]], circles: [[-9, 13, 0.4]] },
    capitol: { radius: 17, boxes: [[0, 0, 26, 14], [0, 8.5, 10, 3]], circles: [[-10, 14, 0.4]] },
    office: { radius: 24, boxes: [[0, 0, 14, 12], [-14, 1, 12, 10], [14, 1, 12, 10]], circles: [[-7, 18, 0.7], [7, 18, 0.7]] },
    cathedral: { radius: 14, boxes: [[0, 0, 12, 22]], circles: [] },
    birds: {
        radius: 18,
        boxes: [],
        circles: [[-8, -4, 0.6], [0, -9, 0.6], [9, -3, 0.6], [-3, 5, 0.6], [7, 7, 0.6], [-11, 8, 0.6], [12, -10, 0.6], [-14, -9, 0.6]],
    },
    waterfall: { radius: 16, boxes: [[0, -6.5, 28, 13]], circles: [[0, 4, 5]] },
    fields: { radius: 22, boxes: [[14, -10, 6, 5]], circles: [[-12, 8, 1.8]] },
    fishport: { radius: 14, boxes: [[0, 0, 20, 10]], circles: [] },
    plaza: { radius: 11, boxes: [], circles: [[0, 0, 2.6]] },
    beach: { radius: 18, boxes: [[0, -12, 6, 4]], circles: [[-4, 2, 0.3], [5, 6, 0.3], [-2, 12, 0.3]] },
    hotspring: { radius: 9, boxes: [], circles: [[0, 0, 6]] },
    campus: { radius: 17, boxes: [[0, 0, 30, 12]], circles: [[-4.5, 10, 0.6], [4.5, 10, 0.6]] },
};

const HALF_PI = Math.PI / 2;

export const LANDMARKS: Landmark[] = [
    // Koronadal City
    { slug: 'koronadal-roundabout', name: 'Koronadal Roundabout', town: 'koronadal', kind: 'roundabout', category: 'civic', at: [0, 0], rot: 0, blurb: 'The heart of Koronadal City, where the roads to Tacurong, Kidapawan, Lake Sebu and General Santos meet.' },
    { slug: 'koronadal-city-hall', name: 'Koronadal City Hall', town: 'koronadal', kind: 'cityhall', category: 'civic', at: [34, -38], rot: 0, palette: ['#F1EFE8', '#185FA5', '#EF9F27'], blurb: 'Seat of the city government of Koronadal, the regional centre of SOCCSKSARGEN.' },
    { slug: 'regional-prime-center', name: 'Regional Prime Center', town: 'koronadal', kind: 'office', category: 'civic', at: [118, 0], rot: -HALF_PI, blurb: 'Where the regional government offices of Region XII work side by side.' },
    { slug: 'south-cotabato-capitol', name: 'South Cotabato Provincial Capitol', town: 'koronadal', kind: 'capitol', category: 'civic', at: [-100, 0], rot: HALF_PI, palette: ['#FFFFFF', '#1D9E75', '#97C459'], blurb: 'Home of the provincial government of South Cotabato.' },
    { slug: 'christ-the-king-cathedral', name: 'Christ the King Cathedral', town: 'koronadal', kind: 'cathedral', category: 'culture', at: [-22, -48], rot: 0, blurb: 'The cathedral of Koronadal, a downtown landmark for more than half a century.' },

    // Sultan Kudarat
    { slug: 'baras-bird-sanctuary', name: 'Baras Bird Sanctuary', town: 'tacurong', kind: 'birds', category: 'nature', at: [-10, -40], rot: 0, blurb: 'A grove in Tacurong where thousands of egrets and herons come home to roost every evening.' },
    { slug: 'sultan-kudarat-capitol', name: 'Sultan Kudarat Provincial Capitol', town: 'isulan', kind: 'capitol', category: 'civic', at: [26, -34], rot: 0, palette: ['#FAEEDA', '#0F6E56', '#EF9F27'], blurb: 'The provincial capitol in Isulan, capital town of Sultan Kudarat.' },

    // South Cotabato
    { slug: 'seven-falls', name: 'Seven Falls of Lake Sebu', town: 'lake-sebu', kind: 'waterfall', category: 'nature', at: [-30, -40], rot: 0, blurb: 'Seven waterfalls in the hills of Lake Sebu, home of the T\'boli people.' },
    { slug: 'polomolok-pineapple-fields', name: 'Pineapple Fields', town: 'polomolok', kind: 'fields', category: 'livelihood', at: [-40, 30], rot: 0.4, blurb: 'Polomolok\'s pineapple farms stretch across the foot of Mt. Matutum.' },

    // General Santos City
    { slug: 'gensan-fish-port', name: 'GenSan Fish Port Complex', town: 'general-santos', kind: 'fishport', category: 'livelihood', at: [12, 22], rot: 0, blurb: 'One of the busiest tuna landing ports in the world: the reason GenSan is the Tuna Capital of the Philippines.' },
    { slug: 'gensan-city-hall', name: 'General Santos City Hall', town: 'general-santos', kind: 'cityhall', category: 'civic', at: [5, -44], rot: 0, palette: ['#E6F1FB', '#0C447C', '#378ADD'], blurb: 'Seat of the city government of General Santos.' },
    { slug: 'plaza-heneral-santos', name: 'Plaza Heneral Santos', town: 'general-santos', kind: 'plaza', category: 'culture', at: [40, -22], rot: 0, blurb: 'The city\'s central park, with a tuna monument for the Tuna Capital.' },

    // Sarangani
    { slug: 'sarangani-capitol', name: 'Sarangani Provincial Capitol', town: 'alabel', kind: 'capitol', category: 'civic', at: [20, -36], rot: 0, palette: ['#F1EFE8', '#993C1D', '#F5C4B3'], blurb: 'The provincial capitol of Sarangani in Alabel.' },
    { slug: 'gumasa-beach', name: 'Gumasa Beach', town: 'glan', kind: 'beach', category: 'nature', at: [-48, 5], rot: -HALF_PI, blurb: 'Glan\'s long white-sand beach on Sarangani Bay.' },

    // Cotabato
    { slug: 'kidapawan-city-hall', name: 'Kidapawan City Hall', town: 'kidapawan', kind: 'cityhall', category: 'civic', at: [-36, -14], rot: 0, palette: ['#EAF3DE', '#27500A', '#639922'], blurb: 'Seat of the city government of Kidapawan, at the foot of Mt. Apo.' },
    { slug: 'lake-agco', name: 'Lake Agco Hot Springs', town: 'kidapawan', kind: 'hotspring', category: 'nature', at: [66, -26], rot: 0, blurb: 'Warm sulphur pools on the slopes of Mt. Apo, the highest mountain in the Philippines.' },
    { slug: 'usm-kabacan', name: 'University of Southern Mindanao', town: 'kabacan', kind: 'campus', category: 'culture', at: [-30, -22], rot: 0, blurb: 'The state university of the region, with its main campus in Kabacan.' },
];

export type TownPlan = {
    /** Jeepney terminal shed position (the jeepney parks 6 m east of it). */
    terminal: [number, number];
    /** Local streets as polylines. Highways come from region.ts. */
    streets: [number, number][][];
    /** Radius of the town's built-up area. */
    urban: number;
    /** A roundabout at the town centre: radius of the ring road's centre line. */
    roundabout?: number;
    /** Provincial bus terminal: [x, z, rot]. Its front (where the buses park) faces +Z before rot. */
    bus?: [number, number, number];
};

const ring = (r: number, sides: number, offset: number): [number, number][] =>
    Array.from({ length: sides + 1 }, (_, i) => {
        const a = offset + (i / sides) * Math.PI * 2;
        return [Math.round(Math.cos(a) * r * 10) / 10, Math.round(Math.sin(a) * r * 10) / 10];
    });

export const TOWN_PLANS: Record<string, TownPlan> = {
    koronadal: {
        terminal: [22, 58],
        bus: [-50, -14, 0],
        urban: 110,
        roundabout: 12.5,
        streets: [
            [[-14, 0], [-91, 0]], // to the provincial capitol
            [[14, 0], [100, 0]], // to the Regional Prime Center
            ring(80, 8, Math.PI / 8), // city ring road
            [[34, -30], [34, 0]], // city hall driveway
            [[-22, -36], [-22, -20]], // cathedral driveway
        ],
    },
    tacurong: { terminal: [10, -14], bus: [-19, 17, Math.PI], urban: 55, streets: [[[-10, -22], [-1, 0]]] },
    isulan: { terminal: [8, 16], urban: 55, streets: [[[26, -26], [24, 7]], [[-24, -15], [-24, 1]]] },
    'lake-sebu': { terminal: [14, 10], urban: 45, streets: [[[-30, -32], [-8, -20], [10, -27]]] },
    polomolok: { terminal: [12, -14], urban: 50, streets: [] },
    'general-santos': {
        terminal: [12, -16],
        bus: [66, -6, 0],
        urban: 70,
        streets: [
            [[5, -36], [5, 0]],
            [[-26, 15], [12, 17]],
            [[34, -14], [34, 6]],
        ],
    },
    alabel: { terminal: [-14, 16], urban: 50, streets: [[[20, -28], [20, 5], [0, 0]], [[-20, -21], [-12, -3]]] },
    glan: { terminal: [10, -10], urban: 45, streets: [[[0, 0], [-29, 5]]] },
    kiamba: { terminal: [12, -14], urban: 45, streets: [] },
    kidapawan: { terminal: [14, 16], bus: [40, -36, 0], urban: 60, streets: [[[-36, -5], [-24, 16], [0, 0]]] },
    kabacan: { terminal: [12, -8], urban: 45, streets: [[[-30, -16], [0, 0]]] },
};

export function townCenter(slug: string): [number, number] {
    const town = TOWNS.find((t) => t.slug === slug);
    return town ? toWorld(town.at) : [0, 0];
}

/** World position of a landmark's origin. */
export function landmarkWorld(l: Landmark): [number, number] {
    const [cx, cz] = townCenter(l.town);
    return [cx + l.at[0], cz + l.at[1]];
}

/** A point in a landmark's own frame, rotated and moved into the world. */
export function landmarkPoint(l: Landmark, x: number, z: number): [number, number] {
    const [wx, wz] = landmarkWorld(l);
    const c = Math.cos(l.rot);
    const s = Math.sin(l.rot);
    return [wx + x * c + z * s, wz - x * s + z * c];
}
