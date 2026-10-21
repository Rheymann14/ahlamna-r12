import { Bus, Lock, MapPin, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { allLocations, playerState, useGame } from '../store';
import { CATEGORY_COLORS, LANDMARKS, landmarkWorld } from '../world/landmarks';
import { ROADS, TOWN_LAYOUTS, type Road } from '../world/layout';
import { LAKES, MOUNTAINS, NEIGHBOURS, PROVINCES, TOWNS, toMap } from '../world/region';

// The maps are drawn in the same "map pixel" space as region.ts (1 px = 3 m).
const VIEW = { x: 235, y: 5, w: 410, h: 560 };
/** Map pixels across the corner minimap, which follows the player (~250 m). */
const FOLLOW_SPAN = 84;

const ROAD_FILL: Record<Road['kind'], string> = { highway: '#FFE7A0', road: '#FFF6DC', street: '#FFFFFF' };

function points(outline: [number, number][]) {
    return outline.map(([x, y]) => `${x},${y}`).join(' ');
}

const ROAD_PATHS = ROADS.map((road) => ({ kind: road.kind, width: road.width / 3, d: points(road.points.map(([x, z]) => toMap(x, z))) }));

/** The player: view cone, pulse, white-ringed dot and heading arrow, sized by `u` (map px per screen unit). */
function PlayerMarker({ u, label, gradient, markerRef, arrowRef, coneRef }: { u: number; label: boolean; gradient: string; markerRef: React.RefObject<SVGGElement | null>; arrowRef: React.RefObject<SVGGElement | null>; coneRef: React.RefObject<SVGGElement | null> }) {
    const L = 46 * u;
    const half = L * Math.tan(Math.PI / 6);
    return (
        <g ref={markerRef}>
            <g ref={coneRef}>
                <path d={`M0 0 L${-half} ${-L} A${L} ${L} 0 0 1 ${half} ${-L} Z`} fill={`url(#${gradient})`} />
            </g>
            <circle r={6 * u} fill="#E53935" opacity={0.5}>
                <animate attributeName="r" from={6 * u} to={24 * u} dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.55" to="0" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle r={8 * u} fill="#FFFFFF" stroke="rgba(0,0,0,0.25)" strokeWidth={u} />
            <circle r={5.6 * u} fill="#E53935" />
            <g ref={arrowRef}>
                <polygon points={`0,${-15 * u} ${4.6 * u},${-9 * u} ${-4.6 * u},${-9 * u}`} fill="#E53935" stroke="#FFFFFF" strokeWidth={1.4 * u} strokeLinejoin="round" />
            </g>
            {label && (
                <text y={-19 * u} textAnchor="middle" fontSize={11 * u} fontWeight={900} fill="#E53935" stroke="#FFFFFF" strokeWidth={3 * u} paintOrder="stroke">
                    YOU
                </text>
            )}
        </g>
    );
}

function MapSvg({ big, onTown }: { big?: boolean; onTown?: (slug: string) => void }) {
    const zones = useGame((s) => s.zones);
    const visited = useGame((s) => s.visited);
    const svg = useRef<SVGSVGElement>(null);
    const marker = useRef<SVGGElement>(null);
    const arrow = useRef<SVGGElement>(null);
    const cone = useRef<SVGGElement>(null);
    const locked = new Set(zones.filter((z) => z.locked).map((z) => z.slug));
    const u = big ? 1.1 : FOLLOW_SPAN / 150;
    const gradient = big ? 'view-cone-big' : 'view-cone-mini';

    const quests = useMemo(
        () =>
            allLocations(zones).map((loc) => {
                const open = !loc.zone.locked && loc.quests.some((q) => !q.locked);
                const done = loc.quests.length > 0 && loc.quests.every((q) => q.passed);
                return { slug: loc.slug, name: loc.name, at: toMap(loc.position[0], loc.position[1]), color: done ? '#1D9E75' : open ? '#EF9F27' : '#9A9893' };
            }),
        [zones],
    );

    // Move the marker (and, on the minimap, the whole view) every frame without re-rendering React.
    useEffect(() => {
        let raf = 0;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            const [px, py] = toMap(playerState.x, playerState.z);
            marker.current?.setAttribute('transform', `translate(${px} ${py})`);
            arrow.current?.setAttribute('transform', `rotate(${180 - (playerState.heading * 180) / Math.PI})`);
            cone.current?.setAttribute('transform', `rotate(${(-playerState.cameraYaw * 180) / Math.PI})`);
            if (!big) svg.current?.setAttribute('viewBox', `${px - FOLLOW_SPAN / 2} ${py - FOLLOW_SPAN / 2} ${FOLLOW_SPAN} ${FOLLOW_SPAN}`);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [big]);

    return (
        <svg ref={svg} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="h-full w-full" role="img" aria-label="Map of Region XII">
            <defs>
                <radialGradient id={gradient} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`scale(${46 * u})`}>
                    <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
                    <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                </radialGradient>
            </defs>
            <rect x={-200} y={-200} width={1400} height={1000} fill="#7FC8F0" />
            {NEIGHBOURS.map((n) => (
                <polygon key={n.name} points={points(n.outline)} fill="#CFD8C0" />
            ))}
            {PROVINCES.map((p, i) => (
                <polygon
                    key={`${p.slug}-${i}`}
                    points={points(p.outline)}
                    fill={big ? p.mapColor : p.groundColor}
                    opacity={big && locked.has(p.slug) ? 0.6 : 1}
                    stroke="#FFFFFF"
                    strokeWidth={big ? 1.5 : 0.5}
                    strokeDasharray={big ? undefined : '2 2'}
                />
            ))}
            {TOWN_LAYOUTS.map((t) => {
                const [x, y] = toMap(t.center[0], t.center[1]);
                return <circle key={t.slug} cx={x} cy={y} r={t.urban / 3} fill="#EEF0DA" opacity={big ? 0.45 : 0.8} />;
            })}
            {LAKES.map((l) => (
                <ellipse key={l.name} cx={l.at[0]} cy={l.at[1]} rx={l.rx} ry={l.rz} fill="#4FB6E6" />
            ))}
            {MOUNTAINS.map((m) => (
                <polygon key={m.name} points={`${m.at[0]},${m.at[1] - m.radius * 0.7} ${m.at[0] - m.radius * 0.6},${m.at[1] + m.radius * 0.4} ${m.at[0] + m.radius * 0.6},${m.at[1] + m.radius * 0.4}`} fill="#4E7F35" stroke="#FFFFFF" strokeWidth={0.6} />
            ))}

            {/* roads: outline first, then fills, like the 3D world */}
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                {ROAD_PATHS.map((r, i) => (
                    <polyline key={`o${i}`} points={r.d} stroke="#B9A97C" strokeWidth={Math.max(r.width, big ? 1.6 : 0) + 0.8} />
                ))}
                {TOWN_LAYOUTS.filter((t) => t.roundabout).map((t) => {
                    const [x, y] = toMap(t.center[0], t.center[1]);
                    return (
                        <g key={t.slug}>
                            <circle cx={x} cy={y} r={t.roundabout! / 3} stroke="#B9A97C" strokeWidth={8 / 3 + 0.8} />
                            <circle cx={x} cy={y} r={t.roundabout! / 3} stroke={ROAD_FILL.highway} strokeWidth={8 / 3} />
                        </g>
                    );
                })}
                {ROAD_PATHS.map((r, i) => (
                    <polyline key={`f${i}`} points={r.d} stroke={ROAD_FILL[r.kind]} strokeWidth={Math.max(r.width, big ? 1.6 : 0)} />
                ))}
            </g>

            {big &&
                PROVINCES.filter((p, i, all) => all.findIndex((q) => q.slug === p.slug) === i).map((p) => (
                    <text key={p.slug} x={p.labelAt[0]} y={p.labelAt[1]} textAnchor="middle" fontSize={13} fontWeight={800} fill="#2C2C2A" stroke="#FFFFFF" strokeWidth={3} paintOrder="stroke">
                        {p.name}
                    </text>
                ))}

            {/* quest spots */}
            {quests.map((q) => (
                <circle key={q.slug} cx={q.at[0]} cy={q.at[1]} r={3.2 * u} fill={q.color} stroke="#FFFFFF" strokeWidth={1.2 * u}>
                    <title>{q.name}</title>
                </circle>
            ))}

            {/* landmarks: coloured once discovered */}
            {LANDMARKS.map((l) => {
                const [x, y] = toMap(...landmarkWorld(l));
                const seen = visited.includes(l.slug);
                const r = 4 * u;
                return (
                    <g key={l.slug} transform={`translate(${x} ${y})`}>
                        <title>{seen ? l.name : 'Undiscovered place'}</title>
                        <path d={`M0 0 L${-r * 0.75} ${-r * 1.4} A${r} ${r} 0 1 1 ${r * 0.75} ${-r * 1.4} Z`} fill={seen ? CATEGORY_COLORS[l.category] : '#8E99A4'} stroke="#FFFFFF" strokeWidth={1.1 * u} />
                        <circle cy={-r * 2.05} r={r * 0.38} fill="#FFFFFF" />
                    </g>
                );
            })}

            {TOWNS.map((t) => (
                <g key={t.slug} onClick={onTown ? () => onTown(t.slug) : undefined} style={{ cursor: onTown ? 'pointer' : undefined }}>
                    {big && <circle cx={t.at[0]} cy={t.at[1]} r={4.5} fill="#FFFFFF" stroke="#2C2C2A" strokeWidth={1.5} />}
                    <text
                        x={t.at[0] + (big ? 7 : 0)}
                        y={t.at[1] + (big ? 4 : -9 * u)}
                        textAnchor={big ? 'start' : 'middle'}
                        fontSize={big ? 10 : 9 * u}
                        fontWeight={800}
                        fill="#412402"
                        stroke="#FFFFFF"
                        strokeWidth={big ? 3 : 2.4 * u}
                        paintOrder="stroke"
                    >
                        {t.name}
                    </text>
                </g>
            ))}

            <PlayerMarker u={u} label={!!big} gradient={gradient} markerRef={marker} arrowRef={arrow} coneRef={cone} />
        </svg>
    );
}

/** Round corner map that follows the player; tap to open the big map. */
export function Minimap() {
    const setShowMap = useGame((s) => s.setShowMap);
    const area = useGame((s) => s.area);
    return (
        <div className="flex flex-col items-center gap-1.5">
            <button
                onClick={() => setShowMap(true)}
                className="pointer-events-auto relative block h-32 w-32 overflow-hidden rounded-full bg-sky-300 shadow-lg ring-4 ring-white sm:h-40 sm:w-40"
                aria-label="Open map"
            >
                <MapSvg />
                <span className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 rounded-full bg-stone-900/70 px-1.5 text-[10px] leading-4 font-black text-white" aria-hidden>
                    N
                </span>
            </button>
            {(area.town || area.province) && (
                <span className="max-w-[10rem] truncate rounded-full bg-stone-900/75 px-2.5 py-0.5 text-[11px] font-bold text-white shadow md:hidden">{area.town ?? area.province}</span>
            )}
        </div>
    );
}

/** Full region map with the jeepney travel list. */
export function MapPanel() {
    const show = useGame((s) => s.showMap);
    const showTravel = useGame((s) => s.showTravel);
    const setShowMap = useGame((s) => s.setShowMap);
    const setShowTravel = useGame((s) => s.setShowTravel);
    const startRide = useGame((s) => s.startRide);
    const nearSlug = useGame((s) => s.nearSlug);
    const zones = useGame((s) => s.zones);
    const visited = useGame((s) => s.visited);

    if (!show && !showTravel) return null;

    // Which terminal the player is at: "terminal:<town>" (jeepney) or "bus:<town>".
    const mode = nearSlug?.startsWith('bus:') ? 'bus' : 'jeepney';
    const here = nearSlug?.split(':')[1] ?? '';
    const reachable = (slug: string) => slug !== here && (mode === 'jeepney' || !!TOWN_LAYOUTS.find((t) => t.slug === slug)?.bus);
    const ride = (slug: string) => {
        if (here && reachable(slug)) startRide({ mode, from: here, to: slug });
    };
    const title = !showTravel ? 'Region XII' : mode === 'bus' ? 'Bus terminal' : 'Jeepney terminal';

    const locked = new Set(zones.filter((z) => z.locked).map((z) => z.slug));
    const unlockLevel = (slug: string) => zones.find((z) => z.slug === slug)?.unlock_level;
    const discovered = LANDMARKS.filter((l) => visited.includes(l.slug)).length;
    const close = () => {
        setShowMap(false);
        setShowTravel(false);
    };

    return (
        <div className="absolute inset-0 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={showTravel ? title : 'Region map'}>
            <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-amber-50 shadow-2xl ring-4 ring-amber-300 sm:flex-row">
                <div className="h-[48dvh] shrink-0 bg-sky-300 sm:h-auto sm:w-1/2">
                    <MapSvg big onTown={showTravel ? ride : undefined} />
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-xl font-black text-stone-800">{title}</h2>
                        <button onClick={close} className="rounded-full p-2 text-stone-500 hover:bg-amber-100" aria-label="Close">
                            <X size={22} />
                        </button>
                    </div>
                    <p className="mb-2 text-sm text-stone-600">
                        {showTravel
                            ? mode === 'bus'
                                ? 'Provincial buses to the big cities. Where to? Rides are free.'
                                : 'Where to? Rides are free.'
                            : 'SOCCSKSARGEN. Walk anywhere, or ride a jeepney or bus from a town terminal.'}
                    </p>
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-stone-600">
                        <span className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded-full border-2 border-white bg-red-600 shadow" /> You
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded-full border-2 border-white bg-amber-500 shadow" /> Quest
                        </span>
                        <span className="flex items-center gap-1">
                            <MapPin size={14} className="text-blue-600" aria-hidden /> Places found: {discovered}/{LANDMARKS.length}
                        </span>
                    </div>
                    <div className="min-h-0 space-y-2 overflow-y-auto">
                        {TOWNS.filter((t) => !showTravel || mode === 'jeepney' || reachable(t.slug) || t.slug === here).map((t) => {
                            const province = PROVINCES.find((p) => p.slug === t.province)?.name;
                            const canGo = showTravel && reachable(t.slug);
                            return (
                                <button
                                    key={t.slug}
                                    disabled={!canGo}
                                    onClick={() => ride(t.slug)}
                                    className="flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-amber-200 bg-white p-3 text-left transition enabled:hover:border-amber-400 disabled:cursor-default"
                                >
                                    <span>
                                        <span className="block font-bold text-stone-800">{t.name}</span>
                                        <span className="text-sm text-stone-500">{province}</span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                        {locked.has(t.province) && (
                                            <span className="flex items-center gap-1 text-xs text-stone-500" title="Quests in this province open at this level">
                                                <Lock size={14} aria-hidden /> Quests Lv {unlockLevel(t.province)}
                                            </span>
                                        )}
                                        {showTravel && t.slug === here && <span className="text-xs font-bold text-stone-500">You are here</span>}
                                        {canGo && (
                                            <span className="flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white">
                                                <Bus size={14} aria-hidden /> Go
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
