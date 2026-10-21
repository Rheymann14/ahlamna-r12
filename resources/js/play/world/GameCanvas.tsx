import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import type { DirectionalLight } from 'three';
import { bindCameraGestures } from '../camera';
import { allLocations, playerState, useGame } from '../store';
import { Landmarks } from './LandmarkModels';
import { BUS_TERMINAL, TOWN_LAYOUTS, buildCollisionWorld, busPoint, hillPositions, npcSpot, treePositions } from './layout';
import { LocationSpot, type MarkerState } from './LocationSpot';
import { PlayerController, type Spot } from './PlayerController';
import { RideCutscene } from './RideCutscene';
import { Clouds, MapLabels, Mountains, Nature, SUN_DIRECTION, Sky, Towns } from './Scenery';
import { Terrain } from './Terrain';
import { TownLife, planTownLife } from './TownLife';
import { Traffic } from './Traffic';

const Effects = lazy(() => import('./Effects'));

const HORIZON = '#D4EEFF';
const SHADOW_SPAN = 70;

/** Sunlight that follows the player so its shadow map always covers what the camera sees. */
function Sun({ shadows }: { shadows: boolean }) {
    const light = useRef<DirectionalLight>(null);
    useFrame(() => {
        const l = light.current;
        if (!l) return;
        // Snap to the shadow-map texel grid so shadows don't shimmer while walking.
        const step = (SHADOW_SPAN * 2) / 2048;
        const x = Math.round(playerState.x / step) * step;
        const z = Math.round(playerState.z / step) * step;
        l.position.set(x + SUN_DIRECTION.x * 150, SUN_DIRECTION.y * 150, z + SUN_DIRECTION.z * 150);
        l.target.position.set(x, 0, z);
        l.target.updateMatrixWorld();
    });
    return (
        <directionalLight
            ref={light}
            intensity={1.8}
            color="#FFF3DD"
            castShadow={shadows}
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-SHADOW_SPAN}
            shadow-camera-right={SHADOW_SPAN}
            shadow-camera-top={SHADOW_SPAN}
            shadow-camera-bottom={-SHADOW_SPAN}
            shadow-camera-near={20}
            shadow-camera-far={320}
            shadow-bias={-0.0004}
            shadow-normalBias={0.05}
        />
    );
}

/**
 * The 3D Region XII world. Loaded lazily so the login screen stays tiny on slow connections.
 */
export default function GameCanvas() {
    const zones = useGame((s) => s.zones);
    const quality = useGame((s) => s.quality);
    const high = quality === 'high';
    const wrapper = useRef<HTMLDivElement>(null);

    useEffect(() => (wrapper.current ? bindCameraGestures(wrapper.current) : undefined), []);

    const locations = useMemo(() => allLocations(zones), [zones]);
    const unlockLevels = useMemo(() => Object.fromEntries(zones.map((z) => [z.slug, z.unlock_level])), [zones]);

    // NPC buildings come from the database, so trees are cleared around them here.
    const trees = useMemo(
        () => treePositions(high ? 1800 : 800).filter(([x, z]) => !locations.some((l) => Math.hypot(l.position[0] - x, l.position[1] - z) < 10)),
        [high, locations],
    );
    const hills = useMemo(() => hillPositions(high ? 40 : 24), [high]);

    const spots = useMemo<Spot[]>(
        () => [
            ...locations.map((l) => {
                const [x, z] = npcSpot(l.slug, l.position);
                return { slug: l.slug, x, z };
            }),
            ...TOWN_LAYOUTS.map((t) => ({ slug: `terminal:${t.slug}`, x: t.center[0] + t.terminal[0], z: t.center[1] + t.terminal[1] + 1.5 })),
            ...TOWN_LAYOUTS.flatMap((t) => {
                if (!t.bus) return [];
                const [x, z] = busPoint(t.bus, ...BUS_TERMINAL.spot);
                return [{ slug: `bus:${t.slug}`, x, z }];
            }),
        ],
        [locations],
    );

    // Town life (stalls, houses, courts) is planned around everything else, then made solid too.
    const { world, life } = useMemo(() => {
        const w = buildCollisionWorld(locations, trees, hills);
        const plan = planTownLife(w, spots, high);
        w.add([], plan.circles);
        return { world: w, life: plan.plans };
    }, [locations, trees, hills, spots, high]);

    const markerFor = (loc: (typeof locations)[number]): MarkerState => {
        if (loc.zone.locked || loc.quests.length === 0 || loc.quests.every((q) => q.locked)) return 'locked';
        return loc.quests.every((q) => q.passed) ? 'done' : 'new';
    };

    return (
        <div ref={wrapper} className="absolute inset-0 touch-none">
            <Canvas
                flat
                shadows={high}
                dpr={high ? [1, 1.5] : 1}
                gl={{ antialias: false, powerPreference: 'high-performance' }}
                camera={{ fov: 45, near: 0.5, far: 800, position: [0, 20, 26] }}
            >
                <color attach="background" args={[HORIZON]} />
                <fog attach="fog" args={[HORIZON, high ? 150 : 100, high ? 440 : 290]} />
                <hemisphereLight args={['#FFFFFF', '#8FBF6A', 1.1]} />
                <Sun shadows={high} />

                <Sky />
                {high && <Clouds count={18} />}
                <Terrain />
                <Mountains />
                <Nature trees={trees} hills={hills} />
                <Towns />
                <TownLife plans={life} />
                <Traffic jeepneys={high ? 8 : 4} buses={high ? 3 : 1} />
                <Landmarks range={high ? 360 : 240} />
                <MapLabels />

                {locations.map((loc) => (
                    <LocationSpot key={loc.slug} location={loc} marker={markerFor(loc)} />
                ))}

                <PlayerController world={world} spots={spots} unlockLevels={unlockLevels} />
                <RideCutscene />

                {high && (
                    <Suspense fallback={null}>
                        <Effects />
                    </Suspense>
                )}
            </Canvas>
        </div>
    );
}
