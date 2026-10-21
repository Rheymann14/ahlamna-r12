import { LogOut, Phone, X } from 'lucide-react';
import { useGame } from '../store';

export function MenuPanel() {
    const show = useGame((s) => s.showMenu);
    const quality = useGame((s) => s.quality);
    const setQuality = useGame((s) => s.setQuality);
    const setShowMenu = useGame((s) => s.setShowMenu);
    const logout = useGame((s) => s.logout);

    if (!show) return null;

    return (
        <div className="absolute inset-0 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="w-full max-w-sm rounded-3xl bg-amber-50 p-5 shadow-2xl ring-4 ring-amber-300">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-black text-stone-800">Menu</h2>
                    <button onClick={() => setShowMenu(false)} className="rounded-full p-2 text-stone-500 hover:bg-amber-100" aria-label="Close">
                        <X size={22} />
                    </button>
                </div>

                <p className="mb-2 text-sm font-semibold text-stone-600">Graphics</p>
                <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-amber-100 p-1">
                    {(['low', 'high'] as const).map((q) => (
                        <button key={q} onClick={() => setQuality(q)} className={`rounded-xl py-2 font-semibold ${quality === q ? 'bg-white text-red-900 shadow' : 'text-stone-600'}`}>
                            {q === 'low' ? 'Low (saves battery)' : 'High'}
                        </button>
                    ))}
                </div>

                <div className="mb-5 rounded-2xl bg-white p-4 text-sm text-stone-700">
                    <p className="mb-1 flex items-center gap-2 font-bold">
                        <Phone size={16} aria-hidden /> Need someone to talk to?
                    </p>
                    <p>NCMH crisis hotline: 1553 (24/7, free on landline).</p>
                    <p>Visit your nearest teen-friendly health center for confidential help.</p>
                </div>

                <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-300 py-2.5 font-semibold text-stone-700 hover:bg-white">
                    <LogOut size={18} aria-hidden /> Log out
                </button>
            </div>
        </div>
    );
}
