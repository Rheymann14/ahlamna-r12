import { Suspense, lazy, useEffect, useState } from 'react';
import { ApiError, api } from './api';
import { resetCamera } from './camera';
import { bindKeyboard } from './input';
import { isPaused, useGame } from './store';
import { AuthScreen } from './ui/AuthScreen';
import { BadgesPanel } from './ui/BadgesPanel';
import { Hud } from './ui/Hud';
import { MapPanel } from './ui/Minimap';
import { MenuPanel } from './ui/MenuPanel';
import { QuestPanel } from './ui/QuestPanel';
import { RideOverlay } from './ui/RideOverlay';

// three.js + the world only download after login.
const GameCanvas = lazy(() => import('./world/GameCanvas'));

function Loading({ text }: { text: string }) {
    return (
        <div className="flex h-dvh items-center justify-center bg-gradient-to-b from-sky-200 to-lime-200">
            <p className="rounded-2xl bg-white/80 px-5 py-3 font-semibold text-stone-700 shadow">{text}</p>
        </div>
    );
}

export function App() {
    const token = useGame((s) => s.token);
    const player = useGame((s) => s.player);
    const zones = useGame((s) => s.zones);
    const [error, setError] = useState<string | null>(null);

    // Restore a saved session.
    useEffect(() => {
        if (!token || player) return;
        api.me()
            .then(({ player }) => useGame.getState().setSession(token, player))
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) useGame.getState().logout();
                else setError('Could not reach the server. Check your connection and refresh.');
            });
    }, [token, player]);

    useEffect(() => {
        const unbind = bindKeyboard(() => isPaused(useGame.getState()), resetCamera);
        const escape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            const s = useGame.getState();
            s.openLocation(null);
            s.setShowBadges(false);
            s.setShowMenu(false);
            s.setShowTravel(false);
            s.setShowMap(false);
        };
        window.addEventListener('keydown', escape);
        return () => {
            unbind();
            window.removeEventListener('keydown', escape);
        };
    }, []);

    if (!token) return <AuthScreen />;
    if (error) return <Loading text={error} />;
    if (!player || zones.length === 0) return <Loading text="Loading your barangay…" />;

    return (
        <div className="relative h-dvh w-full overflow-hidden bg-sky-200">
            <Suspense fallback={<Loading text="Building the world…" />}>
                <GameCanvas />
            </Suspense>
            <Hud />
            <RideOverlay />
            <QuestPanel />
            <BadgesPanel />
            <MenuPanel />
            <MapPanel />
        </div>
    );
}
