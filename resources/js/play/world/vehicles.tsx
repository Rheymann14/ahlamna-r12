import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import {
    BoxGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    Euler,
    Float32BufferAttribute,
    Matrix4,
    MeshLambertMaterial,
    Quaternion,
    SphereGeometry,
    TorusGeometry,
    Vector3,
    type BufferGeometry,
    type Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Avatar, type Action, type AvatarColors } from './Avatar';
import { signTexture } from './textures';

/**
 * Philippine road vehicles, built from primitives: the jeepney, the tricycle and the provincial bus.
 * Every model faces +X. Each body is merged into one vertex-coloured mesh (one draw call); only the
 * wheels are separate so they can turn.
 */

type V3 = [number, number, number];

const tmpColor = new Color();
const matrix = new Matrix4();

/** Collects coloured primitives into one merged geometry. */
class Kit {
    private parts: BufferGeometry[] = [];

    add(geometry: BufferGeometry, color: string, p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) {
        const g = geometry.index ? geometry.toNonIndexed() : geometry;
        if (g !== geometry) geometry.dispose();
        g.deleteAttribute('uv');
        matrix.compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(...r)), new Vector3(...s));
        g.applyMatrix4(matrix);
        tmpColor.set(color);
        const count = g.attributes.position.count;
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
        g.setAttribute('color', new Float32BufferAttribute(colors, 3));
        this.parts.push(g);
        return this;
    }

    /** Box from its centre and size. */
    box(color: string, p: V3, size: V3, r?: V3) {
        return this.add(new BoxGeometry(...size), color, p, r);
    }

    /** Box from its min and max corners. */
    span(color: string, min: V3, max: V3) {
        return this.box(color, [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], [max[0] - min[0], max[1] - min[1], max[2] - min[2]]);
    }

    /** Cylinder along an axis: 'y' (upright), 'x' (front-back) or 'z' (side to side). */
    cyl(color: string, p: V3, radius: number, length: number, axis: 'x' | 'y' | 'z' = 'y', seg = 10, top = radius) {
        const r: V3 = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
        return this.add(new CylinderGeometry(top, radius, length, seg), color, p, r);
    }

    build(): BufferGeometry {
        const merged = mergeGeometries(this.parts)!;
        this.parts.forEach((g) => g.dispose());
        merged.computeBoundingSphere();
        return merged;
    }
}

const BODY_MATERIAL = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

const geometryCache = new Map<string, BufferGeometry>();

function cached(key: string, make: () => BufferGeometry): BufferGeometry {
    let g = geometryCache.get(key);
    if (!g) {
        g = make();
        geometryCache.set(key, g);
    }
    return g;
}

/** A tyre with a chrome hubcap, its axle along Z. */
function wheelGeometry(radius: number, width: number): BufferGeometry {
    return cached(`wheel:${radius}:${width}`, () =>
        new Kit()
            .cyl('#232323', [0, 0, 0], radius, width, 'z', 14)
            .cyl('#D9DDE0', [0, 0, 0], radius * 0.55, width + 0.02, 'z', 10)
            .cyl('#8C9196', [0, 0, 0], radius * 0.2, width + 0.05, 'z', 6)
            .build(),
    );
}

/** Wheels that roll with the distance in `spin` (meters travelled). */
function Wheels({ at, radius, width, spin }: { at: [number, number, number][]; radius: number; width: number; spin?: RefObject<number> }) {
    const refs = useRef<(Mesh | null)[]>([]);
    const geometry = wheelGeometry(radius, width);
    useFrame(() => {
        const angle = -(spin?.current ?? 0) / radius;
        for (const m of refs.current) if (m) m.rotation.z = angle;
    });
    return (
        <>
            {at.map((p, i) => (
                <mesh key={i} ref={(m) => void (refs.current[i] = m)} geometry={geometry} material={BODY_MATERIAL} position={p} castShadow />
            ))}
        </>
    );
}

/** A sign board with text, readable from the front (and from behind when `both`). */
function Board({ text, p, w, h, bg, fg, rot = 0 }: { text: string; p: V3; w: number; h: number; bg: string; fg: string; rot?: number }) {
    const map = signTexture(text, bg, fg);
    return (
        <mesh position={p} rotation-y={rot}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>
    );
}

/** People sitting inside a vehicle. Each seat: position, facing (rotation.y) and colours. */
export type Seat = { p: V3; rot: number; colors: AvatarColors; action?: Action };

const SEATED_SCALE = 0.66;

function Riders({ seats }: { seats: Seat[] }) {
    const still = useRef(0);
    const actions = useMemo(() => seats.map((s) => ({ current: s.action ?? 'sit' })), [seats]);
    return (
        <>
            {seats.map((s, i) => (
                <group key={i} position={s.p} rotation-y={s.rot} scale={SEATED_SCALE}>
                    <Avatar colors={s.colors} speed={still} action={actions[i]} />
                </group>
            ))}
        </>
    );
}

/** Height of a seated rider's group above the seat top, so their hips rest on it. */
const SIT_DROP = 0.37 * SEATED_SCALE;

/* ---------------------------------------------------------------- jeepney */

export type JeepneyPaint = { body: string; stripe: string; accent: string; roof: string };

export const JEEPNEY_PAINTS: JeepneyPaint[] = [
    { body: '#E6F1FB', stripe: '#E24B4A', accent: '#EF9F27', roof: '#185FA5' },
    { body: '#F2C14E', stripe: '#185FA5', accent: '#E24B4A', roof: '#F1EFE8' },
    { body: '#1D9E75', stripe: '#F2C14E', accent: '#E24B4A', roof: '#F1EFE8' },
    { body: '#C0392B', stripe: '#F1EFE8', accent: '#F2C14E', roof: '#2C2C2A' },
    { body: '#2F80ED', stripe: '#F2C14E', accent: '#F1EFE8', roof: '#E24B4A' },
    { body: '#8E44AD', stripe: '#F2C14E', accent: '#5DCAA5', roof: '#F1EFE8' },
];

const CHROME = '#E4E8EB';
const DARK = '#2C2C2A';
const GLASS = '#8EC5E8';

function jeepneyGeometry(paint: JeepneyPaint): BufferGeometry {
    return cached(`jeep:${paint.body}${paint.stripe}${paint.accent}${paint.roof}`, () => {
        const k = new Kit();
        const { body, stripe, accent, roof } = paint;
        // chassis and floor
        k.span('#3A3A38', [-2.8, 0.42, -0.9], [2.95, 0.62, 0.9]);
        k.span('#5F5E5A', [-2.8, 0.62, -0.95], [1.25, 0.66, 0.95]);
        // passenger cab: side panels, chrome sill and running boards
        for (const z of [-1, 1]) {
            k.span(body, [-2.8, 0.62, z * 0.97 - 0.03], [1.25, 1.45, z * 0.97 + 0.03]);
            k.span(stripe, [-2.75, 1.08, z * 1.0 - 0.012], [1.2, 1.24, z * 1.0 + 0.012]);
            k.span(accent, [-2.75, 0.88, z * 1.0 - 0.012], [1.2, 0.98, z * 1.0 + 0.012]);
            k.span(CHROME, [-2.8, 1.42, z * 1.0 - 0.03], [1.25, 1.48, z * 1.0 + 0.03]);
            k.span(CHROME, [-1.25, 0.5, z * 1.0 - 0.05], [1.25, 0.6, z * 1.0 + 0.05]);
            // window posts holding up the roof
            for (const x of [-2.74, -1.8, -0.85, 0.1, 1.18]) k.span(body, [x - 0.05, 1.45, z * 0.97 - 0.04], [x + 0.05, 2.06, z * 0.97 + 0.04]);
            // chrome side mirrors on stalks
            k.box(CHROME, [2.0, 1.55, z * 1.12], [0.04, 0.04, 0.3]);
            k.box(DARK, [2.0, 1.62, z * 1.3], [0.06, 0.24, 0.16]);
            // fender skirts over the wheels
            k.span(DARK, [-2.25, 0.86, z * 0.85], [-1.25, 0.93, z * 1.1]);
            k.span(CHROME, [1.3, 0.86, z * 0.82], [2.2, 0.94, z * 1.1]);
            // mud flaps
            k.box('#C0392B', [-2.35, 0.32, z * 0.88], [0.04, 0.32, 0.26]);
        }
        // rear panel with the open entrance, step and tail lights
        for (const z of [-1, 1]) k.span(body, [-2.84, 0.62, z * 0.4], [-2.78, 1.45, z * 0.97]);
        k.span(body, [-2.84, 1.85, -0.97], [-2.78, 2.06, 0.97]);
        k.span(CHROME, [-3.02, 0.45, -0.7], [-2.8, 0.53, 0.7]);
        k.span('#D6312E', [-2.86, 0.95, 0.62], [-2.82, 1.15, 0.85]);
        k.span('#D6312E', [-2.86, 0.95, -0.85], [-2.82, 1.15, -0.62]);
        // benches along both sides
        for (const z of [-1, 1]) {
            k.span('#7A2E1D', [-2.65, 0.9, z * 0.62 - 0.2], [1.05, 1.0, z * 0.62 + 0.2]);
            k.span('#8A3A27', [-2.65, 1.0, z * 0.9 - 0.05], [1.05, 1.42, z * 0.9 + 0.05]);
        }
        // roof with a visor over the windshield, chrome rails and an accent trim
        k.span(roof, [-2.95, 2.05, -1.07], [2.25, 2.17, 1.07]);
        k.span(stripe, [-2.95, 2.0, -1.08], [2.25, 2.05, 1.08]);
        for (const z of [-1, 1]) k.span(CHROME, [-2.8, 2.17, z * 1.0 - 0.03], [2.0, 2.25, z * 1.0 + 0.03]);
        // driver's cab: windshield, dashboard and steering wheel
        k.box(GLASS, [2.04, 1.75, 0], [0.05, 0.6, 1.84], [0, 0, -0.15]);
        k.span(body, [1.25, 0.62, -0.95], [2.05, 1.45, -0.89]);
        k.span(body, [1.25, 0.62, 0.89], [2.05, 1.45, 0.95]);
        k.span(DARK, [1.85, 1.15, -0.9], [2.02, 1.35, 0.9]);
        k.add(new TorusGeometry(0.17, 0.03, 5, 12), DARK, [1.75, 1.42, -0.45], [0, Math.PI / 2, 0.5]);
        // long chrome-trimmed hood, grille, headlights and bumper
        k.span(body, [2.05, 0.62, -0.82], [2.95, 1.25, 0.82]);
        k.span(CHROME, [2.05, 1.25, -0.6], [2.95, 1.32, 0.6]);
        k.span(CHROME, [2.95, 0.62, -0.6], [3.02, 1.2, 0.6]);
        for (const y of [0.75, 0.88, 1.01]) k.span(DARK, [3.0, y, -0.5], [3.04, y + 0.06, 0.5]);
        for (const z of [-0.72, 0.72]) {
            k.cyl(CHROME, [2.98, 1.0, z], 0.13, 0.1, 'x', 12);
            k.cyl('#FFF6C8', [3.04, 1.0, z], 0.1, 0.04, 'x', 12);
            k.cyl('#FFF6C8', [3.1, 0.7, z * 0.75], 0.09, 0.06, 'x', 10);
        }
        k.span(CHROME, [3.0, 0.48, -1.05], [3.16, 0.6, 1.05]);
        // the chrome horses and antennas on the bonnet
        for (const z of [-0.35, 0, 0.35]) {
            k.box(CHROME, [2.75, 1.42, z], [0.3, 0.12, 0.06]);
            k.box(CHROME, [2.92, 1.55, z], [0.1, 0.24, 0.06], [0, 0, -0.5]);
            k.add(new ConeGeometry(0.04, 0.16, 4), CHROME, [2.62, 1.5, z], [0, 0, 0.8]);
        }
        for (const z of [-0.78, 0.78]) {
            k.cyl(CHROME, [2.9, 1.65, z], 0.015, 0.8, 'y', 4);
            k.add(new SphereGeometry(0.05, 6, 4), accent, [2.9, 2.06, z]);
        }
        return k.build();
    });
}

type VehicleProps = {
    /** Meters travelled, for the wheels. */
    spin?: RefObject<number>;
    /** People on board. */
    seats?: Seat[];
};

/** The jeepney: the King of the Road, with chrome horses, a long hood and open sides you can see the riders through. */
export function Jeepney({ paint = JEEPNEY_PAINTS[0], route, spin, seats }: VehicleProps & { paint?: JeepneyPaint; route?: string }) {
    const geometry = jeepneyGeometry(paint);
    return (
        <group>
            <mesh geometry={geometry} material={BODY_MATERIAL} castShadow />
            <Wheels at={[[-1.75, 0.42, 0.92], [-1.75, 0.42, -0.92], [1.75, 0.42, 0.92], [1.75, 0.42, -0.92]]} radius={0.42} width={0.28} spin={spin} />
            {route && (
                <>
                    {/* route board on the roof, over the windshield */}
                    <mesh position={[1.9, 2.36, 0]}>
                        <boxGeometry args={[0.6, 0.38, 1.8]} />
                        <meshLambertMaterial color="#F1EFE8" />
                    </mesh>
                    <Board text={route} p={[2.205, 2.36, 0]} w={1.76} h={0.33} bg="#FFFFFF" fg="#C0392B" rot={Math.PI / 2} />
                </>
            )}
            {seats && <Riders seats={seats} />}
        </group>
    );
}

/** Seats in a jeepney: the driver, then riders along the two benches facing each other. */
export function jeepneySeats(driver: AvatarColors | null, riders: AvatarColors[]): Seat[] {
    const benchY = 1.0 - SIT_DROP;
    const spots: [number, number][] = [[0.5, 0.62], [-0.8, -0.62], [-1.6, 0.62], [-0.2, -0.62], [-2.2, -0.62], [-0.6, 0.62]];
    const seats: Seat[] = riders.slice(0, spots.length).map((colors, i) => {
        const [x, z] = spots[i];
        return { p: [x, benchY, z], rot: z > 0 ? Math.PI : 0, colors };
    });
    if (driver) seats.push({ p: [1.55, benchY, -0.45], rot: Math.PI / 2, colors: driver, action: 'ride' });
    return seats;
}

/* ---------------------------------------------------------------- tricycle */

export const TRICYCLE_PAINTS = ['#C0392B', '#1D9E75', '#2F80ED', '#F2C14E', '#8E44AD', '#E67E22'];

function tricycleGeometry(color: string): BufferGeometry {
    return cached(`trike:${color}`, () => {
        const k = new Kit();
        // motorcycle: engine, tank, seat, fork, handlebar, headlight, exhaust
        k.span('#5F5E5A', [-0.2, 0.32, -0.12], [0.3, 0.62, 0.12]);
        k.span(color, [-0.05, 0.7, -0.15], [0.42, 0.92, 0.15]);
        k.span(DARK, [-0.62, 0.78, -0.16], [0.0, 0.88, 0.16]);
        k.span(color, [-0.85, 0.5, -0.12], [-0.45, 0.6, 0.12]);
        k.cyl(CHROME, [0.58, 0.68, 0], 0.03, 0.85, 'y', 5);
        k.cyl(DARK, [0.48, 1.08, 0], 0.025, 0.7, 'z', 5);
        k.cyl(CHROME, [0.62, 0.95, 0], 0.09, 0.08, 'x', 10);
        k.cyl('#FFF6C8', [0.67, 0.95, 0], 0.07, 0.03, 'x', 10);
        k.cyl(CHROME, [-0.45, 0.32, -0.2], 0.04, 0.7, 'x', 6);
        k.span(color, [0.5, 0.36, -0.08], [0.78, 0.42, 0.08]);
        // sidecar on the right (+Z): floor, walls, windshield, bench, wheel arch
        k.span('#3A3A38', [-0.9, 0.3, 0.3], [0.8, 0.38, 1.45]);
        k.span(color, [-0.9, 0.38, 1.38], [0.8, 0.95, 1.45]);
        k.span(color, [-0.9, 0.38, 0.3], [0.8, 0.95, 0.37]);
        k.span(color, [-0.9, 0.38, 0.3], [-0.83, 1.0, 1.45]);
        k.span(color, [0.55, 0.38, 0.3], [0.85, 0.95, 1.45]);
        k.box(GLASS, [0.78, 1.25, 0.88], [0.04, 0.55, 1.05], [0, 0, -0.2]);
        k.span(CHROME, [-0.9, 0.93, 1.42], [0.85, 0.98, 1.48]);
        k.span('#F1EFE8', [-0.88, 0.62, 1.44], [0.55, 0.72, 1.47]);
        k.span('#7A2E1D', [-0.75, 0.6, 0.45], [0.05, 0.72, 1.3]);
        k.span('#8A3A27', [-0.8, 0.72, 0.45], [-0.7, 1.15, 1.3]);
        // roof over the sidecar and the driver, on four posts
        k.span(color, [-0.95, 1.92, -0.3], [0.9, 2.0, 1.5]);
        k.span('#F1EFE8', [-0.95, 1.88, -0.31], [0.9, 1.92, 1.51]);
        for (const [x, z] of [[-0.88, -0.25], [-0.88, 1.43], [0.8, 1.43], [0.5, -0.25]]) k.cyl(CHROME, [x, 1.4, z], 0.025, 1.05, 'y', 5);
        // headlight and stripe on the sidecar nose
        k.cyl('#FFF6C8', [0.87, 0.8, 1.2], 0.06, 0.03, 'x', 8);
        return k.build();
    });
}

/** A tricycle: motorcycle with a covered sidecar, the everyday ride inside every town. */
export function Tricycle({ color = TRICYCLE_PAINTS[0], spin, seats }: VehicleProps & { color?: string }) {
    const geometry = tricycleGeometry(color);
    return (
        <group>
            <mesh geometry={geometry} material={BODY_MATERIAL} castShadow />
            <Wheels at={[[-0.65, 0.3, 0], [0.68, 0.3, 0], [-0.2, 0.28, 1.52]]} radius={0.3} width={0.12} spin={spin} />
            {seats && <Riders seats={seats} />}
        </group>
    );
}

/** Driver on the motorcycle seat. */
export function tricycleDriver(colors: AvatarColors): Seat {
    return { p: [-0.3, 0.88 - SIT_DROP, 0], rot: Math.PI / 2, colors, action: 'ride' };
}

/** Where a passenger sits in the sidecar, in the tricycle's frame. */
export const TRICYCLE_PASSENGER: V3 = [-0.25, 0.72 - SIT_DROP, 0.88];

/* ---------------------------------------------------------------- bus */

export type BusPaint = { body: string; stripe: string; accent: string };

export const BUS_PAINTS: BusPaint[] = [
    { body: '#F2C14E', stripe: '#C0392B', accent: '#2C2C2A' },
    { body: '#F4F6F8', stripe: '#185FA5', accent: '#E24B4A' },
    { body: '#1D9E75', stripe: '#F2C14E', accent: '#F4F6F8' },
];

function busGeometry(paint: BusPaint): BufferGeometry {
    return cached(`bus:${paint.body}${paint.stripe}${paint.accent}`, () => {
        const k = new Kit();
        const { body, stripe, accent } = paint;
        const L = 5.5;
        // chassis, lower body and skirt
        k.span('#3A3A38', [-L, 0.35, -1.15], [L, 0.5, 1.15]);
        k.span(body, [-L, 0.5, -1.25], [L, 1.5, 1.25]);
        // window band: dark glass with body-coloured pillars
        k.span('#26384A', [-L + 0.05, 1.5, -1.22], [L - 0.05, 2.6, 1.22]);
        for (const z of [-1, 1]) {
            for (let x = -L + 0.1; x < L - 1.2; x += 1.45) k.span(body, [x, 1.5, z * 1.23 - 0.03], [x + 0.14, 2.6, z * 1.23 + 0.03]);
            k.span(stripe, [-L + 0.02, 0.95, z * 1.25 - 0.012], [L - 0.02, 1.22, z * 1.25 + 0.012]);
            k.span(accent, [-L + 0.02, 1.26, z * 1.25 - 0.012], [L - 0.02, 1.34, z * 1.25 + 0.012]);
            k.span(CHROME, [-L, 1.47, z * 1.25 - 0.02], [L, 1.52, z * 1.25 + 0.02]);
            // wheel arches
            for (const x of [3.6, -2.6, -3.75]) k.span(DARK, [x - 0.62, 0.4, z * 1.25 - 0.02], [x + 0.62, 1.08, z * 1.25 + 0.02]);
            // the "ears": mirrors reaching forward
            k.box(DARK, [L + 0.15, 2.35, z * 1.3], [0.3, 0.05, 0.05]);
            k.box(DARK, [L + 0.3, 2.1, z * 1.38], [0.08, 0.45, 0.2]);
        }
        // passenger door on the right (curb) side, near the front
        k.span('#3E6A8A', [3.4, 0.55, 1.255], [4.4, 2.5, 1.27]);
        k.span(CHROME, [3.88, 0.55, 1.27], [3.92, 2.5, 1.28]);
        // upper body, roof and air-conditioning unit
        k.span(body, [-L, 2.6, -1.25], [L, 3.15, 1.25]);
        k.span('#F1EFE8', [-L + 0.1, 3.15, -1.15], [L - 0.1, 3.22, 1.15]);
        k.span('#D3D1C7', [-1.8, 3.22, -0.75], [1.4, 3.5, 0.75]);
        // front: windshield, destination board frame, grille, lights and bumper
        k.span('#3E6A8A', [L, 1.3, -1.15], [L + 0.03, 2.55, 1.15]);
        k.span(DARK, [L, 2.6, -1.1], [L + 0.03, 3.0, 1.1]);
        k.span(DARK, [L, 0.6, -0.7], [L + 0.04, 1.0, 0.7]);
        for (const z of [-0.95, 0.95]) {
            k.span('#FFF6C8', [L, 0.75, z - 0.18], [L + 0.05, 0.95, z + 0.18]);
            k.span('#EF9F27', [L, 0.62, z - 0.12], [L + 0.05, 0.7, z + 0.12]);
        }
        k.span(CHROME, [L, 0.35, -1.25], [L + 0.15, 0.55, 1.25]);
        // rear: window, tail lights, engine grille and bumper
        k.span('#26384A', [-L - 0.03, 1.7, -1.0], [-L, 2.55, 1.0]);
        for (const z of [-0.95, 0.95]) k.span('#D6312E', [-L - 0.04, 0.8, z - 0.15], [-L, 1.4, z + 0.15]);
        for (const y of [0.85, 1.05, 1.25]) k.span(DARK, [-L - 0.03, y, -0.55], [-L, y + 0.08, 0.55]);
        k.span(DARK, [-L - 0.12, 0.35, -1.25], [-L, 0.55, 1.25]);
        return k.build();
    });
}

/** A provincial bus with a destination board, for trips between the bigger cities. */
export function Bus({ paint = BUS_PAINTS[0], route, spin, seats }: VehicleProps & { paint?: BusPaint; route?: string }) {
    const geometry = busGeometry(paint);
    const wheels: [number, number, number][] = [3.6, -2.6, -3.75].flatMap((x) => [[x, 0.5, 1.2], [x, 0.5, -1.2]] as [number, number, number][]);
    return (
        <group>
            <mesh geometry={geometry} material={BODY_MATERIAL} castShadow />
            <Wheels at={wheels} radius={0.5} width={0.32} spin={spin} />
            {route && <Board text={route} p={[5.54, 2.8, 0]} w={2.1} h={0.36} bg="#111111" fg="#FFB020" rot={Math.PI / 2} />}
            {seats && <Riders seats={seats} />}
        </group>
    );
}

/** The driver of a bus, visible through the windshield. */
export function busDriver(colors: AvatarColors): Seat {
    return { p: [4.6, 1.15 - SIT_DROP, -0.6], rot: Math.PI / 2, colors, action: 'ride' };
}
