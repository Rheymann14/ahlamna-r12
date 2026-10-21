import { BufferGeometry, Float32BufferAttribute } from 'three';

type P = [number, number];
export type RGBA = [number, number, number, number];

/**
 * Builds flat, upward-facing ground geometry (roads, coastlines, discs) at a fixed height.
 * Everything goes into one non-indexed geometry, so a whole road network is a single draw call.
 * Points are world [x, z].
 */
export class FlatBuilder {
    private pos: number[] = [];
    private col: number[] = [];

    constructor(
        private readonly y: number,
        private readonly withColor = false,
    ) {}

    tri(a: P, b: P, c: P, ca: RGBA = [1, 1, 1, 1], cb: RGBA = ca, cc: RGBA = ca) {
        // Swap two corners if the triangle would face down (y of (b - a) × (c - a) must be positive).
        if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) < 0) {
            [b, c] = [c, b];
            [cb, cc] = [cc, cb];
        }
        for (const p of [a, b, c]) this.pos.push(p[0], this.y, p[1]);
        if (this.withColor) this.col.push(...ca, ...cb, ...cc);
    }

    quad(a: P, b: P, c: P, d: P, ca?: RGBA, cb?: RGBA, cc?: RGBA, cd?: RGBA) {
        this.tri(a, b, c, ca, cb, cc);
        this.tri(a, c, d, ca, cc, cd);
    }

    disc(x: number, z: number, r: number, segments = 12, center?: RGBA, rim: RGBA | undefined = center) {
        for (let i = 0; i < segments; i++) {
            const a0 = (i / segments) * Math.PI * 2;
            const a1 = ((i + 1) / segments) * Math.PI * 2;
            this.tri([x, z], [x + Math.cos(a0) * r, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, z + Math.sin(a1) * r], center, rim, rim);
        }
    }

    ring(x: number, z: number, inner: number, outer: number, segments = 48) {
        for (let i = 0; i < segments; i++) {
            const a0 = (i / segments) * Math.PI * 2;
            const a1 = ((i + 1) / segments) * Math.PI * 2;
            const p = (r: number, a: number): P => [x + Math.cos(a) * r, z + Math.sin(a) * r];
            this.quad(p(inner, a0), p(outer, a0), p(outer, a1), p(inner, a1));
        }
    }

    /** A strip of constant width along a polyline, with round joints and ends. */
    polyline(points: P[], half: number, joints = 10) {
        for (let i = 1; i < points.length; i++) {
            const [ax, az] = points[i - 1];
            const [bx, bz] = points[i];
            const len = Math.hypot(bx - ax, bz - az) || 1;
            const nx = (-(bz - az) / len) * half;
            const nz = ((bx - ax) / len) * half;
            this.quad([ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]);
        }
        for (const [x, z] of points) this.disc(x, z, half, joints);
    }

    /** Dashes along a polyline (centre lines). */
    dashes(points: P[], half: number, dash: number, gap: number) {
        let carry = 0;
        for (let i = 1; i < points.length; i++) {
            const [ax, az] = points[i - 1];
            const [bx, bz] = points[i];
            const len = Math.hypot(bx - ax, bz - az);
            if (carry >= len) {
                carry -= len;
                continue;
            }
            const dx = (bx - ax) / len;
            const dz = (bz - az) / len;
            for (let t = carry; t < len; t += dash + gap) {
                const t1 = Math.min(len, t + dash);
                this.quad(
                    [ax + dx * t - dz * half, az + dz * t + dx * half],
                    [ax + dx * t1 - dz * half, az + dz * t1 + dx * half],
                    [ax + dx * t1 + dz * half, az + dz * t1 - dx * half],
                    [ax + dx * t + dz * half, az + dz * t - dx * half],
                );
                carry = t + dash + gap - len;
            }
        }
    }

    build(): BufferGeometry {
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
        const normals = new Float32Array(this.pos.length);
        for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
        g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
        if (this.withColor) g.setAttribute('color', new Float32BufferAttribute(this.col, 4));
        return g;
    }
}
