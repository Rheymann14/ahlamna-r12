import { useRef, useState, type PointerEvent } from 'react';
import { input } from '../input';

const RADIUS = 48;

/** On-screen thumb stick for touch devices. Writes straight into the shared input state. */
export function Joystick() {
    const base = useRef<HTMLDivElement>(null);
    const [knob, setKnob] = useState({ x: 0, y: 0 });
    const pointerId = useRef<number | null>(null);

    const move = (e: PointerEvent) => {
        if (pointerId.current !== e.pointerId || !base.current) return;
        const rect = base.current.getBoundingClientRect();
        let dx = e.clientX - (rect.left + rect.width / 2);
        let dy = e.clientY - (rect.top + rect.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > RADIUS) {
            dx = (dx / len) * RADIUS;
            dy = (dy / len) * RADIUS;
        }
        setKnob({ x: dx, y: dy });
        input.joystick.x = dx / RADIUS;
        input.joystick.y = dy / RADIUS;
    };

    const end = () => {
        pointerId.current = null;
        setKnob({ x: 0, y: 0 });
        input.joystick.x = 0;
        input.joystick.y = 0;
    };

    return (
        <div
            ref={base}
            className="pointer-events-auto absolute bottom-6 left-6 h-32 w-32 touch-none rounded-full bg-black/20 ring-2 ring-white/50 select-none"
            onPointerDown={(e) => {
                pointerId.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                move(e);
            }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label="Movement joystick"
            role="application"
        >
            <div
                className="absolute top-1/2 left-1/2 h-14 w-14 rounded-full bg-white/90 shadow-md"
                style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
            />
        </div>
    );
}
