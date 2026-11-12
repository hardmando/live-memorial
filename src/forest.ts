import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { mulberry32 } from "./random";

export interface PlotBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// Deliberately tiny, bilinear-filtered textures: the soft, chunky look of a PS2-era game.
function paintTexture(
  scene: Scene,
  name: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const tex = new DynamicTexture(name, { width, height }, scene, true, Texture.BILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE; // DynamicTexture defaults to clamp
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, width, height);
  draw(ctx, width, height);
  tex.update(true);
  tex.hasAlpha = true; // alpha-tested cutout, not blended
  return tex;
}

function createPineTexture(scene: Scene) {
  return paintTexture(scene, "pineTex", 64, 128, (ctx, w, h) => {
    const rng = mulberry32(3);
    ctx.fillStyle = "rgb(45,32,22)";
    ctx.fillRect(w / 2 - 3, h - 22, 6, 22);
    // Layered jagged tiers, darkest at the bottom
    for (let t = 0; t < 6; t++) {
      const top = 4 + t * 16;
      const bottom = top + 34;
      const half = 8 + t * 4.4;
      const g = 38 + t * 3 + rng() * 8;
      ctx.fillStyle = `rgb(${g * 0.45},${g},${g * 0.6})`;
      ctx.beginPath();
      ctx.moveTo(w / 2, top);
      const steps = 7;
      for (let s = 0; s <= steps; s++) {
        const x = w / 2 + half - (s / steps) * half * 2;
        const y = bottom - (s % 2 === 0 ? 0 : 4 + rng() * 4);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      // A few lighter needles for texture
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(90,120,80,${0.25 + rng() * 0.3})`;
        const yy = top + 8 + rng() * 22;
        const spread = ((yy - top) / 34) * half;
        ctx.fillRect(w / 2 + (rng() - 0.5) * spread * 1.6, yy, 1, 2);
      }
    }
  });
}

/**
 * Pine forest surrounding the cemetery, done the way early-2000s games did it: each pine is
 * two crossed, alpha-tested quads, all drawn as thin instances in one call, thickening with
 * distance until the fog swallows them.
 */
export function createForest(scene: Scene, { minX, maxX, minZ, maxZ }: PlotBounds) {
  const xCenter = (minX + maxX) / 2;
  const zCenter = (minZ + maxZ) / 2;
  const xHalf = (maxX - minX) / 2;
  const zHalf = (maxZ - minZ) / 2;

  const pineMat = new StandardMaterial("pine", scene);
  pineMat.diffuseTexture = createPineTexture(scene);
  pineMat.specularColor = Color3.Black();
  pineMat.backFaceCulling = false;
  pineMat.twoSidedLighting = true;

  const h = 9;
  const w = 4.5;
  const a = CreatePlane("pineA", { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE }, scene);
  a.position.y = h / 2;
  const b = a.clone("pineB");
  b.rotation.y = Math.PI / 2;
  const pine = Mesh.MergeMeshes([a, b], true)!;
  pine.material = pineMat;
  pine.isPickable = false;

  // Scatter pines in a band around the fence: clear for a few metres outside it,
  // then thickening into woods that fade away in the fog.
  const rng = mulberry32(42);
  const matrices: Matrix[] = [];
  const clearing = 6;
  const depth = 50;
  for (let tries = 0; tries < 20000 && matrices.length < 900; tries++) {
    const x = xCenter + (rng() * 2 - 1) * (xHalf + clearing + depth);
    const z = zCenter + (rng() * 2 - 1) * (zHalf + clearing + depth);
    // Distance outside the fenced rectangle
    const out = Math.max(Math.abs(x - xCenter) - xHalf, Math.abs(z - zCenter) - zHalf);
    if (out < clearing) continue;
    // Sparser near the clearing, denser deeper in
    if (rng() > Math.min(1, 0.25 + (out - clearing) / 15)) continue;
    if (Math.abs(x - xCenter) < 3 && z < minZ) continue; // keep the approach to the gate open
    const s = 0.7 + rng() * 0.8;
    matrices.push(
      Matrix.Compose(
        new Vector3(s * (0.85 + rng() * 0.3), s, s * (0.85 + rng() * 0.3)),
        Quaternion.FromEulerAngles(0, rng() * Math.PI, 0),
        new Vector3(x, -0.2, z),
      ),
    );
  }
  pine.thinInstanceAdd(matrices);
  pine.thinInstanceRefreshBoundingInfo();
  pine.freezeWorldMatrix();
}
