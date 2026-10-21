import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * Small textures painted on a canvas at startup: nothing to download, and each is made once and shared.
 */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')!];
}

function texture(c: HTMLCanvasElement, repeat = false): CanvasTexture {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
    return t;
}

function once<T>(make: () => T): () => T {
    let value: T | undefined;
    return () => (value ??= make());
}

/** Speckled grass, tinted by the material colour. Tiles every 28 m. */
export const grassTexture = once(() => {
    const S = 256;
    const [c, ctx] = canvas(S, S);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    // Draw each blob at all wrap offsets so the tile is seamless.
    const blob = (x: number, y: number, r: number, style: string | CanvasGradient) => {
        ctx.fillStyle = style;
        for (const ox of [-S, 0, S]) {
            for (const oy of [-S, 0, S]) {
                ctx.beginPath();
                ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    };
    for (let i = 0; i < 18; i++) blob(rand() * S, rand() * S, 20 + rand() * 40, `rgba(70,120,50,${0.05 + rand() * 0.05})`);
    for (let i = 0; i < 1500; i++) {
        const light = rand() < 0.45;
        blob(rand() * S, rand() * S, 0.8 + rand() * 1.8, light ? `rgba(255,255,215,${0.12 + rand() * 0.12})` : `rgba(40,90,30,${0.08 + rand() * 0.1})`);
    }
    const t = texture(c, true);
    t.repeat.set(1 / 28, 1 / 28);
    return t;
});

/** White in the middle fading to transparent at the edge (urban areas, glows). */
export const softDiscTexture = once(() => {
    const [c, ctx] = canvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return texture(c);
});

/** Rice paddies: a grid of green plots separated by earthen dikes. */
export const riceTexture = once(() => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = '#B79E6A';
    ctx.fillRect(0, 0, 256, 256);
    const greens = ['#8DCB4C', '#A3D65A', '#78BC3E', '#B8DB6A', '#6FB23B'];
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
            ctx.fillStyle = greens[(x * 3 + y * 2) % greens.length];
            ctx.fillRect(x * 64 + 3, y * 64 + 3, 58, 58);
            ctx.strokeStyle = 'rgba(40,90,20,0.25)';
            for (let r = 8; r < 60; r += 6) {
                ctx.beginPath();
                ctx.moveTo(x * 64 + 5, y * 64 + r);
                ctx.lineTo(x * 64 + 59, y * 64 + r);
                ctx.stroke();
            }
        }
    }
    return texture(c);
});

/** Pineapple rows: dark spiky plants in lines on red-brown soil. */
export const pineappleTexture = once(() => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = '#B5774A';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 8; y < 256; y += 16) {
        for (let x = 6; x < 256; x += 10) {
            ctx.fillStyle = (x + y) % 3 === 0 ? '#3E7A3A' : '#4F8F45';
            ctx.beginPath();
            ctx.arc(x + ((y / 16) % 2) * 5, y, 4.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    return texture(c);
});

/** The Philippine flag. */
export const flagTexture = once(() => {
    const [c, ctx] = canvas(128, 64);
    ctx.fillStyle = '#0038A8';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#CE1126';
    ctx.fillRect(0, 32, 128, 32);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(55, 32);
    ctx.lineTo(0, 64);
    ctx.fill();
    ctx.fillStyle = '#FCD116';
    ctx.beginPath();
    ctx.arc(18, 32, 7, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y] of [[5, 8], [5, 56], [42, 32]]) {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }
    return texture(c);
});

/** Vertical streaks for falling water; scroll its offset to animate. */
export const waterfallTexture = once(() => {
    const [c, ctx] = canvas(64, 128);
    ctx.fillStyle = '#CDEFFB';
    ctx.fillRect(0, 0, 64, 128);
    let seed = 3;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 70; i++) {
        ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(120,200,235,0.6)';
        const x = rand() * 64;
        const y = rand() * 128;
        ctx.fillRect(x, y, 1.5 + rand() * 2, 10 + rand() * 30);
        ctx.fillRect(x, y - 128, 1.5, 30);
    }
    const t = texture(c, true);
    return t;
});

const signCache = new Map<string, CanvasTexture>();

/** A painted sign board with centred text. */
export function signTexture(text: string, bg: string, fg: string): CanvasTexture {
    const key = `${text}|${bg}|${fg}`;
    let t = signCache.get(key);
    if (!t) {
        const [c, ctx] = canvas(512, 96);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 512, 96);
        ctx.fillStyle = fg;
        ctx.font = `900 ${text.length > 18 ? 40 : 52}px 'Instrument Sans', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 50, 490);
        t = texture(c);
        signCache.set(key, t);
    }
    return t;
}
