import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { MathUtils, PerspectiveCamera, Vector3, type Group } from 'three';
import { cameraRig, rotateCamera, zoomCamera } from '../camera';
import { cameraInput, input, isRunning, moveVector } from '../input';
import { isPaused, playerState, useGame } from '../store';
import { Character } from './Character';
import { PLAYER_SPAWN, type CollisionWorld } from './layout';
import { nearestTown, provinceAt } from './region';

const WALK_SPEED = 7;
const RUN_SPEED = 13;
const RADIUS = 0.45;
const TALK_DISTANCE = 3.5;

const PLAYER_COLORS = { skin: '#C68B59', hair: '#2C2C2A', shirt: '#D85A30', pants: '#0C447C' };

export type Spot = { slug: string; x: number; z: number };

export function PlayerController({ world, spots, unlockLevels }: { world: CollisionWorld; spots: Spot[]; unlockLevels: Record<string, number> }) {
    const group = useRef<Group>(null);
    const pos = useRef<[number, number]>([...PLAYER_SPAWN]);
    const speed = useRef(0);
    const lastLockToast = useRef(-10);
    const lookAt = useRef(new Vector3(PLAYER_SPAWN[0], 1, PLAYER_SPAWN[1]));
    const camPos = useRef(new Vector3());
    const areaCheck = useRef(0);

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
            const { pos: next, hit } = world.move(x, z, wx * targetSpeed * dt, wz * targetSpeed * dt, RADIUS);
            pos.current = next;

            if (hit && typeof hit === 'object' && clock.elapsedTime - lastLockToast.current > 4) {
                lastLockToast.current = clock.elapsedTime;
                game.flash(`${hit.locked.name} opens at level ${unlockLevels[hit.locked.slug] ?? '?'}. Keep doing quests!`);
            }

            if (group.current) {
                const target = Math.atan2(wx, wz);
                let diff = target - group.current.rotation.y;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                group.current.rotation.y += diff * Math.min(1, dt * 12);
            }
        }

        const [px, pz] = pos.current;
        group.current?.position.set(px, 0, pz);
        playerState.x = px;
        playerState.z = pz;
        playerState.heading = group.current?.rotation.y ?? 0;
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

        // Province / town name for the HUD, a few times a second.
        if (clock.elapsedTime - areaCheck.current > 0.3) {
            areaCheck.current = clock.elapsedTime;
            game.setArea(provinceAt(px, pz)?.name ?? null, nearestTown(px, pz)?.name ?? null);
        }
    });

    return (
        <group ref={group} position={[PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]]}>
            <Character modelKey="player" colors={PLAYER_COLORS} speed={speed} />
        </group>
    );
}
