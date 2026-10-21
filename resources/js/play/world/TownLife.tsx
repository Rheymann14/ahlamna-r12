import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { DoubleSide, type Group } from 'three';
import { playerState } from '../store';
import { Avatar, type Action, type AvatarColors } from './Avatar';
import { LANDMARKS, LANDMARK_KINDS, landmarkWorld } from './landmarks';
import { TOWN_LAYOUTS, inField, jeepneyBay, nearRoad, type Circle, type CollisionWorld, type TownLayout } from './layout';
import { Bystander, townsfolkColors } from './people';
import { headingX, headingZ, pingPong, Route, seeded, townRoads, turnToward, type P, type Sample } from './routes';
import { Roof, Shadowed } from './Scenery';
import { signTexture } from './textures';
import { TRICYCLE_PAINTS, TRICYCLE_PASSENGER, Tricycle, tricycleDriver } from './vehicles';

/**
 * Everyday life in each town: people walking the sidewalks, tricycles dropping off and picking up
 * passengers, and little scenes beside the road (a sari-sari store, a fruit stand, a waiting shed,
 * a barangay basketball court, someone sweeping their yard, kids playing tag).
 *
 * Everything is planned once from the town's roads with a seeded random generator, so every player
 * sees the same town, and only the town the player is in is mounted.
 */

/** Grown-ups are drawn a little smaller than the player so the hero stands out. */
const FOLK_SCALE = 0.9;
const KID_SCALE = 0.62;
/** Speed value that makes the avatar's legs match a stroll. */
const STROLL = 0.55;

export type StationKind = 'store' | 'fruit' | 'shed' | 'court' | 'house' | 'kids';

export type Station = { kind: StationKind; x: number; z: number; rot: number; seed: number };

type WalkerPlan = { points: P[]; start: number; pace: number; seed: number; carry: Action };
type TrikePlan = { points: P[]; start: number; curb: number; seed: number };

export type TownLifePlan = { town: TownLayout; walkers: WalkerPlan[]; trikes: TrikePlan[]; stations: Station[] };

/** Footprint radius of each scene (its front, +Z, faces the road). */
const STATION_RADIUS: Record<StationKind, number> = { store: 3.2, fruit: 2.6, shed: 2.4, court: 5, house: 3.8, kids: 3.2 };

/** Solid parts of each scene in its own frame: [x, z, r]. */
const STATION_SOLIDS: Record<StationKind, [number, number, number][]> = {
    store: [[0, -0.6, 1.6]],
    fruit: [[0, -0.3, 0.9]],
    shed: [[0, -0.2, 0.9]],
    court: [[0, -3.9, 0.3]],
    house: [[0, -1.0, 2.1], [2.8, -1.8, 0.15], [2.8, 0.6, 0.15]],
    kids: [],
};

const KIND_ORDER: StationKind[] = ['store', 'shed', 'kids', 'fruit', 'house', 'court', 'store', 'house'];

const TRIKE_LANE = 1.5;

function toWorldFrame(s: { x: number; z: number; rot: number }, lx: number, lz: number): [number, number] {
    const c = Math.cos(s.rot);
    const n = Math.sin(s.rot);
    return [s.x + lx * c + lz * n, s.z - lx * n + lz * c];
}

/**
 * Plans every town's life and returns the extra solids (stalls, houses, hoops) for the collision world.
 * `spots` are the places the player talks at; scenes keep clear of them.
 */
export function planTownLife(world: CollisionWorld, spots: { x: number; z: number }[], high: boolean): { plans: TownLifePlan[]; circles: Circle[] } {
    const circles: Circle[] = [];
    const plans = TOWN_LAYOUTS.map((town, ti) => {
        const rand = seeded(ti * 7919 + 31);
        const roads = townRoads(town);
        const big = town.urban > 80;
        const plan: TownLifePlan = { town, walkers: [], trikes: [], stations: [] };
        if (!roads.length) return plan;

        // Scenes beside the road.
        const wanted = high ? (big ? 9 : 6) : big ? 4 : 3;
        const kinds = [...KIND_ORDER].sort(() => rand() - 0.5);
        for (let tries = 0; tries < 400 && plan.stations.length < wanted; tries++) {
            const road = roads[Math.floor(rand() * roads.length)];
            const i = 1 + Math.floor(rand() * (road.points.length - 1));
            const [ax, az] = road.points[i - 1];
            const [bx, bz] = road.points[i];
            const len = Math.hypot(bx - ax, bz - az);
            if (len < 1) continue;
            const t = rand();
            const side = rand() < 0.5 ? 1 : -1;
            const nx = (-(bz - az) / len) * side;
            const nz = ((bx - ax) / len) * side;
            const kind = kinds[plan.stations.length % kinds.length];
            const r = STATION_RADIUS[kind];
            const off = road.width / 2 + 1.8 + r;
            const x = ax + (bx - ax) * t + nx * off;
            const z = az + (bz - az) * t + nz * off;

            if (Math.hypot(x - town.center[0], z - town.center[1]) > town.urban) continue;
            if (world.blocked(x, z, r)) continue;
            if (nearRoad(x, z, r + 0.4) || inField(x, z, r)) continue;
            if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < r + 4.5)) continue;
            if (plan.stations.some((s) => Math.hypot(s.x - x, s.z - z) < STATION_RADIUS[s.kind] + r + 3)) continue;
            if (LANDMARKS.some((l) => {
                const [lx, lz] = landmarkWorld(l);
                return Math.hypot(lx - x, lz - z) < LANDMARK_KINDS[l.kind].radius + r + 2;
            })) continue;
            const [jx, jz] = jeepneyBay(town);
            if (Math.hypot(jx - x, jz - z) < r + 9) continue;
            if (town.bus && Math.hypot(town.bus.x - x, town.bus.z - z) < r + 19) continue;

            // Face the road: the scene's +Z points back toward it.
            const station: Station = { kind, x, z, rot: Math.atan2(-nx, -nz), seed: Math.floor(rand() * 100000) };
            plan.stations.push(station);
            for (const [lx, lz, cr] of STATION_SOLIDS[kind]) {
                const [cx, cz] = toWorldFrame(station, lx, lz);
                circles.push({ x: cx, z: cz, r: cr });
            }
        }

        // People strolling the sidewalks (out on one side, back on the other).
        const walkers = high ? (big ? 10 : 6) : big ? 4 : 3;
        for (let k = 0; k < walkers; k++) {
            const road = roads[k % roads.length];
            const points = pingPong(road.points, road.width / 2 + 1.0);
            const roll = rand();
            plan.walkers.push({
                points,
                start: rand() * 1000,
                pace: 1.1 + rand() * 0.5,
                seed: Math.floor(rand() * 100000),
                carry: roll < 0.15 ? 'carry' : roll < 0.3 ? 'umbrella' : roll < 0.4 ? 'phone' : 'idle',
            });
        }

        // Tricycles running up and down the main roads.
        const trikes = high ? (big ? 4 : 2) : big ? 2 : 1;
        for (let k = 0; k < trikes; k++) {
            const road = roads[k % Math.min(roads.length, 3)];
            plan.trikes.push({ points: pingPong(road.points, TRIKE_LANE), start: rand() * 1000, curb: road.width / 2 - TRIKE_LANE + 1.0, seed: Math.floor(rand() * 100000) });
        }
        return plan;
    });
    return { plans, circles };
}

/* ---------------------------------------------------------------- mounting */

/** Mounts its children only while the player is within `range` (with a little slack so it doesn't flicker). */
export function NearMount({ x, z, range, children }: { x: number; z: number; range: number; children: ReactNode }) {
    const [on, setOn] = useState(false);
    useFrame(() => {
        const d = Math.hypot(playerState.x - x, playerState.z - z);
        if (!on && d < range) setOn(true);
        else if (on && d > range + 40) setOn(false);
    });
    return on ? <>{children}</> : null;
}

/* ---------------------------------------------------------------- walkers */

const STOP_ACTIONS: Action[] = ['look', 'phone', 'stretch', 'talk', 'wave'];

function Walker({ plan }: { plan: WalkerPlan }) {
    const route = useMemo(() => new Route(plan.points, true), [plan]);
    const colors = useMemo(() => townsfolkColors(seeded(plan.seed)), [plan]);
    const group = useRef<Group>(null);
    const speed = useRef(0);
    const action = useRef<Action>(plan.carry);
    const st = useRef({ d: plan.start, heading: 0, stopUntil: 0, nextStop: 4 + (plan.seed % 20), first: true });
    const s = useMemo<Sample>(() => ({ x: 0, z: 0, dx: 0, dz: 1 }), []);

    useFrame(({ clock }, delta) => {
        const g = group.current;
        if (!g) return;
        const t = clock.elapsedTime;
        const dt = Math.min(delta, 0.1);
        const w = st.current;

        let moving = t >= w.stopUntil;
        if (moving && t > w.nextStop) {
            // Pause for a moment: check the phone, look around, stretch...
            w.stopUntil = t + 3 + Math.random() * 3;
            w.nextStop = w.stopUntil + 10 + Math.random() * 15;
            action.current = STOP_ACTIONS[Math.floor(Math.random() * STOP_ACTIONS.length)];
            moving = false;
        }
        route.sample(w.d, s);
        const px = playerState.x - s.x;
        const pz = playerState.z - s.z;
        const close = px * px + pz * pz < 1.6 * 1.6;
        if (close) {
            // Someone's in the way: stop and look at them.
            moving = false;
            action.current = 'look';
        } else if (moving) {
            action.current = plan.carry;
        }
        if (moving) w.d += plan.pace * dt;

        speed.current += ((moving ? STROLL : 0) - speed.current) * Math.min(1, dt * 8);
        const target = close ? headingZ(px, pz) : headingZ(s.dx, s.dz);
        w.heading = w.first ? target : turnToward(w.heading, target, dt * 5);
        w.first = false;
        g.position.set(s.x, 0, s.z);
        g.rotation.y = w.heading;
    });

    return (
        <group ref={group} scale={FOLK_SCALE}>
            <Avatar colors={colors} speed={speed} action={action} />
        </group>
    );
}

/* ---------------------------------------------------------------- tricycles */

const TRIKE_CRUISE = 6.5;
const TRIKE_BRAKE = 5;
const TRIKE_ACCEL = 2.5;

type PaxMode = 'seat' | 'out' | 'leave' | 'gone' | 'wait' | 'board';

/**
 * A tricycle on its loop: drive a while, pull over and let the passenger off, drive on empty until
 * someone at the roadside flags it down ("Para!"), let them climb in, and go again.
 */
function TricycleRun({ plan }: { plan: TrikePlan }) {
    const route = useMemo(() => new Route(plan.points, true), [plan]);
    const rand = useMemo(() => seeded(plan.seed), [plan]);
    const driver = useMemo(() => [tricycleDriver(townsfolkColors(rand))], [rand]);
    const color = TRICYCLE_PAINTS[plan.seed % TRICYCLE_PAINTS.length];
    const [paxColors, setPaxColors] = useState<AvatarColors>(() => townsfolkColors(rand));

    const trike = useRef<Group>(null);
    const pax = useRef<Group>(null);
    const spin = useRef(0);
    const paxSpeed = useRef(0);
    const paxAction = useRef<Action>('sit');
    const s = useMemo<Sample>(() => ({ x: 0, z: 0, dx: 1, dz: 0 }), []);
    const at = useMemo<Sample>(() => ({ x: 0, z: 0, dx: 1, dz: 0 }), []);
    const st = useRef({
        d: plan.start,
        v: 0,
        phase: 'drive' as 'drive' | 'dwell',
        until: 3 + rand() * 6,
        dropAt: 0,
        pickD: -1,
        loaded: true,
        mode: 'seat' as PaxMode,
        modeAt: 0,
        from: [0, 0] as P,
        to: [0, 0] as P,
        paxHeading: 0,
        leaveDir: 1,
    });

    useFrame(({ clock }, delta) => {
        const g = trike.current;
        const p = pax.current;
        if (!g || !p) return;
        const t = clock.elapsedTime;
        const dt = Math.min(delta, 0.1);
        const k = st.current;

        route.sample(k.d, s);
        const heading = headingX(s.dx, s.dz);
        const rx = -s.dz;
        const rz = s.dx;

        // Where to go: cruise, stop for the drop-off, or stop exactly at the person waiting.
        let target = TRIKE_CRUISE;
        if (k.phase === 'dwell') target = 0;
        else if (k.loaded && t > k.until) target = 0;
        else if (k.pickD >= 0) target = Math.min(TRIKE_CRUISE, Math.sqrt(2 * TRIKE_BRAKE * Math.max(0, k.pickD - k.d - 0.1)));
        // Brake for the player.
        const px = playerState.x - s.x;
        const pz = playerState.z - s.z;
        const ahead = px * s.dx + pz * s.dz;
        if (ahead > 0 && ahead < 5 && Math.abs(px * rx + pz * rz) < 1.8) target = 0;

        k.v = target < k.v ? Math.max(target, k.v - TRIKE_BRAKE * dt) : Math.min(target, k.v + TRIKE_ACCEL * dt);
        k.d += k.v * dt;
        spin.current += k.v * dt;

        const seat = (): P => {
            const [lx, , lz] = TRICYCLE_PASSENGER;
            return [s.x + lx * s.dx + lz * rx, s.z + lx * s.dz + lz * rz];
        };
        const curb = (x: number, z: number, dx: number, dz: number): P => [x - dz * plan.curb, z + dx * plan.curb];

        if (k.phase === 'drive' && k.v < 0.05) {
            if (k.loaded && t > k.until) {
                // Drop-off: the passenger climbs out to the curb.
                k.phase = 'dwell';
                k.dropAt = t + 2.4;
                k.loaded = false;
                k.mode = 'out';
                k.modeAt = t;
                k.from = seat();
                k.to = curb(s.x, s.z, s.dx, s.dz);
                k.leaveDir = Math.random() < 0.5 ? 1 : -1;
            } else if (k.pickD >= 0 && k.pickD - k.d < 0.4) {
                // Pick-up: the waiting commuter walks over and gets in.
                k.phase = 'dwell';
                k.dropAt = t + 1.8;
                k.pickD = -1;
                k.mode = 'board';
                k.modeAt = t;
                k.to = seat();
            }
        }
        if (k.phase === 'dwell' && t > k.dropAt) {
            k.phase = 'drive';
            if (k.mode === 'board' || k.mode === 'seat') {
                k.mode = 'seat';
                k.loaded = true;
                k.until = t + 8 + Math.random() * 8;
            } else {
                k.until = t + 8 + Math.random() * 5;
            }
        }
        if (!k.loaded && k.pickD < 0 && k.phase === 'drive' && t > k.until && k.mode === 'gone') {
            // Someone down the road needs a ride.
            k.pickD = k.d + 30 + Math.random() * 15;
            route.sample(k.pickD, at);
            k.from = curb(at.x, at.z, at.dx, at.dz);
            k.paxHeading = headingZ(at.dz, -at.dx); // facing the road
            k.mode = 'wait';
            k.modeAt = t;
            setPaxColors(townsfolkColors(Math.random));
        }

        g.position.set(s.x, 0, s.z);
        g.rotation.y = heading;

        // The passenger, in world space so they can step in and out.
        let scale = FOLK_SCALE;
        paxSpeed.current = 0;
        switch (k.mode) {
            case 'seat': {
                const [x, z] = seat();
                p.position.set(x, TRICYCLE_PASSENGER[1], z);
                p.rotation.y = heading + Math.PI / 2;
                scale = 0.66;
                paxAction.current = 'sit';
                break;
            }
            case 'out':
            case 'board': {
                // Step between the sidecar and the curb (shrinking to fit the seat on the way in).
                const u = Math.min(1, (t - k.modeAt) / 1.1);
                const out = k.mode === 'out';
                const [ax, az] = k.from;
                const [bx, bz] = out ? k.to : seat();
                const seated = out ? 1 - u : u;
                p.position.set(ax + (bx - ax) * u, TRICYCLE_PASSENGER[1] * seated, az + (bz - az) * u);
                p.rotation.y = headingZ(bx - ax, bz - az);
                scale = FOLK_SCALE + (0.66 - FOLK_SCALE) * seated;
                paxSpeed.current = u < 1 ? STROLL : 0;
                paxAction.current = 'idle';
                if (u >= 1 && out) {
                    k.mode = 'leave';
                    k.modeAt = t;
                    k.from = k.to;
                    k.to = [s.dx * k.leaveDir, s.dz * k.leaveDir];
                } else if (u >= 1) {
                    k.mode = 'seat';
                }
                break;
            }
            case 'leave': {
                // Walk off along the sidewalk, then disappear into the neighbourhood.
                const age = t - k.modeAt;
                const [dx, dz] = k.to;
                p.position.set(k.from[0] + dx * age * 1.2, 0, k.from[1] + dz * age * 1.2);
                p.rotation.y = headingZ(dx, dz);
                paxSpeed.current = STROLL;
                paxAction.current = 'idle';
                scale = age < 5.5 ? FOLK_SCALE : Math.max(0, FOLK_SCALE * (1 - (age - 5.5) / 0.5));
                if (age > 6) k.mode = 'gone';
                break;
            }
            case 'wait': {
                const grow = Math.min(1, (t - k.modeAt) / 0.5);
                p.position.set(k.from[0], 0, k.from[1]);
                p.rotation.y = k.paxHeading;
                scale = FOLK_SCALE * grow;
                paxAction.current = k.pickD - k.d < 25 ? 'hail' : 'look';
                break;
            }
            case 'gone':
                scale = 0;
                break;
        }
        p.visible = scale > 0.01;
        p.scale.setScalar(Math.max(0.001, scale));
    });

    return (
        <>
            <group ref={trike}>
                <Shadowed>
                    <Tricycle color={color} spin={spin} seats={driver} />
                </Shadowed>
            </group>
            <group ref={pax}>
                <Avatar colors={paxColors} speed={paxSpeed} action={paxAction} />
            </group>
        </>
    );
}

/* ---------------------------------------------------------------- scenes */

function Box({ p, s, c, r = 0 }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number }) {
    return (
        <mesh position={p} rotation-y={r}>
            <boxGeometry args={s} />
            <meshLambertMaterial color={c} flatShading />
        </mesh>
    );
}

function Post({ p, h, r = 0.07, c = '#8A5A2B' }: { p: [number, number]; h: number; r?: number; c?: string }) {
    return (
        <mesh position={[p[0], h / 2, p[1]]}>
            <cylinderGeometry args={[r, r, h, 6]} />
            <meshLambertMaterial color={c} flatShading />
        </mesh>
    );
}

function SignBoard({ text, p, w, h, bg, fg = '#FFFFFF' }: { text: string; p: [number, number, number]; w: number; h: number; bg: string; fg?: string }) {
    return (
        <mesh position={p}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial map={signTexture(text, bg, fg)} toneMapped={false} />
        </mesh>
    );
}

const STORE_WALLS = ['#F5C4B3', '#C0DD97', '#B5D4F4', '#FAC775', '#EEEDFE'];
const GOODS = ['#E24B4A', '#F2C14E', '#2F80ED', '#1D9E75', '#E67E22', '#8E44AD'];

/** Sari-sari store: the neighbourhood corner shop, a vendor behind the counter and a customer chatting. */
function Store({ seed }: { seed: number }) {
    const rand = useMemo(() => seeded(seed), [seed]);
    const wall = STORE_WALLS[seed % STORE_WALLS.length];
    const [vendor, customer] = useMemo(() => [townsfolkColors(rand), townsfolkColors(rand)], [rand]);
    return (
        <group>
            <Shadowed>
                <Box p={[0, 1.2, -1.8]} s={[3, 2.4, 0.15]} c={wall} />
                <Box p={[-1.45, 1.2, -0.6]} s={[0.15, 2.4, 2.5]} c={wall} />
                <Box p={[1.45, 1.2, -0.6]} s={[0.15, 2.4, 2.5]} c={wall} />
                <Box p={[0, 0.5, 0.6]} s={[3, 1, 0.15]} c={wall} />
                <Box p={[0, 2.25, 0.6]} s={[3, 0.3, 0.15]} c={wall} />
                <Box p={[0, 1.04, 0.75]} s={[3.1, 0.08, 0.4]} c="#8A5A2B" />
                <Roof w={3.8} d={3.4} h={1.1} color="#5F5E5A" y={2.4} />
                {/* snacks on the counter and shelves of goods at the back */}
                {[-1, -0.6, -0.2, 0.3, 0.8].map((x, i) => (
                    <Box key={x} p={[x, 1.17, 0.75]} s={[0.25, 0.18, 0.2]} c={GOODS[(i + seed) % GOODS.length]} />
                ))}
                {[0.9, 1.5].map((y) =>
                    [-1, -0.4, 0.2, 0.8].map((x, i) => <Box key={`${y}${x}`} p={[x, y, -1.6]} s={[0.4, 0.4, 0.25]} c={GOODS[(i * 3 + Math.round(y * 10) + seed) % GOODS.length]} />),
                )}
            </Shadowed>
            <SignBoard text="SARI-SARI STORE" p={[0, 2.25, 0.69]} w={2.8} h={0.28} bg="#C0392B" />
            <Bystander colors={vendor} position={[0, 0, -0.8]} actions={['vend', 'look', 'phone', 'vend']} scale={FOLK_SCALE} />
            <Bystander colors={customer} position={[0.3, 0, 1.7]} rot={Math.PI} actions={['talk', 'idle', 'phone', 'talk']} scale={FOLK_SCALE} />
        </group>
    );
}

/** Fruit stand under a big parasol: mangoes, bananas, durian and lanzones. */
function FruitStand({ seed }: { seed: number }) {
    const rand = useMemo(() => seeded(seed), [seed]);
    const vendor = useMemo(() => townsfolkColors(rand), [rand]);
    const fruit = useMemo(
        () =>
            Array.from({ length: 16 }, (_, i) => ({
                p: [-0.85 + (i % 8) * 0.24, 0.95 + Math.floor(i / 8) * 0.1, -0.5 + Math.floor(i / 8) * 0.35] as [number, number, number],
                c: ['#F2C14E', '#97C459', '#8A6A3A', '#D9B26A', '#E67E22'][Math.floor(rand() * 5)],
            })),
        [rand],
    );
    return (
        <group>
            <Shadowed>
                <Box p={[0, 0.8, -0.3]} s={[2.2, 0.1, 1.1]} c="#8A5A2B" />
                {[[-1, -0.75], [1, -0.75], [-1, 0.15], [1, 0.15]].map(([x, z], i) => (
                    <Box key={i} p={[x, 0.4, z]} s={[0.08, 0.8, 0.08]} c="#633806" />
                ))}
                {fruit.map((f, i) => (
                    <mesh key={i} position={f.p}>
                        <icosahedronGeometry args={[0.12, 0]} />
                        <meshLambertMaterial color={f.c} flatShading />
                    </mesh>
                ))}
                <Post p={[0, -0.3]} h={2.6} r={0.04} c="#D3D1C7" />
                <mesh position={[0, 2.65, -0.3]}>
                    <coneGeometry args={[1.7, 0.6, 8]} />
                    <meshLambertMaterial color={seed % 2 ? '#E24B4A' : '#1D9E75'} flatShading />
                </mesh>
            </Shadowed>
            <Bystander colors={vendor} position={[0.2, 0, -1.4]} actions={['vend', 'hail', 'look', 'vend', 'phone']} scale={FOLK_SCALE} />
        </group>
    );
}

/** A roadside waiting shed where two neighbours sit and catch up. */
function WaitingShed({ seed }: { seed: number }) {
    const rand = useMemo(() => seeded(seed), [seed]);
    const folk = useMemo(() => [townsfolkColors(rand), townsfolkColors(rand)], [rand]);
    return (
        <group>
            <Shadowed>
                {[[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.6], [1.3, 0.6]].map(([x, z], i) => (
                    <Post key={i} p={[x, z]} h={2.3} />
                ))}
                <Roof w={3.4} d={2.4} h={0.8} color="#B5651D" y={2.3} />
                <Box p={[0, 0.5, -0.4]} s={[2.4, 0.1, 0.5]} c="#8A5A2B" />
                <Box p={[0, 0.85, -0.68]} s={[2.4, 0.6, 0.06]} c="#8A5A2B" />
                {[-1, 1].map((x) => (
                    <Box key={x} p={[x, 0.25, -0.4]} s={[0.08, 0.5, 0.4]} c="#633806" />
                ))}
            </Shadowed>
            <Bystander colors={folk[0]} position={[-0.55, 0.15, -0.35]} rot={0.35} actions={['chat', 'sit', 'chat']} scale={FOLK_SCALE} />
            <Bystander colors={folk[1]} position={[0.55, 0.15, -0.35]} rot={-0.35} actions={['sit', 'chat', 'chat']} scale={FOLK_SCALE} />
        </group>
    );
}

/** A kid dribbling around a barangay half-court while a friend guards and cheers. */
function Court({ seed }: { seed: number }) {
    const rand = useMemo(() => seeded(seed), [seed]);
    const [a, b] = useMemo(() => [townsfolkColors(rand), townsfolkColors(rand)], [rand]);
    const kid = useRef<Group>(null);
    const friend = useRef<Group>(null);
    const kidSpeed = useRef(0);
    const kidAction = useRef<Action>('dribble');
    const friendAction = useRef<Action>('jump');
    const still = useRef(0);
    const st = useRef({ x: 0, z: 0, tx: 1, tz: 0, until: 0, heading: 0 });

    useFrame(({ clock }, delta) => {
        const t = clock.elapsedTime;
        const dt = Math.min(delta, 0.1);
        const k = st.current;
        if (t > k.until) {
            k.until = t + 2.5 + Math.random() * 2.5;
            if (Math.random() < 0.3) {
                kidAction.current = 'cheer';
                k.tx = k.x;
                k.tz = k.z;
            } else {
                kidAction.current = 'dribble';
                k.tx = (Math.random() - 0.5) * 5;
                k.tz = -1.5 + Math.random() * 3.5;
            }
            friendAction.current = kidAction.current === 'cheer' ? 'cheer' : Math.random() < 0.5 ? 'jump' : 'idle';
        }
        const dx = k.tx - k.x;
        const dz = k.tz - k.z;
        const left = Math.hypot(dx, dz);
        const moving = left > 0.1;
        if (moving) {
            const step = Math.min(left, 1.6 * dt);
            k.x += (dx / left) * step;
            k.z += (dz / left) * step;
            k.heading = turnToward(k.heading, headingZ(dx, dz), dt * 6);
        } else {
            k.heading = turnToward(k.heading, headingZ(0 - k.x, -3.9 - k.z), dt * 4);
        }
        kidSpeed.current = moving ? 0.8 : 0;
        kid.current?.position.set(k.x, 0.1, k.z);
        if (kid.current) kid.current.rotation.y = k.heading;
        if (friend.current) {
            friend.current.position.set(k.x * 0.6, 0.1, k.z * 0.6 - 1.3);
            friend.current.rotation.y = headingZ(k.x - k.x * 0.6, k.z - (k.z * 0.6 - 1.3));
        }
    });

    return (
        <group>
            <mesh position={[0, 0.05, -0.5]} receiveShadow>
                <boxGeometry args={[8, 0.1, 7.5]} />
                <meshLambertMaterial color="#B5B1A5" />
            </mesh>
            <mesh position={[0, 0.11, -2.5]} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[2.5, 2.62, 32, 1, 0, Math.PI]} />
                <meshBasicMaterial color="#FFFFFF" />
            </mesh>
            <Shadowed>
                <Post p={[0, -3.95]} h={3.3} r={0.1} c="#2F80ED" />
                <Box p={[0, 3.15, -3.75]} s={[1.6, 1.0, 0.08]} c="#FFFFFF" />
                <mesh position={[0, 2.85, -3.4]} rotation-x={Math.PI / 2}>
                    <torusGeometry args={[0.25, 0.03, 6, 14]} />
                    <meshLambertMaterial color="#E67E22" />
                </mesh>
            </Shadowed>
            <group ref={kid} scale={KID_SCALE}>
                <Avatar colors={a} speed={kidSpeed} action={kidAction} />
            </group>
            <group ref={friend} scale={KID_SCALE}>
                <Avatar colors={b} speed={still} action={friendAction} />
            </group>
        </group>
    );
}

const LAUNDRY = ['#E24B4A', '#FFFFFF', '#2F80ED', '#F2C14E', '#97C459'];

/** A small house: someone sweeping the yard, clothes drying on the line. */
function House({ seed }: { seed: number }) {
    const rand = useMemo(() => seeded(seed), [seed]);
    const colors = useMemo(() => townsfolkColors(rand), [rand]);
    const sweeper = useRef<Group>(null);
    const speed = useRef(0);
    const action = useRef<Action>('sweep');
    useFrame(({ clock }) => {
        const t = clock.elapsedTime * 0.25 + seed;
        // Sweep back and forth along the front of the house, turning at each end.
        const x = Math.sin(t) * 1.6;
        if (sweeper.current) {
            sweeper.current.position.x = x;
            sweeper.current.rotation.y = Math.cos(t) > 0 ? Math.PI / 2 - 0.6 : -Math.PI / 2 + 0.6;
        }
        speed.current = Math.abs(Math.cos(t)) > 0.2 ? 0.25 : 0;
    });
    const walls = ['#D9B26A', '#F1EFE8', '#C0DD97', '#F5C4B3'][seed % 4];
    return (
        <group>
            <Shadowed>
                <Box p={[0, 1.3, -1.0]} s={[4, 2.6, 3]} c={walls} />
                <Roof w={4.8} d={3.8} h={1.6} color={seed % 3 ? '#8A6A3A' : '#993C1D'} y={2.6} />
                {[-2.8, 0.6].map((z) => (
                    <Post key={z} p={[2.8, z]} h={1.8} r={0.05} />
                ))}
            </Shadowed>
            <mesh position={[0, 1.05, 0.51]}>
                <planeGeometry args={[0.9, 2.1]} />
                <meshLambertMaterial color="#633806" />
            </mesh>
            {[-1.3, 1.3].map((x) => (
                <mesh key={x} position={[x, 1.5, 0.51]}>
                    <planeGeometry args={[0.8, 0.7]} />
                    <meshLambertMaterial color="#B5D4F4" />
                </mesh>
            ))}
            {/* the laundry line */}
            <mesh position={[2.8, 1.75, -1.1]}>
                <boxGeometry args={[0.02, 0.02, 3.4]} />
                <meshBasicMaterial color="#F1EFE8" />
            </mesh>
            {[-2.3, -1.6, -0.9, -0.2].map((z, i) => (
                <mesh key={z} position={[2.8, 1.45, z]} rotation-y={Math.PI / 2}>
                    <planeGeometry args={[0.5, 0.6]} />
                    <meshLambertMaterial color={LAUNDRY[(i + seed) % LAUNDRY.length]} side={DoubleSide} />
                </mesh>
            ))}
            <group ref={sweeper} position={[0, 0, 1.4]} scale={FOLK_SCALE}>
                <Avatar colors={colors} speed={speed} action={action} />
            </group>
        </group>
    );
}

/** Kids playing tag ("habulan") in a circle, stopping now and then to jump and cheer. */
function KidsPlaying({ seed }: { seed: number }) {
    const rand = useMemo(() => seeded(seed), [seed]);
    const kids = useMemo(() => [0, 1, 2].map(() => townsfolkColors(rand)), [rand]);
    const refs = useRef<(Group | null)[]>([]);
    const speeds = useMemo(() => kids.map(() => ({ current: 0 })), [kids]);
    const actions = useMemo(() => kids.map(() => ({ current: 'idle' as Action })), [kids]);
    const st = useRef({ angle: 0, breakUntil: 0, nextBreak: 6 });
    useFrame(({ clock }, delta) => {
        const t = clock.elapsedTime;
        const k = st.current;
        if (t > k.breakUntil && t > k.nextBreak) {
            k.breakUntil = t + 2.5;
            k.nextBreak = k.breakUntil + 6 + Math.random() * 6;
        }
        const onBreak = t < k.breakUntil;
        if (!onBreak) k.angle += Math.min(delta, 0.1) * 1.1;
        kids.forEach((_, i) => {
            const g = refs.current[i];
            if (!g) return;
            const a = k.angle + (i * Math.PI * 2) / 3;
            g.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2);
            // Face along the circle, the way they run.
            g.rotation.y = headingZ(-Math.sin(a), Math.cos(a));
            speeds[i].current = onBreak ? 0 : 1.5;
            actions[i].current = onBreak ? (i === 1 ? 'jump' : 'cheer') : 'idle';
        });
    });
    return (
        <group>
            {kids.map((c, i) => (
                <group key={i} ref={(g) => void (refs.current[i] = g)} scale={KID_SCALE}>
                    <Avatar colors={c} speed={speeds[i]} action={actions[i]} />
                </group>
            ))}
        </group>
    );
}

const SCENES: Record<StationKind, (p: { seed: number }) => ReactNode> = {
    store: Store,
    fruit: FruitStand,
    shed: WaitingShed,
    court: Court,
    house: House,
    kids: KidsPlaying,
};

function StationView({ station }: { station: Station }) {
    const Scene = SCENES[station.kind];
    return (
        <group position={[station.x, 0, station.z]} rotation-y={station.rot}>
            <Scene seed={station.seed} />
        </group>
    );
}

/* ---------------------------------------------------------------- town */

function TownLifeView({ plan }: { plan: TownLifePlan }) {
    return (
        <group>
            {plan.stations.map((s, i) => (
                <StationView key={i} station={s} />
            ))}
            {plan.walkers.map((w, i) => (
                <Walker key={i} plan={w} />
            ))}
            {plan.trikes.map((t, i) => (
                <TricycleRun key={i} plan={t} />
            ))}
        </group>
    );
}

/** Life in every town, mounted only for the town the player is in or near. */
export function TownLife({ plans }: { plans: TownLifePlan[] }) {
    return (
        <group>
            {plans.map((p) => (
                <NearMount key={p.town.slug} x={p.town.center[0]} z={p.town.center[1]} range={p.town.urban + 130}>
                    <TownLifeView plan={p} />
                </NearMount>
            ))}
        </group>
    );
}
