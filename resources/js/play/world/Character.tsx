import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { AnimationMixer, Box3, Vector3, type AnimationAction } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useModel, type LoadedModel } from './assets';
import { Avatar, type AvatarColors } from './Avatar';

const TARGET_HEIGHT = 1.8;

type Props = {
    /** Manifest key: "player" or a location slug. */
    modelKey: string;
    /** Manifest key tried when modelKey has no model (e.g. "npc_default"). */
    fallbackKey?: string;
    /** Placeholder colours used until (or unless) a real model exists. */
    colors: AvatarColors;
    /** Movement speed relative to walking: 0 = standing, 1 = walking, >1.4 = running. */
    speed?: RefObject<number>;
};

/**
 * A character: the artist's animated glTF model when one is listed in public/models/manifest.json,
 * otherwise the built-in low-poly placeholder.
 */
export function Character({ modelKey, fallbackKey, colors, speed }: Props) {
    const model = useModel('characters', modelKey, fallbackKey);
    return model ? <ModelCharacter model={model} speed={speed} /> : <Avatar colors={colors} speed={speed} />;
}

function findClip(model: LoadedModel, pattern: RegExp) {
    return model.animations.find((clip) => pattern.test(clip.name));
}

function ModelCharacter({ model, speed }: { model: LoadedModel; speed?: RefObject<number> }) {
    // Each character needs its own copy of the skinned mesh and skeleton.
    const scene = useMemo(() => {
        const copy = cloneSkinned(model.scene);
        const size = new Box3().setFromObject(copy).getSize(new Vector3());
        if (size.y > 0) copy.scale.multiplyScalar(TARGET_HEIGHT / size.y);
        return copy;
    }, [model]);

    const mixer = useMemo(() => new AnimationMixer(scene), [scene]);
    const actions = useMemo(() => {
        const make = (re: RegExp) => {
            const clip = findClip(model, re);
            return clip ? mixer.clipAction(clip) : null;
        };
        const idle = make(/idle/i) ?? make(/.*/);
        const walk = make(/walk/i);
        const run = make(/run|jog|sprint/i);
        return { idle, walk: walk ?? run ?? idle, run: run ?? walk ?? idle };
    }, [model, mixer]);

    const current = useRef<AnimationAction | null>(null);

    useEffect(() => {
        actions.idle?.play();
        current.current = actions.idle;
        return () => {
            mixer.stopAllAction();
        };
    }, [actions, mixer]);

    useFrame((_, delta) => {
        const s = speed?.current ?? 0;
        const next = s < 0.1 ? actions.idle : s < 1.4 ? actions.walk : actions.run;
        if (next && next !== current.current) {
            next.reset().fadeIn(0.2).play();
            current.current?.fadeOut(0.2);
            current.current = next;
        }
        if (next && next !== actions.idle) next.timeScale = Math.max(0.6, s < 1.4 ? s : s / 1.6);
        mixer.update(Math.min(delta, 0.1));
    });

    return (
        <group>
            <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
                <circleGeometry args={[0.55, 16]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
            </mesh>
            <primitive object={scene} />
        </group>
    );
}
