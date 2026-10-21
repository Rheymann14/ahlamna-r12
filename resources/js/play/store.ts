import { create } from 'zustand';
import { api, tokenStore, type Player, type WorldLocation, type Zone } from './api';

export type Quality = 'low' | 'high';

const QUALITY_KEY = 'ahlamna.quality';
const VISITED_KEY = 'ahlamna.visited';

function loadVisited(): string[] {
    try {
        const saved = JSON.parse(localStorage.getItem(VISITED_KEY) ?? '[]');
        return Array.isArray(saved) ? saved.filter((s) => typeof s === 'string') : [];
    } catch {
        return [];
    }
}

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

/** Live player position for the minimap (mutable; updated every frame without re-rendering). */
export const playerState = { x: 0, z: 0, heading: 0, cameraYaw: 0 };

type GameState = {
    token: string | null;
    player: Player | null;
    zones: Zone[];
    /** Location slug, or "terminal:<town>" for a jeepney terminal. */
    nearSlug: string | null;
    /** Landmark the player is standing at (world/landmarks.ts slug). */
    nearLandmark: string | null;
    /** Landmarks this device has discovered (shown in colour on the map). */
    visited: string[];
    openSlug: string | null;
    showBadges: boolean;
    showMenu: boolean;
    showTravel: boolean;
    showMap: boolean;
    /** Where the player is, for the HUD: province name and nearby town. */
    area: { province: string | null; town: string | null };
    /** Set by the travel menu; consumed by the player controller. */
    teleport: [number, number] | null;
    toast: string | null;
    quality: Quality;

    setSession: (token: string, player: Player) => Promise<void>;
    loadWorld: () => Promise<void>;
    setPlayer: (player: Player) => void;
    setNear: (slug: string | null) => void;
    setNearLandmark: (slug: string | null) => void;
    visit: (slug: string) => boolean;
    openLocation: (slug: string | null) => void;
    setShowBadges: (show: boolean) => void;
    setShowMenu: (show: boolean) => void;
    setShowTravel: (show: boolean) => void;
    setShowMap: (show: boolean) => void;
    setArea: (province: string | null, town: string | null) => void;
    travelTo: (spot: [number, number]) => void;
    consumeTeleport: () => [number, number] | null;
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
    nearLandmark: null,
    visited: loadVisited(),
    openSlug: null,
    showBadges: false,
    showMenu: false,
    showTravel: false,
    showMap: false,
    area: { province: null, town: null },
    teleport: null,
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

    setNearLandmark: (slug) => {
        if (get().nearLandmark !== slug) set({ nearLandmark: slug });
    },

    /** Marks a landmark as discovered; true the first time. */
    visit: (slug) => {
        const visited = get().visited;
        if (visited.includes(slug)) return false;
        const next = [...visited, slug];
        try {
            localStorage.setItem(VISITED_KEY, JSON.stringify(next));
        } catch {
            // ignore: discoveries just won't be remembered on this device
        }
        set({ visited: next });
        return true;
    },

    openLocation: (slug) => set({ openSlug: slug }),
    setShowBadges: (showBadges) => set({ showBadges }),
    setShowMenu: (showMenu) => set({ showMenu }),
    setShowTravel: (showTravel) => set({ showTravel }),
    setShowMap: (showMap) => set({ showMap }),

    setArea: (province, town) => {
        const a = get().area;
        if (a.province !== province || a.town !== town) set({ area: { province, town } });
    },

    travelTo: (spot) => set({ teleport: spot, showTravel: false, showMap: false }),

    consumeTeleport: () => {
        const t = get().teleport;
        if (t) set({ teleport: null });
        return t;
    },

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
        set({ token: null, player: null, zones: [], openSlug: null, nearSlug: null, nearLandmark: null, showMenu: false, showTravel: false, showMap: false });
    },
}));

/** True while a panel is open and the world should ignore movement. */
export function isPaused(s: GameState): boolean {
    return s.openSlug !== null || s.showBadges || s.showMenu || s.showTravel || s.showMap;
}

export function allLocations(zones: Zone[]): (WorldLocation & { zone: Zone })[] {
    return zones.flatMap((zone) => zone.locations.map((loc) => ({ ...loc, zone })));
}
