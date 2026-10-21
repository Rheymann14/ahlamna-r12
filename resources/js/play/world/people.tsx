import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Action, AvatarColors } from './Avatar';
import { Avatar } from './Avatar';

/** Townsfolk looks: Filipino skin tones, dark hair, everyday clothes. */
const SKIN = ['#C68B59', '#B97A4A', '#A86B3C', '#D9A066', '#8D5A33', '#E0B07E'];
const HAIR = ['#2C2C2A', '#1F1A17', '#412402', '#2C2C2A', '#D3D1C7'];
const SHIRTS = ['#E24B4A', '#2F80ED', '#F2C14E', '#1D9E75', '#FFFFFF', '#8E44AD', '#E67E22', '#5DCAA5', '#F09595', '#185FA5', '#97C459', '#D85A30'];
const PANTS = ['#444441', '#0C447C', '#633806', '#2C2C2A', '#5F5E5A', '#D3D1C7', '#185FA5'];
const CAPS = ['#E24B4A', '#185FA5', '#F2C14E', '#2C2C2A'];

/** A random look from a seeded random function. */
export function townsfolkColors(rand: () => number): AvatarColors {
    const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
    const roll = rand();
    return {
        skin: pick(SKIN),
        hair: roll < 0.08 ? '#D3D1C7' : pick(HAIR.slice(0, 4)),
        shirt: pick(SHIRTS),
        pants: pick(PANTS),
        longHair: rand() < 0.4,
        cap: rand() < 0.18 ? pick(CAPS) : undefined,
    };
}

type BystanderProps = {
    colors: AvatarColors;
    position: [number, number, number];
    /** Facing (rotation.y); characters face +Z. */
    rot?: number;
    /** Actions to switch between, at random every few seconds. */
    actions: Action[];
    scale?: number;
};

/** Someone standing (or sitting) in one place, switching between everyday actions. */
export function Bystander({ colors, position, rot = 0, actions, scale = 1 }: BystanderProps) {
    const action = useRef<Action>(actions[0]);
    const speed = useRef(0);
    const next = useRef(2 + Math.random() * 4);
    useFrame(({ clock }) => {
        if (clock.elapsedTime < next.current || actions.length < 2) return;
        next.current = clock.elapsedTime + 3 + Math.random() * 5;
        let pick = actions[Math.floor(Math.random() * actions.length)];
        if (pick === action.current) pick = actions[(actions.indexOf(pick) + 1) % actions.length];
        action.current = pick;
    });
    return (
        <group position={position} rotation-y={rot} scale={scale}>
            <Avatar colors={colors} speed={speed} action={action} />
        </group>
    );
}
