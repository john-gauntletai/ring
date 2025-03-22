import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { loadModel, addResizeEventListeners } from "./_lib/helpers.js";
import PlayerEntity from "./entities/PlayerEntity.js";
// import EnemyEntity from "./entities/EnemyEntity.js";
import Camera from "./entities/Camera.js";
import KEYS from "./_lib/keys";
import GrassComponent from "./components/GrassComponent.js";
import FlatTerrain from "./components/FlatTerrain.js";

import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

window.GAME_STARTED = true;

const LOADING_MANAGER = new THREE.LoadingManager();
const TERRAIN_SIZE = 300;

LOADING_MANAGER.onProgress = (url, itemsLoaded, itemsTotal) => {
  // console.log(url, itemsLoaded, itemsTotal);
};

LOADING_MANAGER.onLoad = () => {
  console.log("Loaded");
};

LOADING_MANAGER.onError = (url) => {
  console.error(url);
};

async function generateHDR(scene) {
  const hdriLoader = new RGBELoader();
  const texture = await hdriLoader.loadAsync("/assets/hdr/kingdom-sky.hdr");
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
}

function generateLight(scene) {
  // Ambient Light: Reduced intensity for darker feel
  const ambientLight = new THREE.AmbientLight(0xf5f9ff, 0.5); // Reduced from 0.7 to 0.5
  scene.add(ambientLight);

  // Directional Light: Maintain sun brightness but adjust color for contrast
  const dirLight = new THREE.DirectionalLight(0xffeecc, 2.0); // Slightly warmer, reduced intensity
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
  dirLight.shadow.radius = 2.0; // Increased for softer shadows against darker terrain
  scene.add(dirLight);
  
  // Secondary fill light to balance shadows (from opposite direction)
  const fillLight = new THREE.DirectionalLight(0xd0e6ff, 0.3); // Reduced from 0.4 to 0.3
  fillLight.position.set(-30, 30, -20); // Opposite side from main light
  scene.add(fillLight);
  
  // Add a ground-reflecting light to brighten the terrain
  const groundLight = new THREE.HemisphereLight(0xffffff, 0x5c4b2d, 0.35); // Darker ground reflection
  scene.add(groundLight);
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
  renderer.outputColorSpace = THREE.SRGBColorSpace; // Updated from outputEncoding
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // Recommended for HDR
  renderer.toneMappingExposure = 0.7; // Reduced to make the scene darker overall

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

  // Create a flat terrain
  const terrain = new FlatTerrain(TERRAIN_SIZE, 32);
  terrain.init();
  terrain.addToScene(scene);

  // Load models
  const [player, goldenKnight] = await Promise.all([
    loadModel("/assets/models/austen-out.glb", scene, LOADING_MANAGER),
    loadModel("/assets/models/golden-knight-out.glb", scene, LOADING_MANAGER),
    // loadModel("/assets/models/dragon-out.glb", scene),
  ]);

  const PLAYER = new PlayerEntity(
    player.model,
    player.animations,
    player.mixer
  );

  // const ENEMY = new EnemyEntity(
  //   goldenKnight.model,
  //   goldenKnight.animations,
  //   goldenKnight.mixer
  // );

  // Create camera
  window.CAMERA = new Camera(PLAYER, renderer);
  scene.add(CAMERA.camera);

  // Add axes helper to player
  const axesHelperPlayer = new THREE.AxesHelper(5);
  PLAYER.model.add(axesHelperPlayer);

  // Initialize grass component
  const grass = new GrassComponent(scene, PLAYER);
  grass.init();
  
  // Position grass group at ground level
  grass.grassGroup.position.y = 0;
  
  // Debug: Verify grass is added to scene
  console.log("Grass component initialized:");
  console.log("- Group added to scene:", scene.children.includes(grass.grassGroup));
  console.log("- Number of LOD geometries:", grass.geometryLow ? 1 : 0, grass.geometryHigh ? 1 : 0);
  console.log("- Number of materials:", grass.grassMaterialLow ? 1 : 0, grass.grassMaterialHigh ? 1 : 0);

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
  let logTimer = 0;
  
  function animate() {
    stats.begin();

    const delta = clock.getDelta();
    logTimer += delta;

    PLAYER.update(delta);
    CAMERA.update(delta, PLAYER);
    
    // Update grass animation and LOD
    // Only show log messages every 2 seconds to avoid console spam
    const shouldLog = logTimer > 5.0;
    if (shouldLog) {
      logTimer = 0;
    }
    
    grass.update(delta, CAMERA.camera, shouldLog);

    renderer.render(scene, CAMERA.camera);

    stats.end();
  }

  renderer.setAnimationLoop(animate);
}

window.addEventListener("DOMContentLoaded", init);
