import { useEffect, useRef, useState } from 'react';

// Cube orientation that shows each face to the viewer.
const FACE: Record<number, [number, number]> = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACE_CLASS = ['', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6'];

interface Props {
  value: number;
  rollId: number;
  color: string;
  ready: boolean;
  onRoll(): void;
  onSettled?(): void;
}

export function Dice({ value, rollId, color, ready, onRoll, onSettled }: Props) {
  const spins = useRef(0);
  const [rot, setRot] = useState<[number, number]>(FACE[value]);
  const [rolling, setRolling] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    spins.current += 1;
    const [x, y] = FACE[value];
    const k = spins.current * 720;
    setRot([x + k, y + k]);
    setRolling(true);
    const t = setTimeout(() => { setRolling(false); onSettled?.(); }, 750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollId]);

  return (
    <button className={`dice-btn ${ready ? 'ready' : ''} ${rolling ? 'rolling' : ''}`} style={{ ['--dc' as string]: color }}
      onClick={ready ? onRoll : undefined} aria-label={ready ? 'Roll dice' : `Dice shows ${value}`}>
      <div className="dice-stage">
        <div className="cube" style={{ transform: `rotateX(${rot[0]}deg) rotateY(${rot[1]}deg)` }}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className={`face ${FACE_CLASS[n]}`}>
              {Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n].includes(i) ? 'pip' : ''} />)}
            </div>
          ))}
        </div>
      </div>
      {ready && <span className="tap-hint">TAP TO ROLL</span>}
    </button>
  );
}
