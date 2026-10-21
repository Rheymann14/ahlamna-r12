import { Award, Coins, Flame, Menu, MessageCircle } from 'lucide-react';
import { input } from '../input';
import { allLocations, useGame } from '../store';
import { Joystick } from './Joystick';

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function Hud() {
    const player = useGame((s) => s.player);
    const zones = useGame((s) => s.zones);
    const nearSlug = useGame((s) => s.nearSlug);
    const openSlug = useGame((s) => s.openSlug);
    const toast = useGame((s) => s.toast);
    const setShowBadges = useGame((s) => s.setShowBadges);
    const setShowMenu = useGame((s) => s.setShowMenu);

    if (!player) return null;

    const near = nearSlug ? allLocations(zones).find((l) => l.slug === nearSlug) : null;
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
                        <div className="mt-1 h-2 w-28 overflow-hidden rounded-full bg-stone-200 sm:w-36" title={`${player.xp} XP`}>
                            <div className="h-full rounded-full bg-emerald-600 transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-stone-500">
                            {player.xp} / {player.level_xp_end} XP
                        </p>
                    </div>
                </div>

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
            </div>

            {toast && (
                <div className="absolute top-20 left-1/2 w-[min(90vw,26rem)] -translate-x-1/2 rounded-2xl bg-stone-900/85 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
                    {toast}
                </div>
            )}

            {/* talk prompt */}
            {near && !openSlug && (
                <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
                    <div className="rounded-xl bg-white/95 px-3 py-1.5 text-center shadow-md">
                        <p className="text-sm font-bold text-stone-800">{near.npc_name}</p>
                        <p className="text-xs text-stone-500">{near.name}</p>
                    </div>
                    <button
                        className="pointer-events-auto flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-lg font-bold text-white shadow-lg ring-4 ring-amber-200 active:scale-95"
                        onClick={() => (input.interact = true)}
                    >
                        <MessageCircle size={20} aria-hidden /> Talk {!isTouch && <kbd className="ml-1 rounded bg-white/25 px-1.5 text-xs">E</kbd>}
                    </button>
                </div>
            )}

            {!isTouch && !near && (
                <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/30 px-3 py-1 text-xs text-white">
                    Move with WASD or arrow keys. Walk up to someone with a ! to talk.
                </p>
            )}

            {isTouch && !openSlug && <Joystick />}
        </div>
    );
}
