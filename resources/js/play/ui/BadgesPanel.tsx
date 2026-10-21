import { Award, Flame, Footprints, Handshake, HeartPulse, Map, Sparkles, Star, TrendingUp, X, type LucideIcon } from 'lucide-react';
import { useGame } from '../store';

const ICONS: Record<string, LucideIcon> = {
    footprints: Footprints,
    map: Map,
    star: Star,
    'heart-pulse': HeartPulse,
    sparkles: Sparkles,
    handshake: Handshake,
    'trending-up': TrendingUp,
    flame: Flame,
};

export function BadgeIcon({ icon, className }: { icon: string; className?: string }) {
    const Icon = ICONS[icon] ?? Award;
    return <Icon size={28} className={className} aria-hidden />;
}

export function BadgesPanel() {
    const show = useGame((s) => s.showBadges);
    const player = useGame((s) => s.player);
    const setShowBadges = useGame((s) => s.setShowBadges);

    if (!show || !player) return null;

    return (
        <div className="absolute inset-0 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Your badges">
            <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-amber-50 p-5 shadow-2xl ring-4 ring-amber-300">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-black text-stone-800">Your badges</h2>
                    <button onClick={() => setShowBadges(false)} className="rounded-full p-2 text-stone-500 hover:bg-amber-100" aria-label="Close">
                        <X size={22} />
                    </button>
                </div>
                {player.badges.length === 0 ? (
                    <p className="rounded-2xl bg-white p-4 text-stone-600">Pass your first quest to earn a badge. Look for people with a ! above their heads.</p>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {player.badges.map((b) => (
                            <div key={b.slug} className="rounded-2xl bg-white p-3 text-center shadow-sm">
                                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100">
                                    <BadgeIcon icon={b.icon} className="text-violet-800" />
                                </div>
                                <p className="font-bold text-stone-800">{b.name}</p>
                                <p className="text-xs text-stone-500">{b.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
