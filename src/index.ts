import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
// Side-effect import: adds thin instance support to Mesh
import "@babylonjs/core/Meshes/thinInstanceMesh";
// Side-effect import: lets the camera collide with the cemetery's fence, graves and mausoleum
import "@babylonjs/core/Collisions/collisionCoordinator";
import { formatLifespan, formatSpan, games, type Game } from "./games";
import { Ambience } from "./ambience";
import { createAtmosphere } from "./world/atmosphere";
import { createCemetery, type PlotBounds } from "./world/cemetery";
import { createForest } from "./world/forest";
import { createStoneTexture, mulberry32 } from "./world/textures";

const EYE_HEIGHT = 1.7;
const AISLE_HALF_WIDTH = 2.5;
const ROW_SPACING = 4;
const FIRST_ROW_Z = 4;
const INTERACT_DISTANCE = 2.4;
const STONE_RADIUS = 0.7;
const MAX_CANDLES_PER_STONE = 12;
const STONE_HEX = "#787a7d";
/** Uniform scale of the TV and its crate, relative to the modelled size */
const TV_SCALE = 1.75;
const TV_RADIUS = 0.9;
/** TV sits beside its headstone, this far along the aisle */
const TV_OFFSET_Z = 1.6;
/** TV screen size in metres and the CSS size of the trailer iframe mapped onto it */
const SCREEN_W = 0.48 * TV_SCALE;
const SCREEN_H = 0.36 * TV_SCALE;
const IFRAME_W = 640;
const IFRAME_H = 480;

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const fpsDiv = document.getElementById("fps")!;
const plaque = document.getElementById("plaque")!;
const tvOverlay = document.getElementById("tv")!;
const engine = new Engine(canvas, true, { stencil: false });
const ambience = new Ambience();

interface Grave {
  game: Game;
  position: Vector3;
  /** Unit vector the engraved face points along (towards the aisle) */
  front: Vector3;
  /** Candles drawn so far; capped so the instance count stays bounded */
  candles: number;
  /** World-space corners of the TV screen: top-left, top-right, bottom-right, bottom-left */
  screen: Vector3[];
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
  // Weathered speckle so the engraved face matches the textured stone around it
  const rng = mulberry32(5);
  for (let i = 0; i < cols * height * 0.6; i++) {
    const shade = rng() < 0.5 ? "0,0,0" : "255,255,255";
    ctx.fillStyle = `rgba(${shade},${0.04 + rng() * 0.08})`;
    const size = 2 + rng() * 6;
    ctx.fillRect(rng() * cols * cell, rng() * height, size, size);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const engrave = (text: string, x: number, y: number, font: string, maxWidth: number) => {
    // Sizes can be fractional (e.g. 71.68px), so match the whole number including decimals
    let size = parseFloat(font.match(/([\d.]+)px/)![1]);
    ctx.font = font;
    while (ctx.measureText(text).width > maxWidth && size > 12) {
      size -= 2;
      ctx.font = font.replace(/[\d.]+px/, `${size}px`);
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
    engrave("R . I . P .", x, y + cell * 0.14, `bold ${cell * 0.07}px serif`, w);
    engrave(game.name, x, y + cell * 0.33, `bold ${cell * 0.14}px serif`, w);
    engrave(game.studio, x, y + cell * 0.49, `italic ${cell * 0.06}px serif`, w);
    engrave(formatSpan(game), x, y + cell * 0.64, `${cell * 0.06}px serif`, w);
    engrave(formatLifespan(game), x, y + cell * 0.78, `bold ${cell * 0.065}px serif`, w);
  });
  atlas.update();
  return { atlas, rows: height / cell };
}

// Shared animated TV static. Tiny and point-sampled, so updating it is cheap.
function createStatic(scene: Scene) {
  const w = 64;
  const h = 48;
  const tex = new DynamicTexture("static", { width: w, height: h }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const image = ctx.createImageData(w, h);
  return {
    tex,
    redraw() {
      const d = image.data;
      for (let y = 0; y < h; y++) {
        const scanline = y % 2 === 0 ? 1 : 0.6;
        for (let x = 0; x < w; x++) {
          const v = Math.random() * 200 * scanline;
          const i = (y * w + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = v;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
      tex.update();
    },
  };
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
  scene.skipPointerMovePicking = true;
  scene.collisionsEnabled = true;

  // Storm sky, fog, lighting and lightning
  createAtmosphere(scene);

  const graves: Grave[] = games.map((game, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    return {
      game,
      position: new Vector3(side * AISLE_HALF_WIDTH, 0, FIRST_ROW_Z + Math.floor(i / 2) * ROW_SPACING),
      front: new Vector3(-side, 0, 0),
      candles: 0,
      screen: [],
    };
  });
  const aisleLength = FIRST_ROW_Z + Math.ceil(games.length / 2) * ROW_SPACING;

  // The memorial aisle runs up the middle of a larger, older cemetery
  const plot: PlotBounds = { xHalf: 20, zMin: -6, zMax: aisleLength + 14, aisleHalf: 6.5 };
  createCemetery(scene, plot);
  createForest(scene, plot);

  // Headstones: one mesh drawn once per grave via thin instances
  const body = CreateBox("stoneBody", { width: 1.2, height: 1.2, depth: 0.25 }, scene);
  body.position.y = 0.6;
  const top = CreateCylinder("stoneTop", { diameter: 1.2, height: 0.25, tessellation: 32 }, scene);
  top.rotation.x = Math.PI / 2;
  top.position.y = 1.2;
  const stone = Mesh.MergeMeshes([body, top], true)!;
  const stoneMat = new StandardMaterial("stone", scene);
  stoneMat.diffuseTexture = createStoneTexture(scene);
  stoneMat.specularColor = new Color3(0.05, 0.05, 0.05);
  stone.material = stoneMat;

  // CRT TVs on crates beside each stone, built the same way: shared meshes, thin instances
  const crate = CreateBox("crate", { width: 0.6, height: 0.5, depth: 0.5 }, scene);
  crate.bakeTransformIntoVertices(Matrix.Translation(0, 0.25, 0));
  const crateMat = new StandardMaterial("crate", scene);
  crateMat.diffuseColor = new Color3(0.3, 0.22, 0.15);
  crateMat.specularColor = Color3.Black();
  crate.material = crateMat;

  const tvFront = CreateBox("tvFront", { width: 0.62, height: 0.5, depth: 0.45 }, scene);
  tvFront.position.y = 0.75;
  const tvTube = CreateBox("tvTube", { width: 0.42, height: 0.36, depth: 0.25 }, scene);
  tvTube.position.set(0, 0.74, 0.33);
  const tv = Mesh.MergeMeshes([tvFront, tvTube], true)!;
  const tvMat = new StandardMaterial("tv", scene);
  tvMat.diffuseColor = new Color3(0.16, 0.16, 0.17);
  tvMat.specularColor = new Color3(0.15, 0.15, 0.15);
  tv.material = tvMat;

  // Engravings and TV screens: one quad per grave each, merged into single meshes
  const cols = 4;
  const { atlas, rows } = createEpitaphAtlas(scene, cols, 512);
  const stoneMatrices: Matrix[] = [];
  const tvMatrices: Matrix[] = [];
  const faces: Mesh[] = [];
  const screens: Mesh[] = [];
  graves.forEach((grave, i) => {
    // Front faces -z by default; turn it to face the aisle
    const rotation = Quaternion.RotationAxis(Vector3.Up(), Math.atan2(-grave.front.x, -grave.front.z));
    stoneMatrices.push(Matrix.Compose(Vector3.One(), rotation, grave.position));

    const face = CreatePlane(`face${i}`, { size: 1.0 }, scene);
    face.rotationQuaternion = rotation;
    face.position = grave.position.add(grave.front.scale(0.126)).addInPlaceFromFloats(0, 0.85, 0);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const uvs = face.getVerticesData(VertexBuffer.UVKind)!;
    for (let v = 0; v < uvs.length; v += 2) {
      uvs[v] = (col + uvs[v]) / cols;
      uvs[v + 1] = 1 - (row + 1 - uvs[v + 1]) / rows;
    }
    face.setVerticesData(VertexBuffer.UVKind, uvs);
    faces.push(face);

    // The TV stands beside the stone, angled back towards visitors coming up the aisle
    const tvFacing = grave.front.add(new Vector3(0, 0, -0.5)).normalize();
    const tvRotation = Quaternion.RotationAxis(Vector3.Up(), Math.atan2(-tvFacing.x, -tvFacing.z));
    const tvPosition = grave.position.add(new Vector3(0, 0, TV_OFFSET_Z));
    tvMatrices.push(Matrix.Compose(new Vector3(TV_SCALE, TV_SCALE, TV_SCALE), tvRotation, tvPosition));

    const screenCenter = tvPosition.add(tvFacing.scale(0.226 * TV_SCALE)).addInPlaceFromFloats(0, 0.76 * TV_SCALE, 0);
    const right = Vector3.Cross(tvFacing, Vector3.Up()).scaleInPlace(SCREEN_W / 2);
    const up = new Vector3(0, SCREEN_H / 2, 0);
    grave.screen = [
      screenCenter.subtract(right).addInPlace(up),
      screenCenter.add(right).addInPlace(up),
      screenCenter.add(right).subtractInPlace(up),
      screenCenter.subtract(right).subtractInPlace(up),
    ];
    const screen = CreatePlane(`screen${i}`, { width: SCREEN_W, height: SCREEN_H }, scene);
    screen.rotationQuaternion = tvRotation;
    screen.position = screenCenter;
    screens.push(screen);
  });
  stone.thinInstanceAdd(stoneMatrices);
  stone.thinInstanceRefreshBoundingInfo();
  crate.thinInstanceAdd(tvMatrices);
  crate.thinInstanceRefreshBoundingInfo();
  tv.thinInstanceAdd(tvMatrices);
  tv.thinInstanceRefreshBoundingInfo();

  const engravings = Mesh.MergeMeshes(faces, true)!;
  const engravingMat = new StandardMaterial("engraving", scene);
  engravingMat.diffuseTexture = atlas;
  engravingMat.diffuseColor = new Color3(0.85, 0.85, 0.85); // sit closer to the weathered stone around it
  engravingMat.specularColor = stoneMat.specularColor;
  engravings.material = engravingMat;

  const tvStatic = createStatic(scene);
  const screenMesh = Mesh.MergeMeshes(screens, true)!;
  const screenMat = new StandardMaterial("screen", scene);
  screenMat.disableLighting = true;
  screenMat.diffuseColor = Color3.Black();
  screenMat.emissiveTexture = tvStatic.tex;
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
    const side = Vector3.Cross(Vector3.Up(), grave.front);
    const base = grave.position
      .add(grave.front.scale(0.4 + Math.floor(slot / 6) * 0.15))
      .addInPlace(side.scale(((slot % 6) - 2.5) * 0.16));
    candle.thinInstanceAdd(Matrix.Translation(base.x, 0.09, base.z));
    flame.thinInstanceAdd(Matrix.Translation(base.x, 0.215, base.z));
    candle.setEnabled(true);
    flame.setEnabled(true);
  };

  const respects = loadRespects();
  for (const grave of graves) {
    for (let i = 0; i < Math.min(respects[grave.game.name] ?? 0, MAX_CANDLES_PER_STONE); i++) addCandle(grave);
  }

  for (const mesh of [stone, engravings, crate, tv, screenMesh]) mesh.freezeWorldMatrix();
  for (const mat of [stoneMat, engravingMat, crateMat, tvMat, candleMat]) mat.freeze();

  // First-person camera: WASD to walk, click to lock the pointer for mouse look.
  // Starts on the path just outside the cemetery gate.
  const cam = new UniversalCamera("camera", new Vector3(0, EYE_HEIGHT, plot.zMin - 8), scene);
  cam.setTarget(new Vector3(0, EYE_HEIGHT, 10));
  cam.attachControl(canvas, true);
  cam.inertia = 0;
  cam.speed = 1.3;
  cam.minZ = 0.05;
  cam.maxZ = 400;
  // Babylon's collisions handle the fence, decorative graves and mausoleum; the memorial
  // stones and TVs (thin instances) are pushed out by hand below.
  cam.checkCollisions = true;
  cam.ellipsoid = new Vector3(0.35, 0.6, 0.35);
  cam.keysUp = [87]; // W
  cam.keysDown = [83]; // S
  cam.keysLeft = [65]; // A
  cam.keysRight = [68]; // D
  const obstacles = graves.flatMap(({ position }) => [
    { center: position, radius: STONE_RADIUS },
    { center: position.add(new Vector3(0, 0, TV_OFFSET_Z)), radius: TV_RADIUS },
  ]);
  cam.onAfterCheckInputsObservable.add(() => {
    const p = cam.position;
    // Walk on the ground, don't wander off into the endless woods, and don't pass through stones or TVs
    p.y = EYE_HEIGHT;
    p.x = Math.min(Math.max(p.x, -plot.xHalf - 25), plot.xHalf + 25);
    p.z = Math.min(Math.max(p.z, plot.zMin - 25), plot.zMax + 25);
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
    plaque.querySelector(".dates")!.textContent = `${formatSpan(game)} · ${formatLifespan(game)}`;
    const tvHint = !game.trailer ? "No signal" : playing === nearest ? "E to switch off" : "E to play trailer";
    const respectsHint = count === 0 ? "F to pay respects" : `F to pay respects · ${count} paid`;
    plaque.querySelector(".actions")!.textContent = `${respectsHint} · ${tvHint}`;
  };

  let frame = 0;
  scene.onBeforeRenderObservable.add(() => {
    let closest: Grave | null = null;
    let closestDist = INTERACT_DISTANCE;
    for (const grave of graves) {
      // Measure from between the stone and its TV, so both count as "at the grave"
      const dist = Math.hypot(cam.position.x - grave.position.x, cam.position.z - (grave.position.z + TV_OFFSET_Z / 2));
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
    if (frame++ % 3 === 0) tvStatic.redraw();
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
if (import.meta.env.DEV) (window as unknown as { scene: Scene }).scene = scene; // handy for console debugging
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
