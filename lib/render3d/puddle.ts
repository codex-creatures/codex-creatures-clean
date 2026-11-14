// lib/render3d/puddle.ts — a puddle's water in 3D (the user, 2026-11-13, first in /lab/chest's Floor
// life; in the game's walkable dungeons since 2026-11-14, components/WalkView3D.tsx FloorLife).
// The game lights nothing with Three's lights in Stone mode, so a shiny material shows nothing: the
// reflection is drawn by hand, as a layer added over the puddle's picture. A soft glint of the light's
// colour where a mirror on the floor would show it (the light's spot, nearer you by its height ÷
// tan(pitch)), shimmering a little, and a faint sheen as it comes near. Only on the water: pixels
// bluer than they're red or green. Ripples (when you walk in it): RIPPLE.rings rings spreading from
// where you stepped, RIPPLE.speed u a second, fading out over RIPPLE.life seconds, lighter on the
// water (and bending the glint).

export const GLINT = { radius: 0.4, strength: 1.2, sheen: 0.3, sheenReach: 1.6 };
// `every`: seconds between the small ripples that come on their own (a drip), `step`: between a walker's.
export const RIPPLE = { speed: 0.55, life: 1.6, width: 0.09, rings: 3, gap: 0.16, light: 0.8, every: 3.5, step: 0.45 };

// Uniforms: map, the puddle's picture; uLight, the light (x, y up, z); uColour; uTime; uTan, tan(pitch);
// uStep, the last step (x, z, when).
export const GLINT_VERT = `varying vec2 vUv; varying vec3 vWorld;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
export const GLINT_FRAG = `uniform sampler2D map; uniform vec3 uLight; uniform vec3 uColour; uniform float uTime; uniform float uTan;
uniform float uRadius; uniform float uStrength; uniform float uSheen; uniform float uReach;
uniform vec3 uStep; uniform float uSpeed; uniform float uLife; uniform float uWidth; uniform float uGap; uniform float uLit;
varying vec2 vUv; varying vec3 vWorld;
void main() {
  vec4 c = texture2D(map, vUv);
  float water = smoothstep(0.02, 0.09, c.b - max(c.r, c.g)) * step(0.5, c.a);
  // Rings from the last step: each a thin band moving out, fading as it goes.
  float age = uTime - uStep.z, rings = 0.0;
  if (age >= 0.0 && age < uLife) {
    float from = distance(vWorld.xz, uStep.xy);
    for (int i = 0; i < ${RIPPLE.rings}; i++) {
      float r = age * uSpeed - float(i) * uGap;
      if (r > 0.0) rings += exp(-pow((from - r) / uWidth, 2.0)) * (1.0 - age / uLife);
    }
  }
  vec2 mirror = vec2(uLight.x, uLight.z + uLight.y / uTan);
  float d = distance(vWorld.xz, mirror) - rings * 0.06;
  float shimmer = 0.75 + 0.25 * sin(vWorld.x * 23.0 + uTime * 2.7) * sin(vWorld.z * 19.0 - uTime * 2.1);
  float glint = exp(-d * d / (uRadius * uRadius)) * uStrength * shimmer;
  float near = distance(vWorld.xz, uLight.xz);
  float sheen = uSheen * exp(-near * near / (uReach * uReach));
  gl_FragColor = vec4(uColour * (glint + sheen + rings * uLit) * water, 1.0);
}`;
// The uniforms' starting values (Three's ShaderMaterial wants { value } boxes: the caller wraps them).
export const glintNumbers = (pitch: number) => ({
  uTan: Math.tan(pitch), uRadius: GLINT.radius, uStrength: GLINT.strength, uSheen: GLINT.sheen, uReach: GLINT.sheenReach,
  uSpeed: RIPPLE.speed, uLife: RIPPLE.life, uWidth: RIPPLE.width, uGap: RIPPLE.gap, uLit: RIPPLE.light,
});

// The rat's run (the lab's): along the wall's foot from where it starts to its hole at RAT_SPEED u a
// second, a moment going in (RAT_DIVE), then RAT_HIDE seconds out of sight, and round again. Where it
// is `t` seconds into its loop, given how far it runs: x along the run (0 at the start, `run` at the
// hole), `into` how far into the hole it's gone (0–1), or null while it hides.
export const RAT_SPEED = 1.9, RAT_DIVE = 0.3, RAT_HIDE = 6; // 🧪
export const ratLoop = (run: number) => run / RAT_SPEED + RAT_DIVE + RAT_HIDE;
export function ratAt(t: number, run: number): { along: number; into: number } | null {
  const time = run / RAT_SPEED, at = ((t % ratLoop(run)) + ratLoop(run)) % ratLoop(run);
  if (at < time) return { along: at * RAT_SPEED, into: 0 };
  if (at < time + RAT_DIVE) return { along: run, into: (at - time) / RAT_DIVE };
  return null;
}
