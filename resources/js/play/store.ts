import { create } from 'zustand';
import { api, tokenStore, type Player, type WorldLocation, type Zone } from './api';

export type Quality = 'low' | 'high';

const QUALITY_KEY = 'ahlamna.quality';

function detectQuality(): Quality {
    try {
        const saved = localStorage.getItem(QUALITY_KEY);
        if (saved === 'low' || saved === 'high') return saved;
    } catch {
        // storage unavailable; fall through to detection
    }
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak = (nav.deviceMemory ?? 4) <= 2 || (navigator.hardwareConcurrency ?? 4) <= 4;
    return weak ? 'low' : 'high';
}

type GameState = {
    token: string | null;
    player: Player | null;
    zones: Zone[];
    nearSlug: string | null;
    openSlug: string | null;
    showBadges: boolean;
    showMenu: boolean;
    toast: string | null;
    quality: Quality;

    setSession: (token: string, player: Player) => Promise<void>;
    loadWorld: () => Promise<void>;
    setPlayer: (player: Player) => void;
    setNear: (slug: string | null) => void;
    openLocation: (slug: string | null) => void;
    setShowBadges: (show: boolean) => void;
    setShowMenu: (show: boolean) => void;
    flash: (message: string) => void;
    setQuality: (quality: Quality) => void;
    logout: () => Promise<void>;
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useGame = create<GameState>((set, get) => ({
    token: tokenStore.get(),
    player: null,
    zones: [],
    nearSlug: null,
    openSlug: null,
    showBadges: false,
    showMenu: false,
    toast: null,
    quality: detectQuality(),

    setSession: async (token, player) => {
        tokenStore.set(token);
        set({ token, player });
        await get().loadWorld();
    },

    loadWorld: async () => {
        const { zones } = await api.world();
        set({ zones });
    },

    setPlayer: (player) => set({ player }),

    setNear: (slug) => {
        if (get().nearSlug !== slug) set({ nearSlug: slug });
    },

    openLocation: (slug) => set({ openSlug: slug }),
    setShowBadges: (showBadges) => set({ showBadges }),
    setShowMenu: (showMenu) => set({ showMenu }),

    flash: (message) => {
        clearTimeout(toastTimer);
        set({ toast: message });
        toastTimer = setTimeout(() => set({ toast: null }), 2600);
    },

    setQuality: (quality) => {
        try {
            localStorage.setItem(QUALITY_KEY, quality);
        } catch {
            // ignore: quality just won't be remembered
        }
        set({ quality });
    },

    logout: async () => {
        await api.logout().catch(() => undefined);
        tokenStore.clear();
        set({ token: null, player: null, zones: [], openSlug: null, nearSlug: null, showMenu: false });
    },
}));

export function allLocations(zones: Zone[]): (WorldLocation & { zone: Zone })[] {
    return zones.flatMap((zone) => zone.locations.map((loc) => ({ ...loc, zone })));
}
