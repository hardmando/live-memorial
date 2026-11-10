import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { createPineTexture, createTreelineTexture, mulberry32 } from "./textures";
import type { PlotBounds } from "./cemetery";

/**
 * Low-res background forest, done the way games of the early 2000s did it:
 * each pine is two crossed, alpha-tested quads, and a painted treeline strip
 * closes off the horizon behind them.
 */
export const createForest = (scene: Scene, { xHalf, zMin, zMax }: PlotBounds) => {
  const zCenter = (zMin + zMax) / 2;
  const zHalf = (zMax - zMin) / 2;
  const pineMat = new StandardMaterial("pineMat", scene);
  const pineTex = createPineTexture(scene);
  pineTex.hasAlpha = true; // alpha test (cutout), not blending
  pineMat.diffuseTexture = pineTex;
  pineMat.specularColor = Color3.Black();
  pineMat.backFaceCulling = false;
  pineMat.twoSidedLighting = true;

  const h = 9;
  const w = 4.5;
  const a = MeshBuilder.CreatePlane("pineA", { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE }, scene);
  a.position.y = h / 2;
  const b = a.clone("pineB");
  b.rotation.y = Math.PI / 2;
  const pine = Mesh.MergeMeshes([a, b], true)!;
  pine.name = "pine";
  pine.material = pineMat;
  pine.isPickable = false;

  const rng = mulberry32(42);
  const matrices: number[] = [];
  const m = new Matrix();
  // Scatter pines in a band around the fenced plot: clear for a few metres outside the
  // fence, then thickening into woods that fade away in the fog.
  const clearing = 6;
  const depth = 50;
  let count = 0;
  for (let tries = 0; tries < 20000 && count < 900; tries++) {
    const x = (rng() * 2 - 1) * (xHalf + clearing + depth);
    const z = zCenter + (rng() * 2 - 1) * (zHalf + clearing + depth);
    // distance outside the plot rectangle
    const out = Math.max(Math.abs(x) - xHalf, Math.abs(z - zCenter) - zHalf);
    if (out < clearing) continue;
    // sparser near the clearing, denser deeper in
    if (rng() > Math.min(1, 0.25 + (out - clearing) / 15)) continue;
    if (Math.abs(x) < 3 && z < zMin) continue; // keep the approach to the gate open
    const s = 0.7 + rng() * 0.8;
    Matrix.ComposeToRef(
      new Vector3(s * (0.85 + rng() * 0.3), s, s * (0.85 + rng() * 0.3)),
      Quaternion.FromEulerAngles(0, rng() * Math.PI, 0),
      new Vector3(x, -0.2, z),
      m,
    );
    m.copyToArray(matrices, count * 16);
    count++;
  }
  pine.thinInstanceSetBuffer("matrix", new Float32Array(matrices), 16, true);

  // Distant painted treeline, wrapped around the whole map.
  const lineTex = createTreelineTexture(scene);
  lineTex.hasAlpha = true;
  lineTex.uScale = 30;
  const lineMat = new StandardMaterial("treelineMat", scene);
  lineMat.diffuseTexture = lineTex;
  lineMat.disableLighting = true;
  lineMat.emissiveColor = new Color3(0.55, 0.6, 0.58);
  lineMat.backFaceCulling = false;
  const treeline = MeshBuilder.CreateCylinder(
    "treeline",
    { diameter: (Math.max(xHalf, zHalf) + 60) * 2, height: 26, tessellation: 48, cap: Mesh.NO_CAP, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  treeline.position.set(0, 12, zCenter);
  treeline.material = lineMat;
  treeline.isPickable = false;
};
