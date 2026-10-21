/**
 * Orbit camera around the player. Mutable on purpose (read every frame, never re-renders React).
 *
 * yaw:      0 = camera south of the player looking north (the map's "up" is up on screen)
 * pitch:    angle above the ground, in radians
 * distance: meters from the player
 */
export const DEFAULT_CAMERA = { yaw: 0, pitch: 0.5, distance: 26 };

export const LIMITS = { minPitch: 0.2, maxPitch: 1.4, minDistance: 8, maxDistance: 80 };

export const cameraRig = { ...DEFAULT_CAMERA };

export function rotateCamera(deltaYaw: number, deltaPitch = 0) {
    cameraRig.yaw += deltaYaw;
    cameraRig.pitch = Math.min(LIMITS.maxPitch, Math.max(LIMITS.minPitch, cameraRig.pitch + deltaPitch));
}

export function zoomCamera(factor: number) {
    cameraRig.distance = Math.min(LIMITS.maxDistance, Math.max(LIMITS.minDistance, cameraRig.distance * factor));
}

export function resetCamera() {
    Object.assign(cameraRig, DEFAULT_CAMERA);
}

/**
 * Mouse / touch gestures on the 3D view:
 *  - drag (mouse or one finger): rotate around the player
 *  - mouse wheel or two-finger pinch: zoom
 */
export function bindCameraGestures(el: HTMLElement): () => void {
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;

    const down = (e: PointerEvent) => {
        el.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        }
    };

    const move = (e: PointerEvent) => {
        const prev = pointers.get(e.pointerId);
        if (!prev) return;
        const now = { x: e.clientX, y: e.clientY };
        pointers.set(e.pointerId, now);

        if (pointers.size === 1) {
            rotateCamera(-(now.x - prev.x) * 0.008, (now.y - prev.y) * 0.005);
        } else if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinchStart > 0 && dist > 0) zoomCamera(pinchStart / dist);
            pinchStart = dist;
        }
    };

    const up = (e: PointerEvent) => {
        pointers.delete(e.pointerId);
        pinchStart = 0;
    };

    const wheel = (e: WheelEvent) => {
        e.preventDefault();
        zoomCamera(1 + Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100) * 0.0015);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });

    return () => {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        el.removeEventListener('wheel', wheel);
    };
}
