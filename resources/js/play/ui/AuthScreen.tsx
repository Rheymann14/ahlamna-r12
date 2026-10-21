import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError, api, type Meta } from '../api';
import { useGame } from '../store';

const AGE_LABELS: Record<string, string> = { '10-14': '10 to 14', '15-19': '15 to 19', '20-24': '20 to 24' };
const SEX_LABELS: Record<string, string> = { female: 'Female', male: 'Male', prefer_not: 'Prefer not to say' };

const field = 'w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2.5 text-base text-stone-800 outline-none focus:border-amber-500';
const label = 'mb-1 block text-sm font-medium text-stone-700';

export function AuthScreen() {
    const setSession = useGame((s) => s.setSession);
    const [mode, setMode] = useState<'new' | 'login'>('new');
    const [meta, setMeta] = useState<Meta | null>(null);
    const [form, setForm] = useState({ nickname: '', pin: '', age_group: '', sex: '', municipality_id: '', class_code: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.meta().then(setMeta).catch(() => setMeta({ age_groups: [], sexes: [], municipalities: [] }));
    }, []);

    const provinces = useMemo(() => {
        const groups: Record<string, Meta['municipalities']> = {};
        for (const m of meta?.municipalities ?? []) (groups[m.province] ??= []).push(m);
        return groups;
    }, [meta]);

    const update = (key: keyof typeof form, value: string) => {
        setForm((f) => ({ ...f, [key]: value }));
        setErrors((e) => ({ ...e, [key]: '' }));
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const local: Record<string, string> = {};
        if (form.nickname.trim().length < 3) local.nickname = 'Enter a nickname with at least 3 characters.';
        if (!/^\d{4,6}$/.test(form.pin)) local.pin = 'Your PIN must be 4 to 6 numbers.';
        if (mode === 'new' && !form.age_group) local.age_group = 'Choose your age group.';
        if (mode === 'new' && !form.sex) local.sex = 'Choose an option.';
        if (Object.keys(local).length) return setErrors(local);

        setBusy(true);
        try {
            const res =
                mode === 'new'
                    ? await api.register({
                          nickname: form.nickname.trim(),
                          pin: form.pin,
                          age_group: form.age_group,
                          sex: form.sex,
                          municipality_id: form.municipality_id || null,
                          class_code: form.class_code.trim() || null,
                      })
                    : await api.login(form.nickname.trim(), form.pin);
            await setSession(res.token, res.player);
        } catch (err) {
            if (err instanceof ApiError && Object.keys(err.errors).length) {
                setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
            } else {
                setErrors({ form: err instanceof Error ? err.message : 'Something went wrong. Try again.' });
            }
        } finally {
            setBusy(false);
        }
    };

    const Err = ({ name }: { name: string }) => (errors[name] ? <p className="mt-1 text-sm text-red-700">{errors[name]}</p> : null);

    return (
        <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-sky-200 to-lime-200 p-4">
            <div className="w-full max-w-md rounded-3xl bg-amber-50 p-6 shadow-xl ring-4 ring-amber-300 sm:p-8">
                <div className="mb-6 text-center">
                    <p className="text-sm font-medium tracking-wide text-red-800">SOCCSKSARGEN</p>
                    <h1 className="text-4xl font-black text-red-900">AHlam Na!</h1>
                    <p className="mt-1 text-stone-600">Explore the barangay. Learn. Level up.</p>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-amber-100 p-1">
                    {(['new', 'login'] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => {
                                setMode(m);
                                setErrors({});
                            }}
                            className={`rounded-xl py-2 font-semibold transition ${mode === m ? 'bg-white text-red-900 shadow' : 'text-stone-600'}`}
                        >
                            {m === 'new' ? 'New player' : 'I have an account'}
                        </button>
                    ))}
                </div>

                <form onSubmit={submit} className="space-y-4" noValidate>
                    <div>
                        <label className={label} htmlFor="nickname">
                            Nickname
                        </label>
                        <input id="nickname" className={field} value={form.nickname} maxLength={20} autoComplete="username" placeholder="Kulas_GenSan" onChange={(e) => update('nickname', e.target.value)} />
                        {mode === 'new' && <p className="mt-1 text-xs text-stone-500">Use a nickname, not your real name.</p>}
                        <Err name="nickname" />
                    </div>

                    <div>
                        <label className={label} htmlFor="pin">
                            PIN (4 to 6 numbers)
                        </label>
                        <input id="pin" className={field} value={form.pin} inputMode="numeric" type="password" maxLength={6} autoComplete={mode === 'new' ? 'new-password' : 'current-password'} onChange={(e) => update('pin', e.target.value.replace(/\D/g, ''))} />
                        <Err name="pin" />
                    </div>

                    {mode === 'new' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={label} htmlFor="age">
                                        Age
                                    </label>
                                    <select id="age" className={field} value={form.age_group} onChange={(e) => update('age_group', e.target.value)}>
                                        <option value="">Choose</option>
                                        {meta?.age_groups.map((a) => (
                                            <option key={a} value={a}>
                                                {AGE_LABELS[a] ?? a}
                                            </option>
                                        ))}
                                    </select>
                                    <Err name="age_group" />
                                </div>
                                <div>
                                    <label className={label} htmlFor="sex">
                                        Sex
                                    </label>
                                    <select id="sex" className={field} value={form.sex} onChange={(e) => update('sex', e.target.value)}>
                                        <option value="">Choose</option>
                                        {meta?.sexes.map((s) => (
                                            <option key={s} value={s}>
                                                {SEX_LABELS[s] ?? s}
                                            </option>
                                        ))}
                                    </select>
                                    <Err name="sex" />
                                </div>
                            </div>

                            <div>
                                <label className={label} htmlFor="town">
                                    Town or city (optional)
                                </label>
                                <select id="town" className={field} value={form.municipality_id} onChange={(e) => update('municipality_id', e.target.value)}>
                                    <option value="">Choose</option>
                                    {Object.entries(provinces).map(([province, towns]) => (
                                        <optgroup key={province} label={province}>
                                            {towns.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={label} htmlFor="class">
                                    Class code from your teacher (optional)
                                </label>
                                <input id="class" className={field} value={form.class_code} maxLength={20} placeholder="KOR-G9-ROSE" onChange={(e) => update('class_code', e.target.value)} />
                            </div>
                        </>
                    )}

                    <Err name="form" />

                    <button type="submit" disabled={busy} className="w-full rounded-2xl bg-red-800 py-3 text-lg font-bold text-white shadow-md transition hover:bg-red-900 active:scale-[0.98] disabled:opacity-60">
                        {busy ? 'Loading…' : mode === 'new' ? 'Start playing' : 'Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}
