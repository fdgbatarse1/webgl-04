import "./reset.css";

import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  HueSaturationEffect,
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
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

const isDebug = true;

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

new OrbitControls(camera, renderer.domElement);

const scene = new Scene();
scene.background = new Color(0x121212);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const blurEffect = new DepthOfFieldEffect(camera, {
  focusDistance: 0.02,
  focalLength: 0.2,
  bokehScale: 2,
});

const bloomEffect = new BloomEffect({
  intensity: 1.2,
  luminanceThreshold: 0.7,
});

const hueSaturationEffect = new HueSaturationEffect({
  hue: 0,
  saturation: 0,
});

const fxaaEffect = new FXAAEffect();

const effectPass = new EffectPass(camera, fxaaEffect);
composer.addPass(effectPass);

let snitch: GLTF;
let nimbus: GLTF;
let animationMixer: AnimationMixer;

const clock = new Clock();
const pmrem = new PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();

Promise.all([
  new Promise<GLTF>((resolve, reject) =>
    gltfLoader.load(
      "/models/golden_snitch_sgp29.glb",
      resolve,
      undefined,
      reject
    )
  ),
  new Promise<GLTF>((resolve, reject) =>
    gltfLoader.load("/models/nimbus_2000.glb", resolve, undefined, reject)
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
  .then(([snitchGltf, nimbusGltf, env]) => {
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

    nimbus = nimbusGltf;
    nimbus.scene.scale.set(0.01, 0.01, 0.01);
    nimbus.scene.position.set(0, 0, 0);
    nimbus.scene.rotation.set(0, Math.PI / 2, 0);

    nimbus.scene.traverse((obj: Object3D) => {
      if (obj instanceof Mesh) {
        if (
          obj.material instanceof MeshStandardMaterial ||
          obj.material instanceof MeshPhysicalMaterial
        ) {
          obj.material.envMap = env;
          obj.material.envMapIntensity = 2;
          obj.material.needsUpdate = true;
          obj.material.roughness = 0.9;
          obj.material.metalness = 0.0;
        }
      }
    });

    scene.add(nimbus.scene);

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

function animate() {
  stats.begin();

  const deltaTime = clock.getDelta();

  if (animationMixer) {
    animationMixer.update(deltaTime);
  }

  composer.render();

  stats.end();

  window.requestAnimationFrame(animate);
}

animate();
