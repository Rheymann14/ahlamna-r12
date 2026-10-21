import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import type { WorldLocation } from '../api';
import { playerState } from '../store';
import { useModel } from './assets';
import type { Action, AvatarColors } from './Avatar';
import { Character } from './Character';
import { BUILDINGS, DEFAULT_BUILDING, npcSpot } from './layout';
import { headingZ, turnToward } from './routes';
import { Near, Roof, Shadowed } from './Scenery';

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

/** What each quest-giver does while waiting for you (picked at random, a few seconds each). */
const NPC_HABITS: Record<string, Action[]> = {
    loc_school: ['read', 'look', 'talk', 'stretch'],
    loc_health_center: ['read', 'look', 'phone', 'stretch'],
    loc_home: ['sweep', 'sweep', 'look', 'stretch'],
    loc_plaza: ['dribble', 'dribble', 'cheer', 'phone'],
    loc_lake_sebu: ['stretch', 'look', 'stretch', 'idle'],
    loc_gensan_port: ['phone', 'look', 'carry', 'stretch'],
    loc_isulan_youth: ['read', 'talk', 'look', 'phone'],
    loc_alabel_capitol: ['read', 'phone', 'look', 'talk'],
    loc_kidapawan_hub: ['stretch', 'jump', 'look', 'phone'],
};

const DEFAULT_HABITS: Action[] = ['look', 'phone', 'stretch', 'idle'];

/** Within this distance the NPC turns to the player and waves. */
const GREET_DISTANCE = 9;
/** How far an NPC wanders from their spot. */
const WANDER = 1.6;
const WANDER_SPEED = 1.1;

/**
 * Keeps a quest-giver busy: everyday habits, a short wander now and then, and a wave when the player comes over.
 */
function useNpcLife(home: [number, number], habits: Action[]) {
    const npc = useRef<Group>(null);
    const speed = useRef(0);
    const action = useRef<Action>(habits[0]);
    const state = useRef({ x: home[0], z: home[1], heading: 0, until: 0, target: null as [number, number] | null, greetedAt: -1 });

    useFrame(({ clock }, delta) => {
        const g = npc.current;
        if (!g) return;
        const t = clock.elapsedTime;
        const dt = Math.min(delta, 0.1);
        const st = state.current;
        const dx = playerState.x - st.x;
        const dz = playerState.z - st.z;
        const d = Math.hypot(dx, dz);

        if (d < GREET_DISTANCE) {
            // Stop, turn to the player, wave, then chat.
            if (st.greetedAt < 0) st.greetedAt = t;
            st.target = null;
            speed.current = 0;
            st.heading = turnToward(st.heading, headingZ(dx, dz), dt * 5);
            action.current = t - st.greetedAt < 2.2 ? 'wave' : d < 4.5 ? 'talk' : 'idle';
        } else {
            if (st.greetedAt >= 0) {
                st.greetedAt = -1;
                st.until = t + 1.5;
                action.current = 'idle';
            }
            if (st.target) {
                const tx = st.target[0] - st.x;
                const tz = st.target[1] - st.z;
                const left = Math.hypot(tx, tz);
                if (left < 0.1) {
                    st.target = null;
                    speed.current = 0;
                } else {
                    const step = Math.min(left, WANDER_SPEED * dt);
                    st.x += (tx / left) * step;
                    st.z += (tz / left) * step;
                    st.heading = turnToward(st.heading, headingZ(tx, tz), dt * 6);
                    speed.current = 0.6;
                    action.current = 'idle';
                }
            } else if (t > st.until) {
                st.until = t + 4 + Math.random() * 5;
                if (Math.random() < 0.3) {
                    // Wander a step or two away from the building (+Z), or head back home.
                    const a = Math.random() * Math.PI;
                    const r = Math.hypot(st.x - home[0], st.z - home[1]) > 0.5 ? 0 : WANDER * (0.5 + Math.random() * 0.5);
                    st.target = [home[0] + Math.cos(a) * r, home[1] + Math.sin(a) * r];
                } else {
                    action.current = habits[Math.floor(Math.random() * habits.length)];
                }
            } else {
                // Settle back to facing the street (and the default camera) with a little sway.
                st.heading = turnToward(st.heading, Math.sin(t * 0.4 + home[0]) * 0.35, dt * 1.5);
            }
        }

        g.position.set(st.x, 0, st.z);
        g.rotation.y = st.heading;
    });

    return { npc, speed, action };
}

export type MarkerState = 'new' | 'done' | 'locked';

const MARKER_COLORS: Record<MarkerState, string> = { new: '#EF9F27', done: '#1D9E75', locked: '#888780' };

function Marker({ state }: { state: MarkerState }) {
    const ref = useRef<Group>(null);
    useFrame(({ clock }) => {
        if (!ref.current) return;
        ref.current.position.y = 2.85 + Math.sin(clock.elapsedTime * 3) * 0.12;
        ref.current.rotation.y = clock.elapsedTime * 1.5;
    });

    const color = MARKER_COLORS[state];

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
    const home = useMemo<[number, number]>(() => [nx, nz], [nx, nz]);
    const { npc, speed, action } = useNpcLife(home, NPC_HABITS[location.slug] ?? DEFAULT_HABITS);

    return (
        <Near x={x} z={z} range={300}>
            <Shadowed>
                <group position={[x, 0, z]}>
                    <Building slug={location.slug} />
                </group>
                <group position={[nx, 0, nz]} ref={npc}>
                    <Character modelKey={location.slug} fallbackKey="npc_default" colors={NPC_COLORS[location.slug] ?? FALLBACK_COLORS} speed={speed} action={action} />
                </group>
            </Shadowed>
            <group position={[nx, 0, nz]}>
                <Marker state={marker} />
                {/* quest spot ring, like a stop's interaction radius */}
                <mesh rotation-x={-Math.PI / 2} position-y={0.13}>
                    <ringGeometry args={[2.6, 3.0, 40]} />
                    <meshBasicMaterial color={MARKER_COLORS[marker]} transparent opacity={0.55} depthWrite={false} />
                </mesh>
            </group>
        </Near>
    );
}
