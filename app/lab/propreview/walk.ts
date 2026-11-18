// app/lab/propreview/walk.ts — the review lab's walking: the stick's push, a tapped spot, a prop to go to, and who's
// told which prop you're near. A plain shared object the page and the scene both write (outside React's state),
// kept apart from ./ReviewScene.tsx so the page loads without Three.js.

export type Walk = { push: { x: number; y: number } | null; target: { x: number; z: number } | null; jump: number | null; near: (i: number | null) => void };
export const newWalk = (): Walk => ({ push: null, target: null, jump: null, near: () => {} });
export const walkTo = (w: Walk, x: number, z: number) => { w.target = { x, z }; };
export const pushWalk = (w: Walk, p: { x: number; y: number } | null) => { w.push = p; };
export const jumpTo = (w: Walk, i: number) => { w.jump = i; };
export const onNear = (w: Walk, f: (i: number | null) => void) => { w.near = f; };
export type LightMode = "den" | "torch" | "game";
