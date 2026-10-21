import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { MathUtils, PerspectiveCamera, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { cameraRig, rotateCamera, zoomCamera } from '../camera';
import { cameraInput, input, isRunning, moveVector } from '../input';
import { isPaused, playerState, useGame } from '../store';
import { Character } from './Character';
import { LANDMARKS, LANDMARK_KINDS, landmarkWorld } from './landmarks';
import { PLAYER_SPAWN, type CollisionWorld } from './layout';
import { nearestTown, provinceAt } from './region';
import { Shadowed } from './Scenery';

const WALK_SPEED = 7;
const RUN_SPEED = 13;
const RADIUS = 0.45;
const TALK_DISTANCE = 3.5;

const PLAYER_COLORS = { skin: '#C68B59', hair: '#2C2C2A', shirt: '#D85A30', pants: '#0C447C' };

export type Spot = { slug: string; x: number; z: number };

/** Pokémon GO-style rings under the player: a steady ring and a pulse that keeps expanding. */
function PlayerRing() {
    const pulse = useRef<Mesh>(null);
    useFrame(({ clock }) => {
        if (!pulse.current) return;
        const t = (clock.elapsedTime * 0.7) % 1;
        pulse.current.scale.setScalar(1 + t * 3);
        (pulse.current.material as MeshBasicMaterial).opacity = 0.55 * (1 - t);
    });
    return (
        <group position-y={0.14}>
            <mesh rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.85, 1.05, 40]} />
                <meshBasicMaterial color="#FFFFFF" transparent opacity={0.9} depthWrite={false} />
            </mesh>
            <mesh ref={pulse} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.9, 1.0, 40]} />
                <meshBasicMaterial color="#4FC3F7" transparent depthWrite={false} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2}>
                <ringGeometry args={[TALK_DISTANCE - 0.1, TALK_DISTANCE, 56]} />
                <meshBasicMaterial color="#FFFFFF" transparent opacity={0.22} depthWrite={false} />
            </mesh>
        </group>
    );
}

export function PlayerController({ world, spots, unlockLevels }: { world: CollisionWorld; spots: Spot[]; unlockLevels: Record<string, number> }) {
    const group = useRef<Group>(null);
    const body = useRef<Group>(null);
    const pos = useRef<[number, number]>([...PLAYER_SPAWN]);
    const speed = useRef(0);
    const lookAt = useRef(new Vector3(PLAYER_SPAWN[0], 1, PLAYER_SPAWN[1]));
    const camPos = useRef(new Vector3());
    const areaCheck = useRef(0);
    const lastProvince = useRef<string | null>(null);

    useFrame(({ camera, clock }, delta) => {
        const dt = Math.min(delta, 0.05);
        const game = useGame.getState();
        const paused = isPaused(game);

        const teleport = game.consumeTeleport();
        if (teleport) {
            pos.current = [...teleport];
            lookAt.current.set(teleport[0], 1, teleport[1]);
        }

        // Camera turn / zoom from keys and on-screen buttons.
        const cam = cameraInput();
        if (cam.turn) rotateCamera(cam.turn * dt * 2);
        if (cam.zoom) zoomCamera(1 + cam.zoom * dt * 1.5);

        // Movement is relative to where the camera looks.
        const mv = paused ? { x: 0, z: 0 } : moveVector();
        const amount = Math.hypot(mv.x, mv.z);
        const running = amount > 0.05 && isRunning();
        const targetSpeed = amount * (running ? RUN_SPEED : WALK_SPEED);
        speed.current = MathUtils.lerp(speed.current, targetSpeed / WALK_SPEED, 0.2);

        if (amount > 0.05) {
            const cos = Math.cos(cameraRig.yaw);
            const sin = Math.sin(cameraRig.yaw);
            const wx = mv.x * cos + mv.z * sin;
            const wz = -mv.x * sin + mv.z * cos;
            const [x, z] = pos.current;
            pos.current = world.move(x, z, wx * targetSpeed * dt, wz * targetSpeed * dt, RADIUS).pos;

            if (body.current) {
                const target = Math.atan2(wx, wz);
                let diff = target - body.current.rotation.y;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                body.current.rotation.y += diff * Math.min(1, dt * 12);
            }
        }

        const [px, pz] = pos.current;
        group.current?.position.set(px, 0, pz);
        playerState.x = px;
        playerState.z = pz;
        playerState.heading = body.current?.rotation.y ?? 0;
        playerState.cameraYaw = cameraRig.yaw;

        // Orbit camera.
        if (camera instanceof PerspectiveCamera) {
            const fov = camera.aspect < 0.8 ? 60 : camera.aspect < 1.2 ? 52 : 45;
            if (camera.fov !== fov) {
                camera.fov = fov;
                camera.updateProjectionMatrix();
            }
        }
        const { yaw, pitch, distance } = cameraRig;
        const follow = 1 - Math.pow(0.0005, dt);
        lookAt.current.lerp(new Vector3(px, 1.2, pz), follow);
        camPos.current.set(
            lookAt.current.x + Math.sin(yaw) * Math.cos(pitch) * distance,
            lookAt.current.y + Math.sin(pitch) * distance,
            lookAt.current.z + Math.cos(yaw) * Math.cos(pitch) * distance,
        );
        camera.position.copy(camPos.current);
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
            if (near && !paused) {
                if (near.startsWith('terminal:')) game.setShowTravel(true);
                else game.openLocation(near);
            }
        }

        // A few times a second: where am I, and am I at a landmark?
        if (clock.elapsedTime - areaCheck.current > 0.3) {
            areaCheck.current = clock.elapsedTime;
            const province = provinceAt(px, pz);
            game.setArea(province?.name ?? null, nearestTown(px, pz)?.name ?? null);

            if (province && province.slug !== lastProvince.current) {
                if (lastProvince.current) {
                    const zone = game.zones.find((z) => z.slug === province.slug);
                    game.flash(zone?.locked ? `Welcome to ${province.name}! Quests here open at level ${unlockLevels[province.slug] ?? '?'}.` : `Welcome to ${province.name}!`);
                }
                lastProvince.current = province.slug;
            }

            const landmark = LANDMARKS.find((l) => {
                const [lx, lz] = landmarkWorld(l);
                return Math.hypot(lx - px, lz - pz) < LANDMARK_KINDS[l.kind].radius + 6;
            });
            game.setNearLandmark(landmark?.slug ?? null);
            if (landmark && game.visit(landmark.slug)) game.flash(`New place discovered: ${landmark.name}!`);
        }
    });

    return (
        <group ref={group} position={[PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]]}>
            <PlayerRing />
            <group ref={body}>
                <Shadowed>
                    <Character modelKey="player" colors={PLAYER_COLORS} speed={speed} />
                </Shadowed>
            </group>
        </group>
    );
}
