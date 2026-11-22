// tests/propMaterials.test.ts: the 3D props' materials (components/Props3D.tsx makeFlat, makeLit).
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { makeFlat, makeLit } from "@/components/Props3D";

describe("a prop's material", () => {
  // Three.js warns about every setting handed to it as undefined. A flat material was handed its picture, colour
  // and side whether or not it had them: two or three warnings a material, some 60 each time the Den opened and
  // more each time a room's props were made in the Labyrinth (docs/polish-audit-2026-11.md).
  it("is made without a warning, whichever of its picture, colour and side it has", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tex = new THREE.Texture();
    for (const make of [makeFlat, makeLit]) {
      make({ color: "#33271a" });
      make({ map: tex });
      make({ map: tex, side: THREE.DoubleSide });
      make({ color: "#3b4152", flatShading: true });
    }
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([]);
    warn.mockRestore();
  });
  it("keeps what it was given: a flat one its picture, colour and side; a lit one its flat shading too", () => {
    const tex = new THREE.Texture();
    const flat = makeFlat({ map: tex, color: "#ff0000", side: THREE.DoubleSide }) as THREE.MeshBasicMaterial;
    expect(flat).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect([flat.map, flat.color.getHexString(), flat.side]).toEqual([tex, "ff0000", THREE.DoubleSide]);
    const plain = makeFlat({ color: "#00ff00" }) as THREE.MeshBasicMaterial;
    expect([plain.map, plain.color.getHexString(), plain.side]).toEqual([null, "00ff00", THREE.FrontSide]);
    const lit = makeLit({ color: "#0000ff", flatShading: true }) as THREE.MeshLambertMaterial;
    expect(lit).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect([lit.color.getHexString(), lit.flatShading]).toEqual(["0000ff", true]);
  });
});
