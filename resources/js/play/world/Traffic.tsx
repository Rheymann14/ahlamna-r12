import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { playerState } from '../store';
import { TOWN_LAYOUTS } from './layout';
import { townsfolkColors } from './people';
import { headingX, offsetRight, randomTour, Route, seeded, viaRoundabouts, type Sample } from './routes';
import { routeName, Shadowed } from './Scenery';
import { BUS_PAINTS, Bus, busDriver, JEEPNEY_PAINTS, Jeepney, jeepneySeats } from './vehicles';

/**
 * Jeepneys and provincial buses on the highways between towns. Each drives a random tour of a few
 * towns and back, pulling in at every town to load passengers, and stops for the player.
 */

const LANE = 2;
const VISIBLE = 280;

type Kind = 'jeepney' | 'bus';

type Tour = { kind: Kind; route: Route; stops: number[]; start: number; seed: number; label: string };

const SPEC: Record<Kind, { cruise: number; accel: number; brake: number; dwell: number; length: number }> = {
    jeepney: { cruise: 12, accel: 2.5, brake: 4.5, dwell: 3, length: 3 },
    bus: { cruise: 14, accel: 2, brake: 4, dwell: 4.5, length: 5.6 },
};

/** Distances along the route where it passes (within 10 m of) a town centre: local minima only. */
function townStops(route: Route): number[] {
    const s: Sample = { x: 0, z: 0, dx: 0, dz: 0 };
    const stops: number[] = [];
    for (const town of TOWN_LAYOUTS) {
        let best = Infinity;
        let bestD = -1;
        for (let d = 0; d <= route.length; d += 2) {
            route.sample(d, s);
            const dist = Math.hypot(s.x - town.center[0], s.z - town.center[1]);
            if (dist < 10 + (town.roundabout ?? 0) && dist < best) {
                best = dist;
                bestD = d;
            } else if (bestD >= 0 && dist > 30 + (town.roundabout ?? 0)) {
                stops.push(bestD);
                best = Infinity;
                bestD = -1;
            }
        }
        if (bestD >= 0) stops.push(bestD);
    }
    return stops.sort((a, b) => a - b);
}

function makeTour(kind: Kind, index: number): Tour {
    const rand = seeded(index * 4513 + (kind === 'bus' ? 77 : 3));
    const start = TOWN_LAYOUTS[Math.floor(rand() * TOWN_LAYOUTS.length)].slug;
    const tour = randomTour(start, 3 + Math.floor(rand() * 3), rand);
    const out = viaRoundabouts(tour);
    const back = viaRoundabouts([...tour].reverse());
    const route = new Route([...offsetRight(out, LANE), ...offsetRight(back, LANE)], true);
    const end = TOWN_LAYOUTS.find((t) => Math.hypot(t.center[0] - tour[tour.length - 1][0], t.center[1] - tour[tour.length - 1][1]) < 1);
    return { kind, route, stops: townStops(route), start: rand() * route.length, seed: index, label: routeName(end?.slug ?? start) };
}

/** Distance (counting laps) of the n-th stop on a tour's loop. */
function stopAt(tour: Tour, n: number): number {
    const count = tour.stops.length;
    if (!count) return Infinity;
    return tour.stops[((n % count) + count) % count] + Math.floor(n / count) * tour.route.length;
}

function firstStop(tour: Tour, v: number) {
    let stop = tour.stops.findIndex((x) => x > tour.start);
    if (stop < 0) stop = tour.stops.length;
    return { d: tour.start, v, dwellUntil: 0, stop, nextStop: stopAt(tour, stop) };
}

function Vehicle({ tour }: { tour: Tour }) {
    const group = useRef<Group>(null);
    const spin = useRef(0);
    const spec = SPEC[tour.kind];
    const st = useRef(firstStop(tour, spec.cruise));
    const s = useMemo<Sample>(() => ({ x: 0, z: 0, dx: 1, dz: 0 }), []);
    const seats = useMemo(() => {
        const rand = seeded(tour.seed * 31 + 7);
        const driver = townsfolkColors(rand);
        if (tour.kind === 'bus') return [busDriver(driver)];
        return jeepneySeats(driver, [0, 1, 2].slice(0, 1 + Math.floor(rand() * 3)).map(() => townsfolkColors(rand)));
    }, [tour]);

    useFrame(({ clock }, delta) => {
        const g = group.current;
        if (!g) return;
        const t = clock.elapsedTime;
        const dt = Math.min(delta, 0.1);
        const k = st.current;
        const toStop = k.nextStop - k.d;

        let target = t < k.dwellUntil ? 0 : spec.cruise;
        if (t >= k.dwellUntil) target = Math.min(target, Math.sqrt(2 * spec.brake * Math.max(0, toStop - 0.3)));

        tour.route.sample(k.d, s);
        // Stop for the player standing in the lane ahead.
        const px = playerState.x - s.x;
        const pz = playerState.z - s.z;
        const ahead = px * s.dx + pz * s.dz;
        if (ahead > 0 && ahead < spec.length + 5 && Math.abs(-px * s.dz + pz * s.dx) < 2.2) target = 0;

        k.v = target < k.v ? Math.max(target, k.v - spec.brake * dt) : Math.min(target, k.v + spec.accel * dt);
        k.d += k.v * dt;
        spin.current += k.v * dt;
        if (toStop < 0.6 && k.v < 0.2 && t >= k.dwellUntil) {
            // Pulled in at a town: wait for passengers, then head for the next stop.
            k.dwellUntil = t + spec.dwell;
            k.stop += 1;
            k.nextStop = stopAt(tour, k.stop);
        }

        g.position.set(s.x, 0, s.z);
        g.rotation.y = headingX(s.dx, s.dz);
        g.visible = Math.hypot(playerState.x - s.x, playerState.z - s.z) < VISIBLE;
    });

    return (
        <group ref={group}>
            <Shadowed>
                {tour.kind === 'bus' ? (
                    <Bus paint={BUS_PAINTS[tour.seed % BUS_PAINTS.length]} route={tour.label} spin={spin} seats={seats} />
                ) : (
                    <Jeepney paint={JEEPNEY_PAINTS[(tour.seed + 2) % JEEPNEY_PAINTS.length]} route={tour.label} spin={spin} seats={seats} />
                )}
            </Shadowed>
        </group>
    );
}

export function Traffic({ jeepneys, buses }: { jeepneys: number; buses: number }) {
    const tours = useMemo(
        () => [...Array.from({ length: jeepneys }, (_, i) => makeTour('jeepney', i)), ...Array.from({ length: buses }, (_, i) => makeTour('bus', i + 100))],
        [jeepneys, buses],
    );
    return (
        <group>
            {tours.map((t, i) => (
                <Vehicle key={i} tour={t} />
            ))}
        </group>
    );
}

