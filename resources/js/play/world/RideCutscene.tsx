import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3, type Group } from 'three';
import { playerState, rideState, useGame, type Ride } from '../store';
import type { AvatarColors } from './Avatar';
import { BUS_TERMINAL, TOWN_LAYOUTS, busPoint, jeepneyBay, type TownLayout } from './layout';
import { PLAYER_COLORS } from './PlayerController';
import { townsfolkColors } from './people';
import { headingX, offsetRight, Route, seeded, townRoute, viaRoundabouts, type P, type Sample } from './routes';
import { routeName, Shadowed } from './Scenery';
import { BUS_PAINTS, Bus, busDriver, JEEPNEY_PAINTS, Jeepney, jeepneySeats } from './vehicles';

/**
 * The ride between towns, as a short cutscene in three shots:
 *  1. pulling out of the terminal (fixed camera),
 *  2. on the road: a chase camera following the real roads between the towns,
 *  3. pulling in at the destination terminal.
 * Fades to black hide the cuts. The overlay (ui/RideOverlay.tsx) shows the title, progress and Skip.
 */

const PULL = 18; // meters driven in the departure and arrival shots
const DEPART = 2.6;
const ARRIVE = 3.0;
const FADE = 0.35;
const LANE = 2;

type Bay = { pos: P; dir: P };

/** Where the vehicle is parked at a town's terminal, and which way it faces. */
function parked(town: TownLayout, mode: Ride['mode']): Bay {
    if (mode === 'bus' && town.bus) {
        const [x, z] = BUS_TERMINAL.bays[0];
        return { pos: busPoint(town.bus, x, z), dir: [Math.cos(town.bus.rot), -Math.sin(town.bus.rot)] };
    }
    return { pos: jeepneyBay(town), dir: [1, 0] };
}

function line(from: P, dir: P, length: number): P[] {
    return [0, 0.5, 1].map((k) => [from[0] + dir[0] * length * k, from[1] + dir[1] * length * k]);
}

type Plan = { depart: Route; road: Route; roadFrom: number; roadTo: number; arrive: Route; journey: number; total: number; start: Bay; end: Bay };

function planRide(ride: Ride): Plan | null {
    const from = TOWN_LAYOUTS.find((t) => t.slug === ride.from);
    const to = TOWN_LAYOUTS.find((t) => t.slug === ride.to);
    const path = townRoute(ride.from, ride.to);
    if (!from || !to || !path) return null;
    const start = parked(from, ride.mode);
    const end = parked(to, ride.mode);
    const road = new Route(offsetRight(viaRoundabouts(path), LANE), false);
    // Skip the town streets at both ends: the journey shot is out on the highway.
    const roadFrom = Math.min(from.urban * 0.55, road.length * 0.25);
    const roadTo = road.length - Math.min(to.urban * 0.55, road.length * 0.25);
    const journey = Math.min(8, Math.max(4.5, (roadTo - roadFrom) / 55));
    return {
        depart: new Route(line(start.pos, start.dir, PULL), false),
        road,
        roadFrom,
        roadTo,
        arrive: new Route(line([end.pos[0] - end.dir[0] * PULL, end.pos[1] - end.dir[1] * PULL], end.dir, PULL), false),
        journey,
        total: DEPART + journey + ARRIVE,
        start,
        end,
    };
}

const ease = (u: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, u))) / 2;
const bump = (t: number, at: number) => Math.max(0, 1 - Math.abs(t - at) / FADE);

const camTarget = new Vector3();
const lookTarget = new Vector3();

function RideScene({ ride }: { ride: Ride }) {
    const plan = useMemo(() => planRide(ride), [ride]);
    const vehicle = useRef<Group>(null);
    const spin = useRef(0);
    const st = useRef({ t: 0, shot: -1, px: 0, pz: 0, look: new Vector3(), done: false });
    const s = useMemo<Sample>(() => ({ x: 0, z: 0, dx: 1, dz: 0 }), []);

    const riders = useMemo(() => {
        const rand = seeded(ride.from.length * 131 + ride.to.length * 17);
        const others: AvatarColors[] = [0, 1, 2].map(() => townsfolkColors(rand));
        const driver = townsfolkColors(rand);
        return ride.mode === 'bus' ? [busDriver(driver)] : jeepneySeats(driver, [PLAYER_COLORS, ...others]);
    }, [ride]);
    const paint = TOWN_LAYOUTS.findIndex((t) => t.slug === ride.from);

    useFrame(({ camera }, delta) => {
        const g = vehicle.current;
        const game = useGame.getState();
        if (!plan) {
            game.endRide();
            return;
        }
        if (!g) return;
        const k = st.current;
        const dt = Math.min(delta, 0.1);
        k.t += dt;
        const t = k.t;

        // Which shot, and how far along it.
        let shot: number;
        let d: number;
        if (t < DEPART) {
            shot = 0;
            d = PULL * Math.pow(t / DEPART, 2);
            plan.depart.sample(d, s);
        } else if (t < DEPART + plan.journey) {
            shot = 1;
            d = plan.roadFrom + (plan.roadTo - plan.roadFrom) * ease((t - DEPART) / plan.journey * 0.9 + 0.05);
            plan.road.sample(d, s);
        } else {
            shot = 2;
            d = PULL * (1 - Math.pow(1 - Math.min(1, (t - DEPART - plan.journey) / (ARRIVE - 0.6)), 2));
            plan.arrive.sample(d, s);
        }
        // Roll the wheels by the distance moved (not across a cut).
        const moved = Math.hypot(s.x - k.px, s.z - k.pz);
        if (moved < 3) spin.current += moved;
        k.px = s.x;
        k.pz = s.z;

        g.position.set(s.x, 0, s.z);
        g.rotation.y = headingX(s.dx, s.dz);
        // The world streams in around the vehicle, as if it were the player.
        playerState.x = s.x;
        playerState.z = s.z;
        playerState.heading = g.rotation.y + Math.PI / 2;

        // Camera. Fixed shots stand off to the right of the bay (south of an east-facing jeepney, like the game camera).
        const rx = -s.dz;
        const rz = s.dx;
        if (shot === 0) {
            const { pos, dir } = plan.start;
            camTarget.set(pos[0] + dir[0] * (PULL + 4) - dir[1] * 11, 6, pos[1] + dir[1] * (PULL + 4) + dir[0] * 11);
            lookTarget.set(s.x, 1.4, s.z);
        } else if (shot === 1) {
            // Chase from behind, swinging slowly round to the side and back.
            const u = (t - DEPART) / plan.journey;
            const swing = Math.sin(u * Math.PI * 1.5) * 1.1;
            const bx = -s.dx * Math.cos(swing) + rx * Math.sin(swing);
            const bz = -s.dz * Math.cos(swing) + rz * Math.sin(swing);
            const dist = ride.mode === 'bus' ? 20 : 15;
            camTarget.set(s.x + bx * dist, 6.5 + Math.sin(u * Math.PI) * 3, s.z + bz * dist);
            lookTarget.set(s.x + s.dx * 6, 1.2, s.z + s.dz * 6);
        } else {
            const { pos, dir } = plan.end;
            camTarget.set(pos[0] + dir[0] * 7 - dir[1] * 13, 7.5, pos[1] + dir[1] * 7 + dir[0] * 13);
            lookTarget.set(s.x, 1.4, s.z);
        }
        if (shot !== k.shot) {
            // A cut (hidden by the fade): jump straight to the new shot.
            camera.position.copy(camTarget);
            k.look.copy(lookTarget);
            k.shot = shot;
        } else {
            const f = 1 - Math.exp(-dt * (shot === 1 ? 4 : 6));
            camera.position.lerp(camTarget, f);
            k.look.lerp(lookTarget, f);
        }
        camera.lookAt(k.look);

        rideState.progress = Math.min(1, t / plan.total);
        rideState.fade = Math.min(
            1,
            Math.max(1 - t / 0.5, bump(t, DEPART), bump(t, DEPART + plan.journey), (t - (plan.total - 0.45)) / 0.45, 0),
        );

        if (t >= plan.total && !k.done) {
            k.done = true;
            game.endRide();
        }
    });

    if (!plan) return null;
    const label = routeName(ride.to);
    return (
        <group ref={vehicle}>
            <Shadowed>
                {ride.mode === 'bus' ? (
                    <Bus paint={BUS_PAINTS[0]} route={label} spin={spin} seats={riders} />
                ) : (
                    <Jeepney paint={JEEPNEY_PAINTS[Math.max(0, paint) % JEEPNEY_PAINTS.length]} route={label} spin={spin} seats={riders} />
                )}
            </Shadowed>
        </group>
    );
}

/** Plays the ride cutscene while a ride is in progress. */
export function RideCutscene() {
    const ride = useGame((s) => s.ride);
    if (!ride) return null;
    return <RideScene key={`${ride.mode}:${ride.from}:${ride.to}`} ride={ride} />;
}
