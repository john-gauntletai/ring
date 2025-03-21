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
  generateTerrain,
} from "./_lib/heightmapGenerator.js";
import GrassComponent from "./components/GrassComponent.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

window.GAME_STARTED = true;

const LOADING_MANAGER = new THREE.LoadingManager();
const TERRAIN_SIZE = 500;

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
const TERRAIN_HEIGHT = 3;
const TERRAIN_MIN_HEIGHT = 0;

// Reference to grass system
let grassSystem;

async function generateHDR(scene) {
  const hdriLoader = new RGBELoader();
  const texture = await hdriLoader.loadAsync("/assets/hdr/kingdom-sky.hdr");
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
}

function generateLight(scene) {
  // Ambient Light: Bright afternoon light
  const ambientLight = new THREE.AmbientLight(0xf5f9ff, 0.6); // Slightly blue-tinted, higher intensity
  scene.add(ambientLight);

  // Directional Light: Afternoon sun from positive X direction to match HDR
  const dirLight = new THREE.DirectionalLight(0xfffaf0, 2.0); // Warm white light, bright
  dirLight.position.set(50, 40, 10); // Positioned at positive X to match HDR sun
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 4096;
  dirLight.shadow.mapSize.height = 4096;
  dirLight.shadow.camera.top = 40;
  dirLight.shadow.camera.bottom = -40;
  dirLight.shadow.camera.left = -40;
  dirLight.shadow.camera.right = 40;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 500;
  dirLight.shadow.bias = -0.0001;
  dirLight.shadow.radius = 1.5; // Sharper shadows for mid-day
  scene.add(dirLight);
  
  // Secondary fill light to balance shadows (from opposite direction)
  const fillLight = new THREE.DirectionalLight(0xd0e6ff, 0.3); // Sky blue light
  fillLight.position.set(-30, 30, -20); // Opposite side from main light
  scene.add(fillLight);
}

function generateGrid(scene) {
  const grid = new THREE.GridHelper(100, 100);
  scene.add(grid);
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

  // Set up renderer before generating terrain to ensure proper shader setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(window.devicePixelRatio);
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

  // Set up scene lighting and environment
  generateLight(scene);
  generateHDR(scene);

  // Generate terrain after renderer is initialized
  const heightmap = generateHeightmap(
    TERRAIN_SIZE,
    TERRAIN_SIZE,
    0.01,
    5,
    4,
    0.5
  );
  const terrain = generateTerrain(TERRAIN_SIZE, TERRAIN_SIZE, 2, 2, heightmap);
  scene.add(terrain);

  // Add axes helper
  const axesHelper = new THREE.AxesHelper(15); // The parameter defines the length of the axes
  scene.add(axesHelper);

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

  // Set terrain data for player to follow terrain
  PLAYER.setTerrainData(
    heightmap,
    TERRAIN_SIZE,
    TERRAIN_MIN_HEIGHT,
    TERRAIN_HEIGHT
  );

  // Ensure player starts at the correct height on the terrain
  const initialX = PLAYER.model.position.x;
  const initialZ = PLAYER.model.position.z;
  const initialY = PLAYER.sampleHeight(initialX, initialZ);
  PLAYER.model.position.y = initialY + PLAYER.heightOffset;

  // Create camera
  window.CAMERA = new Camera(PLAYER, renderer);
  scene.add(CAMERA.camera);

  // Load environment
  await loadEnvironment(scene);

  // Add axes helper to player
  const axesHelperPlayer = new THREE.AxesHelper(5);
  PLAYER.model.add(axesHelperPlayer);

  // Initialize grass system
  grassSystem = new GrassComponent({
    scene: scene,
    heightmap: heightmap,
    terrainSize: TERRAIN_SIZE,
    maxHeight: TERRAIN_HEIGHT, // Use the same height as terrain
    minHeight: TERRAIN_MIN_HEIGHT,
    heightOffset: 0,
    patchSize: 20, // Larger patch size for better coverage
    density: 1, // Increased density for better appearance
    playerObject: PLAYER.model,
  });

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
