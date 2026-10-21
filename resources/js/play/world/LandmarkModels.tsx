import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, DoubleSide, IcosahedronGeometry, PlaneGeometry, type BufferGeometry, type Group, type Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useModel } from './assets';
import { CATEGORY_COLORS, LANDMARKS, LANDMARK_KINDS, landmarkWorld, type Landmark, type LandmarkKind } from './landmarks';
import { Label, Near, Roof, Shadowed } from './Scenery';
import { flagTexture, signTexture, waterfallTexture } from './textures';

/**
 * The "best spots" of Region XII as stylized low-poly models, each with a floating map pin
 * (like a PokéStop) so it can be spotted from far away.
 *
 * Every model faces +Z. A glTF listed under "landmarks" in public/models/manifest.json
 * (keyed by landmark slug) replaces the built-in model; see docs/ART_PIPELINE.md.
 */

/** How high the pin floats above each kind of landmark. */
const PIN_HEIGHT: Record<LandmarkKind, number> = {
    roundabout: 17, cityhall: 18, capitol: 22, office: 30, cathedral: 30, birds: 18, waterfall: 27,
    fields: 12, fishport: 14, plaza: 14, beach: 11, hotspring: 9, campus: 24,
};

/* ---------------------------------------------------------------- building blocks */

type V3 = [number, number, number];

function Box({ p, s, c, r }: { p: V3; s: V3; c: string; r?: V3 }) {
    return (
        <mesh position={p} rotation={r}>
            <boxGeometry args={s} />
            <meshLambertMaterial color={c} flatShading />
        </mesh>
    );
}

function Cyl({ p, r, h, c, top, seg = 12 }: { p: V3; r: number; h: number; c: string; top?: number; seg?: number }) {
    return (
        <mesh position={p}>
            <cylinderGeometry args={[top ?? r, r, h, seg]} />
            <meshLambertMaterial color={c} flatShading />
        </mesh>
    );
}

/** A triangular prism roof / pediment: w wide, h tall, l long (along z), base at y. */
function Gable({ p, w, h, l, c }: { p: V3; w: number; h: number; l: number; c: string }) {
    // A 3-sided cylinder is a triangle (apex +z before rotating); scale it to size, then stand it up.
    return (
        <mesh position={[p[0], p[1] + h / 3, p[2]]} rotation-x={-Math.PI / 2} scale={[w / 1.732, l, h / 1.5]}>
            <cylinderGeometry args={[1, 1, 1, 3]} />
            <meshLambertMaterial color={c} flatShading />
        </mesh>
    );
}

/** A grid of window panes on a facade, merged into one mesh. */
function Windows({ cols, rows, w, h, sx, sy, y0, z, color = '#2D5C8A', skip }: { cols: number; rows: number; w: number; h: number; sx: number; sy: number; y0: number; z: number; color?: string; skip?: (c: number, r: number) => boolean }) {
    const geometry = useMemo(() => {
        const parts: BufferGeometry[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (skip?.(c, r)) continue;
                parts.push(new PlaneGeometry(w, h).translate((c - (cols - 1) / 2) * sx, y0 + r * sy, z));
            }
        }
        return parts.length ? mergeGeometries(parts) : null;
    }, [cols, rows, w, h, sx, sy, y0, z, skip]);
    useEffect(() => () => geometry?.dispose(), [geometry]);
    if (!geometry) return null;
    return (
        <mesh geometry={geometry}>
            <meshLambertMaterial color={color} />
        </mesh>
    );
}

function Flag({ p, height = 11 }: { p: V3; height?: number }) {
    const flag = useRef<Mesh>(null);
    useFrame(({ clock }) => {
        if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2.2 + p[0]) * 0.25;
    });
    return (
        <group position={p}>
            <Cyl p={[0, height / 2, 0]} r={0.1} h={height} c="#D3D1C7" seg={6} />
            <mesh position={[0, height + 0.15, 0]}>
                <sphereGeometry args={[0.2, 8, 6]} />
                <meshLambertMaterial color="#F2C14E" />
            </mesh>
            <group ref={flag} position={[0, height - 1, 0]}>
                <mesh position={[1.25, 0, 0]}>
                    <planeGeometry args={[2.5, 1.25]} />
                    <meshLambertMaterial map={flagTexture()} side={DoubleSide} />
                </mesh>
            </group>
        </group>
    );
}

function Sign({ p, text, w, h = 1.2, bg = '#0C447C', fg = '#FFFFFF', both = false }: { p: V3; text: string; w: number; h?: number; bg?: string; fg?: string; both?: boolean }) {
    const map = signTexture(text, bg, fg);
    return (
        <group position={p}>
            <mesh>
                <planeGeometry args={[w, h]} />
                <meshBasicMaterial map={map} toneMapped={false} />
            </mesh>
            {both && (
                <mesh rotation-y={Math.PI} position-z={-0.02}>
                    <planeGeometry args={[w, h]} />
                    <meshBasicMaterial map={map} toneMapped={false} />
                </mesh>
            )}
        </group>
    );
}

export function Palm({ p, h = 5, lean = 0.12 }: { p: V3; h?: number; lean?: number }) {
    return (
        <group position={p} rotation-z={lean}>
            <Cyl p={[0, h / 2, 0]} r={0.2} top={0.13} h={h} c="#9C7A4F" seg={6} />
            {Array.from({ length: 7 }, (_, k) => (
                <group key={k} position-y={h} rotation-y={(k / 7) * Math.PI * 2}>
                    <mesh position={[0, -0.35, 1.3]} rotation-x={0.5}>
                        <boxGeometry args={[0.55, 0.06, 2.7]} />
                        <meshLambertMaterial color={k % 2 ? '#5DAA3A' : '#4F9A30'} flatShading />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

function RoundTree({ p, s = 1, c = '#4E9A2E' }: { p: V3; s?: number; c?: string }) {
    return (
        <group position={p} scale={s}>
            <Cyl p={[0, 0.8, 0]} r={0.28} top={0.2} h={1.6} c="#8A5A2B" seg={6} />
            <mesh position-y={2.6}>
                <icosahedronGeometry args={[1.5, 0]} />
                <meshLambertMaterial color={c} flatShading />
            </mesh>
        </group>
    );
}

/** Several small spheres in one mesh (flowers, perched birds, rocks). */
function Dots({ points, r, c, detail = 0 }: { points: V3[]; r: number; c: string; detail?: number }) {
    const geometry = useMemo(() => mergeGeometries(points.map((pt) => new IcosahedronGeometry(r, detail).translate(...pt)))!, [points, r, detail]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return (
        <mesh geometry={geometry}>
            <meshLambertMaterial color={c} flatShading />
        </mesh>
    );
}

const circlePoints = (n: number, r: number, y: number, offset = 0): V3[] =>
    Array.from({ length: n }, (_, i) => {
        const a = offset + (i / n) * Math.PI * 2;
        return [Math.cos(a) * r, y, Math.sin(a) * r];
    });

/* ---------------------------------------------------------------- models */

function Roundabout() {
    const red = useMemo(() => circlePoints(14, 6.7, 0.55), []);
    const yellow = useMemo(() => circlePoints(14, 6.7, 0.55, Math.PI / 14), []);
    return (
        <group>
            <Cyl p={[0, 0.2, 0]} r={8.2} h={0.4} c="#E8E3D3" seg={40} />
            <Cyl p={[0, 0.43, 0]} r={7.8} h={0.06} c="#79C257" seg={40} />
            <Dots points={red} r={0.35} c="#E24B4A" />
            <Dots points={yellow} r={0.35} c="#F2C14E" />
            {circlePoints(4, 5, 0.4, Math.PI / 4).map((pt, i) => (
                <Palm key={i} p={pt} h={4.2} lean={0.08} />
            ))}
            <Cyl p={[0, 1.0, 0]} r={2.8} h={1.2} c="#D3D1C7" seg={8} />
            <Cyl p={[0, 2.0, 0]} r={2.0} h={0.8} c="#C9C2AE" seg={8} />
            <Cyl p={[0, 6.9, 0]} r={0.95} top={0.45} h={9} c="#F4F1E8" seg={4} />
            <mesh position-y={11.9}>
                <sphereGeometry args={[0.85, 14, 10]} />
                <meshLambertMaterial color="#F2C14E" emissive="#8A6A10" />
            </mesh>
        </group>
    );
}

function Civic({ palette: [wall, roof, accent], width, depth, height, dome }: { palette: [string, string, string]; width: number; depth: number; height: number; dome?: boolean }) {
    const base = 0.6;
    const top = base + height;
    const cols = Math.floor(width / 3);
    const skipPortico = useMemo(() => (c: number) => Math.abs(c - (cols - 1) / 2) < 1.6, [cols]);
    return (
        <group>
            <Box p={[0, 0.3, 0.6]} s={[width + 2, 0.6, depth + 3.2]} c="#D9D4C3" />
            <Box p={[0, 0.15, depth / 2 + 3.2]} s={[10, 0.3, 2]} c="#E8E3D3" />
            <Box p={[0, base + height / 2, 0]} s={[width, height, depth]} c={wall} />
            <Box p={[0, base + height * 0.5, 0]} s={[width + 0.2, 0.35, depth + 0.2]} c={accent} />
            <Box p={[0, top + 0.25, 0]} s={[width + 0.8, 0.5, depth + 0.8]} c={roof} />
            <Windows cols={cols} rows={2} w={1.3} h={1.7} sx={3} sy={height / 2} y0={base + height * 0.27} z={depth / 2 + 0.01} skip={skipPortico} />
            <group rotation-y={Math.PI}>
                <Windows cols={cols} rows={2} w={1.3} h={1.7} sx={3} sy={height / 2} y0={base + height * 0.27} z={depth / 2 + 0.01} />
            </group>
            {/* portico: columns, slab and pediment */}
            {[-3.6, -1.2, 1.2, 3.6].map((x) => (
                <Cyl key={x} p={[x, base + (height - 0.4) / 2, depth / 2 + 2.2]} r={0.38} h={height - 0.4} c="#FFFFFF" seg={10} />
            ))}
            <Box p={[0, top - 0.15, depth / 2 + 1.8]} s={[9.5, 0.5, 3.6]} c={wall} />
            <Gable p={[0, top + 0.1, depth / 2 + 1.8]} w={9.5} h={1.8} l={3.6} c={wall} />
            <Box p={[0, base + 1.6, depth / 2 + 0.02]} s={[2.4, 3.2, 0.05]} c="#5A3A22" />
            {dome ? (
                <group position-y={top + 0.5}>
                    <Cyl p={[0, 1.1, 0]} r={3.6} h={2.2} c={wall} seg={20} />
                    <Cyl p={[0, 2.25, 0]} r={3.8} h={0.3} c={accent} seg={20} />
                    <mesh position-y={2.3}>
                        <sphereGeometry args={[3.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
                        <meshLambertMaterial color={roof} flatShading />
                    </mesh>
                    <Cyl p={[0, 6.3, 0]} r={0.6} h={1.4} c={wall} seg={8} />
                    <mesh position-y={7.6}>
                        <coneGeometry args={[0.7, 1.4, 8]} />
                        <meshLambertMaterial color={accent} flatShading />
                    </mesh>
                </group>
            ) : (
                <group position-y={top + 0.5}>
                    <Box p={[0, 2, 0]} s={[5, 4, 5]} c={wall} />
                    <mesh position={[0, 2.4, 2.52]}>
                        <circleGeometry args={[1.3, 20]} />
                        <meshLambertMaterial color="#FFFFFF" />
                    </mesh>
                    <Box p={[0, 2.4, 2.56]} s={[0.12, 1.1, 0.02]} c="#2C2C2A" />
                    <Box p={[0.35, 2.4, 2.56]} s={[0.7, 0.1, 0.02]} c="#2C2C2A" />
                    <Roof w={5.6} d={5.6} h={2.4} color={roof} y={4} />
                </group>
            )}
            {/* hedges and the flag */}
            {[-1, 1].map((side) => (
                <Box key={side} p={[side * (width / 2 - 3), 0.5, depth / 2 + 5.5]} s={[6, 1, 1.2]} c="#3F8A2A" />
            ))}
            <Flag p={[dome ? -10 : -9, 0, dome ? 14 : 13]} />
        </group>
    );
}

function Office() {
    return (
        <group>
            {/* paved forecourt */}
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 12.5]}>
                <planeGeometry args={[30, 11]} />
                <meshLambertMaterial color="#E4E0D4" />
            </mesh>
            <Box p={[0, 11, 0]} s={[14, 22, 12]} c="#DCE6EE" />
            {[0, Math.PI].map((ry) => (
                <group key={ry} rotation-y={ry}>
                    <Windows cols={4} rows={6} w={2.6} h={2.2} sx={3.3} sy={3.3} y0={3.2} z={6.01} color="#3E6E9C" />
                </group>
            ))}
            {[Math.PI / 2, -Math.PI / 2].map((ry) => (
                <group key={ry} rotation-y={ry}>
                    <Windows cols={3} rows={6} w={2.6} h={2.2} sx={3.3} sy={3.3} y0={3.2} z={7.01} color="#3E6E9C" />
                </group>
            ))}
            <Box p={[0, 22.5, 0]} s={[14.6, 1, 12.6]} c="#185FA5" />
            <Sign p={[0, 22.5, 6.32]} text="REGION XII" w={8} h={0.9} bg="#185FA5" />
            {[-14, 14].map((x) => (
                <group key={x} position={[x, 0, 1]}>
                    <Box p={[0, 5, 0]} s={[12, 10, 10]} c="#EEF2F5" />
                    <Windows cols={3} rows={2} w={2.8} h={2} sx={3.6} sy={4} y0={3.2} z={5.01} color="#3E6E9C" />
                    <Box p={[0, 10.25, 0]} s={[12.4, 0.5, 10.4]} c="#185FA5" />
                </group>
            ))}
            {/* entrance canopy */}
            <Box p={[0, 4, 8]} s={[8, 0.4, 4]} c="#185FA5" />
            {[-3.6, 3.6].map((x) => (
                <Cyl key={x} p={[x, 2, 9.6]} r={0.2} h={4} c="#FFFFFF" seg={8} />
            ))}
            <Box p={[0, 1.6, 6.02]} s={[3.2, 3.2, 0.05]} c="#1F3B57" />
            {/* gate with the name sign */}
            {[-7, 7].map((x) => (
                <Box key={x} p={[x, 2.8, 18]} s={[1.4, 5.6, 1.4]} c="#D9D4C3" />
            ))}
            <Box p={[0, 6.2, 18]} s={[15.6, 1.6, 0.8]} c="#0C447C" />
            <Sign p={[0, 6.2, 18.42]} text="REGIONAL PRIME CENTER" w={14} h={1.3} both />
            <Flag p={[-4, 0, 13]} height={9} />
            <Flag p={[4, 0, 13]} height={9} />
        </group>
    );
}

function Cathedral() {
    return (
        <group>
            <Box p={[0, 0.2, 1]} s={[14, 0.4, 25]} c="#D9D4C3" />
            <Box p={[0, 4.9, 0]} s={[12, 9, 22]} c="#F5F1E6" />
            <Gable p={[0, 9.4, 0]} w={13.4} h={4.2} l={23} c="#9C3B2A" />
            {[Math.PI / 2, -Math.PI / 2].map((ry) => (
                <group key={ry} rotation-y={ry}>
                    <Windows cols={5} rows={1} w={1} h={3.2} sx={4} sy={0} y0={5.2} z={6.01} color="#5B7FC4" />
                </group>
            ))}
            {/* bell tower */}
            <Box p={[0, 10.4, 8]} s={[6, 20, 6]} c="#F5F1E6" />
            <Box p={[0, 14.5, 8]} s={[6.3, 0.4, 6.3]} c="#C9C2AE" />
            {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ry) => (
                <group key={ry} position={[0, 0, 8]} rotation-y={ry}>
                    <Box p={[0, 17, 3.01]} s={[1.6, 2.8, 0.05]} c="#3A2A1A" />
                </group>
            ))}
            <mesh position={[0, 23.4, 8]} rotation-y={Math.PI / 4}>
                <coneGeometry args={[4.4, 6, 4]} />
                <meshLambertMaterial color="#9C3B2A" flatShading />
            </mesh>
            <Box p={[0, 27.6, 8]} s={[0.25, 2.4, 0.25]} c="#F2C14E" />
            <Box p={[0, 28.1, 8]} s={[1.4, 0.25, 0.25]} c="#F2C14E" />
            {/* door and rose window */}
            <Box p={[0, 2.6, 11.03]} s={[2.8, 4.2, 0.05]} c="#5A3A22" />
            <mesh position={[0, 12, 11.03]}>
                <circleGeometry args={[1.3, 16]} />
                <meshLambertMaterial color="#6A8FD0" />
            </mesh>
        </group>
    );
}

function Birds() {
    const flock = useRef<Group>(null);
    const trees: V3[] = useMemo(() => LANDMARK_KINDS.birds.circles.map(([x, z]) => [x, 0, z]), []);
    const perched = useMemo(() => trees.flatMap(([x, , z], i) => circlePoints(3, 2.4, 6.6 + (i % 2) * 0.6, i).map(([dx, y, dz]) => [x + dx, y, z + dz] as V3)), [trees]);
    useFrame(({ clock }) => {
        if (!flock.current) return;
        flock.current.rotation.y = clock.elapsedTime * 0.35;
        flock.current.children.forEach((bird, i) => {
            const flap = Math.sin(clock.elapsedTime * 9 + i) * 0.6;
            bird.children[1].rotation.z = flap;
            bird.children[2].rotation.z = -flap;
        });
    });
    return (
        <group>
            {trees.map((p, i) => (
                <RoundTree key={i} p={p} s={2 + (i % 3) * 0.25} c={i % 2 ? '#3E7F2E' : '#4A8F35'} />
            ))}
            <Dots points={perched} r={0.35} c="#FFFFFF" detail={1} />
            <group ref={flock} position-y={13}>
                {Array.from({ length: 9 }, (_, i) => {
                    const a = (i / 9) * Math.PI * 2;
                    const r = 9 + (i % 3) * 2;
                    return (
                        <group key={i} position={[Math.cos(a) * r, (i % 4) * 0.9, Math.sin(a) * r]} rotation-y={-a}>
                            <Box p={[0, 0, 0]} s={[0.25, 0.25, 0.9]} c="#FFFFFF" />
                            <group position={[0.12, 0, 0]}>
                                <Box p={[0.6, 0, 0]} s={[1.2, 0.05, 0.45]} c="#FFFFFF" />
                            </group>
                            <group position={[-0.12, 0, 0]}>
                                <Box p={[-0.6, 0, 0]} s={[1.2, 0.05, 0.45]} c="#FFFFFF" />
                            </group>
                        </group>
                    );
                })}
            </group>
            <group position={[0, 0, 15]}>
                <Box p={[-1.6, 1, 0]} s={[0.2, 2, 0.2]} c="#633806" />
                <Box p={[1.6, 1, 0]} s={[0.2, 2, 0.2]} c="#633806" />
                <Sign p={[0, 2.2, 0.12]} text="BARAS BIRD SANCTUARY" w={4.4} h={0.8} bg="#27500A" both />
            </group>
        </group>
    );
}

function Waterfall() {
    const tex = useMemo(() => {
        const t = waterfallTexture().clone();
        t.repeat.set(1, 2);
        return t;
    }, []);
    const mist = useRef<Group>(null);
    useEffect(() => () => tex.dispose(), [tex]);
    useFrame(({ clock }, delta) => {
        tex.offset.y += delta * 1.4;
        if (mist.current) mist.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2) * 0.08);
    });
    const falls: [number, number, number, number][] = [
        [-5.5, 1.6, 12, 18.5],
        [0, 4, 18, 20.5],
        [5.5, 1.4, 9, 15.5],
    ]; // x, width, height, top
    return (
        <group>
            <Box p={[0, 10, -8]} s={[28, 20, 10]} c="#7E7466" />
            <Box p={[0, 20.6, -8]} s={[28.6, 1.4, 10.6]} c="#4E8A33" />
            <Box p={[-10.5, 6, -2.5]} s={[7, 12, 3.6]} c="#8A8072" />
            <Box p={[10.5, 4.5, -2.5]} s={[7, 9, 3.6]} c="#8A8072" />
            <Box p={[-10.5, 12.3, -2.5]} s={[7.3, 0.7, 3.9]} c="#5E9A3D" />
            <Box p={[10.5, 9.3, -2.5]} s={[7.3, 0.7, 3.9]} c="#5E9A3D" />
            {[[-9, -8], [-3, -10], [4, -9], [10, -7]].map(([x, z], i) => (
                <group key={i} position={[x, 21.2, z]}>
                    <mesh position-y={2}>
                        <coneGeometry args={[1.5, 4, 7]} />
                        <meshLambertMaterial color="#2F6B34" flatShading />
                    </mesh>
                </group>
            ))}
            {falls.map(([x, w, h, topY]) => (
                <mesh key={x} position={[x, topY - h / 2, -2.94]}>
                    <planeGeometry args={[w, h]} />
                    <meshBasicMaterial map={tex} transparent opacity={0.92} toneMapped={false} />
                </mesh>
            ))}
            {/* plunge pool, rocks, mist and a rainbow */}
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.07, 3]} scale={[7.5, 4.6, 1]}>
                <circleGeometry args={[1, 28]} />
                <meshLambertMaterial color="#5CC6EE" />
            </mesh>
            <Dots points={circlePoints(12, 6.6, 0.3).map(([x, y, z]) => [x * 1.1, y, z * 0.7 + 3] as V3)} r={0.9} c="#9A9488" />
            <group ref={mist} position={[0, 1.2, -1]}>
                <Dots points={[[-1.5, 0, 0], [1.2, 0.3, 0.5], [0, 0.6, 1]]} r={1.4} c="#FFFFFF" detail={1} />
            </group>
            {['#E24B4A', '#F2C14E', '#5DCAA5', '#378ADD'].map((c, i) => (
                <mesh key={c} position={[0, 2, 2]} rotation-y={0.2}>
                    <torusGeometry args={[9 - i * 0.35, 0.16, 6, 32, Math.PI]} />
                    <meshBasicMaterial color={c} transparent opacity={0.35} depthWrite={false} />
                </mesh>
            ))}
        </group>
    );
}

function PineappleFields() {
    return (
        <group>
            <group position={[14, 0, -10]}>
                <Box p={[0, 1.5, 0]} s={[6, 3, 5]} c="#C9A66B" />
                <Roof w={6.6} d={5.6} h={2} color="#7A4A22" y={3} />
                <Box p={[0, 1.1, 2.52]} s={[1.6, 2.2, 0.05]} c="#5A3A22" />
            </group>
            <group position={[-12, 0, 8]}>
                <Cyl p={[0, 0.4, 0]} r={1.9} h={0.8} c="#D9D4C3" seg={10} />
                <mesh position-y={2.6} scale={[1, 1.35, 1]}>
                    <sphereGeometry args={[1.5, 8, 6]} />
                    <meshLambertMaterial color="#E8A93A" flatShading />
                </mesh>
                {Array.from({ length: 6 }, (_, k) => (
                    <group key={k} position-y={4.4} rotation-y={(k / 6) * Math.PI * 2}>
                        <mesh position={[0, 0.7, 0.35]} rotation-x={0.35}>
                            <coneGeometry args={[0.32, 1.8, 4]} />
                            <meshLambertMaterial color="#3E8A3A" flatShading />
                        </mesh>
                    </group>
                ))}
            </group>
        </group>
    );
}

function Banca({ p, ry, hull }: { p: V3; ry: number; hull: string }) {
    const ref = useRef<Group>(null);
    useFrame(({ clock }) => {
        if (!ref.current) return;
        ref.current.position.y = p[1] + Math.sin(clock.elapsedTime * 1.4 + p[0]) * 0.08;
        ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.1 + p[2]) * 0.04;
    });
    return (
        <group ref={ref} position={p} rotation-y={ry}>
            <Box p={[0, 0, 0]} s={[1.3, 0.7, 6]} c={hull} />
            <mesh position={[0, 0.05, 3.6]} rotation-x={Math.PI / 2}>
                <coneGeometry args={[0.66, 1.4, 4]} />
                <meshLambertMaterial color={hull} flatShading />
            </mesh>
            <Box p={[0, 0.65, -0.8]} s={[1.1, 0.7, 1.8]} c="#FFFFFF" />
            {[-2.5, 2.5].map((x) => (
                <mesh key={x} position={[x, -0.15, 0]} rotation-x={Math.PI / 2}>
                    <cylinderGeometry args={[0.12, 0.12, 6.4, 6]} />
                    <meshLambertMaterial color="#D9C29A" />
                </mesh>
            ))}
            {[-1.6, 1.6].map((z) => (
                <Box key={z} p={[0, 0.4, z]} s={[5.2, 0.1, 0.15]} c="#D9C29A" />
            ))}
        </group>
    );
}

function FishPort() {
    return (
        <group>
            <Box p={[0, 3, 0]} s={[20, 6, 10]} c="#E6F1FB" />
            <mesh position-y={6} rotation-z={Math.PI / 2} scale={[1, 1, 0.45]}>
                <cylinderGeometry args={[5.3, 5.3, 20.4, 14, 1, false, 0, Math.PI]} />
                <meshLambertMaterial color="#185FA5" flatShading side={DoubleSide} />
            </mesh>
            {[-6, 0, 6].map((x) => (
                <Box key={x} p={[x, 2.25, 5.02]} s={[4, 4.5, 0.05]} c="#3A4A5A" />
            ))}
            <Sign p={[0, 5.2, 5.06]} text="GENSAN FISH PORT" w={11} h={1.2} />
            {/* pier out into the bay */}
            <Box p={[0, 0, 21]} s={[5, 0.5, 32]} c="#B58B5A" />
            {[9, 15, 21, 27, 33].flatMap((z) => [-2.2, 2.2].map((x) => <Cyl key={`${x},${z}`} p={[x, -0.6, z]} r={0.18} h={1.4} c="#7A5A3A" seg={6} />))}
            <Box p={[-1.2, 0.6, 12]} s={[1.2, 0.7, 1.2]} c="#378ADD" />
            <Box p={[-1.2, 1.3, 12]} s={[1.2, 0.7, 1.2]} c="#378ADD" />
            <Box p={[1.3, 0.6, 14]} s={[1.2, 0.7, 1.2]} c="#F2C14E" />
            <Banca p={[-5.2, -0.45, 27]} ry={0.1} hull="#E24B4A" />
            <Banca p={[5.6, -0.45, 31]} ry={-0.15} hull="#378ADD" />
            <Banca p={[-6, -0.45, 36]} ry={0.25} hull="#F2C14E" />
        </group>
    );
}

function TunaPlaza() {
    const lamps = useMemo(() => circlePoints(4, 8.5, 0, Math.PI / 4), []);
    return (
        <group>
            <Cyl p={[0, 0.04, 0]} r={11} h={0.08} c="#EDE6D3" seg={36} />
            <Cyl p={[0, 0.1, 0]} r={5.4} h={0.08} c="#7CC35A" seg={30} />
            <Dots points={circlePoints(16, 4.6, 0.3)} r={0.3} c="#E24B4A" />
            <Cyl p={[0, 0.8, 0]} r={2.6} h={1.4} c="#C9C2AE" seg={8} />
            <Cyl p={[0, 2.1, 0]} r={1.6} top={0.9} h={1.2} c="#378ADD" seg={10} />
            <group position-y={4.4} rotation-x={-0.55}>
                <mesh scale={[0.85, 1, 2.6]}>
                    <sphereGeometry args={[1, 12, 8]} />
                    <meshLambertMaterial color="#5B7A99" flatShading />
                </mesh>
                <mesh position-z={-2.9} rotation-x={Math.PI / 2} scale={[1.8, 1, 0.25]}>
                    <coneGeometry args={[0.9, 1.3, 3]} />
                    <meshLambertMaterial color="#3E5A78" flatShading />
                </mesh>
                <mesh position={[0, 1, -0.3]} scale={[0.15, 1, 0.8]}>
                    <coneGeometry args={[0.7, 1.2, 4]} />
                    <meshLambertMaterial color="#F2C14E" flatShading />
                </mesh>
                {[-0.86, 0.86].map((x) => (
                    <mesh key={x} position={[x * 0.9, 0.25, 1.6]}>
                        <sphereGeometry args={[0.12, 6, 4]} />
                        <meshBasicMaterial color="#2C2C2A" />
                    </mesh>
                ))}
            </group>
            {lamps.map(([x, , z], i) => (
                <group key={i} position={[x, 0, z]}>
                    <Cyl p={[0, 1.8, 0]} r={0.08} h={3.6} c="#2C2C2A" seg={6} />
                    <mesh position-y={3.7}>
                        <sphereGeometry args={[0.28, 10, 8]} />
                        <meshBasicMaterial color={[1.6, 1.4, 1]} toneMapped={false} />
                    </mesh>
                </group>
            ))}
            {circlePoints(4, 10, 0).map((pt, i) => (
                <RoundTree key={i} p={pt} s={0.9} />
            ))}
        </group>
    );
}

function Beach() {
    const umbrellas: [V3, string][] = [
        [[-8, 0, 5], '#E24B4A'],
        [[1, 0, 8], '#378ADD'],
        [[9, 0, 4], '#F2C14E'],
        [[-14, 0, 2], '#1D9E75'],
    ];
    return (
        <group>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
                <planeGeometry args={[34, 24]} />
                <meshLambertMaterial color="#F6E7B9" polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
            </mesh>
            {umbrellas.map(([p, c]) => (
                <group key={c} position={p}>
                    <Cyl p={[0, 1.2, 0]} r={0.06} h={2.4} c="#FFFFFF" seg={5} />
                    <mesh position-y={2.5}>
                        <coneGeometry args={[1.9, 0.8, 8]} />
                        <meshLambertMaterial color={c} flatShading />
                    </mesh>
                    <Box p={[1.4, 0.2, 0.2]} s={[0.7, 0.15, 1.9]} c="#FFFFFF" r={[0, 0.3, 0]} />
                </group>
            ))}
            <Palm p={[-4, 0, 2]} h={5.5} lean={0.2} />
            <Palm p={[5, 0, 6]} h={5} lean={-0.18} />
            <Palm p={[-2, 0, 12]} h={4.6} lean={0.25} />
            {/* nipa hut cottage */}
            <group position={[0, 0, -12]}>
                <Box p={[0, 0.5, 0]} s={[6, 1, 4]} c="#A57C4A" />
                <Box p={[0, 1.9, 0]} s={[5.6, 1.8, 3.6]} c="#D9B77E" />
                <Roof w={7} d={5} h={2.4} color="#B08A4A" y={2.8} />
            </group>
        </group>
    );
}

function HotSpring() {
    const steam = useRef<Group>(null);
    useFrame(({ clock }) => {
        steam.current?.children.forEach((puff, i) => {
            const t = (clock.elapsedTime * 0.4 + i / 6) % 1;
            puff.position.y = 0.5 + t * 5;
            puff.scale.setScalar(0.6 + t * 1.6);
            ((puff as Mesh).material as { opacity: number }).opacity = 0.45 * (1 - t);
        });
    });
    return (
        <group>
            <mesh rotation-x={-Math.PI / 2} position-y={0.08}>
                <circleGeometry args={[6, 28]} />
                <meshLambertMaterial color="#86D9CF" emissive="#1E6E66" emissiveIntensity={0.25} />
            </mesh>
            <Dots points={circlePoints(14, 6.6, 0.25)} r={0.95} c="#8E8A80" />
            <group ref={steam}>
                {circlePoints(6, 2.5, 0).map(([x, , z], i) => (
                    <mesh key={i} position={[x, 0, z]}>
                        <icosahedronGeometry args={[0.8, 1]} />
                        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.3} depthWrite={false} />
                    </mesh>
                ))}
            </group>
            <group position={[0, 0, 8.2]}>
                <Box p={[-1.3, 0.9, 0]} s={[0.2, 1.8, 0.2]} c="#633806" />
                <Box p={[1.3, 0.9, 0]} s={[0.2, 1.8, 0.2]} c="#633806" />
                <Sign p={[0, 1.9, 0.12]} text="LAKE AGCO" w={3.4} h={0.8} bg="#27500A" both />
            </group>
        </group>
    );
}

function Campus() {
    return (
        <group>
            <Box p={[0, 0.25, 0.5]} s={[32, 0.5, 14]} c="#D9D4C3" />
            <Box p={[0, 5, 0]} s={[30, 9, 12]} c="#FFF8E7" />
            <Box p={[0, 5, 0]} s={[30.2, 0.35, 12.2]} c="#E0B020" />
            <Box p={[0, 9.75, 0]} s={[30.8, 0.6, 12.8]} c="#1E7B3A" />
            {[0, Math.PI].map((ry) => (
                <group key={ry} rotation-y={ry}>
                    <Windows cols={8} rows={2} w={1.6} h={1.8} sx={3.5} sy={4.2} y0={2.9} z={6.01} skip={ry ? undefined : (c) => c === 3 || c === 4} />
                </group>
            ))}
            {/* clock tower */}
            <Box p={[0, 9.5, 4]} s={[5, 18, 5]} c="#FFF8E7" />
            <mesh position={[0, 15.5, 6.53]}>
                <circleGeometry args={[1.4, 20]} />
                <meshLambertMaterial color="#FFFFFF" />
            </mesh>
            <Box p={[0, 15.7, 6.56]} s={[0.12, 1.1, 0.02]} c="#2C2C2A" />
            <Roof w={5.8} d={5.8} h={3} color="#1E7B3A" y={18.5} />
            <Box p={[0, 1.6, 6.55]} s={[2.6, 3.2, 0.05]} c="#5A3A22" />
            {/* gate */}
            {[-4.5, 4.5].map((x) => (
                <Box key={x} p={[x, 2.4, 10]} s={[1, 4.8, 1]} c="#1E7B3A" />
            ))}
            <Box p={[0, 5.2, 10]} s={[10.4, 1.2, 0.6]} c="#E0B020" />
            <Sign p={[0, 5.2, 10.32]} text="UNIVERSITY OF SOUTHERN MINDANAO" w={9.8} h={1} bg="#E0B020" fg="#1E4620" both />
            <Flag p={[-12, 0, 9]} height={9} />
        </group>
    );
}

function LandmarkModel({ l }: { l: Landmark }) {
    switch (l.kind) {
        case 'roundabout':
            return <Roundabout />;
        case 'cityhall':
            return <Civic palette={l.palette ?? ['#F1EFE8', '#185FA5', '#EF9F27']} width={24} depth={12} height={8} />;
        case 'capitol':
            return <Civic palette={l.palette ?? ['#FFFFFF', '#1D9E75', '#97C459']} width={26} depth={14} height={9} dome />;
        case 'office':
            return <Office />;
        case 'cathedral':
            return <Cathedral />;
        case 'birds':
            return <Birds />;
        case 'waterfall':
            return <Waterfall />;
        case 'fields':
            return <PineappleFields />;
        case 'fishport':
            return <FishPort />;
        case 'plaza':
            return <TunaPlaza />;
        case 'beach':
            return <Beach />;
        case 'hotspring':
            return <HotSpring />;
        case 'campus':
            return <Campus />;
    }
}

/** An artist's glTF (manifest "landmarks" key) replaces the built-in model when there is one. */
function ModelOrBuiltIn({ l }: { l: Landmark }) {
    const model = useModel('landmarks', l.slug);
    const scene = useMemo(() => model?.scene.clone(), [model]);
    return scene ? <primitive object={scene} /> : <LandmarkModel l={l} />;
}

/* ---------------------------------------------------------------- pins */

/** A floating, spinning map pin with a light beam: visible from far away, like a PokéStop. */
function Pin({ height, color, radius }: { height: number; color: string; radius: number }) {
    const icon = useRef<Group>(null);
    const ring = useRef<Mesh>(null);
    const bright = useMemo(() => new Color(color).multiplyScalar(1.5), [color]);
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        if (icon.current) {
            icon.current.rotation.y = t * 1.3;
            icon.current.position.y = height + Math.sin(t * 2) * 0.35;
        }
        if (ring.current) (ring.current.material as { opacity: number }).opacity = 0.22 + Math.sin(t * 2.5) * 0.1;
    });
    return (
        <group>
            <mesh position-y={height / 2}>
                <cylinderGeometry args={[0.3, 0.3, height, 8, 1, true]} />
                <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
            </mesh>
            <group ref={icon}>
                <mesh position-y={0.7}>
                    <sphereGeometry args={[1.1, 16, 12]} />
                    <meshBasicMaterial color={bright} toneMapped={false} />
                </mesh>
                <mesh position-y={-0.45} rotation-x={Math.PI}>
                    <coneGeometry args={[0.86, 1.7, 16]} />
                    <meshBasicMaterial color={bright} toneMapped={false} />
                </mesh>
                <mesh position-y={0.7}>
                    <torusGeometry args={[1.15, 0.12, 6, 24]} />
                    <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
                </mesh>
                <mesh position-y={0.7}>
                    <sphereGeometry args={[0.45, 10, 8]} />
                    <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
                </mesh>
            </group>
            <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.12}>
                <ringGeometry args={[radius + 1.2, radius + 2, 48]} />
                <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
            </mesh>
        </group>
    );
}

function LandmarkSpot({ l, range }: { l: Landmark; range: number }) {
    const [x, z] = landmarkWorld(l);
    const height = PIN_HEIGHT[l.kind];
    const color = CATEGORY_COLORS[l.category];
    return (
        <group>
            <Near x={x} z={z} range={range}>
                <group position={[x, 0, z]} rotation-y={l.rot}>
                    <Shadowed>
                        <ModelOrBuiltIn l={l} />
                    </Shadowed>
                </group>
                <Label text={l.name} position={[x, height + 3.4, z]} height={2.6} size={48} color="#FFFFFF" stroke={color} bg="rgba(20,30,45,0.72)" />
            </Near>
            <group position={[x, 0, z]}>
                <Pin height={height} color={color} radius={LANDMARK_KINDS[l.kind].radius} />
            </group>
        </group>
    );
}

export function Landmarks({ range }: { range: number }) {
    return (
        <group>
            {LANDMARKS.map((l) => (
                <LandmarkSpot key={l.slug} l={l} range={range} />
            ))}
        </group>
    );
}
