import { useEffect, useState } from 'react';
import type { AnimationClip, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Art made in Blender / Mixamo / asset packs is listed in public/models/manifest.json:
 *
 *   {
 *     "characters": { "player": "characters/player.glb", "loc_health_center": "characters/nurse.glb" },
 *     "buildings":  { "loc_school": "buildings/school.glb" },
 *     "landmarks":  { "koronadal-city-hall": "landmarks/koronadal-city-hall.glb" }
 *   }
 *
 * Keys are "player", "npc_default", a location slug, or a landmark slug (world/landmarks.ts). Anything not listed keeps the built-in placeholder,
 * so the game always works while art is still being made. See docs/ART_PIPELINE.md.
 */
export type ModelManifest = {
    characters?: Record<string, string>;
    buildings?: Record<string, string>;
    landmarks?: Record<string, string>;
};

export type LoadedModel = { scene: Object3D; animations: AnimationClip[] };

let manifestPromise: Promise<ModelManifest> | null = null;
const modelCache = new Map<string, Promise<LoadedModel>>();

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export function loadManifest(): Promise<ModelManifest> {
    manifestPromise ??= fetch('/models/manifest.json', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}));
    return manifestPromise;
}

export function loadModel(path: string): Promise<LoadedModel> {
    let p = modelCache.get(path);
    if (!p) {
        p = loader.loadAsync(`/models/${path}`).then((gltf) => ({ scene: gltf.scene, animations: gltf.animations }));
        modelCache.set(path, p);
    }
    return p;
}

/**
 * Resolves the model listed for `key` (falling back to `fallbackKey`), or null while loading,
 * when nothing is listed, or if the file fails to load.
 */
export function useModel(kind: keyof ModelManifest, key: string, fallbackKey?: string): LoadedModel | null {
    const [model, setModel] = useState<LoadedModel | null>(null);

    useEffect(() => {
        let alive = true;
        loadManifest().then((manifest) => {
            const path = manifest[kind]?.[key] ?? (fallbackKey ? manifest[kind]?.[fallbackKey] : undefined);
            if (!path) return;
            loadModel(path)
                .then((m) => alive && setModel(m))
                .catch((e) => console.warn(`Could not load model ${path}; using placeholder.`, e));
        });
        return () => {
            alive = false;
        };
    }, [kind, key, fallbackKey]);

    return model;
}
