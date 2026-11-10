import { Scene } from "@babylonjs/core/scene";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

// Small deterministic RNG so the cemetery layout and textures are the same every load.
export const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const makeTexture = (
  name: string,
  width: number,
  height: number,
  scene: Scene,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) => {
  // Deliberately tiny textures with bilinear filtering: the blurry, chunky look of a PS2-era game.
  const tex = new DynamicTexture(name, { width, height }, scene, true, Texture.BILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE; // DynamicTexture defaults to clamp
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, width, height);
  draw(ctx, width, height);
  tex.update(true);
  return tex;
};

const noisePixels = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  base: [number, number, number],
  amount: number,
) => {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    img.data[i] = base[0] + n;
    img.data[i + 1] = base[1] + n;
    img.data[i + 2] = base[2] + n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};

export const createStoneTexture = (scene: Scene) =>
  makeTexture("stoneTex", 64, 64, scene, (ctx, w, h) => {
    const rng = mulberry32(7);
    noisePixels(ctx, w, h, rng, [118, 118, 112], 40);
    // weathering streaks
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(40,40,38,${0.15 + rng() * 0.2})`;
      ctx.fillRect(rng() * w, rng() * h * 0.5, 1 + rng() * 2, 8 + rng() * 24);
    }
    // cracks
    ctx.strokeStyle = "rgba(30,30,28,0.6)";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      let x = rng() * w;
      let y = rng() * h;
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (rng() - 0.5) * 14;
        y += rng() * 10;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // moss creeping up from the bottom
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(60,80,40,${0.25 + rng() * 0.35})`;
      const y = h - Math.pow(rng(), 2) * h * 0.6;
      ctx.fillRect(rng() * w, y, 2 + rng() * 5, 2 + rng() * 4);
    }
  });

export const createDirtTexture = (scene: Scene) =>
  makeTexture("dirtTex", 64, 64, scene, (ctx, w, h) => {
    const rng = mulberry32(11);
    noisePixels(ctx, w, h, rng, [78, 62, 45], 40);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(${120 + rng() * 30},${110 + rng() * 20},${95},0.6)`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
    }
  });

export const createFenceTexture = (scene: Scene) =>
  makeTexture("fenceTex", 128, 128, scene, (ctx, w, h) => {
    const iron = "rgb(22,22,24)";
    ctx.fillStyle = iron;
    // rails
    ctx.fillRect(0, 26, w, 5);
    ctx.fillRect(0, 108, w, 6);
    // bars with spear tips
    for (let x = 6; x < w; x += 16) {
      ctx.fillRect(x - 1.5, 14, 3, h - 14);
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x + 4, 14);
      ctx.lineTo(x - 4, 14);
      ctx.closePath();
      ctx.fill();
    }
  });

export const createPineTexture = (scene: Scene) =>
  makeTexture("pineTex", 64, 128, scene, (ctx, w, h) => {
    const rng = mulberry32(3);
    ctx.fillStyle = "rgb(45,32,22)";
    ctx.fillRect(w / 2 - 3, h - 22, 6, 22);
    // layered jagged tiers, darkest at the bottom
    const tiers = 6;
    for (let t = 0; t < tiers; t++) {
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
      // a few lighter needles for texture
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(90,120,80,${0.25 + rng() * 0.3})`;
        const yy = top + 8 + rng() * 22;
        const spread = ((yy - top) / 34) * half;
        ctx.fillRect(w / 2 + (rng() - 0.5) * spread * 1.6, yy, 1, 2);
      }
    }
  });

export const createTreelineTexture = (scene: Scene) =>
  makeTexture("treelineTex", 256, 64, scene, (ctx, w, h) => {
    const rng = mulberry32(21);
    ctx.fillStyle = "rgb(24,32,28)";
    ctx.beginPath();
    ctx.moveTo(0, h);
    let x = 0;
    while (x < w) {
      const tw = 6 + rng() * 10;
      const peak = 4 + rng() * 26;
      ctx.lineTo(x + tw / 2, peak);
      ctx.lineTo(x + tw, 30 + rng() * 12);
      x += tw;
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  });

// Tileable (horizontally) fractal value noise for the cloud dome.
const valueNoise = (seed: number, periodX: number) => {
  const rng = mulberry32(seed);
  const size = 256;
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i++) table[i] = rng();
  const at = (x: number, y: number) =>
    table[(((y % size) + size) % size) * size + (((x % periodX) + periodX) % periodX)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
};

export const createStormSkyTexture = (scene: Scene, horizon: [number, number, number]) =>
  makeTexture("stormSkyTex", 256, 128, scene, (ctx, w, h) => {
    const octaves = [
      { f: 8, a: 0.5, n: valueNoise(1, 8) },
      { f: 16, a: 0.25, n: valueNoise(2, 16) },
      { f: 32, a: 0.15, n: valueNoise(3, 32) },
      { f: 64, a: 0.1, n: valueNoise(4, 64) },
    ];
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      // v: 0 at the top of the sky, 1 at the horizon line (canvas row h/2), below = ground side.
      const v = (h - 1 - y) / (h / 2); // texture is uploaded flipped
      for (let x = 0; x < w; x++) {
        let n = 0;
        for (const o of octaves) n += o.n((x / w) * o.f, ((h - 1 - y) / h) * o.f * 0.5) * o.a;
        // push the noise into heavy, lumpy cloud banks
        const cloud = Math.min(1, Math.max(0, (n - 0.35) * 2.2));
        // dark bruised undersides, slightly lighter tops
        let r = 38 + cloud * 70;
        let g = 42 + cloud * 72;
        let b = 50 + cloud * 70;
        // a sickly green-yellow tint in the brighter patches, like light before a storm
        g += cloud * cloud * 10;
        // fade into the fog colour near (and below) the horizon so the forest blends in
        const fade = Math.min(1, Math.max(0, (v - 0.55) / 0.45));
        r = r + (horizon[0] - r) * fade;
        g = g + (horizon[1] - g) * fade;
        b = b + (horizon[2] - b) * fade;
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
