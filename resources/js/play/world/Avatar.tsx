import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import type { Group } from 'three';

export type AvatarColors = { skin: string; hair: string; shirt: string; pants: string };

type Props = {
    colors: AvatarColors;
    /** 0..1 walking intensity, read every frame (a ref so it never re-renders). */
    speed?: RefObject<number>;
};

/**
 * Low-poly character built from primitives: no model files to download.
 * Swap for a glTF character later without changing the rest of the game.
 */
export function Avatar({ colors, speed }: Props) {
    const leftLeg = useRef<Group>(null);
    const rightLeg = useRef<Group>(null);
    const leftArm = useRef<Group>(null);
    const rightArm = useRef<Group>(null);
    const body = useRef<Group>(null);
    const phase = useRef(0);

    useFrame((_, delta) => {
        const s = speed?.current ?? 0;
        phase.current += delta * 10 * s;
        const swing = Math.sin(phase.current) * 0.7 * s;
        if (leftLeg.current) leftLeg.current.rotation.x = swing;
        if (rightLeg.current) rightLeg.current.rotation.x = -swing;
        if (leftArm.current) leftArm.current.rotation.x = -swing;
        if (rightArm.current) rightArm.current.rotation.x = swing;
        if (body.current) body.current.position.y = Math.abs(Math.sin(phase.current)) * 0.06 * s;
    });

    return (
        <group ref={body}>
            {/* blob shadow */}
            <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
                <circleGeometry args={[0.55, 16]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
            </mesh>

            {[
                [leftLeg, -0.16],
                [rightLeg, 0.16],
            ].map(([ref, x]) => (
                <group key={x as number} ref={ref as RefObject<Group>} position={[x as number, 0.75, 0]}>
                    <mesh position-y={-0.37}>
                        <boxGeometry args={[0.24, 0.74, 0.26]} />
                        <meshLambertMaterial color={colors.pants} flatShading />
                    </mesh>
                </group>
            ))}

            <mesh position-y={1.12}>
                <cylinderGeometry args={[0.32, 0.38, 0.8, 8]} />
                <meshLambertMaterial color={colors.shirt} flatShading />
            </mesh>

            {[
                [leftArm, -0.45],
                [rightArm, 0.45],
            ].map(([ref, x]) => (
                <group key={x as number} ref={ref as RefObject<Group>} position={[x as number, 1.45, 0]}>
                    <mesh position-y={-0.3}>
                        <boxGeometry args={[0.16, 0.62, 0.18]} />
                        <meshLambertMaterial color={colors.shirt} flatShading />
                    </mesh>
                    <mesh position-y={-0.66}>
                        <sphereGeometry args={[0.1, 6, 5]} />
                        <meshLambertMaterial color={colors.skin} flatShading />
                    </mesh>
                </group>
            ))}

            <mesh position-y={1.82}>
                <icosahedronGeometry args={[0.34, 1]} />
                <meshLambertMaterial color={colors.skin} flatShading />
            </mesh>
            <mesh position={[0, 1.98, -0.04]} scale={[1, 0.7, 1]}>
                <icosahedronGeometry args={[0.36, 1]} />
                <meshLambertMaterial color={colors.hair} flatShading />
            </mesh>
            {/* eyes face +z (toward the camera when standing still) */}
            {[-0.12, 0.12].map((x) => (
                <mesh key={x} position={[x, 1.84, 0.31]}>
                    <sphereGeometry args={[0.045, 6, 4]} />
                    <meshBasicMaterial color="#2C2C2A" />
                </mesh>
            ))}
        </group>
    );
}
