import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import {
  loadModel,
  loadMutantModel,
  addResizeEventListeners,
  applyEnvMapToModel,
} from './_lib/helpers.js';
import PlayerEntity from './entities/PlayerEntity.js';
import EnemyEntity from './entities/EnemyEntity.js';
import Camera from './entities/Camera.js';
import KEYS from './_lib/keys';
import GrassComponent from './components/GrassComponent.js';
import FlatTerrain from './components/FlatTerrain.js';
import CombatManager from './combat/CombatManager.js';
import BossUI from './components/BossUI.js';
import PlayerUI from './components/PlayerUI.js';
import SoundManager from './_lib/SoundManager.js';
import { TERRAIN_SIZE } from './entities/_constants.js';

window.GAME_STARTED = true;

// Initialize global sound manager
const soundManager = new SoundManager();
window.SOUND_MANAGER = soundManager;

const LOADING_MANAGER = new THREE.LoadingManager();

LOADING_MANAGER.onProgress = (url, itemsLoaded, itemsTotal) => {
  // console.log(url, itemsLoaded, itemsTotal);
};

LOADING_MANAGER.onLoad = () => {
  console.log('Loaded');
};

LOADING_MANAGER.onError = (url) => {
  console.error(url);
};

function generateLight(scene) {
  // Ambient Light: Increased intensity for better visibility
  const ambientLight = new THREE.AmbientLight(0xf5f9ff, 0.8); // Increased from 0.8 to 1.0
  scene.add(ambientLight);

  // Directional Light: Increase intensity and adjust position
  const dirLight = new THREE.DirectionalLight(0xffeecc, 2); // Increased from 2.0 to 2.5
  dirLight.position.set(50, 50, 20); // Adjusted position for better player illumination
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
  dirLight.shadow.radius = 2.0;
  scene.add(dirLight);

  // Secondary fill light to balance shadows (from opposite direction)
  const fillLight = new THREE.DirectionalLight(0xd0e6ff, 0.3); // Increased from 0.3 to 0.5
  fillLight.position.set(-30, 30, -20);
  scene.add(fillLight);

  // Add a ground-reflecting light to brighten the terrain
  const groundLight = new THREE.HemisphereLight(0xffffff, 0x5c4b2d, 0.35); // Increased from 0.35 to 0.4
  scene.add(groundLight);
}

async function init() {
  // Create scene
  const scene = new THREE.Scene();

  const loader = new THREE.CubeTextureLoader();
  const texture = loader.load([
    '/assets/skybox/nz.png',
    '/assets/skybox/pz.png',
    '/assets/skybox/py.png',
    '/assets/skybox/ny.png',
    '/assets/skybox/px.png',
    '/assets/skybox/nx.png',
  ]);

  texture.encoding = THREE.sRGBEncoding;
  scene.background = texture;

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
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';
  stats.domElement.style.right = '0px';
  document.body.appendChild(stats.domElement);

  document.body.appendChild(renderer.domElement);

  // Set up scene lighting and environment
  generateLight(scene);
  // generateHDR(scene);

  // Create a flat terrain
  const terrain = new FlatTerrain(TERRAIN_SIZE, 32);
  terrain.init();
  terrain.addToScene(scene);

  // Load models
  const [player, enemy] = await Promise.all([
    // loadModel('/assets/models/pieter.glb', scene, LOADING_MANAGER),
    loadModel('/assets/models/austen2.glb', scene, LOADING_MANAGER),
    // loadModel('/assets/models/new archer.glb', scene, LOADING_MANAGER),
    // loadModel('/assets/models/pieter.glb', scene, LOADING_MANAGER),
    loadMutantModel(scene, LOADING_MANAGER),
  ]);

  if (enemy) {
    console.log('enemy animations', enemy.animations);
    applyEnvMapToModel(enemy.model, texture);
  }

  applyEnvMapToModel(player.model, texture);

  const PLAYER = new PlayerEntity(
    player.model,
    player.animations,
    player.mixer,
    soundManager
  );
  window.PLAYER = PLAYER;

  // Set the terrain reference for the player
  PLAYER.setTerrain(terrain);

  const ENEMY = new EnemyEntity(
    enemy.model,
    enemy.animations,
    enemy.mixer,
    soundManager
  );

  window.ENEMY = ENEMY;

  // Create camera
  window.CAMERA = new Camera(PLAYER, renderer);
  scene.add(CAMERA.camera);

  // Initialize combat manager
  const combatManager = new CombatManager();
  combatManager.registerEntity(PLAYER);
  combatManager.registerEntity(ENEMY);

  // Set references to combat manager in entities
  PLAYER.combatManager = combatManager;
  ENEMY.combatManager = combatManager;

  // Set up enemy references for player collision detection
  PLAYER.setEnemies([ENEMY]);

  // Enable debug mode with the ` (backtick) key
  window.addEventListener('keydown', (e) => {
    if (e.key === '`') {
      combatManager.setDebugMode(!combatManager.debugMode);
      console.log(
        `Debug mode: ${combatManager.debugMode ? 'enabled' : 'disabled'}`
      );
    }
  });

  // Initialize grass component
  const grass = new GrassComponent(scene, PLAYER);
  grass.init();

  // Initialize Boss UI
  const bossUI = new BossUI();
  window.BOSS_UI = bossUI;

  // Initialize Player UI
  const playerUI = new PlayerUI();
  window.PLAYER_UI = playerUI;

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    KEYS[key] = true;

    // Special key handling
    if (key === 'u') {
      PLAYER.slash();
    } else if (key === 'i') {
      PLAYER.slash2();
    } else if (key === 'o') {
      // "o" or spacebar for roll
      PLAYER.roll();
    } else if (key === 'j') {
      PLAYER.spinAttack();
    } else if (key === 'k') {
      PLAYER.kick();
    } else if (key === 'b') {
      PLAYER.block();
    } else if (key === 'l') {
      if (PLAYER.lockOnEntity === ENEMY) {
        PLAYER.toggleLockOn();
      } else {
        PLAYER.toggleLockOn(ENEMY);
      }
    } else if (key === 'p') {
      PLAYER.powerUp();
    }
  });

  window.addEventListener('keyup', (event) => {
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
    ENEMY.update(delta, PLAYER);

    CAMERA.update(delta, PLAYER);

    // Update combat manager
    combatManager.update(delta);

    // Update UI
    if (window.BOSS_UI) {
      window.BOSS_UI.update();
    }

    if (window.PLAYER_UI) {
      window.PLAYER_UI.update();
    }

    // Update player light position to follow player
    if (scene.userData.playerLight) {
      scene.userData.playerLight.position.copy(PLAYER.model.position);
      scene.userData.playerLight.position.y += 5; // Position light above player
    }

    const shouldLog = logTimer > 10.0;
    if (shouldLog) {
      logTimer = 0;
    }
    grass.update(delta, CAMERA.camera, true);
    renderer.render(scene, CAMERA.camera);
    stats.end();
  }

  renderer.setAnimationLoop(animate);
}

window.addEventListener('DOMContentLoaded', init);
