import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { MathUtils, PerspectiveCamera, Vector3, type Group } from 'three';
import { input, moveVector } from '../input';
import { useGame } from '../store';
import { Avatar } from './Avatar';
import { LAKESIDE_GATE, PLAYER_SPAWN, moveWithCollisions, npcSpot, type Box } from './layout';

const SPEED = 6;
const RADIUS = 0.45;
const TALK_DISTANCE = 3.5;
const CAMERA_OFFSET = new Vector3(0, 17, 15);

const PLAYER_COLORS = { skin: '#C68B59', hair: '#2C2C2A', shirt: '#D85A30', pants: '#0C447C' };

type Spot = { slug: string; x: number; z: number };

export function PlayerController({ colliders, spots, gateLocked, unlockLevel }: { colliders: Box[]; spots: Spot[]; gateLocked: boolean; unlockLevel: number }) {
    const group = useRef<Group>(null);
    const pos = useRef<[number, number]>([...PLAYER_SPAWN]);
    const speed = useRef(0);
    const lastGateToast = useRef(0);
    const lookAt = useRef(new Vector3());

    useFrame(({ camera, clock }, delta) => {
        const dt = Math.min(delta, 0.05);
        const game = useGame.getState();
        const paused = game.openSlug !== null || game.showBadges || game.showMenu;

        const mv = paused ? { x: 0, z: 0 } : moveVector();
        const amount = Math.hypot(mv.x, mv.z);
        speed.current = MathUtils.lerp(speed.current, amount, 0.2);

        if (amount > 0.05) {
            const [x, z] = pos.current;
            pos.current = moveWithCollisions(x, z, mv.x * SPEED * dt, mv.z * SPEED * dt, RADIUS, colliders);

            if (group.current) {
                const target = Math.atan2(mv.x, mv.z);
                let diff = target - group.current.rotation.y;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                group.current.rotation.y += diff * Math.min(1, dt * 12);
            }
        }

        const [px, pz] = pos.current;
        group.current?.position.set(px, 0, pz);

        // Camera follows from a fixed tilted angle (the "semi-3D" view).
        // Portrait phones get a wider lens so they see as much of the street as landscape screens.
        if (camera instanceof PerspectiveCamera) {
            const fov = camera.aspect < 0.8 ? 62 : camera.aspect < 1.2 ? 52 : 45;
            if (camera.fov !== fov) {
                camera.fov = fov;
                camera.updateProjectionMatrix();
            }
        }
        camera.position.lerp(new Vector3(px, 0, pz).add(CAMERA_OFFSET), 1 - Math.pow(0.001, dt));
        lookAt.current.lerp(new Vector3(px, 1, pz), 1 - Math.pow(0.001, dt));
        camera.lookAt(lookAt.current);

        // Who is close enough to talk to?
        let near: string | null = null;
        let best = TALK_DISTANCE;
        for (const s of spots) {
            const d = Math.hypot(s.x - px, s.z - pz);
            if (d < best) {
                best = d;
                near = s.slug;
            }
        }
        game.setNear(near);

        if (input.interact) {
            input.interact = false;
            if (near && !paused) game.openLocation(near);
        }

        if (gateLocked) {
            const g = LAKESIDE_GATE;
            const atGate = px > g.minX - 1 && px < g.maxX + 1 && pz > g.minZ - 1.6 && pz < g.maxZ + 1;
            if (atGate && clock.elapsedTime - lastGateToast.current > 4) {
                lastGateToast.current = clock.elapsedTime;
                game.flash(`The lakeside opens at level ${unlockLevel}. Keep doing quests!`);
            }
        }
    });

    return (
        <group ref={group} position={[PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]]}>
            <Avatar colors={PLAYER_COLORS} speed={speed} />
        </group>
    );
}

export function spotsFor(locations: { slug: string; position: [number, number] }[]): Spot[] {
    return locations.map((l) => {
        const [x, z] = npcSpot(l.slug, l.position);
        return { slug: l.slug, x, z };
    });
}
