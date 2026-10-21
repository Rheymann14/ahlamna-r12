import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import {
    BufferGeometry,
    CanvasTexture,
    Float32BufferAttribute,
    Object3D,
    ExtrudeGeometry,
    Shape,
    SpriteMaterial,
    type InstancedMesh,
    type Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TOWN_LAYOUTS, ROADS, lakeWorld, mountainWorld, type TownLayout } from './layout';
import { LAKES, MOUNTAINS, NEIGHBOURS, PROVINCES, toWorld, type MapPoint } from './region';

/* ---------------------------------------------------------------- terrain */

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

function LandMass({ outline, color, top, depth }: { outline: MapPoint[]; color: string; top: number; depth: number }) {
    const geometry = useMemo(() => new ExtrudeGeometry(shapeFrom(outline), { depth, bevelEnabled: false }), [outline, depth]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return (
        <mesh geometry={geometry} rotation-x={-Math.PI / 2} position-y={top - depth}>
            <meshLambertMaterial color={color} />
        </mesh>
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
                const len = Math.hypot(bx - ax, bz - az);
                const dashes = Math.max(1, Math.floor(len / 6));
                for (let d = 0; d < dashes; d++) {
                    const t0 = d / dashes;
                    const t1 = t0 + 0.5 / dashes;
                    pts.push(ax + (bx - ax) * t0, 0.08, az + (bz - az) * t0, ax + (bx - ax) * t1, 0.08, az + (bz - az) * t1);
                }
            });
        }
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute(pts, 3));
        return g;
    }, []);
    return (
        <lineSegments geometry={geometry}>
            <lineBasicMaterial color="#FFFFFF" transparent opacity={0.55} />
        </lineSegments>
    );
}

function Roads() {
    // All roads merged into one mesh (one draw call).
    const geometry = useMemo(() => {
        const parts: BufferGeometry[] = [];
        const W = 2.6; // half-width
        for (const line of ROADS) {
            for (let i = 1; i < line.length; i++) {
                const [ax, az] = line[i - 1];
                const [bx, bz] = line[i];
                const len = Math.hypot(bx - ax, bz - az);
                const nx = (-(bz - az) / len) * W;
                const nz = ((bx - ax) / len) * W;
                const g = new BufferGeometry();
                g.setAttribute('position', new Float32BufferAttribute([ax + nx, 0.04, az + nz, bx + nx, 0.04, bz + nz, bx - nx, 0.04, bz - nz, ax - nx, 0.04, az - nz], 3));
                g.setIndex([0, 2, 1, 0, 3, 2]);
                g.computeVertexNormals();
                parts.push(g);
            }
        }
        const merged = mergeGeometries(parts);
        parts.forEach((p) => p.dispose());
        return merged;
    }, []);
    return (
        <mesh geometry={geometry}>
            <meshLambertMaterial color="#C9C2AE" />
        </mesh>
    );
}

export function Terrain() {
    return (
        <group>
            <mesh rotation-x={-Math.PI / 2} position-y={-1.2}>
                <planeGeometry args={[4000, 4000]} />
                <meshLambertMaterial color="#378ADD" />
            </mesh>
            {NEIGHBOURS.map((n) => (
                <LandMass key={n.name} outline={n.outline} color="#C9C6B6" top={-0.5} depth={1} />
            ))}
            {PROVINCES.map((p, i) => (
                <LandMass key={`${p.slug}-${i}`} outline={p.outline} color={p.groundColor} top={0} depth={1.6} />
            ))}
            <ProvinceBorders />
            <Roads />
        </group>
    );
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
    return <sprite material={label.material} position={position} scale={[height * label.aspect, height, 1]} />;
}

export function MapLabels() {
    return (
        <group>
            {PROVINCES.map((p, i) => {
                const [x, z] = toWorld(p.labelAt);
                return <Label key={`${p.slug}-${i}`} text={p.name.toUpperCase()} position={[x, 40, z]} height={9} size={64} color="#FFFFFF" stroke="#27500A" />;
            })}
            {TOWN_LAYOUTS.map((t) => (
                <Label key={t.slug} text={t.name} position={[t.center[0], 16, t.center[1] - 6]} height={3.4} size={48} color="#412402" stroke="#FAEEDA" bg="rgba(250,238,218,0.85)" />
            ))}
            {MOUNTAINS.map((m) => {
                const w = mountainWorld(m);
                return <Label key={m.name} text={m.name} position={[w.x, w.h + 8, w.z]} height={5} size={48} color="#FFFFFF" stroke="#444441" />;
            })}
            {LAKES.map((l) => {
                const w = lakeWorld(l);
                return <Label key={l.name} text={l.name} position={[w.x, 6, w.z]} height={3.5} size={44} color="#FFFFFF" stroke="#0C447C" />;
            })}
        </group>
    );
}

/* ---------------------------------------------------------------- nature */

const dummy = new Object3D();

function useInstances(ref: RefObject<InstancedMesh | null>, items: [number, number, number][], place: (o: Object3D, item: [number, number, number], i: number) => void) {
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
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
    }, [ref, items, place]);
}

const placeTrunk = (o: Object3D, [x, z, s]: [number, number, number]) => {
    o.position.set(x, 0.6 * s, z);
    o.scale.setScalar(s);
};
const placeLeaves = (o: Object3D, [x, z, s]: [number, number, number], i: number) => {
    o.position.set(x, 2.1 * s, z);
    o.rotation.y = i;
    o.scale.setScalar(s);
};
const placeHill = (o: Object3D, [x, z, s]: [number, number, number], i: number) => {
    o.position.set(x, 0, z);
    o.rotation.y = i * 1.7;
    o.scale.set(12 * s, 5 * s, 10 * s);
};

/** Trees and hills: one draw call per mesh type however many there are. */
export function Nature({ trees, hills }: { trees: [number, number, number][]; hills: [number, number, number][] }) {
    const trunks = useRef<InstancedMesh>(null);
    const leaves = useRef<InstancedMesh>(null);
    const hillMesh = useRef<InstancedMesh>(null);
    useInstances(trunks, trees, placeTrunk);
    useInstances(leaves, trees, placeLeaves);
    useInstances(hillMesh, hills, placeHill);

    return (
        <group>
            <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} key={`t${trees.length}`}>
                <cylinderGeometry args={[0.18, 0.26, 1.2, 5]} />
                <meshLambertMaterial color="#854F0B" flatShading />
            </instancedMesh>
            <instancedMesh ref={leaves} args={[undefined, undefined, trees.length]} key={`l${trees.length}`}>
                <icosahedronGeometry args={[1.25, 0]} />
                <meshLambertMaterial color="#3B6D11" flatShading />
            </instancedMesh>
            <instancedMesh ref={hillMesh} args={[undefined, undefined, hills.length]} key={`h${hills.length}`}>
                <sphereGeometry args={[1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshLambertMaterial color="#639922" flatShading />
            </instancedMesh>
        </group>
    );
}

export function Mountains() {
    return (
        <group>
            {MOUNTAINS.map((m) => {
                const w = mountainWorld(m);
                return (
                    <group key={m.name} position={[w.x, 0, w.z]}>
                        <mesh position-y={w.h / 2}>
                            <coneGeometry args={[w.r, w.h, 9, 3]} />
                            <meshLambertMaterial color="#3B6D11" flatShading />
                        </mesh>
                        <mesh position-y={w.h * 0.86}>
                            <coneGeometry args={[w.r * 0.28, w.h * 0.28, 9]} />
                            <meshLambertMaterial color="#888780" flatShading />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
}

export function Lakes() {
    return (
        <group>
            {LAKES.map((lake) => {
                const l = lakeWorld(lake);
                return (
                    <group key={lake.name} position={[l.x, 0, l.z]}>
                        <mesh rotation-x={-Math.PI / 2} position-y={0.05} scale={[l.rx + 2, l.rz + 2, 1]}>
                            <circleGeometry args={[1, 28]} />
                            <meshLambertMaterial color="#C2B280" />
                        </mesh>
                        <mesh rotation-x={-Math.PI / 2} position-y={0.08} scale={[l.rx, l.rz, 1]}>
                            <circleGeometry args={[1, 28]} />
                            <meshLambertMaterial color="#378ADD" />
                        </mesh>
                        {/* lily pads, a nod to Lake Sebu */}
                        {[[-0.4, 0.2], [0.3, -0.3], [0.55, 0.35], [-0.6, -0.2], [0.1, 0.5]].map(([fx, fz], i) => (
                            <mesh key={i} rotation-x={-Math.PI / 2} position={[fx * l.rx, 0.1, fz * l.rz]}>
                                <circleGeometry args={[0.9, 7]} />
                                <meshLambertMaterial color="#639922" />
                            </mesh>
                        ))}
                    </group>
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

function Fountain() {
    const water = useRef<Mesh>(null);
    useFrame(({ clock }) => {
        if (water.current) water.current.position.y = 1.0 + Math.sin(clock.elapsedTime * 2) * 0.05;
    });
    return (
        <group>
            <mesh position-y={0.3}>
                <cylinderGeometry args={[1.6, 1.8, 0.6, 12]} />
                <meshLambertMaterial color="#B4B2A9" flatShading />
            </mesh>
            <mesh position-y={0.62}>
                <cylinderGeometry args={[1.35, 1.35, 0.06, 12]} />
                <meshLambertMaterial color="#378ADD" />
            </mesh>
            <mesh position-y={1.0}>
                <cylinderGeometry args={[0.2, 0.3, 1.2, 6]} />
                <meshLambertMaterial color="#888780" flatShading />
            </mesh>
            <mesh ref={water}>
                <icosahedronGeometry args={[0.35, 0]} />
                <meshLambertMaterial color="#85B7EB" flatShading />
            </mesh>
        </group>
    );
}

/** A jeepney: the classic Filipino ride, built from boxes until real art arrives. */
function Jeepney() {
    return (
        <group>
            <mesh position-y={1.1}>
                <boxGeometry args={[5, 1.3, 2]} />
                <meshLambertMaterial color="#E6F1FB" flatShading />
            </mesh>
            <mesh position={[0, 1.15, 1.01]}>
                <planeGeometry args={[4.6, 0.25]} />
                <meshLambertMaterial color="#E24B4A" />
            </mesh>
            <mesh position={[0, 0.85, 1.01]}>
                <planeGeometry args={[4.6, 0.18]} />
                <meshLambertMaterial color="#EF9F27" />
            </mesh>
            <mesh position={[-0.2, 2.0, 0]}>
                <boxGeometry args={[4.4, 0.15, 2.1]} />
                <meshLambertMaterial color="#185FA5" />
            </mesh>
            <mesh position={[2.7, 0.85, 0]}>
                <boxGeometry args={[0.8, 0.9, 1.8]} />
                <meshLambertMaterial color="#B4B2A9" flatShading />
            </mesh>
            {[[-1.6, 1], [1.6, 1], [-1.6, -1], [1.6, -1]].map(([x, z], i) => (
                <mesh key={i} position={[x, 0.4, z]} rotation-x={Math.PI / 2}>
                    <cylinderGeometry args={[0.4, 0.4, 0.3, 10]} />
                    <meshLambertMaterial color="#2C2C2A" />
                </mesh>
            ))}
        </group>
    );
}

function Terminal() {
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
            <group position={[6, 0, 0.5]}>
                <Jeepney />
            </group>
        </group>
    );
}

function TownView({ town }: { town: TownLayout }) {
    const [cx, cz] = town.center;
    return (
        <group position={[cx, 0, cz]}>
            {town.streets.map(([x, z, w, d], i) => (
                <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.045, z]}>
                    <planeGeometry args={[w, d]} />
                    <meshLambertMaterial color="#C9C2AE" />
                </mesh>
            ))}
            <mesh rotation-x={-Math.PI / 2} position-y={0.06}>
                <circleGeometry args={[town.plazaRadius, 24]} />
                <meshLambertMaterial color="#F1EFE8" />
            </mesh>
            <Fountain />
            {town.houses.map(([x, z, w, h, d, wall, roof], i) => (
                <group key={i} position={[x, 0, z]}>
                    <mesh position-y={h / 2}>
                        <boxGeometry args={[w, h, d]} />
                        <meshLambertMaterial color={wall} flatShading />
                    </mesh>
                    <Roof w={w + 0.6} d={d + 0.6} h={1.6} color={roof} y={h} />
                    <mesh position={[0, 0.9, d / 2 + 0.01]}>
                        <planeGeometry args={[0.9, 1.8]} />
                        <meshLambertMaterial color="#444441" />
                    </mesh>
                </group>
            ))}
            <group position={[town.terminal[0], 0, town.terminal[1]]}>
                <Terminal />
            </group>
        </group>
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
