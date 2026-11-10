import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { createStormSkyTexture } from "./textures";

// Grey-green haze: used for fog, the clear colour and the bottom of the sky so everything melts together.
const HORIZON: [number, number, number] = [74, 80, 82];
export const FOG_COLOR = new Color3(HORIZON[0] / 255, HORIZON[1] / 255, HORIZON[2] / 255);

export const createAtmosphere = (scene: Scene) => {
  scene.clearColor = new Color4(FOG_COLOR.r, FOG_COLOR.g, FOG_COLOR.b, 1);
  scene.ambientColor = new Color3(0.25, 0.27, 0.28);

  // Old-school linear fog: the forest fades out into murk instead of ending at a hard edge.
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = FOG_COLOR.clone();
  scene.fogStart = 12;
  scene.fogEnd = 105;

  const hemi = new HemisphericLight("skyLight", new Vector3(0, 1, 0), scene);
  hemi.diffuse = new Color3(0.72, 0.77, 0.8);
  hemi.groundColor = new Color3(0.16, 0.18, 0.16);
  hemi.specular = Color3.Black();
  const baseHemi = 0.75;
  hemi.intensity = baseHemi;

  const moon = new DirectionalLight("overcast", new Vector3(-0.3, -1, 0.4), scene);
  moon.diffuse = new Color3(0.6, 0.65, 0.7);
  moon.specular = Color3.Black();
  moon.intensity = 0.35;

  // Cloud dome
  const sky = MeshBuilder.CreateSphere(
    "stormSky",
    { diameter: 600, segments: 16, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  sky.infiniteDistance = true;
  sky.isPickable = false;
  const skyTex = createStormSkyTexture(scene, HORIZON);
  const skyMat = new StandardMaterial("stormSkyMat", scene);
  skyMat.disableLighting = true;
  skyMat.fogEnabled = false;
  skyMat.backFaceCulling = false;
  skyMat.emissiveTexture = skyTex;
  skyMat.diffuseColor = Color3.Black();
  skyMat.specularColor = Color3.Black();
  sky.material = skyMat;

  // Clouds drift slowly; distant lightning flickers every so often.
  let t = 0;
  let nextStrike = 6 + Math.random() * 8;
  let strikeTime = -1;
  const flashPattern = [0.06, 0.08, 0.12]; // on, off, on (seconds)

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    t += dt;
    skyTex.uOffset = (skyTex.uOffset + dt * 0.004) % 1;

    let flash = 0;
    if (strikeTime < 0 && t > nextStrike) strikeTime = 0;
    if (strikeTime >= 0) {
      strikeTime += dt;
      const [a, b, c] = flashPattern;
      if (strikeTime < a) flash = 1;
      else if (strikeTime < a + b) flash = 0.15;
      else if (strikeTime < a + b + c) flash = 0.8;
      else if (strikeTime < a + b + c + 0.4) flash = 0.8 * (1 - (strikeTime - a - b - c) / 0.4);
      else {
        strikeTime = -1;
        nextStrike = t + 8 + Math.random() * 14;
      }
    }
    hemi.intensity = baseHemi + flash * 1.1;
    skyTex.level = 1 + flash * 1.4;
    scene.fogColor.copyFrom(FOG_COLOR).scaleInPlace(1 + flash * 0.6);
    scene.clearColor.set(scene.fogColor.r, scene.fogColor.g, scene.fogColor.b, 1);
  });
};
