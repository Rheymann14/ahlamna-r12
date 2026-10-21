import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, MeshBasicMaterial, MeshLambertMaterial, ShaderMaterial, Shape, UniformsLib, UniformsUtils } from 'three';
import { FIELD_PATCHES, ROADS, ROAD_WIDTH, TOWN_LAYOUTS, lakeWorld, type Road } from './layout';
import { FlatBuilder, type RGBA } from './mesh';
import { LAKES, NEIGHBOURS, PROVINCES, pointInPolygon, toWorld, type MapPoint } from './region';
import { grassTexture, pineappleTexture, riceTexture, softDiscTexture } from './textures';

/** Heights of the map layers (y). Small steps plus polygon offsets keep them from flickering. */
const SEA_Y = -0.6;

/* ---------------------------------------------------------------- water */

/** Animated cartoon water: two-tone ripples and sparkles. Shared by the sea and the lakes. */
function makeWaterMaterial(deep: string, light: string) {
    return new ShaderMaterial({
        fog: true,
        uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uDeep: { value: new Color(deep) }, uLight: { value: new Color(light) } }]),
        vertexShader: /* glsl */ `
            #include <fog_pars_vertex>
            varying vec2 vWorld;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xz;
                vec4 mvPosition = viewMatrix * world;
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }`,
        fragmentShader: /* glsl */ `
            uniform float uTime;
            uniform vec3 uDeep;
            uniform vec3 uLight;
            varying vec2 vWorld;
            #include <fog_pars_fragment>
            void main() {
                vec2 p = vWorld;
                float w = sin(p.x * 0.07 + uTime * 0.6) * sin(p.y * 0.06 - uTime * 0.45)
                        + 0.5 * sin((p.x + p.y) * 0.13 + uTime * 1.1);
                vec3 col = mix(uDeep, uLight, 0.35 + 0.18 * w);
                float s = sin(p.x * 0.85 + uTime * 1.8) * sin(p.y * 0.8 - uTime * 1.5) * sin((p.x - p.y) * 0.3);
                col += smoothstep(0.82, 0.98, s) * 0.45;
                gl_FragColor = vec4(col, 1.0);
                #include <fog_fragment>
            }`,
    });
}

/* ---------------------------------------------------------------- land */

function shapeFrom(outline: MapPoint[]): Shape {
    // Shape lives in the XY plane; after rotating -90° about X, shape y becomes world -z.
    const shape = new Shape();
    outline.forEach((p, i) => {
        const [x, z] = toWorld(p);
        if (i === 0) shape.moveTo(x, -z);
        else shape.lineTo(x, -z);
    });
    return shape;
}

const SIDE_MATERIAL = new MeshLambertMaterial({ color: '#E2CF97' });

function LandMass({ outline, color, top, depth }: { outline: MapPoint[]; color: string; top: number; depth: number }) {
    const geometry = useMemo(() => new ExtrudeGeometry(shapeFrom(outline), { depth, bevelEnabled: false }), [outline, depth]);
    // Group 0 is the top and bottom, group 1 the sides (a sandy edge where land meets the sea).
    const materials = useMemo(() => [new MeshLambertMaterial({ color, map: grassTexture() }), SIDE_MATERIAL], [color]);
    useEffect(
        () => () => {
            geometry.dispose();
            materials[0].dispose();
        },
        [geometry, materials],
    );
    return <mesh geometry={geometry} material={materials} rotation-x={-Math.PI / 2} position-y={top - depth} receiveShadow />;
}

function isLand(x: number, y: number): boolean {
    return PROVINCES.some((p) => pointInPolygon(x, y, p.outline)) || NEIGHBOURS.some((n) => pointInPolygon(x, y, n.outline));
}

/** Every province edge that touches the sea, with the direction pointing out to sea (world units). */
function coastEdges() {
    const edges: { a: [number, number]; b: [number, number]; out: [number, number]; land: boolean }[] = [];
    const polys = [...PROVINCES.map((p) => ({ outline: p.outline, land: true })), ...NEIGHBOURS.map((n) => ({ outline: n.outline, land: false }))];
    for (const { outline, land } of polys) {
        outline.forEach((a, i) => {
            const b = outline[(i + 1) % outline.length];
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (len < 0.01) return;
            const n: [number, number] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
            const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const left = isLand(m[0] + n[0] * 1.2, m[1] + n[1] * 1.2);
            const right = isLand(m[0] - n[0] * 1.2, m[1] - n[1] * 1.2);
            if (left === right) return;
            const out: [number, number] = left ? [-n[0], -n[1]] : n;
            edges.push({ a: toWorld(a), b: toWorld(b), out, land });
        });
    }
    return edges;
}

function Coast() {
    const { sand, shallow, foam } = useMemo(() => {
        const sand = new FlatBuilder(0.015);
        const shallow = new FlatBuilder(SEA_Y + 0.02, true);
        const foam = new FlatBuilder(SEA_Y + 0.04, true);
        const SH: RGBA = [0.62, 0.92, 0.93, 0.9];
        const SH0: RGBA = [0.62, 0.92, 0.93, 0];
        const F: RGBA = [1, 1, 1, 0.95];
        const F0: RGBA = [1, 1, 1, 0];
        for (const { a, b, out, land } of coastEdges()) {
            const off = (p: [number, number], d: number): [number, number] => [p[0] + out[0] * d, p[1] + out[1] * d];
            shallow.quad(a, b, off(b, 20), off(a, 20), SH, SH, SH0, SH0);
            shallow.disc(a[0], a[1], 20, 14, SH, SH0);
            foam.quad(a, b, off(b, 1.8), off(a, 1.8), F, F, F0, F0);
            foam.disc(a[0], a[1], 1.8, 10, F, F0);
            if (land) sand.quad(a, b, off(b, -5), off(a, -5));
        }
        return { sand: sand.build(), shallow: shallow.build(), foam: foam.build() };
    }, []);
    const foamMaterial = useMemo(() => new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }), []);
    useFrame(({ clock }) => {
        foamMaterial.opacity = 0.65 + Math.sin(clock.elapsedTime * 1.6) * 0.3;
    });
    useEffect(
        () => () => {
            [sand, shallow, foam].forEach((g) => g.dispose());
            foamMaterial.dispose();
        },
        [sand, shallow, foam, foamMaterial],
    );
    return (
        <group>
            <mesh geometry={shallow} renderOrder={1}>
                <meshBasicMaterial vertexColors transparent depthWrite={false} />
            </mesh>
            <mesh geometry={foam} material={foamMaterial} renderOrder={2} />
            <mesh geometry={sand} receiveShadow>
                <meshLambertMaterial color="#F3E3B0" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
            </mesh>
        </group>
    );
}

function ProvinceBorders() {
    // Dashed white lines along province edges, like a game map.
    const geometry = useMemo(() => {
        const pts: number[] = [];
        for (const p of PROVINCES) {
            p.outline.forEach((a, i) => {
                const b = p.outline[(i + 1) % p.outline.length];
                const [ax, az] = toWorld(a);
                const [bx, bz] = toWorld(b);
                const dashes = Math.max(1, Math.floor(Math.hypot(bx - ax, bz - az) / 8));
                for (let d = 0; d < dashes; d++) {
                    const t0 = d / dashes;
                    const t1 = t0 + 0.5 / dashes;
                    pts.push(ax + (bx - ax) * t0, 0.1, az + (bz - az) * t0, ax + (bx - ax) * t1, 0.1, az + (bz - az) * t1);
                }
            });
        }
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute(pts, 3));
        return g;
    }, []);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return (
        <lineSegments geometry={geometry}>
            <lineBasicMaterial color="#FFFFFF" transparent opacity={0.45} />
        </lineSegments>
    );
}

/* ---------------------------------------------------------------- roads */

const ROAD_COLORS: Record<Road['kind'], string> = { highway: '#FFE7A0', road: '#FFF6DC', street: '#FFFFFF' };
/** Depth offsets: where roads overlap at junctions, highways win over roads, roads over streets. */
const ROAD_OFFSET: Record<Road['kind'], number> = { street: -3, road: -4, highway: -5 };

function Roads() {
    const geometries = useMemo(() => {
        const outline = new FlatBuilder(0.03);
        const fills: Record<Road['kind'], FlatBuilder> = { highway: new FlatBuilder(0.05), road: new FlatBuilder(0.05), street: new FlatBuilder(0.05) };
        const dashes = new FlatBuilder(0.07);
        for (const road of ROADS) {
            outline.polyline(road.points, road.width / 2 + 0.7);
            fills[road.kind].polyline(road.points, road.width / 2);
            if (road.kind === 'highway') dashes.dashes(road.points, 0.18, 2.5, 3.5);
        }
        for (const town of TOWN_LAYOUTS) {
            if (!town.roundabout) continue;
            const half = ROAD_WIDTH.highway / 2;
            outline.ring(town.center[0], town.center[1], town.roundabout - half - 0.7, town.roundabout + half + 0.7, 56);
            fills.highway.ring(town.center[0], town.center[1], town.roundabout - half, town.roundabout + half, 56);
        }
        return {
            outline: outline.build(),
            fills: (Object.keys(fills) as Road['kind'][]).map((kind) => ({ kind, geometry: fills[kind].build() })),
            dashes: dashes.build(),
        };
    }, []);
    useEffect(
        () => () => {
            geometries.outline.dispose();
            geometries.dashes.dispose();
            geometries.fills.forEach((f) => f.geometry.dispose());
        },
        [geometries],
    );
    return (
        <group>
            <mesh geometry={geometries.outline} receiveShadow>
                <meshLambertMaterial color="#C8B98E" polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
            </mesh>
            {geometries.fills.map(({ kind, geometry }) => (
                <mesh key={kind} geometry={geometry} receiveShadow>
                    <meshLambertMaterial color={ROAD_COLORS[kind]} polygonOffset polygonOffsetFactor={ROAD_OFFSET[kind]} polygonOffsetUnits={ROAD_OFFSET[kind]} />
                </mesh>
            ))}
            <mesh geometry={geometries.dashes}>
                <meshLambertMaterial color="#FFFFFF" polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-6} />
            </mesh>
        </group>
    );
}

/* ---------------------------------------------------------------- towns, fields, lakes */

function UrbanAreas() {
    return (
        <group>
            {TOWN_LAYOUTS.map((t) => (
                <mesh key={t.slug} rotation-x={-Math.PI / 2} position={[t.center[0], 0.01, t.center[1]]} scale={t.urban * 2}>
                    <planeGeometry />
                    <meshLambertMaterial color="#EEF0DA" alphaMap={softDiscTexture()} transparent depthWrite={false} opacity={0.55} />
                </mesh>
            ))}
        </group>
    );
}

function Fields() {
    return (
        <group>
            {FIELD_PATCHES.map((f, i) => (
                <mesh key={i} rotation={[-Math.PI / 2, 0, f.rot]} position={[f.x, 0.02, f.z]} receiveShadow>
                    <planeGeometry args={[f.w, f.d]} />
                    <meshLambertMaterial map={f.kind === 'rice' ? riceTexture() : pineappleTexture()} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
                </mesh>
            ))}
        </group>
    );
}

function Lakes({ material }: { material: ShaderMaterial }) {
    return (
        <group>
            {LAKES.map((lake) => {
                const l = lakeWorld(lake);
                return (
                    <group key={lake.name} position={[l.x, 0, l.z]}>
                        <mesh rotation-x={-Math.PI / 2} position-y={0.04} scale={[l.rx + 4, l.rz + 4, 1]}>
                            <circleGeometry args={[1, 40]} />
                            <meshLambertMaterial color="#F3E3B0" />
                        </mesh>
                        <mesh rotation-x={-Math.PI / 2} position-y={0.08} scale={[l.rx, l.rz, 1]} material={material}>
                            <circleGeometry args={[1, 40]} />
                        </mesh>
                        {/* lily pads, a nod to Lake Sebu */}
                        {[[-0.4, 0.2], [0.3, -0.3], [0.55, 0.35], [-0.6, -0.2], [0.1, 0.5], [-0.15, -0.5]].map(([fx, fz], i) => (
                            <mesh key={i} rotation-x={-Math.PI / 2} position={[fx * l.rx, 0.11, fz * l.rz]}>
                                <circleGeometry args={[1.3, 7]} />
                                <meshLambertMaterial color="#5E9E3A" />
                            </mesh>
                        ))}
                    </group>
                );
            })}
        </group>
    );
}

/* ---------------------------------------------------------------- all together */

export function Terrain() {
    const sea = useMemo(() => makeWaterMaterial('#2E9BD6', '#5CC6EE'), []);
    const lake = useMemo(() => makeWaterMaterial('#2F8FCF', '#63C2EA'), []);
    useFrame(({ clock }) => {
        sea.uniforms.uTime.value = clock.elapsedTime;
        lake.uniforms.uTime.value = clock.elapsedTime;
    });
    useEffect(
        () => () => {
            sea.dispose();
            lake.dispose();
        },
        [sea, lake],
    );

    return (
        <group>
            <mesh rotation-x={-Math.PI / 2} position-y={SEA_Y} material={sea}>
                <planeGeometry args={[5000, 5000]} />
            </mesh>
            {NEIGHBOURS.map((n) => (
                <LandMass key={n.name} outline={n.outline} color="#BCCBA6" top={-0.25} depth={1.2} />
            ))}
            {PROVINCES.map((p, i) => (
                <LandMass key={`${p.slug}-${i}`} outline={p.outline} color={p.groundColor} top={0} depth={1.6} />
            ))}
            <Coast />
            <ProvinceBorders />
            <UrbanAreas />
            <Fields />
            <Lakes material={lake} />
            <Roads />
        </group>
    );
}
