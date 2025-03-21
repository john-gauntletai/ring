import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { Sky } from "three/addons/objects/Sky.js";
import { loadModel, addResizeEventListeners } from "./_lib/helpers.js";
import PlayerEntity from "./entities/PlayerEntity.js";
import Camera from "./entities/Camera.js";
import KEYS from "./_lib/keys";

import {
  generateHeightmap,
  createTerrainMesh,
} from "./_lib/heightmapGenerator.js";
import GrassComponent from "./components/GrassComponent.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

window.GAME_STARTED = true;

const LOADING_MANAGER = new THREE.LoadingManager();

LOADING_MANAGER.onProgress = (url, itemsLoaded, itemsTotal) => {
  // console.log(url, itemsLoaded, itemsTotal);
};

LOADING_MANAGER.onLoad = () => {
  console.log("Loaded");
};

LOADING_MANAGER.onError = (url) => {
  console.error(url);
};

// Global terrain parameters
const TERRAIN_SIZE = 100;
const TERRAIN_HEIGHT = 5;
const TERRAIN_MIN_HEIGHT = 0;

// Reference to grass system
let grassSystem;

function generateTerrain(scene) {
  // Generate a procedural heightmap with more pronounced features
  const heightmap = generateHeightmap(256, 0.04, 1.8, 4);

  // Create terrain mesh with the heightmap
  const terrain = createTerrainMesh(
    heightmap,
    TERRAIN_SIZE,
    TERRAIN_HEIGHT,
    100
  );
  terrain.receiveShadow = true;

  // Add terrain to scene
  scene.add(terrain);

  // Create a simple colored plane under the terrain for debugging
  const debugPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE),
    new THREE.MeshBasicMaterial({
      color: 0x005500,
      side: THREE.DoubleSide,
      wireframe: true,
    })
  );
  debugPlane.rotation.x = -Math.PI / 2;
  debugPlane.position.y = -0.1; // Slightly below the terrain
  scene.add(debugPlane);

  return { terrain, heightmap };
}

function generateFloor(scene) {
  // TEXTURES
  const textureLoader = new THREE.TextureLoader();
  const sandBaseColor = textureLoader.load(
    "./assets/textures/sand/Sand 002_COLOR.jpg"
  );
  const sandNormalMap = textureLoader.load(
    "./assets/textures/sand/Sand 002_NRM.jpg"
  );
  const sandHeightMap = textureLoader.load(
    "./assets/textures/sand/Sand 002_DISP.jpg"
  );
  const sandAmbientOcclusion = textureLoader.load(
    "./assets/textures/sand/Sand 002_OCC.jpg"
  );

  const WIDTH = 200;
  const LENGTH = 200;

  const geometry = new THREE.PlaneGeometry(WIDTH, LENGTH, 512, 512);
  const material = new THREE.MeshStandardMaterial({
    map: sandBaseColor,
    normalMap: sandNormalMap,
    displacementMap: sandHeightMap,
    displacementScale: 0.1,
    aoMap: sandAmbientOcclusion,
    roughness: 0.4, // Lower for more reflectivity
    metalness: 0.2, // Add some metalness for better light reflection
    envMapIntensity: 0.5, // Increase for brighter reflections
  });

  wrapAndRepeatTexture(material.map);
  wrapAndRepeatTexture(material.normalMap);
  wrapAndRepeatTexture(material.displacementMap);
  wrapAndRepeatTexture(material.aoMap);

  const floor = new THREE.Mesh(geometry, material);
  floor.receiveShadow = true;
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
}

async function generateHDR(scene) {
  const hdriLoader = new RGBELoader();
  const texture = await hdriLoader.loadAsync(
    // "/assets/hdr/blue_puresky_4k.hdr"
    "/assets/hdr/kingdom-sky.hdr"
    // "/assets/hdr/belfast_darker.hdr"
  );
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
}

// function generateLight(scene) {
//   const hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x080820, 4);
//   scene.add(hemiLight);

//   const spotlight = new THREE.SpotLight(0xffa95c, 4);
//   spotlight.castShadow = true;
//   spotlight.shadow.bias = -0.0001;
//   spotlight.shadow.mapSize.width = 1024 * 4;
//   spotlight.shadow.mapSize.height = 1024 * 4;
//   scene.add(spotlight);

//   const helper = new THREE.SpotLightHelper(spotlight);
//   scene.add(helper);
// }

function generateLight(scene) {
  // Ambient Light: Soft, cool-toned to simulate scattered sky light
  const ambientLight = new THREE.AmbientLight(0x8c9eb3, 0.3); // Cool blue-gray, low intensity
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffe4b5, 3); // Warm peachy tone, moderate intensity
  dirLight.position.set(10, 30, 30); // Position to mimic sunset angle (adjust to match skybox sun)
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048; // Softer shadows with lower resolution
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.top = 40;
  dirLight.shadow.camera.bottom = -40;
  dirLight.shadow.camera.left = -40;
  dirLight.shadow.camera.right = 40;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 5000;
  dirLight.shadow.bias = -0.0001; // Reduce shadow artifacts
  dirLight.shadow.radius = 1; // Softer shadow edges
  scene.add(dirLight);

  // const dirLight = new THREE.DirectionalLight(0xffe4b5, 2.0); // Increased from 1.5
  // dirLight.position.set(1000, 500, 300); // Kept for sunset angle
  // dirLight.castShadow = true;
  // dirLight.shadow.mapSize.width = 4096; // Higher resolution for sharper shadows
  // dirLight.shadow.mapSize.height = 4096;
  // dirLight.shadow.camera.top = 50; // Expanded slightly for larger terrain
  // dirLight.shadow.camera.bottom = -50;
  // dirLight.shadow.camera.left = -50;
  // dirLight.shadow.camera.right = 50;
  // dirLight.shadow.camera.near = 0.1;
  // dirLight.shadow.camera.far = 200;
  // dirLight.shadow.bias = -0.00005; // Tighter bias for crisper shadows
  // dirLight.shadow.radius = 1; // Reduced from 2 for sharper edges
  // scene.add(dirLight);
}

function generateGrid(scene) {
  const grid = new THREE.GridHelper(100, 100);
  scene.add(grid);
}

function wrapAndRepeatTexture(map) {
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.x = map.repeat.y = 10;
}

async function loadEnvironment(scene) {
  const loader = new GLTFLoader(LOADING_MANAGER);
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("three/examples/jsm/libs/draco/");
  dracoLoader.setDecoderConfig({ type: "js" });
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
  loader.setDRACOLoader(dracoLoader);
  // const model = await loader.loadAsync("/assets/models/kingdom.glb");
  // scene.add(model.scene);
}

async function init() {
  // Create scene
  const scene = new THREE.Scene();

  // scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);
  generateLight(scene);
  generateHDR(scene);
  
  // Generate terrain instead of flat floor
  // const { terrain, heightmap } = generateTerrain(scene);

  // Comment out old floor generation
  generateFloor(scene);

  // Add axes helper
  const axesHelper = new THREE.AxesHelper(15); // The parameter defines the length of the axes
  scene.add(axesHelper);

  // Red is X axis
  // Green is Y axis
  // Blue is Z axis

  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.gammaOutput = true; // Apply gamma correction
  renderer.gammaFactor = 2.2; // Standard gamma correction
  renderer.outputEncoding = THREE.sRGBEncoding; // Ensures colors are displayed correctly
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // Recommended for HDR
  renderer.toneMappingExposure = 0.6;

  // Add Stats (FPS meter)
  const stats = new Stats();
  stats.domElement.style.position = "absolute";
  stats.domElement.style.top = "0px";
  stats.domElement.style.left = "0px";
  document.body.appendChild(stats.domElement);

  document.body.appendChild(renderer.domElement);

  // Load models
  const [player, austen, dragon] = await Promise.all([
    loadModel("/assets/models/austen-out.glb", scene, LOADING_MANAGER),
    // loadModel("/assets/models/golden-knight-out.glb", scene, LOADING_MANAGER),
    // loadModel("/assets/models/dragon-out.glb", scene),
  ]);

  const PLAYER = new PlayerEntity(
    player.model,
    player.animations,
    player.mixer
  );

  // Create camera
  window.CAMERA = new Camera(PLAYER, renderer);
  scene.add(CAMERA.camera);

  // Load environment
  await loadEnvironment(scene);

  // Add axes helper to player
  const axesHelperPlayer = new THREE.AxesHelper(5);
  PLAYER.model.add(axesHelperPlayer);

  // Initialize grass system
  // grassSystem = new GrassComponent({
  //   scene: scene,
  //   heightMap: heightmap,
  //   terrainSize: TERRAIN_SIZE,
  //   maxHeight: TERRAIN_HEIGHT,
  //   minHeight: TERRAIN_MIN_HEIGHT,
  //   heightOffset: 0,
  //   patchSize: 10,
  //   density: 2, // Lower density for better performance
  //   playerObject: PLAYER.model,
  // });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    console.log(key);
    KEYS[key] = true;
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    KEYS[key] = false;
  });

  addResizeEventListeners(CAMERA.camera, renderer);

  let clock = new THREE.Clock();

  function animate() {
    stats.begin();

    const delta = clock.getDelta();

    PLAYER.update(delta);
    CAMERA.update(delta, PLAYER);

    // Update grass system
    if (grassSystem) {
      grassSystem.update(delta);
    }

    renderer.render(scene, CAMERA.camera);

    stats.end();
  }

  renderer.setAnimationLoop(animate);
}

window.addEventListener("DOMContentLoaded", init);
