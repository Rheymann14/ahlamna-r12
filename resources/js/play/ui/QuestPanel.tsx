import { Check, ChevronRight, Coins, Lock, Sparkles, Star, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, type AnswerResult, type AttemptResult, type AttemptStart, type QuestSummary } from '../api';
import { allLocations, useGame } from '../store';
import { BadgeIcon } from './BadgesPanel';

type Phase = { name: 'talk' } | { name: 'loading' } | { name: 'question'; index: number } | { name: 'finishing' } | { name: 'result'; result: AttemptResult };

export function QuestPanel() {
    const openSlug = useGame((s) => s.openSlug);
    const zones = useGame((s) => s.zones);
    const player = useGame((s) => s.player);
    const openLocation = useGame((s) => s.openLocation);
    const setPlayer = useGame((s) => s.setPlayer);
    const loadWorld = useGame((s) => s.loadWorld);

    const [phase, setPhase] = useState<Phase>({ name: 'talk' });
    const [attempt, setAttempt] = useState<AttemptStart | null>(null);
    const [picked, setPicked] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<AnswerResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const shownAt = useRef(0);

    useEffect(() => {
        setPhase({ name: 'talk' });
        setAttempt(null);
        setError(null);
    }, [openSlug]);

    const location = openSlug ? allLocations(zones).find((l) => l.slug === openSlug) : null;
    if (!location || !player) return null;

    const close = () => {
        // Leaving mid-quest just abandons the attempt; nothing is paid out.
        openLocation(null);
    };

    const start = async (quest: QuestSummary) => {
        setError(null);
        setPhase({ name: 'loading' });
        try {
            const a = await api.startQuest(quest.id);
            setAttempt(a);
            setPicked(null);
            setFeedback(null);
            shownAt.current = performance.now();
            setPhase({ name: 'question', index: 0 });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not start the quest.');
            setPhase({ name: 'talk' });
        }
    };

    const choose = async (choiceId: number) => {
        if (!attempt || phase.name !== 'question' || picked !== null) return;
        const q = attempt.questions[phase.index];
        setPicked(choiceId);
        try {
            setFeedback(await api.answer(attempt.attempt_id, q.id, choiceId, Math.round(performance.now() - shownAt.current)));
        } catch (e) {
            setPicked(null);
            setError(e instanceof Error ? e.message : 'Could not send your answer. Check your connection.');
        }
    };

    const next = async () => {
        if (!attempt || phase.name !== 'question') return;
        setError(null);
        if (phase.index + 1 < attempt.questions.length) {
            setPicked(null);
            setFeedback(null);
            shownAt.current = performance.now();
            setPhase({ name: 'question', index: phase.index + 1 });
            return;
        }
        setPhase({ name: 'finishing' });
        try {
            const result = await api.complete(attempt.attempt_id);
            setPlayer(result.player);
            setPhase({ name: 'result', result });
            loadWorld();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not finish the quest.');
            setPhase({ name: 'question', index: phase.index });
        }
    };

    const color = location.topic?.color ?? '#888780';

    return (
        <div className="absolute inset-0 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={location.name}>
            <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-amber-50 shadow-2xl ring-4 ring-amber-300">
                <div className="flex items-center gap-3 border-b border-amber-200 px-5 py-4" style={{ borderTop: `6px solid ${color}`, borderRadius: '1.5rem 1.5rem 0 0' }}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black text-white" style={{ background: color }}>
                        {location.npc_name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-bold text-stone-800">{location.npc_name}</p>
                        <p className="truncate text-sm text-stone-500">
                            {location.npc_role} · {location.name}
                        </p>
                    </div>
                    <button onClick={close} className="rounded-full p-2 text-stone-500 hover:bg-amber-100" aria-label="Close">
                        <X size={22} />
                    </button>
                </div>

                <div className="p-5">
                    {error && <p className="mb-3 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}

                    {phase.name === 'talk' && (
                        <>
                            <p className="mb-4 rounded-2xl rounded-tl-sm bg-white p-4 text-stone-700 shadow-sm">{location.npc_greeting}</p>
                            {location.topic && <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">Topic: {location.topic.name}</p>}
                            <div className="space-y-2">
                                {location.quests.map((q) => (
                                    <button
                                        key={q.id}
                                        disabled={q.locked}
                                        onClick={() => start(q)}
                                        className="flex w-full items-center gap-3 rounded-2xl border-2 border-amber-200 bg-white p-3 text-left transition hover:border-amber-400 active:scale-[0.99] disabled:opacity-60"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-stone-800">{q.title}</p>
                                            <p className="text-sm text-stone-500">
                                                {q.question_count} questions ·{' '}
                                                {q.passed ? `Best ${q.best_score}/${q.question_count} · replay for half rewards` : `+${q.xp_reward} XP bonus`}
                                            </p>
                                        </div>
                                        {q.locked ? <Lock className="text-stone-400" /> : q.passed ? <Check className="text-emerald-600" /> : <ChevronRight className="text-amber-600" />}
                                    </button>
                                ))}
                                {location.quests.length === 0 && <p className="text-sm text-stone-500">No quests here yet. Come back soon!</p>}
                            </div>
                        </>
                    )}

                    {(phase.name === 'loading' || phase.name === 'finishing') && <p className="py-10 text-center text-stone-500">{phase.name === 'loading' ? 'Getting the quest ready…' : 'Counting your rewards…'}</p>}

                    {phase.name === 'question' && attempt && (() => {
                        const q = attempt.questions[phase.index];
                        return (
                            <>
                                <div className="mb-3 flex items-center justify-between text-sm text-stone-500">
                                    <span className="font-semibold">{attempt.quest.title}</span>
                                    <span>
                                        {phase.index + 1} / {attempt.questions.length}
                                    </span>
                                </div>
                                <div className="mb-4 h-2 overflow-hidden rounded-full bg-amber-100">
                                    <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${((phase.index + (feedback ? 1 : 0)) / attempt.questions.length) * 100}%` }} />
                                </div>
                                <p className="mb-4 text-lg font-bold text-stone-800">{q.prompt}</p>
                                <div className="space-y-2">
                                    {q.choices.map((c) => {
                                        const isPicked = picked === c.id;
                                        const isCorrect = feedback?.correct_choice_id === c.id;
                                        const style = !feedback
                                            ? isPicked
                                                ? 'border-amber-500 bg-amber-100'
                                                : 'border-amber-200 bg-white hover:border-amber-400'
                                            : isCorrect
                                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                                              : isPicked
                                                ? 'border-red-500 bg-red-50 text-red-900'
                                                : 'border-stone-200 bg-white opacity-60';
                                        return (
                                            <button key={c.id} disabled={picked !== null} onClick={() => choose(c.id)} className={`flex w-full items-center justify-between gap-2 rounded-2xl border-2 p-3 text-left font-medium text-stone-800 transition ${style}`}>
                                                {c.label}
                                                {feedback && isCorrect && <Check size={20} className="shrink-0 text-emerald-600" />}
                                                {feedback && isPicked && !isCorrect && <X size={20} className="shrink-0 text-red-600" />}
                                            </button>
                                        );
                                    })}
                                </div>

                                {feedback && (
                                    <div className={`mt-4 rounded-2xl p-4 ${feedback.is_correct ? 'bg-emerald-100 text-emerald-900' : 'bg-orange-100 text-orange-900'}`}>
                                        <p className="font-bold">{feedback.is_correct ? 'Tama! +10 XP' : 'Not quite.'}</p>
                                        {feedback.explanation && <p className="mt-1 text-sm">{feedback.explanation}</p>}
                                    </div>
                                )}

                                {feedback && (
                                    <button onClick={next} className="mt-4 w-full rounded-2xl bg-red-800 py-3 text-lg font-bold text-white shadow-md active:scale-[0.98]" autoFocus>
                                        {phase.index + 1 < attempt.questions.length ? 'Next' : 'Finish quest'}
                                    </button>
                                )}
                            </>
                        );
                    })()}

                    {phase.name === 'result' && (
                        <div className="text-center">
                            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-amber-400 text-white shadow-lg">
                                {phase.result.passed ? <Star size={40} /> : <Sparkles size={40} />}
                            </div>
                            <p className="text-2xl font-black text-stone-800">{phase.result.passed ? 'Quest complete!' : 'Good try!'}</p>
                            <p className="mt-1 text-stone-600">
                                You got {phase.result.score} of {phase.result.total} right.
                                {!phase.result.passed && ' Talk to me again to try once more.'}
                            </p>

                            <div className="mt-4 flex justify-center gap-3">
                                <span className="rounded-2xl bg-emerald-100 px-4 py-2 font-bold text-emerald-800">+{phase.result.xp_earned} XP</span>
                                <span className="flex items-center gap-1 rounded-2xl bg-amber-100 px-4 py-2 font-bold text-amber-800">
                                    <Coins size={18} aria-hidden /> +{phase.result.coins_earned}
                                </span>
                            </div>

                            {phase.result.leveled_up && <p className="mt-4 rounded-2xl bg-red-800 py-3 text-lg font-black text-white">Level up! You are now level {phase.result.player.level}.</p>}

                            {phase.result.new_badges.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <p className="text-sm font-semibold text-stone-500">New badge{phase.result.new_badges.length > 1 ? 's' : ''}</p>
                                    {phase.result.new_badges.map((b) => (
                                        <div key={b.slug} className="flex items-center gap-3 rounded-2xl bg-violet-100 p-3 text-left">
                                            <BadgeIcon icon={b.icon} className="text-violet-800" />
                                            <div>
                                                <p className="font-bold text-violet-900">{b.name}</p>
                                                <p className="text-sm text-violet-800">{b.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button onClick={close} className="mt-5 w-full rounded-2xl bg-red-800 py-3 text-lg font-bold text-white shadow-md active:scale-[0.98]">
                                Back to the barangay
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
