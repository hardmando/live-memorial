import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { createPineTexture, createTreelineTexture, mulberry32 } from "./textures";

/**
 * Low-res background forest, done the way games of the early 2000s did it:
 * each pine is two crossed, alpha-tested quads, and a painted treeline strip
 * closes off the horizon behind them.
 */
export const createForest = (scene: Scene, clearRadius: number) => {
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
  const count = 650;
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    // denser further out; a few stragglers close to the fence
    const r = clearRadius + Math.pow(rng(), 0.7) * 55;
    const s = 0.7 + rng() * 0.8;
    Matrix.ComposeToRef(
      new Vector3(s * (0.85 + rng() * 0.3), s, s * (0.85 + rng() * 0.3)),
      Quaternion.FromEulerAngles(0, rng() * Math.PI, 0),
      new Vector3(Math.cos(angle) * r, -0.2, Math.sin(angle) * r),
      m,
    );
    m.copyToArray(matrices, i * 16);
  }
  pine.thinInstanceSetBuffer("matrix", new Float32Array(matrices), 16, true);

  // Distant painted treeline, wrapped around the whole map.
  const lineTex = createTreelineTexture(scene);
  lineTex.hasAlpha = true;
  lineTex.uScale = 14;
  const lineMat = new StandardMaterial("treelineMat", scene);
  lineMat.diffuseTexture = lineTex;
  lineMat.disableLighting = true;
  lineMat.emissiveColor = new Color3(0.55, 0.6, 0.58);
  lineMat.backFaceCulling = false;
  const treeline = MeshBuilder.CreateCylinder(
    "treeline",
    { diameter: 190, height: 26, tessellation: 48, cap: Mesh.NO_CAP, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  treeline.position.y = 12;
  treeline.material = lineMat;
  treeline.isPickable = false;
};
