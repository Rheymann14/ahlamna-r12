import { Bus, FastForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { rideState, useGame } from '../store';
import { TOWN_LAYOUTS } from '../world/layout';

const townName = (slug: string) => TOWN_LAYOUTS.find((t) => t.slug === slug)?.name ?? slug;

/** Letterbox, title card, trip progress and a Skip button over the ride cutscene. */
export function RideOverlay() {
    const ride = useGame((s) => s.ride);
    const endRide = useGame((s) => s.endRide);
    const fade = useRef<HTMLDivElement>(null);
    const bar = useRef<HTMLDivElement>(null);
    const [closing, setClosing] = useState(false);
    const wasRiding = useRef(false);

    // Follow the cutscene's fade and progress every frame without re-rendering.
    useEffect(() => {
        if (!ride) return;
        let frame = 0;
        const tick = () => {
            if (fade.current) fade.current.style.opacity = String(rideState.fade);
            if (bar.current) bar.current.style.width = `${Math.round(rideState.progress * 100)}%`;
            frame = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(frame);
    }, [ride]);

    // Space, Enter or Escape skips the ride.
    useEffect(() => {
        if (!ride) return;
        const key = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
                e.preventDefault();
                endRide();
            }
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [ride, endRide]);

    // After arriving, fade back in from black over the destination.
    useEffect(() => {
        if (ride) {
            wasRiding.current = true;
            return;
        }
        if (!wasRiding.current) return;
        wasRiding.current = false;
        setClosing(true);
        const t = setTimeout(() => setClosing(false), 700);
        return () => clearTimeout(t);
    }, [ride]);

    if (!ride) {
        return closing ? <div className="pointer-events-none absolute inset-0 animate-[ride-reveal_0.7s_ease-out_forwards] bg-black" /> : null;
    }

    const mode = ride.mode === 'bus' ? 'Bus' : 'Jeepney';

    return (
        <div className="absolute inset-0 select-none" role="dialog" aria-label={`${mode} ride to ${townName(ride.to)}`}>
            <div className="absolute inset-x-0 top-0 h-[11dvh] bg-black" />
            <div className="absolute inset-x-0 bottom-0 flex h-[15dvh] min-h-24 items-center justify-between gap-3 bg-black px-4 sm:px-8">
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-amber-300 uppercase">
                        <Bus size={14} aria-hidden /> {mode} ride
                    </p>
                    <p className="truncate text-lg font-black text-white sm:text-2xl">
                        {townName(ride.from)} <span className="text-amber-300">→</span> {townName(ride.to)}
                    </p>
                    <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/20">
                        <div ref={bar} className="h-full rounded-full bg-amber-400" style={{ width: '0%' }} />
                    </div>
                </div>
                <button
                    onClick={endRide}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/30 hover:bg-white/25 active:scale-95"
                >
                    <FastForward size={16} aria-hidden /> Skip
                </button>
            </div>
            <div ref={fade} className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 1 }} />
        </div>
    );
}
