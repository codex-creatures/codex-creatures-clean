"use client";
// app/lab/propbuilder/Preview.tsx — 🧪 the prop as the game will draw it (components/PropRecipe3D.tsx): the game's
// camera (orthographic, facing north, `pitch` down), its pixel size (48 art pixels a unit at 15 units across,
// drawn that small and scaled up, as components/Den3D.tsx), its lean, on the Den's floor. The prop three times,
// near the left edge, in the middle and near the right edge, so the lean shows its sides as the game will; behind
// each, what the game draws there now, to match it against. For app/lab/propbuilder/page.tsx.

import { useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Place } from "@/components/Den3DPlaces";
import { PROP_LEAN } from "@/components/Props3D";
import { PropRecipe3D } from "@/components/PropRecipe3D";
import { pixelScale } from "@/lib/render3d/stone";
import { uprightStretch } from "@/lib/render3d/dungeon3d";
import { stations, type StationKey } from "@/lib/den3d/layout";
import { DENSITY, type Recipe } from "@/lib/props/recipe";

export const ACROSS = 15;          // units across, as the game starts
export const LEAN = 0.03;          // the rock's lean (decision 36)
export const SPOTS = [-5.5, 0, 5.5]; // where the prop stands: near the left edge, the middle, near the right edge
const BEHIND = -4;                 // (the game's own one, a row back)
const FLOOR = "/sprites/den3d/kit-floor.png";
const DEN_LIGHT = new THREE.Color(1, 0.86, 0.7); // 🧪 roughly the Den's warm light, even everywhere
const PLACES = stations({ opened: true, pit: true, trainingPit: false, repaired: true });

export type PreviewProps = { recipe: Recipe; compare?: StationKey; angle: number; warm: boolean; lean: boolean };

export default function Preview(p: PreviewProps) {
  return (
    <Canvas resize={{ offsetSize: true }} orthographic flat gl={{ antialias: false }}
      style={{ position: "absolute", inset: 0, background: "#000", imageRendering: "pixelated" }}>
      <Scene {...p} />
    </Canvas>
  );
}

function Scene({ recipe, compare, angle, warm, lean }: PreviewProps) {
  const { size, setDpr } = useThree();
  const pitch = (angle * Math.PI) / 180, stretch = uprightStretch(pitch);
  const pix = pixelScale("art", DENSITY, ACROSS, size.width, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);
  const light = warm ? DEN_LIGHT : new THREE.Color(1, 1, 1), tint = () => light.clone();
  const old = compare && PLACES.find((s) => s.key === compare);
  useFrame(({ camera }) => {
    PROP_LEAN.uLean.value = lean ? LEAN : 0; PROP_LEAN.uCx.value = 0;
    if (camera instanceof THREE.OrthographicCamera) {
      const look = new THREE.Vector3(0, 0, BEHIND / 2);
      camera.position.set(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(60).add(look);
      camera.zoom = size.width / pix.across; camera.near = 0.1; camera.far = 200;
      camera.lookAt(look);
      camera.updateProjectionMatrix();
    }
  });
  const floor = useMemo(() => {
    const t = new THREE.TextureLoader().load(FLOOR);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(30, 20);
    return t;
  }, []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><planeGeometry args={[30, 20]} /><meshBasicMaterial map={floor} color={light} /></mesh>
      {SPOTS.map((x) => <PropRecipe3D key={x} recipe={recipe} at={[x, 0, 0]} pitch={pitch} stretch={stretch} tint={tint} />)}
      {old && SPOTS.map((x) => (
        <group key={`old${x}`} position={[x - old.x, 0, BEHIND - old.y]}>
          <Place s={old} tint={tint} stretch={stretch} repaired trainingPit={false} stoneReady={false} />
        </group>
      ))}
    </>
  );
}
