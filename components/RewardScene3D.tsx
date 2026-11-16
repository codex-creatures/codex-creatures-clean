"use client";
// components/RewardScene3D.tsx: the campaign's crate, barrel or bookcase on a patch of the dungeon's
// floor, under the game's camera (orthographic, 60° down) and a warm torch, for the reward reveal
// (components/RewardReveal.tsx). Opened, a crate's lid swings up on what's inside; a barrel or bookcase
// gives a little hop. Three.js is loaded with this file only (the reveal imports it dynamically).

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { uprightStretch } from "@/lib/render3d/dungeon3d";
import { WALK_KIT } from "@/lib/sprites/walk";
import { Prop3D, Crate, Barrel, loaded, PROP_LEAN } from "@/components/Props3D";
import type { RewardModel } from "@/lib/campaign";

const PITCH = Math.PI / 3;
const ACROSS = 3.2;   // units across the view: the reward fills about half of it
const HOP = 0.12;     // how high a barrel or bookcase hops when it's opened (units)

function Scene({ model, open }: { model: RewardModel; open: boolean }) {
  const { size } = useThree();
  const floor = useMemo(() => { const t = loaded(WALK_KIT.floor, true); t.repeat.set(5, 4); return t; }, []);
  const torch = useRef<THREE.PointLight>(null);
  const prop = useRef<THREE.Group>(null);
  const opened = useRef<number | null>(null);
  useEffect(() => { if (open && opened.current === null) opened.current = performance.now(); }, [open]);
  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera, target = new THREE.Vector3(0, model === "bookcase" ? 0.6 : 0.35, 0); // (the bookcase is tall)
    PROP_LEAN.uLean.value = 0;
    camera.position.copy(target).addScaledVector(new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)), 40);
    camera.zoom = size.width / ACROSS; camera.near = 0.1; camera.far = 100;
    camera.lookAt(target); camera.updateProjectionMatrix();
    const t = state.clock.elapsedTime;
    if (torch.current) torch.current.intensity = 7 * (0.92 + 0.05 * Math.sin(t * 9) + 0.03 * Math.sin(t * 23)); // (it flickers)
    // The hop: up and back down over a third of a second.
    if (prop.current && model !== "crate-materials" && model !== "crate-supplies" && opened.current !== null) {
      const k = Math.min(1, (performance.now() - opened.current) / 330);
      prop.current.position.y = Math.sin(k * Math.PI) * HOP;
    }
  });
  return (
    <>
      <ambientLight color="#9aa6c8" intensity={0.5} />
      <pointLight ref={torch} position={[-0.9, 1.6, 1.2]} color="#ffc68a" intensity={7} distance={0} decay={1.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5, 4]} />
        <meshLambertMaterial map={floor} />
      </mesh>
      <group ref={prop}>
        {model === "barrel" ? <Barrel stretch={uprightStretch(PITCH)} />
          : model === "bookcase" ? <Prop3D kind="bookcase" />
          : <Crate inside={model === "crate-materials" ? "materials" : "supplies"} open={open} outline edges />}
      </group>
    </>
  );
}

export default function RewardScene3D({ model, open }: { model: RewardModel; open: boolean }) {
  return (
    <Canvas orthographic flat gl={{ antialias: false }} style={{ imageRendering: "pixelated", background: "#0e0f0c" }}>
      <Scene model={model} open={open} />
    </Canvas>
  );
}
