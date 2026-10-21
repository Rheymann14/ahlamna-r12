import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import { BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, type Group, type Object3D } from 'three';

export type AvatarColors = {
    skin: string;
    hair: string;
    shirt: string;
    pants: string;
    /** Long hair down to the shoulders. */
    longHair?: boolean;
    /** Colour of a cap, if the character wears one. */
    cap?: string;
};

/**
 * What a character is doing. Walking comes from `speed` and mixes with the actions that leave the legs free
 * (phone, carry, umbrella, talk...). Sitting actions fold the legs.
 */
export type Action =
    | 'idle'
    | 'wave'
    | 'hail'
    | 'phone'
    | 'read'
    | 'stretch'
    | 'look'
    | 'talk'
    | 'sweep'
    | 'sit'
    | 'chat'
    | 'ride'
    | 'jump'
    | 'cheer'
    | 'dribble'
    | 'vend'
    | 'carry'
    | 'umbrella';

type Props = {
    colors: AvatarColors;
    /** 0..1 walking intensity, read every frame (a ref so it never re-renders). */
    speed?: RefObject<number>;
    /** Current action, read every frame. */
    action?: RefObject<Action>;
};

/* Shared geometry: every avatar reuses the same buffers, so a busy town costs no extra memory. */
const GEO = {
    shadow: new CircleGeometry(0.55, 16),
    leg: new BoxGeometry(0.24, 0.74, 0.26).translate(0, -0.37, 0),
    torso: new CylinderGeometry(0.32, 0.38, 0.8, 8),
    arm: new BoxGeometry(0.16, 0.62, 0.18).translate(0, -0.3, 0),
    hand: new SphereGeometry(0.1, 6, 5).translate(0, -0.66, 0),
    head: new IcosahedronGeometry(0.34, 1),
    hair: new IcosahedronGeometry(0.36, 1),
    longHair: new BoxGeometry(0.62, 0.62, 0.22),
    capCrown: new SphereGeometry(0.37, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    capBrim: new BoxGeometry(0.42, 0.04, 0.3),
    eye: new SphereGeometry(0.045, 6, 4),
    phone: new BoxGeometry(0.09, 0.16, 0.03).translate(0, -0.72, 0.1),
    broomStick: new CylinderGeometry(0.025, 0.025, 1.15, 5).translate(0, -1.15, 0),
    broomHead: new ConeGeometry(0.18, 0.4, 6).translate(0, -1.82, 0),
    book: new BoxGeometry(0.46, 0.32, 0.06),
    ball: new SphereGeometry(0.14, 10, 8),
    basket: new CylinderGeometry(0.46, 0.34, 0.16, 10),
    fruit: new IcosahedronGeometry(0.12, 0),
    umbrellaStick: new CylinderGeometry(0.02, 0.02, 1.5, 5),
    umbrellaTop: new ConeGeometry(0.85, 0.4, 8),
};

const lambertCache = new Map<string, MeshLambertMaterial>();

/** One shared flat-shaded material per colour. */
export function lambert(color: string): MeshLambertMaterial {
    let m = lambertCache.get(color);
    if (!m) {
        m = new MeshLambertMaterial({ color, flatShading: true });
        lambertCache.set(color, m);
    }
    return m;
}

const SHADOW_MATERIAL = new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.18, depthWrite: false });
const EYE_MATERIAL = new MeshBasicMaterial({ color: '#2C2C2A' });

/** Arm angles: [forward/back swing (x), sideways raise (z)]. Positive z lifts the right arm outward; negative lifts the left. */
type Pose = { la: [number, number]; ra: [number, number]; ll: number; rl: number; y: number; lean: number; headY: number; headX: number };

const SITTING = new Set<Action>(['sit', 'chat', 'ride']);

function targetPose(a: Action, t: number, walk: number, s: number, out: Pose) {
    const swing = Math.sin(walk) * 0.7 * s;
    out.la[0] = -swing;
    out.la[1] = -0.06;
    out.ra[0] = swing;
    out.ra[1] = 0.06;
    out.ll = swing;
    out.rl = -swing;
    out.y = Math.abs(Math.sin(walk)) * 0.06 * s + Math.sin(t * 2) * 0.008;
    out.lean = 0;
    out.headY = 0;
    out.headX = 0;

    switch (a) {
        case 'wave':
            out.ra[0] = 0;
            out.ra[1] = 2.55 + Math.sin(t * 9) * 0.35;
            out.headX = -0.08;
            break;
        case 'hail':
            out.ra[0] = -2.25;
            out.ra[1] = 0.25 + Math.sin(t * 7) * 0.15;
            break;
        case 'phone':
            out.ra[0] = -1.1;
            out.ra[1] = -0.3;
            out.la[0] = -0.95;
            out.la[1] = 0.25;
            out.headX = 0.35;
            break;
        case 'read':
            out.ra[0] = -1.05;
            out.ra[1] = -0.3;
            out.la[0] = -1.05;
            out.la[1] = 0.3;
            out.headX = 0.3 + Math.sin(t * 0.7) * 0.05;
            out.headY = Math.sin(t * 1.3) * 0.12;
            break;
        case 'stretch':
            out.la[0] = 0;
            out.la[1] = -2.9;
            out.ra[0] = 0;
            out.ra[1] = 2.9;
            out.lean = Math.sin(t * 1.2) * 0.12;
            out.headX = -0.15;
            out.y += 0.03;
            break;
        case 'look':
            out.headY = Math.sin(t * 0.9) * 0.9;
            out.headX = Math.sin(t * 0.6) * 0.1;
            break;
        case 'talk':
            out.ra[0] = -0.6 + Math.sin(t * 3.1) * 0.35;
            out.ra[1] = 0.15;
            out.la[0] = -0.3 + Math.sin(t * 2.3 + 1) * 0.25;
            out.la[1] = -0.1;
            out.headX = Math.sin(t * 4) * 0.08;
            out.headY = Math.sin(t * 0.8) * 0.15;
            break;
        case 'sweep': {
            const k = Math.sin(t * 3);
            out.ra[0] = -0.55;
            out.ra[1] = k * 0.35 - 0.25;
            out.la[0] = -0.6;
            out.la[1] = k * 0.35 + 0.35;
            out.lean = 0.12;
            out.headX = 0.25;
            break;
        }
        case 'sit':
        case 'chat':
        case 'ride':
            out.ll = -1.45;
            out.rl = -1.45;
            out.y = -0.38;
            out.la[0] = a === 'ride' ? -1.2 : -0.5;
            out.ra[0] = a === 'ride' ? -1.2 : -0.5;
            out.la[1] = a === 'ride' ? 0.2 : -0.05;
            out.ra[1] = a === 'ride' ? -0.2 : 0.05;
            if (a === 'chat') {
                out.ra[0] = -0.7 + Math.sin(t * 3.3) * 0.3;
                out.ra[1] = 0.2;
                out.headY = Math.sin(t * 0.7) * 0.25;
                out.headX = Math.sin(t * 4.1) * 0.06;
            }
            break;
        case 'jump':
        case 'cheer': {
            const hop = Math.abs(Math.sin(t * 5.5));
            out.y = hop * (a === 'jump' ? 0.5 : 0.25);
            out.la[0] = 0;
            out.ra[0] = 0;
            out.la[1] = -2.5 - (a === 'cheer' ? Math.sin(t * 11) * 0.3 : 0);
            out.ra[1] = 2.5 + (a === 'cheer' ? Math.sin(t * 11) * 0.3 : 0);
            out.ll = -hop * 0.4;
            out.rl = -hop * 0.4;
            break;
        }
        case 'dribble':
            out.ra[0] = -0.5 - Math.abs(Math.cos(t * 6)) * 0.25;
            out.ra[1] = 0.2;
            out.lean = 0.15;
            out.headX = 0.15;
            break;
        case 'vend':
            out.ra[0] = -1.0 + Math.sin(t * 2.4) * 0.3;
            out.la[0] = -1.0 + Math.sin(t * 2.4 + 2) * 0.3;
            out.ra[1] = -0.15;
            out.la[1] = 0.15;
            out.headX = 0.25;
            out.headY = Math.sin(t * 0.5) * 0.2;
            break;
        case 'carry':
            out.la[0] = 0;
            out.la[1] = -2.75;
            break;
        case 'umbrella':
            out.ra[0] = -0.95;
            out.ra[1] = -0.12;
            break;
    }
}

function blankPose(): Pose {
    return { la: [0, 0], ra: [0, 0], ll: 0, rl: 0, y: 0, lean: 0, headY: 0, headX: 0 };
}

/**
 * Low-poly character built from primitives: no model files to download.
 * Swap for a glTF character later without changing the rest of the game.
 */
export function Avatar({ colors, speed, action }: Props) {
    const body = useRef<Group>(null);
    const head = useRef<Group>(null);
    const leftLeg = useRef<Group>(null);
    const rightLeg = useRef<Group>(null);
    const leftArm = useRef<Group>(null);
    const rightArm = useRef<Group>(null);
    const props = useRef<Record<string, Object3D | null>>({});
    const phase = useRef(0);
    const seed = useMemo(() => Math.random() * 100, []);
    const pose = useMemo(blankPose, []);
    const goal = useMemo(blankPose, []);

    useFrame(({ clock }, delta) => {
        const s = speed?.current ?? 0;
        const a = action?.current ?? 'idle';
        const t = clock.elapsedTime + seed;
        phase.current += Math.min(delta, 0.1) * 10 * s;
        targetPose(a, t, phase.current, SITTING.has(a) ? 0 : s, goal);

        // Ease toward the target pose so actions blend instead of snapping.
        const k = 1 - Math.exp(-Math.min(delta, 0.1) * 12);
        pose.la[0] += (goal.la[0] - pose.la[0]) * k;
        pose.la[1] += (goal.la[1] - pose.la[1]) * k;
        pose.ra[0] += (goal.ra[0] - pose.ra[0]) * k;
        pose.ra[1] += (goal.ra[1] - pose.ra[1]) * k;
        pose.ll += (goal.ll - pose.ll) * k;
        pose.rl += (goal.rl - pose.rl) * k;
        pose.y += (goal.y - pose.y) * k;
        pose.lean += (goal.lean - pose.lean) * k;
        pose.headY += (goal.headY - pose.headY) * k;
        pose.headX += (goal.headX - pose.headX) * k;

        leftLeg.current?.rotation.set(pose.ll, 0, 0);
        rightLeg.current?.rotation.set(pose.rl, 0, 0);
        leftArm.current?.rotation.set(pose.la[0], 0, pose.la[1]);
        rightArm.current?.rotation.set(pose.ra[0], 0, pose.ra[1]);
        if (body.current) {
            body.current.position.y = pose.y;
            body.current.rotation.x = pose.lean;
        }
        head.current?.rotation.set(pose.headX, pose.headY, 0);

        const p = props.current;
        if (p.phone) p.phone.visible = a === 'phone';
        if (p.broom) p.broom.visible = a === 'sweep';
        if (p.book) p.book.visible = a === 'read';
        if (p.basket) p.basket.visible = a === 'carry';
        if (p.umbrella) p.umbrella.visible = a === 'umbrella';
        if (p.ball) {
            p.ball.visible = a === 'dribble';
            if (a === 'dribble') p.ball.position.y = 0.16 + Math.abs(Math.cos(t * 6)) * 0.62;
        }
    });

    const prop = (key: string) => (o: Object3D | null) => {
        props.current[key] = o;
        if (o) o.visible = false;
    };

    return (
        <group>
            <mesh geometry={GEO.shadow} material={SHADOW_MATERIAL} rotation-x={-Math.PI / 2} position-y={0.02} />
            <group ref={body}>
                {(
                    [
                        [leftLeg, -0.16],
                        [rightLeg, 0.16],
                    ] as const
                ).map(([ref, x]) => (
                    <group key={x} ref={ref} position={[x, 0.75, 0]}>
                        <mesh geometry={GEO.leg} material={lambert(colors.pants)} />
                    </group>
                ))}

                <mesh geometry={GEO.torso} material={lambert(colors.shirt)} position-y={1.12} />

                {(
                    [
                        [leftArm, -0.45],
                        [rightArm, 0.45],
                    ] as const
                ).map(([ref, x]) => (
                    <group key={x} ref={ref} position={[x, 1.45, 0]}>
                        <mesh geometry={GEO.arm} material={lambert(colors.shirt)} />
                        <mesh geometry={GEO.hand} material={lambert(colors.skin)} />
                        {x > 0 && (
                            <>
                                <mesh ref={prop('phone')} geometry={GEO.phone} material={lambert('#1F2933')} />
                                <group ref={prop('broom')}>
                                    <mesh geometry={GEO.broomStick} material={lambert('#8A5A2B')} />
                                    <mesh geometry={GEO.broomHead} material={lambert('#D9B26A')} />
                                </group>
                            </>
                        )}
                    </group>
                ))}

                <mesh ref={prop('book')} geometry={GEO.book} material={lambert('#B03A2E')} position={[0, 1.2, 0.55]} rotation-x={-0.6} />
                <mesh ref={prop('ball')} geometry={GEO.ball} material={lambert('#E67E22')} position={[0.42, 0.5, 0.5]} />
                <group ref={prop('umbrella')} position={[0.4, 0, 0.45]}>
                    <mesh geometry={GEO.umbrellaStick} material={lambert('#5F5E5A')} position-y={1.7} />
                    <mesh geometry={GEO.umbrellaTop} material={lambert('#2F80ED')} position-y={2.5} />
                </group>

                <group ref={head} position-y={1.82}>
                    <mesh geometry={GEO.head} material={lambert(colors.skin)} />
                    {colors.cap ? (
                        <>
                            <mesh geometry={GEO.capCrown} material={lambert(colors.cap)} position-y={0.08} scale={[1, 0.75, 1]} />
                            <mesh geometry={GEO.capBrim} material={lambert(colors.cap)} position={[0, 0.1, 0.36]} />
                        </>
                    ) : (
                        <mesh geometry={GEO.hair} material={lambert(colors.hair)} position={[0, 0.16, -0.04]} scale={[1, 0.7, 1]} />
                    )}
                    {colors.longHair && <mesh geometry={GEO.longHair} material={lambert(colors.hair)} position={[0, -0.12, -0.22]} />}
                    {/* eyes face +z (toward the camera when standing still) */}
                    {[-0.12, 0.12].map((x) => (
                        <mesh key={x} geometry={GEO.eye} material={EYE_MATERIAL} position={[x, 0.02, 0.31]} />
                    ))}
                    <group ref={prop('basket')} position-y={0.42}>
                        <mesh geometry={GEO.basket} material={lambert('#C8A165')} />
                        {[
                            [0.15, 0.1, 0.08, '#F2C14E'],
                            [-0.14, 0.1, 0.1, '#E24B4A'],
                            [0, 0.12, -0.14, '#6DB843'],
                        ].map(([x, y, z, c]) => (
                            <mesh key={c as string} geometry={GEO.fruit} material={lambert(c as string)} position={[x as number, y as number, z as number]} />
                        ))}
                    </group>
                </group>
            </group>
        </group>
    );
}
