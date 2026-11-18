"use client";
// app/lab/propbuilder/PalettePass.tsx — 🧪 the prop builder preview's "Palette" check (./Preview.tsx): the scene drawn
// into a picture the canvas's size, then every pixel snapped to the nearest colour of a palette (lib/props/palette.ts),
// so a texture or tint that's off the palette shows. Takes over the canvas's drawing while it's on (a useFrame of
// priority 1). The picture's colours are linear (a render target's): compared in sRGB, weighted for brightness (as
// the AI-model trial's pass, 2026-11-19).

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { palette, MAX_PALETTE, type PaletteKey } from "@/lib/props/palette";

const VERTEX = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const FRAGMENT = `
  #define MAX_PAL ${MAX_PALETTE}
  uniform sampler2D tColor; uniform vec3 pal[MAX_PAL]; uniform int palCount;
  varying vec2 vUv;
  vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
  void main(){
    vec3 col = toSRGB(texture2D(tColor, vUv).rgb);
    float best = 1e9; vec3 pick = col;
    for (int i = 0; i < MAX_PAL; i++) {
      if (i >= palCount) break;
      vec3 d = (col - pal[i]) * vec3(.30, .59, .11) * 3.;
      float e = dot(d, d) + .25 * dot(col - pal[i], col - pal[i]);
      if (e < best) { best = e; pick = pal[i]; }
    }
    gl_FragColor = vec4(pick, 1.); // (straight to the screen, which takes sRGB: a ShaderMaterial gets no conversion)
  }`;

type Kit = { target: THREE.WebGLRenderTarget; mat: THREE.ShaderMaterial; quad: THREE.Scene; cam: THREE.OrthographicCamera };
function makeKit(): Kit {
  const mat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: null }, palCount: { value: 0 }, pal: { value: Array.from({ length: MAX_PALETTE }, () => new THREE.Vector3()) } },
    vertexShader: VERTEX, fragmentShader: FRAGMENT, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Scene();
  quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  return { target, mat, quad, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
}

export default function PalettePass({ pal }: { pal: PaletteKey }) {
  const { gl } = useThree();
  const kit = useRef<Kit | null>(null);
  if (kit.current === null) kit.current = makeKit();
  useEffect(() => {
    const u = kit.current!.mat.uniforms, cs = palette(pal);
    u.palCount.value = cs.length;
    // (sRGB as written: THREE.Color would turn it linear.)
    cs.forEach((c, i) => (u.pal.value as THREE.Vector3[])[i].set(...([1, 3, 5].map((j) => parseInt(c.slice(j, j + 2), 16) / 255) as [number, number, number])));
  }, [pal]);
  useEffect(() => () => { kit.current!.target.dispose(); kit.current!.mat.dispose(); }, []);
  useFrame(({ scene, camera }) => {
    const k = kit.current!, size = gl.getDrawingBufferSize(new THREE.Vector2());
    if (k.target.width !== size.x || k.target.height !== size.y) k.target.setSize(size.x, size.y);
    k.mat.uniforms.tColor.value = k.target.texture;
    gl.setRenderTarget(k.target); gl.render(scene, camera);
    gl.setRenderTarget(null); gl.render(k.quad, k.cam);
  }, 1);
  return null;
}
