/**
 * Shared, mutable input state read every frame by the player controller.
 * Kept outside React state on purpose: updating it must not trigger re-renders.
 */
export const input = {
    keys: new Set<string>(),
    joystick: { x: 0, y: 0 },
    /** Set by the "Talk" button or the E/Space key; consumed by the world. */
    interact: false,
};

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function bindKeyboard(isBlocked: () => boolean): () => void {
    const down = (e: KeyboardEvent) => {
        if (isBlocked()) return;
        const target = e.target as HTMLElement | null;
        if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;

        if (MOVE_KEYS.has(e.code)) {
            input.keys.add(e.code);
            e.preventDefault();
        }
        if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
            input.interact = true;
            e.preventDefault();
        }
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const clear = () => input.keys.clear();

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);

    return () => {
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
        window.removeEventListener('blur', clear);
    };
}

/** Movement direction on the ground plane (x right, z toward the camera), length 0..1. */
export function moveVector(): { x: number; z: number } {
    let x = input.joystick.x;
    let z = input.joystick.y;

    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) z -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) z += 1;

    const len = Math.hypot(x, z);
    return len > 1 ? { x: x / len, z: z / len } : { x, z };
}
