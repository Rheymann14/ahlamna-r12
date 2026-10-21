const TOKEN_KEY = 'ahlamna.token';

export type Badge = { slug: string; name: string; description: string; icon: string; earned_at: string | null };

export type Player = {
    id: number;
    nickname: string;
    age_group: string;
    language: string;
    xp: number;
    coins: number;
    level: number;
    level_xp_start: number;
    level_xp_end: number;
    streak_days: number;
    badges: Badge[];
};

export type QuestSummary = {
    id: number;
    title: string;
    intro: string | null;
    type: string;
    min_level: number;
    question_count: number;
    xp_reward: number;
    coin_reward: number;
    locked: boolean;
    passed: boolean;
    best_score: number | null;
};

export type WorldLocation = {
    slug: string;
    name: string;
    npc_name: string;
    npc_role: string | null;
    npc_greeting: string | null;
    position: [number, number];
    topic: { slug: string; name: string; color: string } | null;
    quests: QuestSummary[];
};

export type Zone = {
    slug: string;
    name: string;
    description: string | null;
    unlock_level: number;
    locked: boolean;
    locations: WorldLocation[];
};

export type PlayableQuestion = {
    id: number;
    type: string;
    prompt: string;
    choices: { id: number; label: string }[];
};

export type AttemptStart = {
    attempt_id: number;
    quest: { id: number; title: string; intro: string | null; type: string };
    questions: PlayableQuestion[];
};

export type AnswerResult = { is_correct: boolean; correct_choice_id: number | null; explanation: string | null };

export type AttemptResult = {
    score: number;
    total: number;
    passed: boolean;
    first_pass: boolean;
    xp_earned: number;
    coins_earned: number;
    leveled_up: boolean;
    new_badges: Badge[];
    player: Player;
};

export type Meta = {
    age_groups: string[];
    sexes: string[];
    municipalities: { id: number; name: string; province: string }[];
};

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public errors: Record<string, string[]> = {},
    ) {
        super(message);
    }
}

function safeStorage<T>(fn: () => T, fallback: T): T {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

export const tokenStore = {
    get: () => safeStorage(() => localStorage.getItem(TOKEN_KEY), null),
    set: (token: string) => safeStorage(() => localStorage.setItem(TOKEN_KEY, token), undefined),
    clear: () => safeStorage(() => localStorage.removeItem(TOKEN_KEY), undefined),
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = tokenStore.get();
    const res = await fetch(`/api/play/${path}`, {
        method,
        headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new ApiError(data.message ?? 'Something went wrong. Try again.', res.status, data.errors ?? {});
    }

    return data as T;
}

export const api = {
    meta: () => request<Meta>('GET', 'meta'),
    register: (body: Record<string, unknown>) => request<{ token: string; player: Player }>('POST', 'register', body),
    login: (nickname: string, pin: string) => request<{ token: string; player: Player }>('POST', 'login', { nickname, pin }),
    logout: () => request<{ ok: boolean }>('POST', 'logout'),
    me: () => request<{ player: Player }>('GET', 'me'),
    world: () => request<{ zones: Zone[] }>('GET', 'world'),
    startQuest: (questId: number) => request<AttemptStart>('POST', `quests/${questId}/attempts`),
    answer: (attemptId: number, questionId: number, choiceId: number, timeMs: number) =>
        request<AnswerResult>('POST', `attempts/${attemptId}/answers`, { question_id: questionId, choice_id: choiceId, time_ms: timeMs }),
    complete: (attemptId: number) => request<AttemptResult>('POST', `attempts/${attemptId}/complete`),
};
