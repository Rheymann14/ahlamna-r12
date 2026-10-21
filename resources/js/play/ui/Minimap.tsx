import { Lock, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { playerState, useGame } from '../store';
import { townSpawn } from '../world/layout';
import { LAKES, MOUNTAINS, NEIGHBOURS, PROVINCES, ROAD_LINES, TOWNS, toMap } from '../world/region';

// The minimap is drawn in the same "map pixel" space as region.ts.
const VIEW = { x: 235, y: 5, w: 410, h: 560 };

function points(outline: [number, number][]) {
    return outline.map(([x, y]) => `${x},${y}`).join(' ');
}

function MapSvg({ big, onTown }: { big?: boolean; onTown?: (slug: string) => void }) {
    const zones = useGame((s) => s.zones);
    const marker = useRef<SVGGElement>(null);
    const locked = new Set(zones.filter((z) => z.locked).map((z) => z.slug));

    // Move the player arrow without re-rendering React.
    useEffect(() => {
        let raf = 0;
        let last = 0;
        const tick = (t: number) => {
            raf = requestAnimationFrame(tick);
            if (t - last < 100 || !marker.current) return;
            last = t;
            const [px, py] = toMap(playerState.x, playerState.z);
            const deg = 180 - (playerState.heading * 180) / Math.PI;
            marker.current.setAttribute('transform', `translate(${px} ${py}) rotate(${deg})`);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="h-full w-full" role="img" aria-label="Map of Region XII">
            <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="#85B7EB" />
            {NEIGHBOURS.map((n) => (
                <polygon key={n.name} points={points(n.outline)} fill="#D3D1C7" />
            ))}
            {PROVINCES.map((p, i) => (
                <polygon key={`${p.slug}-${i}`} points={points(p.outline)} fill={p.mapColor} opacity={locked.has(p.slug) ? 0.45 : 1} stroke="#FFFFFF" strokeWidth={1.5} />
            ))}
            {ROAD_LINES.map((line, i) => (
                <polyline key={i} points={points(line)} fill="none" stroke="#FAEEDA" strokeWidth={2.5} strokeLinecap="round" />
            ))}
            {LAKES.map((l) => (
                <ellipse key={l.name} cx={l.at[0]} cy={l.at[1]} rx={l.rx} ry={l.rz} fill="#378ADD" />
            ))}
            {MOUNTAINS.map((m) => (
                <polygon key={m.name} points={`${m.at[0]},${m.at[1] - 9} ${m.at[0] - 8},${m.at[1] + 5} ${m.at[0] + 8},${m.at[1] + 5}`} fill="#3B6D11" />
            ))}
            {big &&
                PROVINCES.filter((p, i, all) => all.findIndex((q) => q.slug === p.slug) === i).map((p) => (
                    <text key={p.slug} x={p.labelAt[0]} y={p.labelAt[1]} textAnchor="middle" fontSize={13} fontWeight={800} fill="#2C2C2A" stroke="#FFFFFF" strokeWidth={3} paintOrder="stroke">
                        {p.name}
                        {locked.has(p.slug) ? ' 🔒' : ''}
                    </text>
                ))}
            {TOWNS.map((t) => {
                const open = !locked.has(t.province);
                return (
                    <g key={t.slug} onClick={open && onTown ? () => onTown(t.slug) : undefined} style={{ cursor: open && onTown ? 'pointer' : undefined }}>
                        <circle cx={t.at[0]} cy={t.at[1]} r={big ? 6 : 5} fill={open ? '#FFFFFF' : '#B4B2A9'} stroke="#2C2C2A" strokeWidth={1.5} />
                        {big && (
                            <text x={t.at[0] + 9} y={t.at[1] + 4} fontSize={11} fontWeight={700} fill="#2C2C2A" stroke="#FFFFFF" strokeWidth={3} paintOrder="stroke">
                                {t.name}
                            </text>
                        )}
                    </g>
                );
            })}
            <g ref={marker}>
                <circle r={big ? 8 : 9} fill="#A32D2D" stroke="#FFFFFF" strokeWidth={2} />
                <polygon points="0,-6 4,3 -4,3" fill="#FFFFFF" />
            </g>
        </svg>
    );
}

/** Small corner map; tap to open the big map. */
export function Minimap() {
    const setShowMap = useGame((s) => s.setShowMap);
    return (
        <button onClick={() => setShowMap(true)} className="pointer-events-auto block h-36 w-28 overflow-hidden rounded-2xl bg-sky-300 shadow-md ring-2 ring-white sm:h-44 sm:w-32" aria-label="Open map">
            <MapSvg />
        </button>
    );
}

/** Full region map with the jeepney travel list. */
export function MapPanel() {
    const show = useGame((s) => s.showMap);
    const showTravel = useGame((s) => s.showTravel);
    const setShowMap = useGame((s) => s.setShowMap);
    const setShowTravel = useGame((s) => s.setShowTravel);
    const travelTo = useGame((s) => s.travelTo);
    const zones = useGame((s) => s.zones);

    if (!show && !showTravel) return null;

    const locked = new Set(zones.filter((z) => z.locked).map((z) => z.slug));
    const unlockLevel = (slug: string) => zones.find((z) => z.slug === slug)?.unlock_level;
    const close = () => {
        setShowMap(false);
        setShowTravel(false);
    };

    return (
        <div className="absolute inset-0 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={showTravel ? 'Jeepney terminal' : 'Region map'}>
            <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-amber-50 shadow-2xl ring-4 ring-amber-300 sm:flex-row">
                <div className="h-[48dvh] shrink-0 bg-sky-300 sm:h-auto sm:w-1/2">
                    <MapSvg big onTown={showTravel ? (slug) => travelTo(townSpawn(slug)) : undefined} />
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-xl font-black text-stone-800">{showTravel ? 'Jeepney terminal' : 'Region XII'}</h2>
                        <button onClick={close} className="rounded-full p-2 text-stone-500 hover:bg-amber-100" aria-label="Close">
                            <X size={22} />
                        </button>
                    </div>
                    <p className="mb-3 text-sm text-stone-600">
                        {showTravel ? 'Where to? Rides are free. New provinces open as you level up.' : 'SOCCSKSARGEN. Visit a jeepney terminal in any town to travel fast.'}
                    </p>
                    <div className="min-h-0 space-y-2 overflow-y-auto">
                        {TOWNS.map((t) => {
                            const open = !locked.has(t.province);
                            const province = PROVINCES.find((p) => p.slug === t.province)?.name;
                            return (
                                <button
                                    key={t.slug}
                                    disabled={!showTravel || !open}
                                    onClick={() => travelTo(townSpawn(t.slug))}
                                    className="flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-amber-200 bg-white p-3 text-left transition enabled:hover:border-amber-400 disabled:cursor-default"
                                >
                                    <span>
                                        <span className="block font-bold text-stone-800">{t.name}</span>
                                        <span className="text-sm text-stone-500">{province}</span>
                                    </span>
                                    {open ? (
                                        showTravel && <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white">Go</span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-sm text-stone-500">
                                            <Lock size={16} aria-hidden /> Level {unlockLevel(t.province)}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
