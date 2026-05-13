import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { ActionManager } from "@babylonjs/core/Actions/actionManager"
import { ExecuteCodeAction } from "@babylonjs/core/Actions/directActions"
import { Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector"
import { Axis } from "@babylonjs/core/Maths/math.axis"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
// Side-effect imports: these register plugins and augment prototypes at load time
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";
import "@babylonjs/loaders/glTF";
import * as BABYLON from '@babylonjs/core';

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

  var inputMap ={};
  scene.actionManager = new ActionManager(scene);
  scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, function (evt) {								
    inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
  }));
  scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, function (evt) {								
    inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
  }));

  // Load a glTF model
  await AppendSceneAsync("https://assets.babylonjs.com/meshes/boombox.glb", scene);
  const plane = MeshBuilder.CreatePlane("plane", { width: 10, height: 10}, scene);
  plane.position.y = 0;
  const mat = new StandardMaterial("mat", scene);
  mat.diffuseTexture = new Texture("./src/textures/grassTexture.jpg", scene);
  plane.material = mat;
  plane.rotation.x = Math.PI / 2;

  const light = new BABYLON.HemisphericLight("light", new Vector3(0, 1, 0), scene);

  // Create a default camera that frames the loaded model
  scene.createDefaultCamera(false, true, true);
  const cam = scene.activeCamera as UniversalCamera;
  cam.position.y = 1;
  const camY = cam.position.y;
  console.log(cam.position);

  // WASD + Mouse Look
  cam.inertia = 0;
  cam.getDirection(Axis.Z)
  cam.getDirection(Axis.Z).negate()
  cam.getDirection(Axis.X)
  cam.getDirection(Axis.X).negate()
  const speed = 1/100;
  scene.onBeforeRenderObservable.add(() => {
    if (keys["w"]) {
        const forward = cam.getDirection(Axis.Z);
        cam.position.addInPlace(forward.scale(speed));
    }
    if (keys["s"]) {
        const backward = cam.getDirection(Axis.Z);
        cam.position.addInPlace(backward.scale(-speed));
    }
    if (keys["d"]) {
        const right = cam.getDirection(Axis.X);
        cam.position.addInPlace(right.scale(speed));
    }
    if (keys["a"]) {
        const left = cam.getDirection(Axis.X);
        cam.position.addInPlace(left.scale(-speed));
    }
    cam.position.y = camY;
});
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
