/**
 * Shared, mutable input state read every frame by the player controller.
 * Kept outside React state on purpose: updating it must not trigger re-renders.
 *
 * Keyboard: WASD / arrows move, Shift runs, Space / Enter / F talks, Q / E rotate the camera,
 * Z / X (or the mouse wheel) zoom, C recenters the camera.
 */
export const input = {
    keys: new Set<string>(),
    joystick: { x: 0, y: 0 },
    /** Set by the "Talk" button or the talk keys; consumed by the world. */
    interact: false,
    /** Held on-screen camera buttons: -1 / 0 / 1. */
    cameraTurn: 0,
    cameraZoom: 0,
};

const HELD_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'KeyZ', 'KeyX',
]);

export function bindKeyboard(isBlocked: () => boolean, onRecenter: () => void): () => void {
    const down = (e: KeyboardEvent) => {
        if (isBlocked()) return;
        const target = e.target as HTMLElement | null;
        if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) && (e.code === 'Space' || e.code === 'Enter')) return;
        if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;

        if (HELD_KEYS.has(e.code)) {
            input.keys.add(e.code);
            e.preventDefault();
        }
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') {
            input.interact = true;
            e.preventDefault();
        }
        if (e.code === 'KeyC') onRecenter();
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

/** Movement relative to the screen (x right, z down/toward the camera), length 0..1. */
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

export function isRunning(): boolean {
    return input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || Math.hypot(input.joystick.x, input.joystick.y) > 0.92;
}

/** Camera turn/zoom from keys and held on-screen buttons: each -1..1. */
export function cameraInput(): { turn: number; zoom: number } {
    let turn = input.cameraTurn;
    let zoom = input.cameraZoom;
    if (input.keys.has('KeyQ')) turn -= 1;
    if (input.keys.has('KeyE')) turn += 1;
    if (input.keys.has('KeyZ')) zoom -= 1;
    if (input.keys.has('KeyX')) zoom += 1;
    return { turn, zoom };
}
