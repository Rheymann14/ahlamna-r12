import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import {
    BackSide,
    BoxGeometry,
    CanvasTexture,
    Color,
    ConeGeometry,
    CylinderGeometry,
    Float32BufferAttribute,
    IcosahedronGeometry,
    Object3D,
    ShaderMaterial,
    SpriteMaterial,
    type Sprite,
    Vector3,
    type BufferGeometry,
    type Group,
    type InstancedMesh,
    type Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { playerState, useGame } from '../store';
import type { Action, AvatarColors } from './Avatar';
import { LANDMARKS } from './landmarks';
import { BUS_TERMINAL, TOWN_LAYOUTS, lakeWorld, mountainWorld, type TownLayout, type TravelMode, type Tree } from './layout';
import { Bystander, townsfolkColors } from './people';
import { LAKES, MOUNTAINS, PROVINCES, toWorld } from './region';
import { seeded } from './routes';
import { signTexture } from './textures';
import { BUS_PAINTS, Bus, JEEPNEY_PAINTS, Jeepney } from './vehicles';

/** Direction of the sun (also used for the shadow-casting light). */
export const SUN_DIRECTION = new Vector3(60, 110, 40).normalize();

/* ---------------------------------------------------------------- helpers */

/** Renders its children only while the player is within `range` meters (saves draw calls far away). */
export function Near({ x, z, range = 320, children }: { x: number; z: number; range?: number; children: ReactNode }) {
    const ref = useRef<Group>(null);
    useFrame(() => {
        if (ref.current) ref.current.visible = Math.hypot(playerState.x - x, playerState.z - z) < range;
    });
    return <group ref={ref}>{children}</group>;
}

/** Makes every mesh inside cast (and optionally receive) shadows. */
export function Shadowed({ children, receive = false }: { children: ReactNode; receive?: boolean }) {
    const ref = useRef<Group>(null);
    useLayoutEffect(() => {
        ref.current?.traverse((o) => {
            if ((o as Mesh).isMesh) {
                o.castShadow = true;
                o.receiveShadow = receive;
            }
        });
    });
    return <group ref={ref}>{children}</group>;
}

/* ---------------------------------------------------------------- labels */

function makeLabel(text: string, opts: { size: number; color: string; stroke: string; bg?: string }) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const font = `900 ${opts.size}px 'Instrument Sans', system-ui, sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + opts.size;
    const h = Math.ceil(opts.size * 1.6);
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (opts.bg) {
        ctx.fillStyle = opts.bg;
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, h / 2);
        ctx.fill();
    }
    ctx.lineWidth = opts.size / 6;
    ctx.strokeStyle = opts.stroke;
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = opts.color;
    ctx.fillText(text, w / 2, h / 2);
    const texture = new CanvasTexture(canvas);
    texture.anisotropy = 4;
    return { material: new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }), aspect: w / h };
}

export function Label({ text, position, height, size = 48, color = '#FFFFFF', stroke = '#2C2C2A', bg }: { text: string; position: [number, number, number]; height: number; size?: number; color?: string; stroke?: string; bg?: string }) {
    const label = useMemo(() => makeLabel(text, { size, color, stroke, bg }), [text, size, color, stroke, bg]);
    useEffect(
        () => () => {
            label.material.map?.dispose();
            label.material.dispose();
        },
        [label],
    );
    // Hide a label when the camera is nearly inside it, so it never fills the screen.
    const sprite = useRef<Sprite>(null);
    useFrame(({ camera }) => {
        if (sprite.current) sprite.current.visible = camera.position.distanceTo(sprite.current.position) > height * 5;
    });
    return <sprite ref={sprite} material={label.material} position={position} scale={[height * label.aspect, height, 1]} />;
}

export function MapLabels() {
    return (
        <group>
            {PROVINCES.filter((p, i, all) => all.findIndex((q) => q.slug === p.slug) === i).map((p) => {
                const [x, z] = toWorld(p.labelAt);
                return <Label key={p.slug} text={p.name.toUpperCase()} position={[x, 60, z]} height={13} size={64} color="#FFFFFF" stroke="#27500A" />;
            })}
            {TOWN_LAYOUTS.filter((t) => !LANDMARKS.some((l) => l.town === t.slug && l.at[0] === 0 && l.at[1] === 0)).map((t) => (
                <Label key={t.slug} text={t.name} position={[t.center[0], 30, t.center[1] - 8]} height={4.2} size={48} color="#412402" stroke="#FAEEDA" bg="rgba(250,238,218,0.88)" />
            ))}
            {MOUNTAINS.map((m) => {
                const w = mountainWorld(m);
                return <Label key={m.name} text={m.name} position={[w.x, w.h + 10, w.z]} height={7} size={48} color="#FFFFFF" stroke="#444441" />;
            })}
            {LAKES.map((l) => {
                const w = lakeWorld(l);
                return <Label key={l.name} text={l.name} position={[w.x, 7, w.z]} height={4.5} size={44} color="#FFFFFF" stroke="#0C447C" />;
            })}
        </group>
    );
}

/* ---------------------------------------------------------------- sky */

export function Sky() {
    const ref = useRef<Mesh>(null);
    const material = useMemo(
        () =>
            new ShaderMaterial({
                side: BackSide,
                depthWrite: false,
                fog: false,
                uniforms: {
                    uTop: { value: new Color('#3E8EE0') },
                    uHorizon: { value: new Color('#D4EEFF') },
                    uSun: { value: SUN_DIRECTION },
                },
                vertexShader: /* glsl */ `
                    varying vec3 vDir;
                    void main() {
                        vDir = normalize(position);
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }`,
                fragmentShader: /* glsl */ `
                    uniform vec3 uTop;
                    uniform vec3 uHorizon;
                    uniform vec3 uSun;
                    varying vec3 vDir;
                    void main() {
                        vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.5, vDir.y));
                        float sun = max(dot(normalize(vDir), uSun), 0.0);
                        col += vec3(1.0, 0.95, 0.8) * (pow(sun, 600.0) * 1.2 + pow(sun, 16.0) * 0.25);
                        gl_FragColor = vec4(col, 1.0);
                    }`,
            }),
        [],
    );
    useEffect(() => () => material.dispose(), [material]);
    // The dome travels with the camera so it is never reached.
    useFrame(({ camera }) => ref.current?.position.copy(camera.position));
    return (
        <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
            <sphereGeometry args={[600, 24, 12]} />
        </mesh>
    );
}

const CLOUD_GEOMETRY = (() => {
    const parts = [
        [0, 0, 0, 1],
        [1.1, -0.15, 0.2, 0.75],
        [-1.05, -0.2, -0.1, 0.7],
        [0.4, 0.45, -0.3, 0.65],
        [-0.3, 0.1, 0.6, 0.6],
    ].map(([x, y, z, r]) => new IcosahedronGeometry(r, 1).translate(x, y, z));
    return mergeGeometries(parts)!.scale(1, 0.6, 0.8);
})();

/** Puffy low-poly clouds drifting east. */
export function Clouds({ count }: { count: number }) {
    const ref = useRef<InstancedMesh>(null);
    const clouds = useMemo(() => {
        let s = 99;
        const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
        return Array.from({ length: count }, () => ({ x: -700 + rand() * 1400, y: 75 + rand() * 45, z: -900 + rand() * 1500, s: 10 + rand() * 12, speed: 1.5 + rand() * 2 }));
    }, [count]);
    useFrame((_, delta) => {
        const mesh = ref.current;
        if (!mesh) return;
        clouds.forEach((c, i) => {
            c.x += c.speed * Math.min(delta, 0.1);
            if (c.x > 700) c.x = -700;
            dummy.position.set(c.x, c.y, c.z);
            dummy.rotation.set(0, i, 0);
            dummy.scale.setScalar(c.s);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
    });
    return (
        <instancedMesh ref={ref} args={[CLOUD_GEOMETRY, undefined, count]} frustumCulled={false}>
            <meshLambertMaterial color="#FFFFFF" emissive="#DDE8F5" emissiveIntensity={0.55} flatShading />
        </instancedMesh>
    );
}

/* ---------------------------------------------------------------- nature */

const dummy = new Object3D();
const tint = new Color();

type Placer<T> = (o: Object3D, item: T, i: number) => void;

function useInstances<T>(ref: RefObject<InstancedMesh | null>, items: T[], place: Placer<T>, colors?: string[]) {
    useLayoutEffect(() => {
        const mesh = ref.current;
        if (!mesh) return;
        items.forEach((item, i) => {
            dummy.position.set(0, 0, 0);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            place(dummy, item, i);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            if (colors) mesh.setColorAt(i, tint.set(colors[(i * 7) % colors.length]));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
    }, [ref, items, place, colors]);
}

/** One kind of tree as two instanced meshes (trunk + foliage): one draw call each however many there are. */
function TreeKindMesh({ trees, trunk, foliage, trunkColor, colors, place }: { trees: Tree[]; trunk: BufferGeometry; foliage: BufferGeometry; trunkColor: string; colors: string[]; place: Placer<Tree> }) {
    const trunks = useRef<InstancedMesh>(null);
    const leaves = useRef<InstancedMesh>(null);
    useInstances(trunks, trees, place);
    useInstances(leaves, trees, place, colors);
    if (trees.length === 0) return null;
    return (
        <group>
            <instancedMesh ref={trunks} args={[trunk, undefined, trees.length]} key={`t${trees.length}`} castShadow>
                <meshLambertMaterial color={trunkColor} flatShading />
            </instancedMesh>
            <instancedMesh ref={leaves} args={[foliage, undefined, trees.length]} key={`l${trees.length}`} castShadow>
                <meshLambertMaterial color="#FFFFFF" flatShading />
            </instancedMesh>
        </group>
    );
}

const TREE_GEOMETRY = {
    broadleaf: {
        trunk: new CylinderGeometry(0.18, 0.28, 1.4, 5).translate(0, 0.7, 0),
        foliage: mergeGeometries([new IcosahedronGeometry(1.35, 0).translate(0, 2.3, 0), new IcosahedronGeometry(0.9, 0).translate(0.55, 3.0, 0.2)])!,
    },
    palm: {
        trunk: new CylinderGeometry(0.13, 0.21, 5, 5).translate(0, 2.5, 0),
        foliage: mergeGeometries(
            Array.from({ length: 7 }, (_, k) => new BoxGeometry(0.55, 0.06, 2.8).translate(0, 0, 1.4).rotateX(0.55).rotateY((k / 7) * Math.PI * 2).translate(0, 5, 0)),
        )!,
    },
    pine: {
        trunk: new CylinderGeometry(0.14, 0.2, 1, 5).translate(0, 0.5, 0),
        foliage: mergeGeometries([
            new ConeGeometry(1.4, 2.4, 7).translate(0, 2.0, 0),
            new ConeGeometry(1.05, 2.0, 7).translate(0, 3.1, 0),
            new ConeGeometry(0.7, 1.6, 7).translate(0, 4.1, 0),
        ])!,
    },
};

const BROADLEAF_COLORS = ['#4E9A2E', '#5FAE3A', '#3F8A2A', '#6DB843', '#7AC14E', '#559F33'];
const PALM_COLORS = ['#5DAA3A', '#6BB545', '#4F9A30', '#7CBF4C'];
const PINE_COLORS = ['#2F6B34', '#3A7A3C', '#2A5F30', '#447F3E'];
const HILL_COLORS = ['#8CCB63', '#7DBE57', '#94D16C', '#86C45E'];

const placeUpright: Placer<Tree> = (o, [x, z, s], i) => {
    o.position.set(x, 0, z);
    o.rotation.y = i * 2.4;
    o.scale.setScalar(s);
};
const placePalm: Placer<Tree> = (o, [x, z, s], i) => {
    o.position.set(x, 0, z);
    o.rotation.set(Math.sin(i) * 0.16, i * 1.3, Math.cos(i * 1.7) * 0.16);
    o.scale.setScalar(s);
};
const placeHill: Placer<[number, number, number]> = (o, [x, z, s], i) => {
    o.position.set(x, 0, z);
    o.rotation.y = i * 1.7;
    o.scale.set(12 * s, 4.5 * s, 10 * s);
};

export function Nature({ trees, hills }: { trees: Tree[]; hills: [number, number, number][] }) {
    const byKind = useMemo(() => [0, 1, 2].map((k) => trees.filter((t) => t[3] === k)), [trees]);
    const hillMesh = useRef<InstancedMesh>(null);
    useInstances(hillMesh, hills, placeHill, HILL_COLORS);

    return (
        <group>
            <TreeKindMesh trees={byKind[0]} {...TREE_GEOMETRY.broadleaf} trunkColor="#8A5A2B" colors={BROADLEAF_COLORS} place={placeUpright} />
            <TreeKindMesh trees={byKind[1]} {...TREE_GEOMETRY.palm} trunkColor="#9C7A4F" colors={PALM_COLORS} place={placePalm} />
            <TreeKindMesh trees={byKind[2]} {...TREE_GEOMETRY.pine} trunkColor="#6B4A2B" colors={PINE_COLORS} place={placeUpright} />
            <instancedMesh ref={hillMesh} args={[undefined, undefined, hills.length]} key={`h${hills.length}`} receiveShadow castShadow>
                <sphereGeometry args={[1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshLambertMaterial color="#FFFFFF" flatShading />
            </instancedMesh>
        </group>
    );
}

/** A low-poly mountain: a cone with bumpy, deterministic sides, coloured by height (forest, rock, snow). */
function mountainGeometry(r: number, h: number, seed: number, snow: boolean): BufferGeometry {
    const cone = new ConeGeometry(r, h, 20, 7, true);
    const pos = cone.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const t = (y + h / 2) / h; // 0 at the base, 1 at the peak
        const a = Math.atan2(z, x);
        // Vertices on the seam share a position, so a function of position keeps the surface closed.
        const hash = Math.sin(Math.round(x * 10) * 12.9898 + Math.round(z * 10) * 78.233 + seed) * 43758.5453;
        const jitter = hash - Math.floor(hash);
        const k = t < 0.999 ? 1 + 0.16 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 7 + seed * 2) + (jitter - 0.5) * 0.18 : 1;
        pos.setXYZ(i, x * k, y + (t > 0.02 && t < 0.98 ? (jitter - 0.5) * h * 0.05 : 0) + h / 2, z * k);
    }
    const g = cone.toNonIndexed();
    cone.dispose();
    g.computeVertexNormals();
    const colors: number[] = [];
    const p = g.attributes.position;
    const c = new Color();
    for (let i = 0; i < p.count; i += 3) {
        const t = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 / h;
        c.set(t < 0.3 ? '#6FAE45' : t < 0.58 ? '#3F7A2A' : t < (snow ? 0.8 : 1.1) ? '#8C8577' : '#F4F6F2');
        if (!snow && t > 0.86) c.set('#77706A');
        for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    return g;
}

export function Mountains() {
    const geometries = useMemo(() => MOUNTAINS.map((m, i) => mountainGeometry(mountainWorld(m).r, m.height, i * 3.7 + 1, !!m.snow)), []);
    useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
    return (
        <group>
            {MOUNTAINS.map((m, i) => {
                const w = mountainWorld(m);
                return (
                    <mesh key={m.name} geometry={geometries[i]} position={[w.x, -0.2, w.z]} castShadow receiveShadow>
                        <meshLambertMaterial vertexColors flatShading />
                    </mesh>
                );
            })}
        </group>
    );
}

/* ---------------------------------------------------------------- towns */

/** Pyramid roof sized to a w x d footprint. */
export function Roof({ w, d, h, color, y }: { w: number; d: number; h: number; color: string; y: number }) {
    return (
        <mesh position-y={y + h / 2} rotation-y={Math.PI / 4} scale={[w * 0.78, h, d * 0.78]}>
            <coneGeometry args={[1, 1, 4]} />
            <meshLambertMaterial color={color} flatShading />
        </mesh>
    );
}

/** Short name for route boards ("General Santos City" is "GENSAN" on every jeepney). */
export function routeName(slug: string): string {
    const town = TOWN_LAYOUTS.find((t) => t.slug === slug);
    if (!town) return '';
    return slug === 'general-santos' ? 'GENSAN' : town.name.replace(/ City$/, '').toUpperCase();
}

const TERMINAL_FOLK: { colors: AvatarColors; position: [number, number, number]; rot: number; actions: Action[] }[] = [
    // the barker calling out the route, a passenger waiting on the bench
    { colors: { skin: '#A86B3C', hair: '#2C2C2A', shirt: '#F2C14E', pants: '#444441', cap: '#E24B4A' }, position: [3.4, 0, 2.6], rot: 0.6, actions: ['hail', 'wave', 'talk', 'hail'] },
    { colors: { skin: '#D9A066', hair: '#1F1A17', shirt: '#5DCAA5', pants: '#0C447C', longHair: true }, position: [-0.8, 0.15, -0.7], rot: 0, actions: ['sit', 'chat'] },
];

/** Jeepney terminal: a waiting shed, the parked jeepney and the barker. */
function Terminal({ town, jeepneyHidden }: { town: TownLayout; jeepneyHidden: boolean }) {
    const paint = JEEPNEY_PAINTS[TOWN_LAYOUTS.indexOf(town) % JEEPNEY_PAINTS.length];
    return (
        <group>
            {/* waiting shed */}
            <mesh position={[0, 1.4, -1.2]}>
                <boxGeometry args={[5, 2.8, 0.3]} />
                <meshLambertMaterial color="#FAC775" flatShading />
            </mesh>
            {[-2.3, 2.3].map((x) => (
                <mesh key={x} position={[x, 1.4, 0.6]}>
                    <boxGeometry args={[0.25, 2.8, 0.25]} />
                    <meshLambertMaterial color="#633806" />
                </mesh>
            ))}
            <mesh position={[0, 2.95, -0.3]} rotation-x={0.15}>
                <boxGeometry args={[5.6, 0.2, 2.6]} />
                <meshLambertMaterial color="#D85A30" flatShading />
            </mesh>
            <mesh position={[0, 0.45, -0.7]}>
                <boxGeometry args={[4, 0.15, 0.6]} />
                <meshLambertMaterial color="#854F0B" />
            </mesh>
            {!jeepneyHidden && (
                <group position={[6.2, 0, 0.5]}>
                    <Jeepney paint={paint} route={routeName(town.slug)} />
                </group>
            )}
            {TERMINAL_FOLK.map((f, i) => (
                <Bystander key={i} {...f} />
            ))}
        </group>
    );
}

/** People at the bus terminal: [x, z, facing, actions]. */
const BUS_WAITING: [number, number, number, Action[]][] = [
    [-6.2, -5.6, 0, ['sit', 'chat']],
    [-4.0, -5.6, 0, ['chat', 'sit']],
    [5.6, -5.6, 0, ['sit', 'chat']],
    [8.5, 2.2, Math.PI / 2, ['look', 'phone', 'idle']],
    [-11, -3.4, Math.PI, ['talk', 'vend', 'idle']],
];

function Sign({ text, position, w, h, bg, fg = '#FFFFFF' }: { text: string; position: [number, number, number]; w: number; h: number; bg: string; fg?: string }) {
    return (
        <mesh position={position}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial map={signTexture(text, bg, fg)} toneMapped={false} />
        </mesh>
    );
}

/** Towns with a provincial bus terminal. */
export const BUS_TOWNS = TOWN_LAYOUTS.filter((t) => t.bus).map((t) => t.slug);

/** Provincial bus terminal: a long shed with seats and a ticket booth, buses parked along the front curb. */
function BusTerminal({ town, departingHidden }: { town: TownLayout; departingHidden: boolean }) {
    const folk = useMemo(() => {
        const rand = seeded(TOWN_LAYOUTS.indexOf(town) * 97 + 5);
        return BUS_WAITING.map(([x, z, rot, actions]) => ({
            colors: townsfolkColors(rand),
            position: [x, actions[0] === 'sit' || actions[0] === 'chat' ? 0.18 : 0.12, z] as [number, number, number],
            rot,
            actions,
        }));
    }, [town]);
    const others = BUS_TOWNS.filter((t) => t !== town.slug);
    const [w, d] = BUS_TERMINAL.size;
    return (
        <group>
            {/* concrete apron, painted curb and bay lines */}
            <mesh position={[0, 0.06, 0]} receiveShadow>
                <boxGeometry args={[w, 0.12, d]} />
                <meshLambertMaterial color="#C9C6BC" />
            </mesh>
            <mesh position={[0, 0.13, d / 2 - 0.15]}>
                <boxGeometry args={[w, 0.04, 0.3]} />
                <meshLambertMaterial color="#F2C14E" />
            </mesh>
            {[-14, -1, 13].map((x) => (
                <mesh key={x} position={[x, 0.125, 5.2]}>
                    <boxGeometry args={[0.15, 0.02, 3.2]} />
                    <meshLambertMaterial color="#FFFFFF" />
                </mesh>
            ))}
            <Shadowed>
                {/* back wall with a coloured band */}
                <mesh position={[0, 1.7, -8.4]}>
                    <boxGeometry args={[28, 3.2, 0.5]} />
                    <meshLambertMaterial color="#F1EFE8" flatShading />
                </mesh>
                <mesh position={[0, 2.6, -8.12]}>
                    <boxGeometry args={[28, 0.5, 0.06]} />
                    <meshLambertMaterial color="#1D9E75" />
                </mesh>
                {/* roof canopy over the waiting area on steel posts */}
                <mesh position={[0, 4.35, -3.6]} rotation-x={-0.04}>
                    <boxGeometry args={[30, 0.25, 11.6]} />
                    <meshLambertMaterial color="#185FA5" flatShading />
                </mesh>
                <mesh position={[0, 4.35, 2.2]}>
                    <boxGeometry args={[30, 0.7, 0.2]} />
                    <meshLambertMaterial color="#F1EFE8" />
                </mesh>
                {[-13, -4.5, 4.5, 13].map((x) => (
                    <mesh key={x} position={[x, 2.2, 1.2]}>
                        <cylinderGeometry args={[0.2, 0.22, 4.2, 8]} />
                        <meshLambertMaterial color="#D3D1C7" flatShading />
                    </mesh>
                ))}
                {/* rows of plastic seats */}
                {[-5, 5].map((x) => (
                    <group key={x} position={[x, 0, -5.6]}>
                        <mesh position-y={0.5}>
                            <boxGeometry args={[4, 0.1, 0.6]} />
                            <meshLambertMaterial color="#E67E22" />
                        </mesh>
                        <mesh position={[0, 0.85, -0.3]}>
                            <boxGeometry args={[4, 0.6, 0.08]} />
                            <meshLambertMaterial color="#E67E22" />
                        </mesh>
                        {[-1.8, 1.8].map((lx) => (
                            <mesh key={lx} position={[lx, 0.25, 0]}>
                                <boxGeometry args={[0.08, 0.5, 0.5]} />
                                <meshLambertMaterial color="#5F5E5A" />
                            </mesh>
                        ))}
                    </group>
                ))}
                {/* ticket booth */}
                <mesh position={[-11, 1.35, -5.5]}>
                    <boxGeometry args={[3.6, 2.7, 3.2]} />
                    <meshLambertMaterial color="#F2C14E" flatShading />
                </mesh>
                <mesh position={[-11, 1.5, -3.88]}>
                    <planeGeometry args={[2.4, 1]} />
                    <meshLambertMaterial color="#26384A" />
                </mesh>
                {!departingHidden && (
                    <group position={[BUS_TERMINAL.bays[0][0], 0.12, BUS_TERMINAL.bays[0][1]]}>
                        <Bus paint={BUS_PAINTS[0]} route={routeName(others[0] ?? town.slug)} />
                    </group>
                )}
                <group position={[BUS_TERMINAL.bays[1][0], 0.12, BUS_TERMINAL.bays[1][1]]}>
                    <Bus paint={BUS_PAINTS[(TOWN_LAYOUTS.indexOf(town) % 2) + 1]} route={routeName(others[1] ?? town.slug)} />
                </group>
            </Shadowed>
            <Sign text="TICKETS" position={[-11, 3.0, -3.86]} w={2.4} h={0.45} bg="#C0392B" />
            <Sign text={`${town.name.toUpperCase()} BUS TERMINAL`} position={[0, 4.35, 2.31]} w={12} h={0.62} bg="#F1EFE8" fg="#185FA5" />
            {folk.map((f, i) => (
                <Bystander key={i} {...f} />
            ))}
        </group>
    );
}

function TownView({ town }: { town: TownLayout }) {
    const [cx, cz] = town.center;
    const ride = useGame((s) => s.ride);
    // The parked vehicle is the one driving in the ride cutscene, so it leaves (and arrives) with it.
    const riding = (mode: TravelMode) => ride?.mode === mode && (ride.from === town.slug || ride.to === town.slug);
    return (
        <Near x={cx} z={cz} range={360}>
            <group position={[cx + town.terminal[0], 0, cz + town.terminal[1]]}>
                <Shadowed>
                    <Terminal town={town} jeepneyHidden={riding('jeepney')} />
                </Shadowed>
                <Label text="JEEPNEY" position={[0, 4.4, 0]} height={1.1} size={40} color="#FFFFFF" stroke="#993C1D" bg="rgba(216,90,48,0.92)" />
            </group>
            {town.bus && (
                <>
                    <group position={[town.bus.x, 0, town.bus.z]} rotation-y={town.bus.rot}>
                        <BusTerminal town={town} departingHidden={riding('bus')} />
                    </group>
                    <Label text="BUS TERMINAL" position={[town.bus.x, 6.8, town.bus.z]} height={1.3} size={40} color="#FFFFFF" stroke="#0C447C" bg="rgba(24,95,165,0.92)" />
                </>
            )}
        </Near>
    );
}

export function Towns() {
    return (
        <group>
            {TOWN_LAYOUTS.map((t) => (
                <TownView key={t.slug} town={t} />
            ))}
        </group>
    );
}
