import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import type { WorldLocation } from '../api';
import { useModel } from './assets';
import type { AvatarColors } from './Avatar';
import { Character } from './Character';
import { BUILDINGS, DEFAULT_BUILDING, npcSpot } from './layout';
import { Roof } from './Scenery';

const NPC_COLORS: Record<string, AvatarColors> = {
    loc_school: { skin: '#C68B59', hair: '#2C2C2A', shirt: '#185FA5', pants: '#444441' },
    loc_health_center: { skin: '#D9A066', hair: '#2C2C2A', shirt: '#FFFFFF', pants: '#E6F1FB' },
    loc_home: { skin: '#B97A4A', hair: '#D3D1C7', shirt: '#D85A30', pants: '#633806' },
    loc_plaza: { skin: '#A86B3C', hair: '#2C2C2A', shirt: '#7F77DD', pants: '#0C447C' },
    loc_lake_sebu: { skin: '#C68B59', hair: '#412402', shirt: '#1D9E75', pants: '#5F5E5A' },
    loc_gensan_port: { skin: '#A86B3C', hair: '#2C2C2A', shirt: '#378ADD', pants: '#444441' },
    loc_isulan_youth: { skin: '#B97A4A', hair: '#2C2C2A', shirt: '#7F77DD', pants: '#2C2C2A' },
    loc_alabel_capitol: { skin: '#C68B59', hair: '#2C2C2A', shirt: '#D85A30', pants: '#444441' },
    loc_kidapawan_hub: { skin: '#D9A066', hair: '#412402', shirt: '#639922', pants: '#633806' },
};

const FALLBACK_COLORS: AvatarColors = { skin: '#C68B59', hair: '#2C2C2A', shirt: '#888780', pants: '#444441' };

export type MarkerState = 'new' | 'done' | 'locked';

function Marker({ state }: { state: MarkerState }) {
    const ref = useRef<Group>(null);
    useFrame(({ clock }) => {
        if (!ref.current) return;
        ref.current.position.y = 2.85 + Math.sin(clock.elapsedTime * 3) * 0.12;
        ref.current.rotation.y = clock.elapsedTime * 1.5;
    });

    const color = state === 'new' ? '#EF9F27' : state === 'done' ? '#1D9E75' : '#888780';

    return (
        <group ref={ref}>
            {state === 'done' ? (
                <mesh>
                    <octahedronGeometry args={[0.32, 0]} />
                    <meshBasicMaterial color={color} />
                </mesh>
            ) : (
                <>
                    <mesh position-y={0.18}>
                        <boxGeometry args={[0.16, 0.5, 0.16]} />
                        <meshBasicMaterial color={color} />
                    </mesh>
                    <mesh position-y={-0.24}>
                        <boxGeometry args={[0.16, 0.16, 0.16]} />
                        <meshBasicMaterial color={color} />
                    </mesh>
                </>
            )}
        </group>
    );
}

function Building({ slug }: { slug: string }) {
    const model = useModel('buildings', slug);
    const scene = useMemo(() => model?.scene.clone(), [model]);
    const s = BUILDINGS[slug] ?? DEFAULT_BUILDING;

    // A building modelled in Blender replaces the placeholder (exported at real size, door facing +Z).
    if (scene) return <primitive object={scene} />;
    const [w, h, d] = s.size;

    if (s.kind === 'gazebo') {
        const hw = w / 2 - 0.3;
        const hd = d / 2 - 0.3;
        return (
            <group>
                <mesh position-y={0.1}>
                    <cylinderGeometry args={[w / 2 + 0.3, w / 2 + 0.4, 0.2, 8]} />
                    <meshLambertMaterial color={s.trim} flatShading />
                </mesh>
                {[[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].map(([x, z], i) => (
                    <mesh key={i} position={[x, h / 2, z]}>
                        <cylinderGeometry args={[0.15, 0.15, h, 6]} />
                        <meshLambertMaterial color={s.wall} flatShading />
                    </mesh>
                ))}
                <Roof w={w + 1} d={d + 1} h={1.6} color={s.roof} y={h} />
            </group>
        );
    }

    return (
        <group>
            <mesh position-y={h / 2}>
                <boxGeometry args={[w, h, d]} />
                <meshLambertMaterial color={s.wall} flatShading />
            </mesh>
            <mesh position-y={0.15}>
                <boxGeometry args={[w + 0.3, 0.3, d + 0.3]} />
                <meshLambertMaterial color={s.trim} flatShading />
            </mesh>
            <Roof w={w + 0.8} d={d + 0.8} h={s.kind === 'hut' ? 2 : 1.8} color={s.roof} y={h} />
            {/* door */}
            <mesh position={[0, 1.1, d / 2 + 0.02]}>
                <planeGeometry args={[1.2, 2.2]} />
                <meshLambertMaterial color="#444441" />
            </mesh>
            {/* windows */}
            {w >= 6 &&
                [-w / 3, w / 3].map((x) => (
                    <mesh key={x} position={[x, h * 0.55, d / 2 + 0.02]}>
                        <planeGeometry args={[1.2, 1]} />
                        <meshLambertMaterial color="#B5D4F4" />
                    </mesh>
                ))}
            {/* coloured sign board above the door */}
            <mesh position={[0, h - 0.5, d / 2 + 0.05]}>
                <boxGeometry args={[Math.min(w - 1, 4), 0.6, 0.1]} />
                <meshLambertMaterial color={s.sign} />
            </mesh>
        </group>
    );
}

export function LocationSpot({ location, marker }: { location: WorldLocation; marker: MarkerState }) {
    const [x, z] = location.position;
    const [nx, nz] = npcSpot(location.slug, location.position);
    const idle = useRef(0);
    const npc = useRef<Group>(null);

    // Gentle idle sway so NPCs feel alive.
    useFrame(({ clock }) => {
        if (npc.current) npc.current.rotation.y = Math.sin(clock.elapsedTime * 0.8 + x) * 0.25;
    });

    return (
        <group>
            <group position={[x, 0, z]}>
                <Building slug={location.slug} />
            </group>
            <group position={[nx, 0, nz]}>
                <group ref={npc}>
                    <Character modelKey={location.slug} fallbackKey="npc_default" colors={NPC_COLORS[location.slug] ?? FALLBACK_COLORS} speed={idle} />
                </group>
                <Marker state={marker} />
            </group>
        </group>
    );
}
