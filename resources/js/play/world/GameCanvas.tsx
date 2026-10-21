import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { bindCameraGestures } from '../camera';
import { allLocations, useGame } from '../store';
import { TOWN_LAYOUTS, buildCollisionWorld, hillPositions, npcSpot, treePositions } from './layout';
import { LocationSpot, type MarkerState } from './LocationSpot';
import { PlayerController, type Spot } from './PlayerController';
import { Lakes, MapLabels, Mountains, Nature, Terrain, Towns } from './Scenery';

/**
 * The 3D Region XII world. Loaded lazily so the login screen stays tiny on slow connections.
 */
export default function GameCanvas() {
    const zones = useGame((s) => s.zones);
    const quality = useGame((s) => s.quality);
    const wrapper = useRef<HTMLDivElement>(null);

    useEffect(() => (wrapper.current ? bindCameraGestures(wrapper.current) : undefined), []);

    const locations = useMemo(() => allLocations(zones), [zones]);

    // Zones in the database are the provinces; locked ones can't be entered yet.
    const lockedKey = zones.filter((z) => z.locked).map((z) => z.slug).join(',');
    const unlockLevels = useMemo(() => Object.fromEntries(zones.map((z) => [z.slug, z.unlock_level])), [zones]);

    const trees = useMemo(() => treePositions(quality === 'low' ? 700 : 1600), [quality]);
    const hills = useMemo(() => hillPositions(quality === 'low' ? 25 : 45), [quality]);

    const world = useMemo(
        () => buildCollisionWorld(locations, trees, hills, new Set(lockedKey ? lockedKey.split(',') : [])),
        [locations, trees, hills, lockedKey],
    );

    const spots = useMemo<Spot[]>(
        () => [
            ...locations.map((l) => {
                const [x, z] = npcSpot(l.slug, l.position);
                return { slug: l.slug, x, z };
            }),
            ...TOWN_LAYOUTS.map((t) => ({ slug: `terminal:${t.slug}`, x: t.center[0] + t.terminal[0], z: t.center[1] + t.terminal[1] + 1.5 })),
        ],
        [locations],
    );

    const markerFor = (loc: (typeof locations)[number]): MarkerState => {
        if (loc.zone.locked || loc.quests.length === 0 || loc.quests.every((q) => q.locked)) return 'locked';
        return loc.quests.every((q) => q.passed) ? 'done' : 'new';
    };

    return (
        <div ref={wrapper} className="absolute inset-0 touch-none">
            <Canvas
                flat
                dpr={quality === 'low' ? 1 : [1, 1.5]}
                gl={{ antialias: quality === 'high', powerPreference: 'high-performance' }}
                camera={{ fov: 45, near: 0.5, far: 700, position: [0, 20, 26] }}
            >
                <color attach="background" args={['#B5D4F4']} />
                <fog attach="fog" args={['#B5D4F4', quality === 'low' ? 70 : 110, quality === 'low' ? 220 : 380]} />
                <hemisphereLight args={['#ffffff', '#97C459', 1.6]} />
                <directionalLight position={[60, 120, 50]} intensity={1.8} />

                <Terrain />
                <Lakes />
                <Mountains />
                <Nature trees={trees} hills={hills} />
                <Towns />
                <MapLabels />

                {locations.map((loc) => (
                    <LocationSpot key={loc.slug} location={loc} marker={markerFor(loc)} />
                ))}

                <PlayerController world={world} spots={spots} unlockLevels={unlockLevels} />
            </Canvas>
        </div>
    );
}
