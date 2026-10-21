import { Award, Bus, Coins, Compass, Flame, MapPin, Menu, MessageCircle, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { resetCamera } from '../camera';
import { input } from '../input';
import { allLocations, useGame } from '../store';
import { CATEGORY_COLORS, LANDMARKS } from '../world/landmarks';
import { TOWN_LAYOUTS } from '../world/layout';
import { Joystick } from './Joystick';
import { Minimap } from './Minimap';

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/** A button that acts while held (for camera turn / zoom). */
function HoldButton({ label, onHold, children }: { label: string; onHold: (active: boolean) => void; children: ReactNode }) {
    return (
        <button
            aria-label={label}
            title={label}
            className="pointer-events-auto flex h-11 w-11 touch-none items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-md active:scale-95 active:bg-amber-100"
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onHold(true);
            }}
            onPointerUp={() => onHold(false)}
            onPointerCancel={() => onHold(false)}
            onPointerLeave={() => onHold(false)}
            onContextMenu={(e) => e.preventDefault()}
        >
            {children}
        </button>
    );
}

export function Hud() {
    const player = useGame((s) => s.player);
    const zones = useGame((s) => s.zones);
    const nearSlug = useGame((s) => s.nearSlug);
    const nearLandmark = useGame((s) => s.nearLandmark);
    const openSlug = useGame((s) => s.openSlug);
    const area = useGame((s) => s.area);
    const toast = useGame((s) => s.toast);
    const ride = useGame((s) => s.ride);
    const setShowBadges = useGame((s) => s.setShowBadges);
    const setShowMenu = useGame((s) => s.setShowMenu);

    if (!player || ride) return null;

    const busStop = nearSlug?.startsWith('bus:') ?? false;
    const terminal = nearSlug && (nearSlug.startsWith('terminal:') || busStop) ? TOWN_LAYOUTS.find((t) => nearSlug.endsWith(`:${t.slug}`)) : null;
    const near = nearSlug && !terminal ? allLocations(zones).find((l) => l.slug === nearSlug) : null;
    const landmark = nearLandmark ? LANDMARKS.find((l) => l.slug === nearLandmark) : null;
    const span = Math.max(1, player.level_xp_end - player.level_xp_start);
    const pct = Math.min(100, Math.round(((player.xp - player.level_xp_start) / span) * 100));

    return (
        <div className="pointer-events-none absolute inset-0 select-none">
            {/* top bar */}
            <div className="flex items-start justify-between gap-2 p-3">
                <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/90 py-1.5 pr-3 pl-1.5 shadow-md">
                    <div className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-red-800 leading-none text-white">
                        <span className="text-[10px]">LV</span>
                        <span className="text-lg font-black">{player.level}</span>
                    </div>
                    <div className="min-w-0">
                        <p className="max-w-[9rem] truncate text-sm font-bold text-stone-800">{player.nickname}</p>
                        <div className="mt-1 h-2 w-24 overflow-hidden rounded-full bg-stone-200 sm:w-36" title={`${player.xp} XP`}>
                            <div className="h-full rounded-full bg-emerald-600 transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-stone-500">
                            {player.xp} / {player.level_xp_end} XP
                        </p>
                    </div>
                </div>

                {/* where am I */}
                {area.province && (
                    <div className="hidden rounded-2xl bg-stone-900/70 px-4 py-1.5 text-center text-white shadow-md md:block">
                        <p className="text-xs tracking-wide text-amber-200 uppercase">{area.province}</p>
                        {area.town && <p className="text-sm font-bold">{area.town}</p>}
                    </div>
                )}

                <div className="flex flex-col items-end gap-2">
                    <div className="pointer-events-auto flex items-center gap-1.5">
                        <span className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-2 text-sm font-bold text-amber-800 shadow-md">
                            <Coins size={16} aria-hidden /> {player.coins}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-2 text-sm font-bold text-orange-700 shadow-md" title="Days in a row">
                            <Flame size={16} aria-hidden /> {player.streak_days}
                        </span>
                        <button onClick={() => setShowBadges(true)} className="rounded-full bg-white/90 p-2.5 text-violet-800 shadow-md" aria-label="Badges">
                            <Award size={18} />
                        </button>
                        <button onClick={() => setShowMenu(true)} className="rounded-full bg-white/90 p-2.5 text-stone-700 shadow-md" aria-label="Menu">
                            <Menu size={18} />
                        </button>
                    </div>
                    <Minimap />
                </div>
            </div>

            {toast && (
                <div className="absolute top-24 left-1/2 w-[min(90vw,26rem)] -translate-x-1/2 rounded-2xl bg-stone-900/85 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
                    {toast}
                </div>
            )}

            {/* camera controls */}
            <div className="absolute right-3 bottom-6 flex flex-col items-center gap-2">
                <div className="flex gap-2">
                    <HoldButton label="Turn camera left (Q)" onHold={(on) => (input.cameraTurn = on ? -1 : 0)}>
                        <RotateCcw size={18} />
                    </HoldButton>
                    <HoldButton label="Turn camera right (E)" onHold={(on) => (input.cameraTurn = on ? 1 : 0)}>
                        <RotateCw size={18} />
                    </HoldButton>
                </div>
                <div className="flex gap-2">
                    <HoldButton label="Zoom in (Z)" onHold={(on) => (input.cameraZoom = on ? -1 : 0)}>
                        <ZoomIn size={18} />
                    </HoldButton>
                    <HoldButton label="Zoom out (X)" onHold={(on) => (input.cameraZoom = on ? 1 : 0)}>
                        <ZoomOut size={18} />
                    </HoldButton>
                </div>
                <button onClick={resetCamera} className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-md" aria-label="Reset camera (C)" title="Reset camera (C)">
                    <Compass size={20} />
                </button>
            </div>

            {/* talk / travel prompt */}
            {(near || terminal) && !openSlug && (
                <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
                    <div className="rounded-xl bg-white/95 px-3 py-1.5 text-center shadow-md">
                        <p className="text-sm font-bold text-stone-800">{near ? near.npc_name : busStop ? 'Bus terminal' : 'Jeepney terminal'}</p>
                        <p className="text-xs text-stone-500">{near ? near.name : terminal?.name}</p>
                    </div>
                    <button
                        className="pointer-events-auto flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-lg font-bold text-white shadow-lg ring-4 ring-amber-200 active:scale-95"
                        onClick={() => (input.interact = true)}
                    >
                        {near ? <MessageCircle size={20} aria-hidden /> : <Bus size={20} aria-hidden />} {near ? 'Talk' : 'Travel'}
                        {!isTouch && <kbd className="ml-1 rounded bg-white/25 px-1.5 text-xs">Space</kbd>}
                    </button>
                </div>
            )}

            {/* landmark card, like spinning a PokéStop */}
            {landmark && !near && !terminal && !openSlug && (
                <div className="absolute bottom-24 left-1/2 flex w-[min(92vw,24rem)] -translate-x-1/2 items-start gap-3 rounded-2xl bg-white/95 p-3 shadow-lg sm:bottom-10">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow" style={{ backgroundColor: CATEGORY_COLORS[landmark.category] }}>
                        <MapPin size={22} aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <p className="font-black text-stone-800">{landmark.name}</p>
                        <p className="text-sm leading-snug text-stone-600">{landmark.blurb}</p>
                    </div>
                </div>
            )}

            {!isTouch && !near && !terminal && !landmark && (
                <p className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-xs text-white lg:block">
                    WASD to move · Shift to run · drag or Q/E to turn · scroll or Z/X to zoom · C to reset view
                </p>
            )}

            {isTouch && !openSlug && <Joystick />}
        </div>
    );
}
