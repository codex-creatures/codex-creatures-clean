"use client";
// app/lab/models/ModelScene.tsx — 🧪 one of the new Den's 3D things on its own (app/lab/models/page.tsx), drawn by
// the game's own code (components/Den3DPlaces.tsx), on a plain background, under a camera you turn freely
// (three's TrackballControls: any axis, upside down included), plainly lit (white: no torchlight).

import { useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import { Place } from "@/components/Den3DPlaces";
import { PROP_LEAN } from "@/components/Props3D";
import { uprightStretch } from "@/lib/render3d/dungeon3d";
import type { Station } from "@/lib/den3d/layout";

const WHITE = () => new THREE.Color(1, 1, 1);
const STRETCH = uprightStretch(Math.PI / 3); // (the flat pictures stand as tall as in the game, at its 60°)

export default function ModelScene({ s, bg, wire, spin, reset }: { s: Station; bg: string; wire: boolean; spin: boolean; reset: number }) {
  return (
    <Canvas camera={{ position: [0, 2.5, 6], fov: 40, near: 0.05, far: 200 }} style={{ position: "absolute", inset: 0, background: bg, touchAction: "none" }}>
      <Turn s={s} wire={wire} spin={spin} reset={reset} />
    </Canvas>
  );
}

function Turn({ s, wire, spin, reset }: { s: Station; wire: boolean; spin: boolean; reset: number }) {
  const { camera, gl, scene } = useThree();
  const size = Math.max(s.w, s.d, s.tall, 1.5);
  const controls = useMemo(() => {
    const c = new TrackballControls(camera, gl.domElement);
    c.rotateSpeed = 3; c.zoomSpeed = 1.2; c.panSpeed = 0.6;
    return c;
  }, [camera, gl]);
  useEffect(() => () => controls.dispose(), [controls]);
  // Back to a three-quarter view from the front, the whole thing in sight (on a new thing, or Reset).
  useEffect(() => {
    controls.reset();
    controls.target.set(0, s.tall / 2, 0);
    camera.position.set(size * 1.3, s.tall / 2 + size, size * 2.8);
    camera.up.set(0, 1, 0);
    camera.lookAt(controls.target);
  }, [s, size, reset, camera, controls]);
  // Wireframe: every surface as its triangles, to show what's a real shape and what's a flat picture.
  useEffect(() => {
    scene.traverse((o) => { const m = (o as THREE.Mesh).material; for (const x of Array.isArray(m) ? m : m ? [m] : []) if ("wireframe" in x) (x as THREE.MeshBasicMaterial).wireframe = wire; });
  });
  useFrame((_, dt) => {
    PROP_LEAN.uLean.value = 0; // (no lean: the Den leans its things towards the screen's middle)
    if (spin) { const p = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.6); camera.position.copy(controls.target).add(p); camera.lookAt(controls.target); }
    controls.update();
  });
  return (
    <>
      <ambientLight intensity={2} />
      {/* (Drawn about its own middle: the game's places stand where the Den puts them.) */}
      <group position={[-s.x, 0, -s.y]}>
        <Place s={s} tint={WHITE} stretch={STRETCH} repaired trainingPit={false} stoneReady />
      </group>
      <axesHelper args={[0.5]} />
    </>
  );
}
