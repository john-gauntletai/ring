import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import {
  loadModel,
  loadMutantModel,
  addResizeEventListeners,
  applyEnvMapToModel,
  detectMobile,
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
import MobileControls from './controls/MobileControls.js';
import { TERRAIN_SIZE } from './entities/_constants.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
window.GAME_STARTED = false; // Set to false initially

// Get start screen elements
const startScreen = document.getElementById('start-screen');
const pressAnyKey = document.querySelector('.press-any-key');
const startButton = document.querySelector('.start-button');
const controlsExplanation = document.getElementById('controls-explanation');
const controlsPanel = document.getElementById('controls-panel');
const controlsToggle = document.querySelector('.controls-toggle');

// Initialize global sound manager
const soundManager = new SoundManager();
window.SOUND_MANAGER = soundManager;

// Initialize mobile controls if on a mobile device
let mobileControls;
let isMobileDevice = detectMobile();
let stats;
// Setup controls panel toggle functionality
function setupControlsPanel() {
  if (!isMobileDevice) {
    const minimizedControls = document.getElementById('minimized-controls');
    const controlsToggle = document.getElementById('controls-toggle');

    // Initialize controls panel after start screen is dismissed
    controlsPanel.style.display = 'block';

    // Handle toggle click
    controlsToggle.addEventListener('click', () => {
      controlsPanel.style.display = 'none';
      minimizedControls.style.display = 'block';
    });

    // Handle minimized controls click
    minimizedControls.addEventListener('click', () => {
      minimizedControls.style.display = 'none';
      controlsPanel.style.display = 'block';
    });
  }
}

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

async function generateHDR(scene) {
  const hdriLoader = new RGBELoader();
  const texture = await hdriLoader.loadAsync('/assets/hdr/kingdom-sky.hdr');
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
}

function generateLight(scene) {
  // Ambient Light: Increased intensity for better visibility
  const ambientLight = new THREE.AmbientLight(0xf5f9ff, 0.6); // Increased from 0.8 to 1.0
  scene.add(ambientLight);

  // Directional Light: Increase intensity and adjust position
  const dirLight = new THREE.DirectionalLight(0xffeecc, 1.5); // Increased from 2.0 to 2.5
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
  const fillLight = new THREE.DirectionalLight(0xd0e6ff, 0.4); // Increased from 0.3 to 0.5
  fillLight.position.set(-30, 30, -20);
  scene.add(fillLight);

  // Add player-specific light to ensure character visibility
  const playerLight = new THREE.PointLight(0xffffff, 0.8, 20);
  playerLight.position.set(0, 5, 0);
  playerLight.castShadow = false;
  if (isMobileDevice) {
    scene.add(playerLight);
  }
  // Store the player light in scene's userData for later repositioning
  scene.userData.playerLight = playerLight;

  // Add enemy-specific light for better visibility
  const enemyLight = new THREE.PointLight(0xffcc88, 1.0, 25);
  enemyLight.position.set(0, 5, 0);
  enemyLight.castShadow = false;
  if (isMobileDevice) {
    scene.add(enemyLight);
  }

  // // // Store the enemy light in scene's userData for later repositioning
  scene.userData.enemyLight = enemyLight;

  // Add a ground-reflecting light to brighten the terrain
  const groundLight = new THREE.HemisphereLight(0xffffff, 0x5c4b2d, 0.35); // Increased from 0.35 to 0.4
  scene.add(groundLight);
}

// Game initialization
async function initGame() {
  // Create scene
  const scene = new THREE.Scene();

  if (isMobileDevice) {
    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
      '/assets/skybox/nz.png',
      '/assets/skybox/pz.png',
      '/assets/skybox/py.png',
      '/assets/skybox/ny.png',
      '/assets/skybox/px.png',
      '/assets/skybox/nx.png',
    ]);

    scene.background = texture;
  } else {
    await generateHDR(scene);
  }

  // Set up renderer before generating terrain to ensure proper shader setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace; // Updated from outputEncoding
  if (isMobileDevice) {
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.2; // Reduced to make the scene darker overall
  } else {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5; // Reduced to make the scene darker overall
  }
  document.body.appendChild(renderer.domElement);
  // Add Stats (FPS meter)
  // stats = new Stats();
  // stats.domElement.style.position = 'absolute';
  // stats.domElement.style.top = '0px';
  // stats.domElement.style.right = '0px';
  // document.body.appendChild(stats.domElement);

  // Set up scene lighting and environment
  generateLight(scene);

  // Preload important sound effects
  if (soundManager) {
    soundManager.preloadSound('dragonRoar', '/assets/sounds/dragon roar.mp3');
    soundManager.preloadSound(
      'bossBattleMusic',
      '/assets/sounds/bossBattleMusic.mp3'
    );
    soundManager.preloadSound('victory', '/assets/sounds/victory.mp3');
  }

  // Create a flat terrain
  const terrain = new FlatTerrain(TERRAIN_SIZE, 32);
  terrain.init();
  terrain.addToScene(scene);

  // Load models
  const [player, enemy] = await Promise.all([
    loadModel('/assets/models/pieter-hair2.glb', scene, LOADING_MANAGER),
    loadModel('/assets/models/mutant-out.glb', scene, LOADING_MANAGER),
    // loadModel('/assets/models/austen2.glb', scene, LOADING_MANAGER),
    // loadMutantModel(scene, LOADING_MANAGER),
  ]);

  enemy.model.scale.setScalar(2);

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

  // Set up keyboard controls for desktop
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

  // Initialize mobile controls after everything else is set up
  mobileControls = new MobileControls();
  window.MOBILE_CONTROLS = mobileControls;

  addResizeEventListeners(CAMERA.camera, renderer);

  let clock = new THREE.Clock();
  let logTimer = 0;

  function animate() {
    if (stats) {
      stats.begin();
    }

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
    if (scene.userData.playerLight && isMobileDevice) {
      scene.userData.playerLight.position.copy(PLAYER.model.position);
      scene.userData.playerLight.position.y += 5; // Position light above player
    }

    // Update enemy light position to follow enemy
    if (scene.userData.enemyLight && ENEMY && isMobileDevice) {
      scene.userData.enemyLight.position.copy(ENEMY.model.position);
      scene.userData.enemyLight.position.y += 6; // Position light above enemy (slightly higher than player light)
    }

    const shouldLog = logTimer > 10.0;
    // const shouldLog = false;
    if (shouldLog) {
      logTimer = 0;
    }
    grass.update(delta, CAMERA.camera, shouldLog);
    renderer.render(scene, CAMERA.camera);
    if (stats) {
      stats.end();
    }
  }

  renderer.setAnimationLoop(animate);

  // Game has been started in the background
  window.GAME_STARTED = true;

  // Dispatch custom event to notify that game has started (behind the start screen)
  window.dispatchEvent(new Event('gameStarted'));

  // Return a function to reveal game (will be called when start button is clicked)
  return function revealGame() {
    // Make sure the controls panel is shown for non-mobile devices
    if (!isMobileDevice && controlsPanel) {
      controlsPanel.style.display = 'block';
    }

    // If the location overlay exists, show it now
    const locationOverlay = document.getElementById('location-overlay');
    if (locationOverlay) {
      locationOverlay.style.display = 'flex';
      // Trigger a reflow before setting opacity for the transition to work
      locationOverlay.offsetHeight;
      // Make the overlay visible with transition
      locationOverlay.style.opacity = '1';

      // Play the new area sound
      if (soundManager) {
        soundManager.preloadSound('newArea', '/assets/sounds/newArea.mp3');
        soundManager.playSound('newArea', { volume: 0.2 });

        // Start ambient wind sound
        if (!soundManager.sounds['ambientWind']) {
          soundManager.preloadSound(
            'ambientWind',
            '/assets/sounds/windBlowing.mp3'
          );
        }
        soundManager.startLoop('ambientWind', { volume: 1.0 });
      }

      // Hide the overlay after 5 seconds
      setTimeout(() => {
        locationOverlay.style.opacity = '0';
        // Wait for the fade-out transition to complete before hiding the element
        setTimeout(() => {
          locationOverlay.style.display = 'none';
        }, 2000); // 2 seconds for fade-out transition
      }, 3000); // Display for 3 seconds before starting fade-out
    }

    // Setup controls panel
    setupControlsPanel();
  };
}

// Handle the start screen functionality
function initStartScreen(revealGameFunc) {
  // Setup controls panel functionality
  setupControlsPanel();

  let firstKeyPressed = false;

  // Event listener for key press
  document.addEventListener('keydown', function (event) {
    if (startScreen.style.display !== 'none') {
      if (!firstKeyPressed) {
        // First key press
        firstKeyPressed = true;
        pressAnyKey.style.display = 'none';
        startButton.style.display = 'block';
      } else if (event.key === 'Enter') {
        // Enter key after first key press - start the game
        startGame();
      }
    }
  });

  // Event listener for mouse/touch click
  document.addEventListener('click', function (event) {
    if (startScreen.style.display !== 'none' && !firstKeyPressed) {
      // First click
      firstKeyPressed = true;
      pressAnyKey.style.display = 'none';
      startButton.style.display = 'block';
    }
  });

  // Start button click handler
  startButton.addEventListener('click', startGame);

  // Function to start the game
  function startGame() {
    // Hide the start screen
    startScreen.style.display = 'none';

    // Show controls panel for non-mobile devices
    if (!isMobileDevice && controlsPanel) {
      controlsPanel.style.display = 'block';
    }

    // Call the reveal function to show the location overlay and proceed with the game
    if (revealGameFunc) {
      revealGameFunc();
    }
  }
}

// Initialize everything when the DOM is loaded
window.addEventListener('DOMContentLoaded', async function () {
  // Initialize the game immediately (running behind start screen)
  const revealGame = await initGame();

  // Then set up the start screen on top of the running game
  if (startScreen) {
    startButton.style.display = 'none'; // Hide the start button initially
    initStartScreen(revealGame);
  } else {
    // If start screen is not found, just reveal the game
    revealGame();
  }
});
