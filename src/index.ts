import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
// Side-effect imports: these register plugins and augment prototypes at load time
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/core/Materials/standardMaterial";
import { createAtmosphere } from "./world/atmosphere";
import { createCemetery, PLOT_HALF } from "./world/cemetery";
import { createForest } from "./world/forest";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);

const fpsDiv = document.createElement("div");
fpsDiv.id = "fps";
Object.assign(fpsDiv.style, {
  position: "absolute",
  top: "10px",
  right: "10px",
  color: "white",
  fontSize: "16px",
  fontWeight: "bold",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  padding: "5px 10px",
  borderRadius: "5px",
  fontFamily: "monospace",
  pointerEvents: "none",
});
document.body.appendChild(fpsDiv);

const createScene = () => {
  const scene = new Scene(engine);
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -0.4, 0);

  createAtmosphere(scene);
  createCemetery(scene);
  createForest(scene, PLOT_HALF * 1.6);

  // First-person camera: starts just outside the cemetery gate.
  const cam = new UniversalCamera("player", new Vector3(0, 1.7, -PLOT_HALF - 8), scene);
  cam.setTarget(new Vector3(0, 1.5, 0));
  cam.minZ = 0.1;
  cam.maxZ = 500;
  cam.fov = 1.0;
  cam.speed = 0.15;
  cam.inertia = 0.6;
  cam.angularSensibility = 2500;
  cam.keysUp = [87, 38]; // W, Up
  cam.keysDown = [83, 40]; // S, Down
  cam.keysLeft = [65, 37]; // A, Left
  cam.keysRight = [68, 39]; // D, Right
  cam.checkCollisions = true;
  cam.applyGravity = true;
  cam.ellipsoid = new Vector3(0.35, 0.85, 0.35); // ~1.7m eye height
  cam.attachControl(canvas, true);

  // Click to capture the mouse for free look (Esc releases it).
  canvas.addEventListener("click", () => {
    if (!engine.isPointerLock) engine.enterPointerlock();
  });

  return scene;
};

const scene = createScene();
if (import.meta.env.DEV) (window as unknown as { scene: Scene }).scene = scene; // handy for console debugging
engine.runRenderLoop(() => {
  scene.render();
  fpsDiv.innerText = `${engine.getFps().toFixed()} FPS`;
});

window.addEventListener("resize", () => {
  engine.resize();
});
