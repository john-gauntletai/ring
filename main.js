import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const KEYS = {};
const LOADING_MANAGER = new THREE.LoadingManager();

LOADING_MANAGER.onProgress = (url, itemsLoaded, itemsTotal) => {
  console.log(url, itemsLoaded, itemsTotal);
};

LOADING_MANAGER.onLoad = () => {
  console.log("Loaded");
};

LOADING_MANAGER.onError = (url) => {
  console.error(url);
};

async function loadPlayer(scene) {
  const animations = {};

  const loader = new FBXLoader(LOADING_MANAGER);
  const model = await loader.loadAsync("/assets/models/archer/archer.fbx");

  model.scale.setScalar(0.1);
  model.traverse(function (child) {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(model);
  const mixer = new THREE.AnimationMixer(model);

  const animationsLoader = new FBXLoader(LOADING_MANAGER);
  animationsLoader.setPath("/assets/models/archer/animations/");

  function addAnimation(name, fbx, mixer) {
    const clip = fbx.animations[0];
    const action = mixer.clipAction(clip);
    animations[name] = {
      action,
      clip,
    };
  }

  await Promise.all([
    animationsLoader.loadAsync("Idle.fbx"),
    animationsLoader.loadAsync("Run.fbx"),
    animationsLoader.loadAsync("Walk.fbx"),
    // animationsLoader.loadAsync("Left Strafe Walk.fbx"),
    // animationsLoader.loadAsync("Right Strafe Walk.fbx"),
  ]).then(([fbx1, fbx2, fbx3, fbx4]) => {
    addAnimation("idle", fbx1, mixer);
    addAnimation("run", fbx2, mixer);
    addAnimation("walk", fbx3, mixer);
    // addAnimation("leftStrafeWalk", fbx2, mixer);
    // addAnimation("rightStrafeWalk", fbx3, mixer);
  });

  return {
    model,
    animations,
    mixer,
  };
}

async function init() {
  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0a0a0);
  // scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

  // Create camera
  CAMERA.camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  CAMERA.camera.position.set(0, 25, 25);
  scene.add(CAMERA.camera);

  // Create lights
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 3);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  // Create ground
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Add axes helper
  const axesHelper = new THREE.AxesHelper(15); // The parameter defines the length of the axes
  scene.add(axesHelper);

  // Red is X axis
  // Green is Y axis
  // Blue is Z axis

  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  CAMERA.orbitControls = new OrbitControls(CAMERA.camera, renderer.domElement);
  CAMERA.orbitControls.enableDamping = true;
  // CAMERA.orbitControls.minDistance = 5;
  // CAMERA.orbitControls.maxDistance = 15;

  // Load player
  const {
    model: playerModel,
    animations: playerAnimations,
    mixer: playerMixer,
  } = await loadPlayer(scene);

  // Add axes helper to player
  const axesHelperPlayer = new THREE.AxesHelper(5);
  playerModel.add(axesHelperPlayer);

  // const box = new THREE.Box3().setFromObject(playerModel);
  // const playerHeight = box.max.y - box.min.y;
  // console.log("Character height:", playerHeight);

  PLAYER.model = playerModel;
  PLAYER.animations = playerAnimations;
  PLAYER.mixer = playerMixer;

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

  let clock = new THREE.Clock();

  function animate() {
    const delta = clock.getDelta();
    PLAYER.update(delta);
    // CAMERA.update(delta);
    // Update all mixers with the same delta time
    renderer.render(scene, CAMERA.camera);
  }

  renderer.setAnimationLoop(animate);
}

const CAMERA = {
  camera: undefined,
  orbitControls: undefined,
};

const PLAYER = {
  model: undefined,
  animations: {},
  prevAction: null,
  runVelocity: 10,
  walkVelocity: 5,
  moveDirection: new THREE.Vector3(),
  rotateAngle: new THREE.Vector3(0, 1, 0),
  rotateQuaternion: new THREE.Quaternion(), // Used for smooth rotation
  mixer: undefined,

  fadeToAction(action) {
    if (this.prevAction !== action) {
      action.reset();
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(1);
      action.crossFadeFrom(
        this.prevAction || this.animations.idle.action,
        0.2,
        true
      );
      action.play();
    }
    this.prevAction = action;
  },

  directionOffset(keys) {
    let directionOffset = 0; // w

    if (keys.w) {
      if (keys.a) {
        directionOffset = Math.PI / 4; // w+a
      } else if (keys.d) {
        directionOffset = -Math.PI / 4; // w+d
      }
    } else if (keys.s) {
      if (keys.a) {
        directionOffset = Math.PI / 4 + Math.PI / 2; // s+a
      } else if (keys.d) {
        directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d
      } else {
        directionOffset = Math.PI; // s
      }
    } else if (keys.a) {
      directionOffset = Math.PI / 2; // a
    } else if (keys.d) {
      directionOffset = -Math.PI / 2; // d
    }

    return directionOffset;
  },

  update(delta) {
    // Movement and rotation logic
    const isMoving = KEYS.w || KEYS.s || KEYS.a || KEYS.d;
    const isWalking = KEYS.shift;

    if (isMoving) {
      if (isWalking) {
        this.fadeToAction(this.animations.walk.action);
      } else {
        this.fadeToAction(this.animations.run.action);
      }
    } else {
      this.fadeToAction(this.animations.idle.action);
    }

    // Update the mixer
    this.mixer.update(delta);

    if (isMoving) {
      // calculate towards camera direction
      const angleYCameraDirection = Math.atan2(
        CAMERA.camera.position.x - this.model.position.x,
        CAMERA.camera.position.z - this.model.position.z
      );

      const directionOffset = this.directionOffset(KEYS);

      // rotate model
      this.rotateQuaternion.setFromAxisAngle(
        this.rotateAngle,
        angleYCameraDirection + directionOffset + Math.PI
      );
      this.model.quaternion.rotateTowards(this.rotateQuaternion, 0.2);

      CAMERA.camera.getWorldDirection(this.moveDirection);
      this.moveDirection.y = 0;
      this.moveDirection.normalize();
      this.moveDirection.applyAxisAngle(this.rotateAngle, directionOffset);

      const velocity = isWalking ? this.walkVelocity : this.runVelocity;

      // move model & camera
      const moveX = this.moveDirection.x * velocity * delta;
      const moveZ = this.moveDirection.z * velocity * delta;
      this.model.position.x += moveX;
      this.model.position.z += moveZ;
      this.updateCamera(moveX, moveZ);
    }
  },

  updateCamera(moveX, moveZ) {
    // move camera
    CAMERA.camera.position.x += moveX;
    CAMERA.camera.position.z += moveZ;

    CAMERA.orbitControls.target.x = this.model.position.x;
    CAMERA.orbitControls.target.y = this.model.position.y + 1;
    CAMERA.orbitControls.target.z = this.model.position.z;
  },
};

window.addEventListener("DOMContentLoaded", init);
