import "./reset.css";

import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
} from "postprocessing";
import Stats from "stats.js";
import {
  AnimationClip,
  AnimationMixer,
  AxesHelper,
  Clock,
  Color,
  LoopPingPong,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

const isDebug = false;

const stats = new Stats();
document.body.appendChild(stats.dom);

const gltfLoader = new GLTFLoader();
const pmremLoader = new RGBELoader();

const renderer = new WebGLRenderer({
  canvas: document.querySelector("#canvas") as HTMLCanvasElement,
  powerPreference: "high-performance",
  antialias: false,
  stencil: false,
  depth: true,
});

renderer.outputColorSpace = SRGBColorSpace;

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const camera = new PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.y = 1;
camera.position.x = 0;
camera.position.z = 4;
camera.lookAt(0, 0, 1);

const scene = new Scene();
scene.background = new Color(0x121212);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomEffect = new BloomEffect({
  intensity: 1.2,
  luminanceThreshold: 0.7,
});

const fxaaEffect = new FXAAEffect();

const effectPass = new EffectPass(camera, fxaaEffect, bloomEffect);
composer.addPass(effectPass);

let snitch: GLTF;
let animationMixer: AnimationMixer;

const clock = new Clock();
const pmrem = new PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();

let scrollY = 0;
let targetScrollY = 0;
const maxScroll = 5000;

Promise.all([
  new Promise<GLTF>((resolve, reject) =>
    gltfLoader.load(
      "/models/golden_snitch_sgp29.glb",
      resolve,
      undefined,
      reject
    )
  ),
  new Promise<Texture>((resolve, reject) =>
    pmremLoader.load(
      "/hdr/carpentry_shop_02_1k.hdr",
      tex => {
        const env = pmrem.fromEquirectangular(tex).texture;
        tex.dispose();
        resolve(env);
      },
      undefined,
      reject
    )
  ),
])
  .then(([snitchGltf, env]) => {
    scene.environment = env;

    snitch = snitchGltf;
    snitch.scene.position.set(0, 1, 0);
    snitch.scene.scale.set(0.0005, 0.0005, 0.0005);

    snitch.scene.traverse((obj: Object3D) => {
      if (obj instanceof Mesh) {
        if (
          obj.material instanceof MeshStandardMaterial ||
          obj.material instanceof MeshPhysicalMaterial
        ) {
          obj.material.envMap = env;
          obj.material.envMapIntensity = 1;
          obj.material.needsUpdate = true;
          obj.material.metalness = 1;
          obj.material.roughness = 0.15;
        }
      }
    });

    animationMixer = new AnimationMixer(snitch.scene);

    scene.add(snitch.scene);

    const grabClip = AnimationClip.findByName(snitch.animations, "Alas|Action");
    if (!grabClip) throw new Error("Grabhold clip not found");
    const grabAction = animationMixer.clipAction(grabClip);
    grabAction.loop = LoopPingPong;
    grabAction.play();
  })
  .catch(console.error);

if (isDebug) {
  scene.add(new AxesHelper(10));
}

function resize() {
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  const resolutionUniform = fxaaEffect.uniforms.get("resolution");
  if (resolutionUniform) {
    resolutionUniform.value.set(
      1 / (window.innerWidth * pixelRatio),
      1 / (window.innerHeight * pixelRatio)
    );
  }
}

resize();

window.addEventListener("resize", resize);

window.addEventListener("wheel", event => {
  event.preventDefault();
  targetScrollY += event.deltaY * 0.5;
  targetScrollY = Math.max(0, Math.min(maxScroll, targetScrollY));
});

let touchStart = 0;
window.addEventListener("touchstart", event => {
  touchStart = event.touches[0].clientY;
});

window.addEventListener("touchmove", event => {
  event.preventDefault();
  const touchY = event.touches[0].clientY;
  const deltaY = touchStart - touchY;
  targetScrollY += deltaY * 2;
  targetScrollY = Math.max(0, Math.min(maxScroll, targetScrollY));
  touchStart = touchY;
});

function animate() {
  stats.begin();

  const deltaTime = clock.getDelta();

  scrollY = MathUtils.lerp(scrollY, targetScrollY, deltaTime * 3);
  const scrollProgress = scrollY / maxScroll;

  if (snitch) {
    const easedProgress = MathUtils.smoothstep(scrollProgress, 0, 1);
    const time = clock.elapsedTime;

    snitch.scene.position.y = MathUtils.lerp(1, -4, easedProgress);

    const floatSpeed = 0.4 + scrollProgress * 0.3;
    const floatIntensity = MathUtils.lerp(0.4, 0.1, scrollProgress);
    snitch.scene.position.x = Math.sin(time * floatSpeed) * floatIntensity;
    snitch.scene.position.z =
      Math.sin(time * floatSpeed * 0.7) * (floatIntensity * 0.5);

    const finaleScale = MathUtils.lerp(0.0005, 0.002, easedProgress);
    snitch.scene.scale.set(finaleScale, finaleScale, finaleScale);
  }

  if (snitch) {
    const easedProgress = MathUtils.smoothstep(scrollProgress, 0, 1);
    const time = clock.elapsedTime;

    camera.position.y = MathUtils.lerp(1, -3.5, easedProgress);

    camera.position.z = MathUtils.lerp(
      4,
      window.innerWidth < 768 ? 3.5 : 2.0,
      easedProgress
    );

    const orbitIntensity = Math.max(0, scrollProgress - 0.7) * 3.33;
    camera.position.x = Math.sin(time * 0.5) * orbitIntensity * 0.3;

    camera.lookAt(snitch.scene.position);
  }

  if (animationMixer) {
    animationMixer.update(deltaTime);
  }

  composer.render();

  stats.end();

  window.requestAnimationFrame(animate);
}

animate();
