import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { createDirtTexture, createFenceTexture, createStoneTexture, mulberry32 } from "./textures";
import grassUrl from "../textures/grassTexture.jpg";

/** Half the side length of the fenced cemetery plot. */
export const PLOT_HALF = 26;

const merge = (name: string, parts: Mesh[], mat: StandardMaterial) => {
  const mesh = Mesh.MergeMeshes(parts, true)!;
  mesh.name = name;
  mesh.material = mat;
  mesh.isVisible = false; // template only; the world uses instances
  return mesh;
};

export const createCemetery = (scene: Scene) => {
  const rng = mulberry32(1337);

  // ---------- materials ----------
  const grassMat = new StandardMaterial("grassMat", scene);
  const grassTex = new Texture(grassUrl, scene);
  grassTex.uScale = grassTex.vScale = 90;
  grassMat.diffuseTexture = grassTex;
  grassMat.diffuseColor = new Color3(0.4, 0.42, 0.3); // dead, desaturated grass
  grassMat.specularColor = Color3.Black();

  const stoneMat = new StandardMaterial("stoneMat", scene);
  stoneMat.diffuseTexture = createStoneTexture(scene);
  stoneMat.specularColor = new Color3(0.05, 0.05, 0.05);

  const darkStoneMat = new StandardMaterial("darkStoneMat", scene);
  darkStoneMat.diffuseTexture = stoneMat.diffuseTexture;
  darkStoneMat.diffuseColor = new Color3(0.62, 0.62, 0.6);
  darkStoneMat.specularColor = Color3.Black();

  const dirtTex = createDirtTexture(scene);
  const dirtMat = new StandardMaterial("dirtMat", scene);
  dirtMat.diffuseTexture = dirtTex;
  dirtMat.specularColor = Color3.Black();
  dirtMat.zOffset = -2;

  const ironMat = new StandardMaterial("ironMat", scene);
  ironMat.diffuseColor = new Color3(0.09, 0.09, 0.1);
  ironMat.specularColor = new Color3(0.1, 0.1, 0.1);

  const barkMat = new StandardMaterial("barkMat", scene);
  barkMat.diffuseColor = new Color3(0.17, 0.14, 0.11);
  barkMat.specularColor = Color3.Black();

  // ---------- ground and paths ----------
  const ground = MeshBuilder.CreateGround("ground", { width: 320, height: 320 }, scene);
  ground.material = grassMat;
  ground.checkCollisions = true;

  const pathTex = createDirtTexture(scene);
  pathTex.vScale = 22;
  const pathMat = dirtMat.clone("pathMat");
  pathMat.diffuseTexture = pathTex;
  const mainPath = MeshBuilder.CreateGround("mainPath", { width: 3, height: PLOT_HALF * 2 + 14 }, scene);
  mainPath.position.set(0, 0.04, -7);
  mainPath.material = pathMat;
  const crossTex = createDirtTexture(scene);
  crossTex.uScale = 18;
  const crossMat = dirtMat.clone("crossPathMat");
  crossMat.diffuseTexture = crossTex;
  const crossPath = MeshBuilder.CreateGround("crossPath", { width: PLOT_HALF * 2 - 2, height: 2.4 }, scene);
  crossPath.position.set(0, 0.045, 0);
  crossPath.material = crossMat;

  // ---------- gravestone templates ----------
  const headstone = (() => {
    const body = MeshBuilder.CreateBox("hsBody", { width: 0.7, height: 0.75, depth: 0.16 }, scene);
    body.position.y = 0.375;
    const top = MeshBuilder.CreateCylinder("hsTop", { diameter: 0.7, height: 0.16, tessellation: 14 }, scene);
    top.rotation.x = Math.PI / 2;
    top.position.y = 0.75;
    return merge("headstone", [body, top], stoneMat);
  })();

  const cross = (() => {
    const v = MeshBuilder.CreateBox("crV", { width: 0.14, height: 1.15, depth: 0.12 }, scene);
    v.position.y = 0.575;
    const h = MeshBuilder.CreateBox("crH", { width: 0.6, height: 0.14, depth: 0.12 }, scene);
    h.position.y = 0.82;
    const base = MeshBuilder.CreateBox("crB", { width: 0.4, height: 0.15, depth: 0.3 }, scene);
    base.position.y = 0.075;
    return merge("cross", [v, h, base], stoneMat);
  })();

  const obelisk = (() => {
    const base = MeshBuilder.CreateBox("obB", { width: 0.65, height: 0.3, depth: 0.65 }, scene);
    base.position.y = 0.15;
    const shaft = MeshBuilder.CreateCylinder(
      "obS",
      { diameterTop: 0.3, diameterBottom: 0.45, height: 1.5, tessellation: 4 },
      scene,
    );
    shaft.rotation.y = Math.PI / 4;
    shaft.position.y = 1.05;
    const tip = MeshBuilder.CreateCylinder(
      "obT",
      { diameterTop: 0, diameterBottom: 0.3, height: 0.3, tessellation: 4 },
      scene,
    );
    tip.rotation.y = Math.PI / 4;
    tip.position.y = 1.95;
    return merge("obelisk", [base, shaft, tip], darkStoneMat);
  })();

  const tablet = (() => {
    const slab = MeshBuilder.CreateBox("tbS", { width: 0.85, height: 0.55, depth: 0.2 }, scene);
    slab.position.y = 0.275;
    return merge("tablet", [slab], darkStoneMat);
  })();

  const mound = MeshBuilder.CreateSphere("mound", { diameterX: 0.9, diameterY: 0.3, diameterZ: 1.9, segments: 6 }, scene);
  mound.material = dirtMat;
  mound.isVisible = false;

  const templates: [Mesh, number][] = [
    [headstone, 0.45],
    [cross, 0.2],
    [tablet, 0.25],
    [obelisk, 0.1],
  ];
  const pickTemplate = () => {
    let r = rng();
    for (const [mesh, w] of templates) {
      if ((r -= w) <= 0) return mesh;
    }
    return headstone;
  };

  // ---------- grave rows ----------
  let n = 0;
  for (let z = -PLOT_HALF + 4; z < PLOT_HALF - 3; z += 3.4) {
    for (let x = -PLOT_HALF + 2.5; x < PLOT_HALF - 2; x += 2.3) {
      if (Math.abs(x) < 2.6) continue; // main path
      if (Math.abs(z) < 2.2) continue; // cross path
      if (Math.abs(x) < 6 && z > PLOT_HALF - 13) continue; // mausoleum yard
      if (rng() < 0.22) continue; // gaps in the rows

      const px = x + (rng() - 0.5) * 0.5;
      const pz = z + (rng() - 0.5) * 0.4;
      const stone = pickTemplate().createInstance(`grave${n++}`);
      stone.position.set(px, -0.05 - rng() * 0.08, pz);
      // old graves lean and sink
      stone.rotation.set((rng() - 0.5) * 0.18, (rng() - 0.5) * 0.25, (rng() - 0.5) * 0.2);
      const s = 0.85 + rng() * 0.35;
      stone.scaling.setAll(s);
      stone.checkCollisions = true;

      if (rng() < 0.55) {
        const m = mound.createInstance(`mound${n}`);
        m.position.set(px, -0.02, pz - 1.1);
        m.rotation.y = stone.rotation.y;
      }
    }
  }

  // ---------- wrought-iron fence ----------
  const fenceTex = createFenceTexture(scene);
  fenceTex.hasAlpha = true;
  const fenceMat = new StandardMaterial("fenceMat", scene);
  fenceMat.diffuseTexture = fenceTex;
  fenceMat.specularColor = Color3.Black();
  fenceMat.backFaceCulling = false;

  const panelsPerSide = 22;
  const panelW = (PLOT_HALF * 2) / panelsPerSide;
  const panel = MeshBuilder.CreatePlane("fencePanel", { width: panelW, height: 1.8, sideOrientation: Mesh.DOUBLESIDE }, scene);
  panel.material = fenceMat;
  panel.isVisible = false;
  const post = MeshBuilder.CreateBox("fencePost", { width: 0.12, height: 2, depth: 0.12 }, scene);
  post.material = ironMat;
  post.isVisible = false;

  const sides = [
    { dir: [1, 0], origin: [-PLOT_HALF, -PLOT_HALF], rotY: 0, isFront: true },
    { dir: [1, 0], origin: [-PLOT_HALF, PLOT_HALF], rotY: 0, isFront: false },
    { dir: [0, 1], origin: [-PLOT_HALF, -PLOT_HALF], rotY: Math.PI / 2, isFront: false },
    { dir: [0, 1], origin: [PLOT_HALF, -PLOT_HALF], rotY: Math.PI / 2, isFront: false },
  ];
  for (const side of sides) {
    for (let i = 0; i < panelsPerSide; i++) {
      const d = panelW * (i + 0.5);
      const cx = side.origin[0] + side.dir[0] * d;
      const cz = side.origin[1] + side.dir[1] * d;
      if (side.isFront && Math.abs(cx) < 2.5) continue; // gate opening
      const p = panel.createInstance(`fence${n++}`);
      p.position.set(cx, 0.9, cz);
      p.rotation.y = side.rotY;
      p.checkCollisions = true;
    }
    for (let i = 0; i <= panelsPerSide; i++) {
      const d = panelW * i;
      const px = side.origin[0] + side.dir[0] * d;
      const pz = side.origin[1] + side.dir[1] * d;
      if (side.isFront && Math.abs(px) < 2.5) continue;
      const p = post.createInstance(`post${n++}`);
      p.position.set(px, 1, pz);
    }
  }

  // stone gate pillars
  for (const sx of [-1, 1]) {
    const pillar = MeshBuilder.CreateBox(`gatePillar${sx}`, { width: 0.7, height: 2.6, depth: 0.7 }, scene);
    pillar.position.set(sx * 2.75, 1.3, -PLOT_HALF);
    pillar.material = darkStoneMat;
    pillar.checkCollisions = true;
    const cap = MeshBuilder.CreateCylinder(
      `gateCap${sx}`,
      { diameterTop: 0, diameterBottom: 0.95, height: 0.5, tessellation: 4 },
      scene,
    );
    cap.rotation.y = Math.PI / 4;
    cap.position.set(sx * 2.75, 2.85, -PLOT_HALF);
    cap.material = darkStoneMat;
  }
  // iron arch over the gate
  const archPath: Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    archPath.push(new Vector3(Math.cos(a) * 2.75, 3.05 + Math.sin(a) * 0.9, -PLOT_HALF));
  }
  const arch = MeshBuilder.CreateTube("gateArch", { path: archPath, radius: 0.05, tessellation: 6 }, scene);
  arch.material = ironMat;
  const archCross = MeshBuilder.CreateBox("archCrossV", { width: 0.08, height: 0.6, depth: 0.06 }, scene);
  archCross.position.set(0, 4.25, -PLOT_HALF);
  archCross.material = ironMat;
  const archCrossH = MeshBuilder.CreateBox("archCrossH", { width: 0.36, height: 0.08, depth: 0.06 }, scene);
  archCrossH.position.set(0, 4.35, -PLOT_HALF);
  archCrossH.material = ironMat;
  // one gate leaf hanging open
  const leaf = MeshBuilder.CreatePlane("gateLeaf", { width: 2.3, height: 1.8, sideOrientation: Mesh.DOUBLESIDE }, scene);
  leaf.setPivotPoint(new Vector3(-1.15, 0, 0));
  leaf.position.set(-1.2, 0.9, -PLOT_HALF);
  leaf.rotation.y = -1.9;
  leaf.material = fenceMat;

  // ---------- mausoleum ----------
  const mz = PLOT_HALF - 6.5;
  const addBox = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: StandardMaterial) => {
    const b = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    b.position.set(x, y, z);
    b.material = mat;
    b.checkCollisions = true;
    return b;
  };
  addBox("mausPlinth", 6, 0.35, 7, 0, 0.175, mz, darkStoneMat);
  addBox("mausStep", 3, 0.18, 0.8, 0, 0.09, mz - 3.9, darkStoneMat);
  addBox("mausBody", 4.6, 3.2, 5.2, 0, 1.95, mz + 0.4, stoneMat);
  addBox("mausDoor", 1.4, 2.2, 0.05, 0, 1.45, mz - 2.23, ironMat);
  // gable roof: a triangle extruded front-to-back
  const roof = MeshBuilder.ExtrudeShape(
    "mausRoof",
    {
      shape: [new Vector3(-2.9, 0, 0), new Vector3(2.9, 0, 0), new Vector3(0, 1.5, 0)],
      closeShape: true,
      path: [new Vector3(0, 0, -3.3), new Vector3(0, 0, 3.0)],
      cap: Mesh.CAP_ALL,
      sideOrientation: Mesh.DOUBLESIDE,
    },
    scene,
  );
  roof.position.set(0, 3.55, mz + 0.4);
  roof.material = darkStoneMat;
  for (const cx of [-1.7, 1.7]) {
    const col = MeshBuilder.CreateCylinder(`mausCol${cx}`, { diameter: 0.42, height: 3.2, tessellation: 10 }, scene);
    col.position.set(cx, 1.95, mz - 2.9);
    col.material = stoneMat;
    col.checkCollisions = true;
  }
  addBox("mausLintel", 4.6, 0.3, 1.2, 0, 3.4, mz - 2.6, stoneMat);

  // ---------- dead trees ----------
  const deadTree = (() => {
    const parts: Mesh[] = [];
    const trunk = MeshBuilder.CreateCylinder("dtTrunk", { diameterTop: 0.14, diameterBottom: 0.55, height: 5.5, tessellation: 7 }, scene);
    trunk.position.y = 2.75;
    parts.push(trunk);
    const trng = mulberry32(99);
    for (let i = 0; i < 6; i++) {
      const len = 1.4 + trng() * 1.6;
      const br = MeshBuilder.CreateCylinder(`dtBr${i}`, { diameterTop: 0.02, diameterBottom: 0.16, height: len, tessellation: 5 }, scene);
      const y = 2.2 + i * 0.5;
      const yaw = trng() * Math.PI * 2;
      const tilt = 0.6 + trng() * 0.5;
      br.rotation.set(0, yaw, tilt);
      // offset so the branch starts at the trunk
      br.position.set(Math.cos(yaw) * Math.sin(tilt) * len * -0.5, y + Math.cos(tilt) * len * 0.5, Math.sin(yaw) * Math.sin(tilt) * len * 0.5);
      parts.push(br);
    }
    return merge("deadTree", parts, barkMat);
  })();
  const treeSpots: [number, number, number][] = [
    [-15, 9, 1.1],
    [17, -12, 0.9],
    [-20, -17, 1.25],
    [13, 15, 1.0],
    [6, -21, 0.8],
  ];
  for (const [x, z, s] of treeSpots) {
    const t = deadTree.createInstance(`deadTree${n++}`);
    t.position.set(x, 0, z);
    t.rotation.y = rng() * Math.PI * 2;
    t.scaling.setAll(s);
    t.checkCollisions = true;
  }
};
