import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";

// Side-effect imports: these register plugins and augment prototypes at load time
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";
import "@babylonjs/loaders/glTF";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);

const fpsDiv = document.createElement("div");
fpsDiv.id = "fps";
fpsDiv.style.position = "absolute";
fpsDiv.style.top = "10px";
fpsDiv.style.right = "10px";
fpsDiv.style.color = "white";
fpsDiv.style.fontSize = "16px";
fpsDiv.style.fontWeight = "bold";
fpsDiv.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
fpsDiv.style.padding = "5px 10px";
fpsDiv.style.borderRadius = "5px";
fpsDiv.style.fontFamily = "monospace";
fpsDiv.style.pointerEvents = "none";
document.body.appendChild(fpsDiv);

const createScene = async () => {
  const scene = new Scene(engine);

  // Load a glTF model
  await AppendSceneAsync("https://assets.babylonjs.com/meshes/boombox.glb", scene);

  // Create a default camera that frames the loaded model
  scene.createDefaultCamera(true, true, true);
  const cam = scene.activeCamera as ArcRotateCamera;
  cam.alpha += Math.PI;

  // WASD + Mouse Look
  cam.attachControl(canvas, true);
  cam.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
  cam.inputs.removeByType("ArcRotateCameraPointersInput");

  // Pointer Lock
  canvas.addEventListener("click", () => {
    canvas.requestPointerLock();
  });

  const keys: { [key: string]: boolean } = {};
  window.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
  window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

  scene.onBeforeRenderObservable.add(() => {
    const speed = 0.1;
    if (keys["w"]) cam.inertialRadiusOffset -= speed * 0.1;
    if (keys["s"]) cam.inertialRadiusOffset += speed * 0.1;
    if (keys["a"]) cam.inertialAlphaOffset -= speed * 0.1;
    if (keys["d"]) cam.inertialAlphaOffset += speed * 0.1;
  });

  // Mouse rotation without click
  window.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === canvas) {
      cam.alpha += e.movementX * 0.005;
      cam.beta += e.movementY * 0.005;
    }
  });

  // Create a default environment (skybox + ground + environment lighting)
  scene.createDefaultEnvironment({
    createGround: true,
    createSkybox: true,
  });

  return scene;
};

createScene().then((scene) => {
  engine.runRenderLoop(() => {
    scene.render();
    fpsDiv.innerText = `${engine.getFps().toFixed()} FPS`;
  });
});

window.addEventListener("resize", () => {
  engine.resize();
});
