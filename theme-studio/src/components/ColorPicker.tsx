import { useCallback, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { hexToHsv, hsvToHex, type Hsv } from '../theme/colorParse';

interface ColorPickerProps {
  /** Initial color — only read on mount. Pass `key={someIdThatChangesPerColorTarget}` from the
   * parent so the picker remounts (and resyncs) when the user selects a different token/scope,
   * without fighting its own in-drag state on every intermediate onChange. */
  value: string;
  onChange: (hex: string) => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'sv' | 'hue' | null>(null);

  const commit = useCallback(
    (next: Hsv) => {
      setHsv(next);
      onChange(hsvToHex(next.h, next.s, next.v));
    },
    [onChange],
  );

  const updateFromSv = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
      commit({ ...hsv, s: x / rect.width, v: 1 - y / rect.height });
    },
    [hsv, commit],
  );

  const updateFromHue = useCallback(
    (clientX: number) => {
      const rect = hueRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      commit({ ...hsv, h: (x / rect.width) * 360 });
    },
    [hsv, commit],
  );

  function onSvDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = 'sv';
    updateFromSv(e.clientX, e.clientY);
  }

  function onHueDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = 'hue';
    updateFromHue(e.clientX);
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (draggingRef.current === 'sv') updateFromSv(e.clientX, e.clientY);
    else if (draggingRef.current === 'hue') updateFromHue(e.clientX);
  }

  function onUp() {
    draggingRef.current = null;
  }

  function onSvKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.1 : 0.02;
    let { s, v } = hsv;
    switch (e.key) {
      case 'ArrowLeft':
        s = clamp01(s - step);
        break;
      case 'ArrowRight':
        s = clamp01(s + step);
        break;
      case 'ArrowUp':
        v = clamp01(v + step);
        break;
      case 'ArrowDown':
        v = clamp01(v - step);
        break;
      default:
        return;
    }
    e.preventDefault();
    commit({ ...hsv, s, v });
  }

  function onHueKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 30 : 5;
    let h = hsv.h;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') h -= step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') h += step;
    else return;
    e.preventDefault();
    h = ((h % 360) + 360) % 360;
    commit({ ...hsv, h });
  }

  const hueColor = `hsl(${hsv.h}, 100%, 50%)`;
  const cursorColor = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <div className="color-picker">
      <div
        ref={svRef}
        className="color-picker-sv"
        style={{ backgroundImage: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
        onPointerDown={onSvDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onKeyDown={onSvKeyDown}
        tabIndex={0}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={cursorColor}
      >
        <div
          className="color-picker-sv-cursor"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: cursorColor }}
        />
      </div>
      <div
        ref={hueRef}
        className="color-picker-hue"
        onPointerDown={onHueDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onKeyDown={onHueKeyDown}
        tabIndex={0}
        role="slider"
        aria-label="Hue"
        aria-valuenow={Math.round(hsv.h)}
        aria-valuemin={0}
        aria-valuemax={360}
      >
        <div className="color-picker-hue-cursor" style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }} />
      </div>
    </div>
  );
}
