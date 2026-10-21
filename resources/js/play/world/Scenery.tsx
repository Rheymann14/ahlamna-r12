import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Object3D, type InstancedMesh, type Mesh } from 'three';
import { FENCES, HOUSES, LAKE, LAKESIDE_GATE, PLAZA_RADIUS, ROADS, WORLD_HALF, treePositions, type Box } from './layout';

export function Ground() {
    return (
        <group>
            <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
                <planeGeometry args={[WORLD_HALF * 2 + 40, WORLD_HALF * 2 + 40]} />
                <meshLambertMaterial color="#97C459" />
            </mesh>
            {ROADS.map(([x, z, w, d], i) => (
                <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.01, z]}>
                    <planeGeometry args={[w, d]} />
                    <meshLambertMaterial color="#D3D1C7" />
                </mesh>
            ))}
            <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
                <circleGeometry args={[PLAZA_RADIUS, 24]} />
                <meshLambertMaterial color="#F1EFE8" />
            </mesh>
        </group>
    );
}

export function Fountain() {
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

/** Pyramid roof sized to a w x d footprint. */
export function Roof({ w, d, h, color, y }: { w: number; d: number; h: number; color: string; y: number }) {
    return (
        <mesh position-y={y + h / 2} rotation-y={Math.PI / 4} scale={[w * 0.78, h, d * 0.78]}>
            <coneGeometry args={[1, 1, 4]} />
            <meshLambertMaterial color={color} flatShading />
        </mesh>
    );
}

export function Houses() {
    return (
        <group>
            {HOUSES.map(([x, z, w, h, d, wall, roof], i) => (
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
        </group>
    );
}

const dummy = new Object3D();

export function Trees({ blocked, count }: { blocked: Box[]; count: number }) {
    const trunks = useRef<InstancedMesh>(null);
    const leaves = useRef<InstancedMesh>(null);
    const positions = useMemo(() => treePositions(blocked, count), [blocked, count]);

    useLayoutEffect(() => {
        positions.forEach(([x, z, s], i) => {
            dummy.position.set(x, 0.6 * s, z);
            dummy.scale.set(s, s, s);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            trunks.current?.setMatrixAt(i, dummy.matrix);

            dummy.position.set(x, 2.1 * s, z);
            dummy.rotation.y = i;
            dummy.updateMatrix();
            leaves.current?.setMatrixAt(i, dummy.matrix);
        });
        if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
        if (leaves.current) leaves.current.instanceMatrix.needsUpdate = true;
    }, [positions]);

    // One draw call per mesh type, however many trees there are.
    return (
        <group>
            <instancedMesh ref={trunks} args={[undefined, undefined, positions.length]} key={`t${positions.length}`}>
                <cylinderGeometry args={[0.18, 0.26, 1.2, 5]} />
                <meshLambertMaterial color="#854F0B" flatShading />
            </instancedMesh>
            <instancedMesh ref={leaves} args={[undefined, undefined, positions.length]} key={`l${positions.length}`}>
                <icosahedronGeometry args={[1.25, 0]} />
                <meshLambertMaterial color="#3B6D11" flatShading />
            </instancedMesh>
        </group>
    );
}

export function Lake() {
    return (
        <group position={[LAKE.x, 0, LAKE.z]}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.015} scale={[LAKE.rx + 0.8, LAKE.rz + 0.8, 1]}>
                <circleGeometry args={[1, 24]} />
                <meshLambertMaterial color="#C2B280" />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position-y={0.03} scale={[LAKE.rx, LAKE.rz, 1]}>
                <circleGeometry args={[1, 24]} />
                <meshLambertMaterial color="#378ADD" />
            </mesh>
            {/* lily pads, a nod to Lake Sebu */}
            {[
                [-2, 1],
                [1.5, -1.5],
                [3, 1.8],
                [-3.5, -1],
            ].map(([x, z], i) => (
                <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.05, z]}>
                    <circleGeometry args={[0.45, 7]} />
                    <meshLambertMaterial color="#639922" />
                </mesh>
            ))}
        </group>
    );
}

function FenceSegment({ box }: { box: Box }) {
    const w = box.maxX - box.minX;
    const d = box.maxZ - box.minZ;
    const horizontal = w > d;
    const length = horizontal ? w : d;
    const posts = Math.max(2, Math.round(length / 2.5));

    return (
        <group position={[(box.minX + box.maxX) / 2, 0, (box.minZ + box.maxZ) / 2]}>
            <mesh position-y={0.7}>
                <boxGeometry args={horizontal ? [length, 0.15, 0.12] : [0.12, 0.15, length]} />
                <meshLambertMaterial color="#BA7517" />
            </mesh>
            <mesh position-y={0.35}>
                <boxGeometry args={horizontal ? [length, 0.15, 0.12] : [0.12, 0.15, length]} />
                <meshLambertMaterial color="#BA7517" />
            </mesh>
            {Array.from({ length: posts }, (_, i) => {
                const t = (i / (posts - 1) - 0.5) * length;
                return (
                    <mesh key={i} position={horizontal ? [t, 0.5, 0] : [0, 0.5, t]}>
                        <boxGeometry args={[0.2, 1, 0.2]} />
                        <meshLambertMaterial color="#854F0B" />
                    </mesh>
                );
            })}
        </group>
    );
}

export function Fences({ gateLocked }: { gateLocked: boolean }) {
    const gate = LAKESIDE_GATE;
    return (
        <group>
            {FENCES.map((box, i) => (
                <FenceSegment key={i} box={box} />
            ))}
            <group position={[(gate.minX + gate.maxX) / 2, 0, (gate.minZ + gate.maxZ) / 2]}>
                {[-2.2, 2.2].map((x) => (
                    <mesh key={x} position={[x, 1.4, 0]}>
                        <boxGeometry args={[0.4, 2.8, 0.4]} />
                        <meshLambertMaterial color="#633806" flatShading />
                    </mesh>
                ))}
                <mesh position-y={2.9}>
                    <boxGeometry args={[4.8, 0.5, 0.3]} />
                    <meshLambertMaterial color="#1D9E75" />
                </mesh>
                {gateLocked && (
                    <mesh position-y={0.7}>
                        <boxGeometry args={[4, 1.4, 0.15]} />
                        <meshLambertMaterial color="#888780" />
                    </mesh>
                )}
            </group>
        </group>
    );
}
