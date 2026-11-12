import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
// Side-effect import: adds thin instance support to Mesh
import "@babylonjs/core/Meshes/thinInstanceMesh";
import grassTextureUrl from "./textures/grassTexture.jpg";
import { formatDate, games, lifespanDays, type Game } from "./games";
import { Ambience } from "./ambience";
import { createForest } from "./forest";
import { mulberry32 } from "./random";

const EYE_HEIGHT = 1.7;
/** Cemetery fence bounds; the closed gate is centred on the near (min z) side */
const BOUNDS = { minX: -14, maxX: 14, minZ: -1, maxZ: 28 };
const GATE_HALF_WIDTH = 1.4;
/** Graves sit in loose rows, in column bands either side of the central path */
const COLUMNS = [-10.5, -5, 3, 8.5];
const FIRST_ROW_Z = 6;
const ROW_SPACING = 5.5;
const LAYOUT_SEED = 1932;
const INTERACT_DISTANCE = 2.4;
const STONE_RADIUS = 0.7;
const TV_RADIUS = 0.6;
const MAX_CANDLES_PER_STONE = 12;
const STONE_HEX = "#787a7d";
const STORM_HEX = "#6b6e73";
const STORM = Color3.FromHexString(STORM_HEX);
/** The plasma TV stands this far to the right of its headstone */
const TV_OFFSET_X = 1.5;
/** 16:9 plasma screen: size and position in TV-local metres, and the CSS size of the trailer iframe */
const SCREEN_W = 0.93;
const SCREEN_H = (SCREEN_W * 9) / 16;
const SCREEN_Y = 1.3;
const SCREEN_Z = -0.046;
const IFRAME_W = 640;
const IFRAME_H = 360;

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const fpsDiv = document.getElementById("fps")!;
const plaque = document.getElementById("plaque")!;
const tvOverlay = document.getElementById("tv")!;
const engine = new Engine(canvas, true, { stencil: false });
const ambience = new Ambience();

interface Grave {
  game: Game;
  /** Headstone world transform, including its random lean and sink */
  stoneMatrix: Matrix;
  /** Upright transform at the headstone's foot, for placing candles on the ground */
  groundMatrix: Matrix;
  tvMatrix: Matrix;
  stonePosition: Vector3;
  tvPosition: Vector3;
  /** Point between stone and TV that counts as "standing at the grave" */
  focus: Vector3;
  /** Candles drawn so far; capped so the instance count stays bounded */
  candles: number;
  /** World-space corners of the TV screen: top-left, top-right, bottom-right, bottom-left */
  screen: Vector3[];
}

// Loose rows facing the gate, oldest shutdowns nearest; each stone a little off-line,
// turned, leaning and sunk, like a cemetery that has settled over the years.
function layoutGraves(): Grave[] {
  const random = mulberry32(LAYOUT_SEED);
  const jitter = (amount: number) => (random() * 2 - 1) * amount;
  return games.map((game, i) => {
    const row = Math.floor(i / COLUMNS.length);
    const stonePosition = new Vector3(
      COLUMNS[i % COLUMNS.length] + jitter(0.6),
      -random() * 0.08,
      FIRST_ROW_Z + row * ROW_SPACING + jitter(0.9),
    );
    const yaw = jitter(0.25);
    const lean = Quaternion.RotationYawPitchRoll(yaw, jitter(0.06), jitter(0.06));
    const stoneMatrix = Matrix.Compose(Vector3.One(), lean, stonePosition);
    const ground = new Vector3(stonePosition.x, 0, stonePosition.z);
    const groundMatrix = Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(yaw, 0, 0), ground);

    // TV to the stone's right, turned back towards someone standing in front of the stone
    const tvPosition = Vector3.TransformCoordinates(new Vector3(TV_OFFSET_X, 0, jitter(0.2)), groundMatrix);
    const tvRotation = Quaternion.RotationYawPitchRoll(yaw + 0.35 + jitter(0.1), 0, 0);
    const tvMatrix = Matrix.Compose(Vector3.One(), tvRotation, tvPosition);
    const corner = (x: number, y: number) =>
      Vector3.TransformCoordinates(new Vector3(x * SCREEN_W, SCREEN_Y + y * SCREEN_H, SCREEN_Z), tvMatrix);

    return {
      game,
      stoneMatrix,
      groundMatrix,
      tvMatrix,
      stonePosition,
      tvPosition,
      focus: Vector3.Center(ground, tvPosition),
      candles: 0,
      screen: [corner(-0.5, 0.5), corner(0.5, 0.5), corner(0.5, -0.5), corner(-0.5, -0.5)],
    };
  });
}

function loadRespects(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem("respects") ?? "{}");
  } catch {
    return {};
  }
}

function saveRespects(respects: Record<string, number>) {
  try {
    localStorage.setItem("respects", JSON.stringify(respects));
  } catch {
    // Storage unavailable (private mode etc.): respects just won't persist
  }
}

// Draws every headstone's engraving into one atlas so all text is a single draw call.
function createEpitaphAtlas(scene: Scene, cols: number, cell: number) {
  const rows = Math.ceil(games.length / cols);
  const height = 2 ** Math.ceil(Math.log2(rows * cell));
  const atlas = new DynamicTexture("epitaphs", { width: cols * cell, height }, scene, true);
  const ctx = atlas.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = STONE_HEX;
  ctx.fillRect(0, 0, cols * cell, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const engrave = (text: string, x: number, y: number, font: string, maxWidth: number) => {
    let size = parseInt(font.match(/(\d+)px/)![1]);
    ctx.font = font;
    while (ctx.measureText(text).width > maxWidth && size > 12) {
      size -= 2;
      ctx.font = font.replace(/\d+px/, `${size}px`);
    }
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillText(text, x + 1, y + 2);
    ctx.fillStyle = "#2b2c2e";
    ctx.fillText(text, x, y);
  };

  games.forEach((game, i) => {
    const x = (i % cols) * cell + cell / 2;
    const y = Math.floor(i / cols) * cell;
    const w = cell * 0.86;
    const days = lifespanDays(game);
    engrave("R . I . P .", x, y + cell * 0.14, `bold ${cell * 0.07}px serif`, w);
    engrave(game.name, x, y + cell * 0.33, `bold ${cell * 0.14}px serif`, w);
    engrave(game.studio, x, y + cell * 0.49, `italic ${cell * 0.06}px serif`, w);
    engrave(`${formatDate(game.launched)} – ${formatDate(game.shutdown)}`, x, y + cell * 0.64, `${cell * 0.06}px serif`, w);
    engrave(`${days} ${days === 1 ? "day" : "days"} online`, x, y + cell * 0.78, `bold ${cell * 0.065}px serif`, w);
  });
  atlas.update();
  return { atlas, rows: height / cell };
}

// Overcast sky painted once onto a dome: dark storm clouds fading into the fog at the horizon.
function createStormSky(scene: Scene) {
  const w = 1024;
  const h = 512;
  const sky = new DynamicTexture("stormSky", { width: w, height: h }, scene, true);
  const ctx = sky.getContext() as CanvasRenderingContext2D;
  const gradient = ctx.createLinearGradient(0, 0, 0, h / 2);
  gradient.addColorStop(0, "#35383d");
  gradient.addColorStop(1, STORM_HEX);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = STORM_HEX;
  ctx.fillRect(0, h / 2, w, h / 2);

  for (let i = 0; i < 500; i++) {
    const y = Math.random() * h * 0.47;
    const r = 15 + Math.random() * 70 * (1 - y / h);
    const dark = Math.random() < 0.75;
    const color = dark ? "30,32,36" : "140,143,148";
    const alpha = dark ? 0.18 : 0.1;
    const x = Math.random() * w;
    // Draw wrapped copies so the clouds tile seamlessly around the dome
    for (const dx of [-w, 0, w]) {
      const blob = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      blob.addColorStop(0, `rgba(${color},${alpha})`);
      blob.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = blob;
      ctx.fillRect(x + dx - r, y - r, r * 2, r * 2);
    }
  }
  sky.update();

  const dome = CreateSphere("sky", { diameter: 180, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
  dome.infiniteDistance = true;
  const mat = new StandardMaterial("sky", scene);
  mat.disableLighting = true;
  mat.diffuseColor = Color3.Black();
  mat.emissiveTexture = sky;
  mat.fogEnabled = false;
  dome.material = mat;
  return dome;
}

// The idle plasma screen: the familiar blue "NO SIGNAL" of a 2000s flat panel. Drawn once.
function createNoSignal(scene: Scene) {
  const w = 512;
  const h = 288;
  const tex = new DynamicTexture("noSignal", { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#1a2b9c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(w * 0.3, h * 0.42, w * 0.4, h * 0.16);
  ctx.fillStyle = "#e8ecff";
  ctx.font = `bold ${h * 0.08}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NO SIGNAL", w / 2, h / 2);
  tex.update();
  return tex;
}

// Wrought-iron fence round the cemetery, with stone pillars and a closed double gate.
// Every bar and rail is one unit cube scaled per instance, so the whole fence is one draw call.
function createFence(scene: Scene, ironMat: StandardMaterial, stoneMat: StandardMaterial) {
  const { minX, maxX, minZ, maxZ } = BOUNDS;
  const unitCube = (name: string) => {
    const box = CreateBox(name, { size: 1 }, scene);
    box.bakeTransformIntoVertices(Matrix.Translation(0, 0.5, 0));
    return box;
  };
  const iron = unitCube("iron");
  iron.material = ironMat;
  const pillars = unitCube("pillars");
  pillars.material = stoneMat;

  const ironMatrices: Matrix[] = [];
  const pillarMatrices: Matrix[] = [];
  const piece = (out: Matrix[], x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
    out.push(Matrix.Scaling(sx, sy, sz).multiply(Matrix.Translation(x, y, z)));
  const gatePillarX = GATE_HALF_WIDTH + 0.25;

  // Bars and rails along a straight side; `along` picks the axis the side runs on
  const side = (from: number, to: number, fixed: number, along: "x" | "z") => {
    const at = (t: number, y: number, sx: number, sy: number, sz: number) =>
      along === "x" ? piece(ironMatrices, t, y, fixed, sx, sy, sz) : piece(ironMatrices, fixed, y, t, sz, sy, sx);
    for (let t = from; t <= to; t += 0.18) at(t, 0, 0.025, 1.6, 0.025);
    const mid = (from + to) / 2;
    for (const y of [0.15, 1.45]) at(mid, y, to - from, 0.04, 0.04);
  };
  side(minX, -gatePillarX - 0.25, minZ, "x");
  side(gatePillarX + 0.25, maxX, minZ, "x");
  side(minX, maxX, maxZ, "x");
  side(minZ, maxZ, minX, "z");
  side(minZ, maxZ, maxX, "z");

  // Closed gate: taller bars, a heavier middle stile where the two leaves meet, three rails
  for (let x = -GATE_HALF_WIDTH; x <= GATE_HALF_WIDTH + 0.01; x += 0.14) piece(ironMatrices, x, 0, minZ, 0.03, 2.0, 0.03);
  piece(ironMatrices, -0.03, 0, minZ, 0.06, 2.1, 0.06);
  piece(ironMatrices, 0.03, 0, minZ, 0.06, 2.1, 0.06);
  for (const y of [0.15, 1.0, 1.85]) piece(ironMatrices, 0, y, minZ, GATE_HALF_WIDTH * 2, 0.06, 0.05);

  for (const x of [-gatePillarX, gatePillarX]) piece(pillarMatrices, x, 0, minZ, 0.5, 2.5, 0.5);
  for (const [x, z] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ]]) {
    piece(pillarMatrices, x, 0, z, 0.4, 1.9, 0.4);
  }

  iron.thinInstanceAdd(ironMatrices);
  iron.thinInstanceRefreshBoundingInfo();
  pillars.thinInstanceAdd(pillarMatrices);
  pillars.thinInstanceRefreshBoundingInfo();
  return [iron, pillars];
}

/**
 * CSS matrix3d that maps a w×h element onto an arbitrary screen-space quad (a homography),
 * so the trailer iframe sits in perspective on the 3D TV screen.
 */
function quadTransform(w: number, h: number, [p0, p1, p2, p3]: number[][]) {
  const dx1 = p1[0] - p2[0];
  const dx2 = p3[0] - p2[0];
  const dy1 = p1[1] - p2[1];
  const dy2 = p3[1] - p2[1];
  const sx = p0[0] - p1[0] + p2[0] - p3[0];
  const sy = p0[1] - p1[1] + p2[1] - p3[1];
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / det;
  const k = (dx1 * sy - sx * dy1) / det;
  const a = p1[0] - p0[0] + g * p1[0];
  const b = p3[0] - p0[0] + k * p3[0];
  const d = p1[1] - p0[1] + g * p1[1];
  const e = p3[1] - p0[1] + k * p3[1];
  return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, p0[0], p0[1], 0, 1].join(",")})`;
}

function createScene() {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromColor3(STORM);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.035;
  scene.fogColor = STORM;
  scene.skipPointerMovePicking = true;

  // Flat overcast daylight
  const daylight = new HemisphericLight("daylight", new Vector3(0, 1, 0), scene);
  daylight.intensity = 1;
  daylight.diffuse = new Color3(0.72, 0.74, 0.78);
  daylight.groundColor = new Color3(0.22, 0.22, 0.25);
  daylight.specular = new Color3(0.5, 0.5, 0.55);

  const sky = createStormSky(scene);
  const graves = layoutGraves();
  const { minX, maxX, minZ, maxZ } = BOUNDS;

  // Ground runs out under the surrounding forest; the path leads from the gate to the back
  const groundW = 160;
  const groundD = 170;
  const grassMat = new StandardMaterial("grass", scene);
  const grassTex = new Texture(grassTextureUrl, scene);
  grassTex.uScale = groundW / 2;
  grassTex.vScale = groundD / 2;
  grassMat.diffuseTexture = grassTex;
  grassMat.diffuseColor = new Color3(0.8, 0.85, 0.8);
  grassMat.specularColor = Color3.Black();
  const grass = CreateGround("grass", { width: groundW, height: groundD }, scene);
  grass.position.z = (minZ + maxZ) / 2;
  grass.material = grassMat;

  const pathMat = new StandardMaterial("path", scene);
  pathMat.diffuseColor = new Color3(0.22, 0.19, 0.16);
  pathMat.specularColor = Color3.Black();
  const path = CreateGround("path", { width: 1.6, height: maxZ - minZ - 1 }, scene);
  path.position.set(0, 0.01, (minZ + maxZ - 1) / 2);
  path.material = pathMat;

  // Headstones: one mesh drawn once per grave via thin instances
  const body = CreateBox("stoneBody", { width: 1.2, height: 1.2, depth: 0.25 }, scene);
  body.position.y = 0.6;
  const top = CreateCylinder("stoneTop", { diameter: 1.2, height: 0.25, tessellation: 32 }, scene);
  top.rotation.x = Math.PI / 2;
  top.position.y = 1.2;
  const stone = Mesh.MergeMeshes([body, top], true)!;
  const stoneMat = new StandardMaterial("stone", scene);
  stoneMat.diffuseColor = Color3.FromHexString(STONE_HEX);
  stoneMat.specularColor = new Color3(0.05, 0.05, 0.05);
  stone.material = stoneMat;

  const ironMat = new StandardMaterial("iron", scene);
  ironMat.diffuseColor = new Color3(0.08, 0.08, 0.09);
  ironMat.specularColor = new Color3(0.2, 0.2, 0.2);
  const fence = createFence(scene, ironMat, stoneMat);
  createForest(scene, BOUNDS);

  // 2000s plasma TVs on pedestal stands: glossy black panel and stand, silver speaker bar
  const standBase = CreateBox("tvBase", { width: 0.5, height: 0.04, depth: 0.35 }, scene);
  standBase.position.y = 0.02;
  const standNeck = CreateBox("tvNeck", { width: 0.1, height: 0.85, depth: 0.06 }, scene);
  standNeck.position.set(0, 0.465, 0.04);
  const panel = CreateBox("tvPanel", { width: 1.04, height: 0.66, depth: 0.09 }, scene);
  panel.position.y = SCREEN_Y;
  const tv = Mesh.MergeMeshes([standBase, standNeck, panel], true)!;
  const tvMat = new StandardMaterial("tv", scene);
  tvMat.diffuseColor = new Color3(0.04, 0.04, 0.05);
  tvMat.specularColor = new Color3(0.6, 0.6, 0.65);
  tvMat.specularPower = 64;
  tv.material = tvMat;

  const speaker = CreateBox("tvSpeaker", { width: 1.04, height: 0.08, depth: 0.09 }, scene);
  speaker.bakeTransformIntoVertices(Matrix.Translation(0, SCREEN_Y - 0.37, 0));
  const speakerMat = new StandardMaterial("tvSpeaker", scene);
  speakerMat.diffuseColor = new Color3(0.58, 0.6, 0.63);
  speakerMat.specularColor = new Color3(0.5, 0.5, 0.5);
  speaker.material = speakerMat;

  // Engravings and TV screens: one quad per grave each, baked into place and merged
  const cols = 4;
  const { atlas, rows } = createEpitaphAtlas(scene, cols, 512);
  const faces = graves.map((grave, i) => {
    const face = CreatePlane(`face${i}`, { size: 1.0 }, scene);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const uvs = face.getVerticesData(VertexBuffer.UVKind)!;
    for (let v = 0; v < uvs.length; v += 2) {
      uvs[v] = (col + uvs[v]) / cols;
      uvs[v + 1] = 1 - (row + 1 - uvs[v + 1]) / rows;
    }
    face.setVerticesData(VertexBuffer.UVKind, uvs);
    face.bakeTransformIntoVertices(Matrix.Translation(0, 0.85, -0.126).multiply(grave.stoneMatrix));
    return face;
  });
  const screens = graves.map((grave, i) => {
    const screen = CreatePlane(`screen${i}`, { width: SCREEN_W, height: SCREEN_H }, scene);
    screen.bakeTransformIntoVertices(Matrix.Translation(0, SCREEN_Y, SCREEN_Z).multiply(grave.tvMatrix));
    return screen;
  });

  stone.thinInstanceAdd(graves.map((g) => g.stoneMatrix));
  stone.thinInstanceRefreshBoundingInfo();
  for (const mesh of [tv, speaker]) {
    mesh.thinInstanceAdd(graves.map((g) => g.tvMatrix));
    mesh.thinInstanceRefreshBoundingInfo();
  }

  const engravings = Mesh.MergeMeshes(faces, true)!;
  const engravingMat = new StandardMaterial("engraving", scene);
  engravingMat.diffuseTexture = atlas;
  engravingMat.specularColor = stoneMat.specularColor;
  engravings.material = engravingMat;

  const screenMesh = Mesh.MergeMeshes(screens, true)!;
  const screenMat = new StandardMaterial("screen", scene);
  screenMat.disableLighting = true;
  screenMat.diffuseColor = Color3.Black();
  screenMat.emissiveTexture = createNoSignal(scene);
  screenMesh.material = screenMat;

  // Candles left as respects
  const candle = CreateCylinder("candle", { diameter: 0.06, height: 0.18, tessellation: 8 }, scene);
  const candleMat = new StandardMaterial("candle", scene);
  candleMat.diffuseColor = new Color3(0.9, 0.87, 0.78);
  candleMat.specularColor = Color3.Black();
  candle.material = candleMat;
  const flame = CreateCylinder("flame", { diameterTop: 0, diameterBottom: 0.04, height: 0.07, tessellation: 6 }, scene);
  const flameMat = new StandardMaterial("flame", scene);
  flameMat.disableLighting = true;
  flameMat.emissiveColor = new Color3(1, 0.65, 0.25);
  flame.material = flameMat;
  // Thin instances are added far from the template's own bounds, so skip culling
  candle.alwaysSelectAsActiveMesh = flame.alwaysSelectAsActiveMesh = true;
  candle.setEnabled(false);
  flame.setEnabled(false);

  const addCandle = (grave: Grave) => {
    if (grave.candles >= MAX_CANDLES_PER_STONE) return;
    const slot = grave.candles++;
    // Two rows of six on the ground in front of the stone
    const local = new Vector3(((slot % 6) - 2.5) * 0.16, 0, -0.4 - Math.floor(slot / 6) * 0.15);
    const base = Vector3.TransformCoordinates(local, grave.groundMatrix);
    candle.thinInstanceAdd(Matrix.Translation(base.x, 0.09, base.z));
    flame.thinInstanceAdd(Matrix.Translation(base.x, 0.215, base.z));
    candle.setEnabled(true);
    flame.setEnabled(true);
  };

  const respects = loadRespects();
  for (const grave of graves) {
    for (let i = 0; i < Math.min(respects[grave.game.name] ?? 0, MAX_CANDLES_PER_STONE); i++) addCandle(grave);
  }

  for (const mesh of [grass, path, stone, engravings, tv, speaker, screenMesh, ...fence]) mesh.freezeWorldMatrix();
  for (const mat of [grassMat, pathMat, stoneMat, ironMat, engravingMat, tvMat, speakerMat, screenMat, candleMat]) {
    mat.freeze();
  }

  // First-person camera: WASD to walk, click to lock the pointer for mouse look
  const cam = new UniversalCamera("camera", new Vector3(0, EYE_HEIGHT, minZ + 1.5), scene);
  cam.setTarget(new Vector3(0, EYE_HEIGHT, maxZ));
  cam.attachControl(canvas, true);
  cam.inertia = 0;
  cam.speed = 1;
  cam.minZ = 0.05;
  cam.maxZ = 120;
  cam.keysUp = [87]; // W
  cam.keysDown = [83]; // S
  cam.keysLeft = [65]; // A
  cam.keysRight = [68]; // D
  const obstacles = graves.flatMap((g) => [
    { center: g.stonePosition, radius: STONE_RADIUS },
    { center: g.tvPosition, radius: TV_RADIUS },
  ]);
  cam.onAfterCheckInputsObservable.add(() => {
    const p = cam.position;
    // Walk on the ground, stay inside the fence (the gate is shut), don't pass through stones or TVs
    p.y = EYE_HEIGHT;
    p.x = Math.min(Math.max(p.x, minX + 0.5), maxX - 0.5);
    p.z = Math.min(Math.max(p.z, minZ + 0.5), maxZ - 0.5);
    for (const { center, radius } of obstacles) {
      const dx = p.x - center.x;
      const dz = p.z - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist < radius && dist > 0) {
        p.x = center.x + (dx / dist) * radius;
        p.z = center.z + (dz / dist) * radius;
      }
    }
  });
  canvas.addEventListener("click", () => {
    canvas.requestPointerLock();
    ambience.start();
  });

  // Trailer playback: a YouTube iframe kept glued onto the TV screen in perspective
  let playing: Grave | null = null;
  const stopTrailer = () => {
    playing = null;
    tvOverlay.replaceChildren();
    tvOverlay.hidden = true;
    ambience.setDucked(false);
  };
  const playTrailer = (grave: Grave) => {
    const id = grave.game.trailer;
    if (!id) return;
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=0&rel=0&playsinline=1`;
    iframe.title = `${grave.game.name} trailer`;
    iframe.allow = "autoplay; encrypted-media";
    iframe.width = String(IFRAME_W);
    iframe.height = String(IFRAME_H);
    tvOverlay.replaceChildren(iframe);
    playing = grave;
    ambience.setDucked(true);
  };
  const placeTrailer = () => {
    if (!playing) return;
    // Hide while any corner is behind the camera; the projection is meaningless there
    const view = cam.getViewMatrix();
    const visible = playing.screen.every((p) => Vector3.TransformCoordinates(p, view).z > cam.minZ);
    tvOverlay.hidden = !visible;
    if (!visible) return;
    const viewport = cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const toCss = canvas.clientWidth / engine.getRenderWidth();
    const corners = playing.screen.map((p) => {
      const s = Vector3.Project(p, Matrix.IdentityReadOnly, scene.getTransformMatrix(), viewport);
      return [s.x * toCss, s.y * toCss];
    });
    tvOverlay.style.transform = quadTransform(IFRAME_W, IFRAME_H, corners);
  };

  // Plaque for the grave the visitor is standing at
  let nearest: Grave | null = null;
  const showPlaque = () => {
    plaque.hidden = !nearest;
    if (!nearest) return;
    const { game } = nearest;
    const count = respects[game.name] ?? 0;
    plaque.querySelector(".name")!.textContent = game.name;
    plaque.querySelector(".studio")!.textContent = game.studio;
    plaque.querySelector(".dates")!.textContent =
      `${formatDate(game.launched)} – ${formatDate(game.shutdown)} · ${lifespanDays(game)} days online`;
    const tvHint = !game.trailer ? "No signal" : playing === nearest ? "E to switch off" : "E to play trailer";
    const respectsHint = count === 0 ? "F to pay respects" : `F to pay respects · ${count} paid`;
    plaque.querySelector(".actions")!.textContent = `${respectsHint} · ${tvHint}`;
  };

  scene.onBeforeRenderObservable.add(() => {
    let closest: Grave | null = null;
    let closestDist = INTERACT_DISTANCE;
    for (const grave of graves) {
      const dist = Math.hypot(cam.position.x - grave.focus.x, cam.position.z - grave.focus.z);
      if (dist < closestDist) {
        closest = grave;
        closestDist = dist;
      }
    }
    if (closest !== nearest) {
      nearest = closest;
      if (playing && playing !== nearest) stopTrailer();
      showPlaque();
    }
    placeTrailer();

    // Flicker all flames together: one uniform update instead of per-instance work
    const t = performance.now() / 1000;
    const flicker = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
    flameMat.emissiveColor.set(flicker, 0.65 * flicker, 0.25 * flicker);
    sky.rotation.y = t * 0.004;
  });

  window.addEventListener("keydown", (e) => {
    ambience.start();
    if (e.repeat) return;
    if (e.code === "KeyM") {
      ambience.toggleMute();
    } else if (e.code === "KeyF" && nearest) {
      const name = nearest.game.name;
      respects[name] = (respects[name] ?? 0) + 1;
      saveRespects(respects);
      addCandle(nearest);
      showPlaque();
    } else if (e.code === "KeyE" && nearest) {
      if (playing === nearest) stopTrailer();
      else playTrailer(nearest);
      showPlaque();
    }
  });

  return scene;
}

const scene = createScene();
let lastFpsUpdate = 0;
engine.runRenderLoop(() => {
  scene.render();
  const now = performance.now();
  if (now - lastFpsUpdate > 500) {
    lastFpsUpdate = now;
    fpsDiv.textContent = `${engine.getFps().toFixed()} FPS`;
  }
});

window.addEventListener("resize", () => {
  engine.resize();
});
