import "./reset.css";

import Stats from "stats.js";
import {
  AnimationClip,
  AnimationMixer,
  AxesHelper,
  CameraHelper,
  Clock,
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  FrontSide,
  LoopPingPong,
  Mesh,
  MeshStandardMaterial,
  CircleGeometry,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
  PMREMGenerator,
  MeshPhysicalMaterial,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  DepthOfFieldEffect,
  BloomEffect,
  HueSaturationEffect,
  FXAAEffect,
} from "postprocessing";

const isDebug = false;

const maxLife = 7 + Math.floor(Math.random() * 4);
let currentLife = maxLife;
let isDead = false;

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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

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

const directionalLight = new DirectionalLight(0xffffff, 2);
directionalLight.position.set(0, 5, 5);
directionalLight.target.position.set(0, 0, 0);

directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
const size = 2;
directionalLight.shadow.camera.top = size;
directionalLight.shadow.camera.bottom = -size;
directionalLight.shadow.camera.left = -size;
directionalLight.shadow.camera.right = size;

directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 10;

scene.add(directionalLight);

if (isDebug) {
  const shadowHelper = new CameraHelper(directionalLight.shadow.camera);
  scene.add(shadowHelper);
  const directionalLightHelper = new DirectionalLightHelper(directionalLight);
  scene.add(directionalLightHelper);
}

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

const pixelRatio = Math.min(window.devicePixelRatio, 2);
const resolutionUniform = fxaaEffect.uniforms.get("resolution");
if (resolutionUniform) {
  resolutionUniform.value.set(
    1 / (window.innerWidth * pixelRatio),
    1 / (window.innerHeight * pixelRatio)
  );
}

const effectPass = new EffectPass(
  camera,
  blurEffect,
  bloomEffect,
  hueSaturationEffect,
  fxaaEffect
);
composer.addPass(effectPass);

const geometry = new CircleGeometry(1.5, 64);
const material = new MeshStandardMaterial({ color: 0xf5f5f5 });
material.side = FrontSide;
const floor = new Mesh(geometry, material);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

let hand: GLTF;
let animationMixer: AnimationMixer;

const originalBgColor = new Color(0x121212);
const bloodColor = new Color(0x2a0808);

let handFallVelocity = 0;
const gravity = -0.02;

const clock = new Clock();
const pmrem = new PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();

Promise.all([
  new Promise<GLTF>((resolve, reject) =>
    gltfLoader.load("/models/the_hand.glb", resolve, undefined, reject)
  ),
  new Promise<Texture>((resolve, reject) =>
    pmremLoader.load(
      "/hdr/cyclorama_hard_light_1k.hdr",
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
  .then(([handGltf, env]) => {
    hand = handGltf;
    hand.scene.rotation.y = (Math.PI * 3) / 2;
    hand.scene.position.set(0, 1, 0.75);
    animationMixer = new AnimationMixer(hand.scene);

    scene.environment = env;

    hand.scene.traverse((obj: Object3D) => {
      if (obj instanceof Mesh) {
        obj.castShadow = true;

        if (
          obj.material instanceof MeshStandardMaterial ||
          obj.material instanceof MeshPhysicalMaterial
        ) {
          obj.material.envMap = env;
          obj.material.envMapIntensity = 0.15;
          obj.material.needsUpdate = true;
        }
      }
    });

    scene.add(hand.scene);

    const grabClip = AnimationClip.findByName(hand.animations, "GrabHold");
    if (!grabClip) throw new Error("Grabhold clip not found");
    const grabAction = animationMixer.clipAction(grabClip);
    grabAction.loop = LoopPingPong;
    grabAction.play();

    floor.material.envMap = env;
    floor.material.envMapIntensity = 0.2;
    floor.material.roughness = 0.9;
    floor.material.metalness = 0.0;
    floor.material.needsUpdate = true;

    const canvas = renderer.domElement;
    canvas.addEventListener("click", handleHit);
    canvas.addEventListener("touchend", handleHit);
    canvas.style.cursor = "pointer";
  })
  .catch(console.error);

if (isDebug) {
  scene.add(new AxesHelper(10));
}

function handleHit(event: Event) {
  if (isDead) return;

  event.preventDefault();

  currentLife--;

  updateBackgroundColor();

  if (currentLife <= 0) {
    isDead = true;
    if (animationMixer) {
      animationMixer.stopAllAction();
    }
  }
}

function updateBackgroundColor() {
  const t = (maxLife - currentLife) / maxLife;
  const newColor = originalBgColor.clone().lerp(bloodColor, t * 0.6);
  scene.background = newColor;

  const intensity = t;
  blurEffect.bokehScale = 2 + intensity * 8;
  bloomEffect.intensity = 1.2 + intensity * 3.0;
  hueSaturationEffect.hue = intensity * -0.3;
  hueSaturationEffect.saturation = intensity * 0.4;
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

  if (animationMixer && !isDead && currentLife > 0) {
    animationMixer.update(deltaTime);
  }

  if (isDead && hand) {
    handFallVelocity += gravity;
    hand.scene.position.y += handFallVelocity;

    if (hand.scene.position.y <= 0.5) {
      hand.scene.position.y = 0.3;
      hand.scene.rotation.z = (Math.PI * 20) / 90;
      hand.scene.rotation.x = (Math.PI * 40) / 90;
      handFallVelocity = 0;
    }
  }

  composer.render();

  stats.end();

  window.requestAnimationFrame(animate);
}

animate();
