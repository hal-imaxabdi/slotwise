import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { CanvasTexture, MathUtils, SRGBColorSpace } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { BOARD, CLAIM_INDEX, NEXT_INDEX } from './slotBoard.ts';

const COLS = 3;
const CARD_W = 1.62;
const CARD_H = 1.02;
const GAP_X = 1.84;
const GAP_Y = 1.2;
const TEX_W = 512;
const TEX_H = 322;

const T_CLAIM = 1.9;
const T_RIVAL = 2.6;
const T_HIT = 3.25;
const T_NEXT = 3.7;
const T_IDLE = 4.6;

type Face = 'open' | 'booked' | 'next' | 'rival' | 'taken';

/** Deterministic noise so the torn edges are the same on every visit. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function tornPath(ctx: CanvasRenderingContext2D, seed: number) {
  const r = rng(seed);
  const pad = 10;
  const step = 9;
  const jag = () => (r() - 0.5) * 9;
  ctx.beginPath();
  ctx.moveTo(pad, pad + jag());
  for (let x = pad; x <= TEX_W - pad; x += step) ctx.lineTo(x, pad + jag());
  for (let y = pad; y <= TEX_H - pad; y += step) ctx.lineTo(TEX_W - pad + jag(), y);
  for (let x = TEX_W - pad; x >= pad; x -= step) ctx.lineTo(x, TEX_H - pad + jag());
  for (let y = TEX_H - pad; y >= pad; y -= step) ctx.lineTo(pad + jag(), y);
  ctx.closePath();
}

function halftone(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  for (let y = 0; y < TEX_H; y += 9) {
    for (let x = (y / 9) % 2 === 0 ? 0 : 4.5; x < TEX_W; x += 9) {
      const radius = 1.4 * (1 - y / TEX_H);
      if (radius > 0.2) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function makeFace(time: string, face: Face, seed: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;
  const light = face === 'booked';
  tornPath(ctx, seed);
  ctx.fillStyle = light ? '#ffffff' : '#0b0b0b';
  ctx.fill();
  ctx.save();
  tornPath(ctx, seed);
  ctx.clip();
  halftone(ctx, light ? 'rgba(11,11,11,0.16)' : 'rgba(255,255,255,0.08)');
  ctx.restore();

  ctx.fillStyle = light ? '#0b0b0b' : '#ffffff';
  ctx.font = 'italic 800 150px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(time, 40, 190);

  const label = { open: 'OPEN', booked: 'BOOKED', next: 'NEXT FREE', rival: 'SECOND CLIENT', taken: '' }[face];
  ctx.font = 'italic 700 46px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.fillStyle = face === 'open' || face === 'rival' ? 'rgba(255,255,255,0.62)' : '#e3140f';
  ctx.fillText(label, 44, 262);

  if (face === 'taken') {
    ctx.save();
    ctx.translate(TEX_W / 2, TEX_H / 2 + 10);
    ctx.rotate(-0.16);
    ctx.strokeStyle = '#e3140f';
    ctx.lineWidth = 12;
    ctx.strokeRect(-200, -70, 400, 140);
    ctx.fillStyle = '#e3140f';
    ctx.font = 'italic 800 120px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAKEN', 0, 42);
    ctx.restore();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

interface Sequence {
  start: number;
  target: number;
  booked: Set<number>;
  next: number;
}

function gridPosition(index: number): [number, number] {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return [(col - 1) * GAP_X, (1.5 - row) * GAP_Y];
}

function firstFreeAfter(booked: Set<number>, from: number): number {
  for (let i = from + 1; i < BOARD.length; i += 1) {
    if (!booked.has(i)) return i;
  }
  return -1;
}

function Card({ index, seq, clock }: { index: number; seq: RefObject<Sequence>; clock: RefObject<number> }) {
  const group = useRef<Group>(null);
  const back = useRef<MeshBasicMaterial>(null);
  const front = useRef<MeshBasicMaterial>(null);
  const slot = BOARD[index];
  const faces = useMemo(
    () => ({
      open: makeFace(slot.time, 'open', index * 97 + 11),
      next: makeFace(slot.time, 'next', index * 97 + 11),
      booked: makeFace(slot.time, 'booked', index * 97 + 53),
    }),
    [slot.time, index],
  );
  useEffect(() => () => Object.values(faces).forEach((t) => t.dispose()), [faces]);

  const spawn = useMemo(() => {
    const r = rng(index * 31 + 7);
    return { x: (r() - 0.2) * 14, y: (r() - 0.5) * 10, z: 6 + r() * 6, rz: (r() - 0.5) * 2.4, tilt: (r() - 0.5) * 0.14 };
  }, [index]);
  const [gx, gy] = gridPosition(index);

  useFrame((_, delta) => {
    const g = group.current;
    const s = seq.current;
    if (g === null) return;
    const t = clock.current - s.start;
    const intro = clock.current - index * 0.06;
    const arrived = intro > 0;
    const lambda = 6;
    g.position.x = MathUtils.damp(g.position.x, arrived ? gx : spawn.x, lambda, delta);
    g.position.y = MathUtils.damp(g.position.y, arrived ? gy : spawn.y, lambda, delta);
    g.position.z = MathUtils.damp(g.position.z, arrived ? 0 : spawn.z, lambda, delta);
    g.rotation.z = MathUtils.damp(g.rotation.z, arrived ? spawn.tilt : spawn.rz, lambda, delta);

    const claimed = s.booked.has(index) && (index !== s.target || t > T_CLAIM);
    g.rotation.y = MathUtils.damp(g.rotation.y, claimed ? Math.PI : 0, 7, delta);
    const isNext = index === s.next && t > T_NEXT;
    const pop = isNext && t < T_NEXT + 0.35 ? 1.1 : 1;
    const scale = MathUtils.damp(g.scale.x, pop, 10, delta);
    g.scale.set(scale, scale, 1);
    if (front.current !== null) {
      const map = isNext ? faces.next : faces.open;
      if (front.current.map !== map) {
        front.current.map = map;
        front.current.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={group} position={[spawn.x, spawn.y, spawn.z]} userData={{ index }}>
      <mesh>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial ref={front} map={faces.open} transparent alphaTest={0.5} />
      </mesh>
      <mesh rotation-y={Math.PI}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial ref={back} map={faces.booked} transparent alphaTest={0.5} />
      </mesh>
    </group>
  );
}

function rivalFaces(target: number) {
  const time = BOARD[target].time;
  return { target, rival: makeFace(time, 'rival', 4242), taken: makeFace(time, 'taken', 4242) };
}

function Rival({ seq, clock }: { seq: RefObject<Sequence>; clock: RefObject<number> }) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const [initial] = useState(() => rivalFaces(CLAIM_INDEX));
  const facesRef = useRef<ReturnType<typeof rivalFaces>>(initial);
  useEffect(
    () => () => {
      facesRef.current.rival.dispose();
      facesRef.current.taken.dispose();
    },
    [],
  );

  useFrame((_, delta) => {
    const m = mesh.current;
    const s = seq.current;
    if (m === null || material.current === null) return;
    if (facesRef.current.target !== s.target) {
      facesRef.current.rival.dispose();
      facesRef.current.taken.dispose();
      facesRef.current = rivalFaces(s.target);
    }
    const faces = facesRef.current;
    const t = clock.current - s.start;
    const [tx, ty] = gridPosition(s.target);
    let x = 7.5;
    let y = ty + 2.5;
    let z = 1.2;
    let rz = 0.5;
    let sy = 1;
    const hit = t > T_HIT;
    if (t > T_RIVAL && !hit) {
      x = tx;
      y = ty;
      z = 0.55;
      rz = -0.08;
    } else if (hit) {
      x = 1.75;
      y = -2.2;
      z = 1.1;
      rz = -0.5;
      sy = 0.42;
    }
    const lambda = hit ? 9 : 5;
    m.position.x = MathUtils.damp(m.position.x, x, lambda, delta);
    m.position.y = MathUtils.damp(m.position.y, y, lambda, delta);
    m.position.z = MathUtils.damp(m.position.z, z, lambda, delta);
    m.rotation.z = MathUtils.damp(m.rotation.z, rz, lambda, delta);
    m.scale.y = MathUtils.damp(m.scale.y, sy, 12, delta);
    m.visible = t > T_RIVAL - 0.6;
    const map = hit ? faces.taken : faces.rival;
    if (material.current.map !== map) {
      material.current.map = map;
      material.current.needsUpdate = true;
    }
  });

  return (
    <mesh ref={mesh} position={[7.5, 3, 1.2]} visible={false}>
      <planeGeometry args={[CARD_W, CARD_H]} />
      <meshBasicMaterial ref={material} map={initial.rival} transparent alphaTest={0.5} />
    </mesh>
  );
}

function Wall() {
  const root = useRef<Group>(null);
  const clock = useRef(0);
  const seq = useRef<Sequence>({
    start: 0,
    target: CLAIM_INDEX,
    booked: new Set([...BOARD.flatMap((slot, i) => (slot.booked ? [i] : [])), CLAIM_INDEX]),
    next: NEXT_INDEX,
  });

  useFrame((state, delta) => {
    clock.current += Math.min(delta, 0.05);
    const g = root.current;
    if (g === null) return;
    g.rotation.x = MathUtils.damp(g.rotation.x, -0.16 - state.pointer.y * 0.12, 3, delta);
    g.rotation.y = MathUtils.damp(g.rotation.y, -0.34 + state.pointer.x * 0.18, 3, delta);
  });

  function claim(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    const s = seq.current;
    if (clock.current - s.start < T_IDLE) return;
    let node: typeof event.object | null = event.object;
    while (node !== null && node.userData.index === undefined) node = node.parent;
    const index = node?.userData.index as number | undefined;
    if (index === undefined || s.booked.has(index)) return;
    s.booked.add(index);
    s.target = index;
    s.next = firstFreeAfter(s.booked, index);
    s.start = clock.current;
  }

  return (
    <group ref={root} position={[0.25, 0, 0]} onClick={claim}>
      {BOARD.map((slot, index) => (
        <Card key={slot.time} index={index} seq={seq} clock={clock} />
      ))}
      <Rival seq={seq} clock={clock} />
    </group>
  );
}

/** The hero's slot wall. Mounted only when WebGL, motion and power allow it. */
export default function SlotWall3D({ active }: { active: boolean }) {
  return (
    <Canvas
      className="slotwall__canvas"
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 9.2], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onPointerMissed={() => undefined}
    >
      <Wall />
    </Canvas>
  );
}
