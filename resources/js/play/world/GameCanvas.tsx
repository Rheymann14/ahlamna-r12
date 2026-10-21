import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { allLocations, useGame } from '../store';
import { BUILDINGS, DEFAULT_BUILDING, buildColliders, type Box } from './layout';
import { LocationSpot, type MarkerState } from './LocationSpot';
import { PlayerController, spotsFor } from './PlayerController';
import { Fences, Fountain, Ground, Houses, Lake, Trees } from './Scenery';

/**
 * The 3D world. Loaded lazily so the login screen stays tiny on slow connections.
 */
export default function GameCanvas() {
    const zones = useGame((s) => s.zones);
    const quality = useGame((s) => s.quality);

    const locations = useMemo(() => allLocations(zones), [zones]);
    const lakeside = zones.find((z) => z.slug === 'lakeside');
    const gateLocked = lakeside?.locked ?? true;

    const colliders = useMemo(() => buildColliders(locations, gateLocked), [locations, gateLocked]);
    const spots = useMemo(() => spotsFor(locations), [locations]);

    // Trees avoid NPC buildings (static blockers only, so they don't move when the gate opens).
    const treeBlockers = useMemo<Box[]>(
        () =>
            locations.map((l) => {
                const [w, , d] = (BUILDINGS[l.slug] ?? DEFAULT_BUILDING).size;
                return { minX: l.position[0] - w / 2 - 2, maxX: l.position[0] + w / 2 + 2, minZ: l.position[1] - d / 2 - 2, maxZ: l.position[1] + d / 2 + 4 };
            }),
        [locations],
    );

    const markerFor = (loc: (typeof locations)[number]): MarkerState => {
        if (loc.zone.locked || loc.quests.every((q) => q.locked)) return 'locked';
        return loc.quests.length > 0 && loc.quests.every((q) => q.passed) ? 'done' : 'new';
    };

    return (
        <Canvas
            flat
            dpr={quality === 'low' ? 1 : [1, 1.5]}
            gl={{ antialias: quality === 'high', powerPreference: 'high-performance' }}
            camera={{ fov: 45, near: 0.5, far: 110, position: [0, 15, 19] }}
        >
            <color attach="background" args={['#B5D4F4']} />
            <fog attach="fog" args={['#B5D4F4', 32, quality === 'low' ? 60 : 80]} />
            <hemisphereLight args={['#ffffff', '#97C459', 1.6]} />
            <directionalLight position={[12, 24, 10]} intensity={1.8} />

            <Ground />
            <Fountain />
            <Houses />
            <Trees blocked={treeBlockers} count={quality === 'low' ? 45 : 90} />
            <Lake />
            <Fences gateLocked={gateLocked} />

            {locations.map((loc) => (
                <LocationSpot key={loc.slug} location={loc} marker={markerFor(loc)} />
            ))}

            <PlayerController colliders={colliders} spots={spots} gateLocked={gateLocked} unlockLevel={lakeside?.unlock_level ?? 3} />
        </Canvas>
    );
}
