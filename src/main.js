import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { loadModel, addResizeEventListeners } from "./_lib/helpers.js";
import PlayerEntity from "./entities/PlayerEntity.js";
import Camera from "./entities/Camera.js";
import KEYS from "./_lib/keys";

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

  const WIDTH = 80;
  const LENGTH = 80;

  const geometry = new THREE.PlaneGeometry(WIDTH, LENGTH, 512, 512);
  const material = new THREE.MeshStandardMaterial({
    map: sandBaseColor,
    normalMap: sandNormalMap,
    displacementMap: sandHeightMap,
    displacementScale: 0.1,
    aoMap: sandAmbientOcclusion,
    roughness: 0.4, // Lower for more reflectivity
    metalness: 0.2, // Add some metalness for better light reflection
    envMapIntensity: 1.0, // Increase for brighter reflections
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

function generateLight(scene) {
  // Add a slightly stronger ambient light
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  // Make the directional light brighter and position it for better coverage
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(-60, 100, -10);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.mapSize.width = 4096;
  dirLight.shadow.mapSize.height = 4096;
  scene.add(dirLight);

  // Add a secondary fill light from another angle
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(60, 60, 60);
  scene.add(fillLight);
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

  const loader = new THREE.CubeTextureLoader();
  const skybox = loader.load([
    "./assets/skybox/posx.jpg",
    "./assets/skybox/negx.jpg",
    "./assets/skybox/posy.jpg",
    "./assets/skybox/negy.jpg",
    "./assets/skybox/posz.jpg",
    "./assets/skybox/negz.jpg",
  ]);
  skybox.encoding = THREE.sRGBEncoding;
  scene.background = skybox;
  // scene.background = new THREE.Color(0xa8def0);
  // scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

  generateLight(scene);
  generateFloor(scene);
  generateGrid(scene);

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
  window.CAMERA = new Camera(player, renderer);
  scene.add(CAMERA.camera);
  // AUSTEN.model = austen.model;
  // AUSTEN.animations = austen.animations;
  // AUSTEN.mixer = austen.mixer;
  // console.log("austen", AUSTEN.animations);

  // DRAGON.model = dragon.model;
  // DRAGON.animations = dragon.animations;
  // DRAGON.mixer = dragon.mixer;
  // console.log('dragon', DRAGON.animations);

  // Load environment
  await loadEnvironment(scene);

  // Add axes helper to player
  const axesHelperPlayer = new THREE.AxesHelper(5);
  PLAYER.model.add(axesHelperPlayer);

  // CAMERA.camera.position.set(0, 25, CAMERA_DISTANCE);
  // CAMERA.lookAtTargetModel(PLAYER.model);

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
    renderer.render(scene, CAMERA.camera);

    stats.end();
  }

  renderer.setAnimationLoop(animate);
}

window.addEventListener("DOMContentLoaded", init);
