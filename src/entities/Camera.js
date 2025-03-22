import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import CameraControls from 'camera-controls';

import KEYS from "../_lib/keys";

CameraControls.install( { THREE: THREE } );

const ORBIT_SPEED = 0.8;
const OVER_SHOULDER_DISTANCE = 3;
const DISTANCE_TO_PLAYER = 5.5;

class Camera {
  constructor(playerEntity, renderer) {
    this.camera = this.initializeCamera();
    this.controls = new CameraControls(this.camera, renderer.domElement);

    this.controls.smoothTime = 0.05; // Smooth movement
    this.controls.draggingSmoothTime = 0.1; // Smoothness during mouse drag
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.minPolarAngle = Math.PI / 3;

    this.locations = {
      behindPlayer: new THREE.Object3D(),
      startScreen: new THREE.Object3D(),
      overShoulder: new THREE.Object3D(),
    };

    this.locations.behindPlayer.position.set(
      playerEntity.model.position.x,
      playerEntity.model.position.y + 1,
      playerEntity.model.position.z + DISTANCE_TO_PLAYER
    );

    this.locations.startScreen.position.set(
      playerEntity.model.position.x + 5,
      playerEntity.model.position.y + 1,
      playerEntity.model.position.z + DISTANCE_TO_PLAYER
    );

    this.activeLocation = "behindPlayer";

    this.controls.moveTo(
      this.locations[this.activeLocation].position.x,
      this.locations[this.activeLocation].position.y,
      this.locations[this.activeLocation].position.z
    );
    this.lookAtPlayer(playerEntity);
  }

  initializeCamera() {
    return new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
  }

  lookAtPlayer(playerEntity, smooth = true) {
    if (this.activeLocation === "behindPlayer") {
      this.controls.setTarget(
        playerEntity.model.position.x,
        playerEntity.model.position.y + 1.7,
        playerEntity.model.position.z,
        smooth
      );
    }
  }

  update(delta, playerEntity) {
    if (!window.GAME_STARTED) {
      return;
    }

    if (KEYS.arrowleft) {
      this.controls.rotate(ORBIT_SPEED * delta, 0, true);
    } else if (KEYS.arrowright) {
      this.controls.rotate(-ORBIT_SPEED * delta, 0, true);
    }

    if (KEYS.arrowup) {
      this.controls.rotate(0, -ORBIT_SPEED * delta, true); // Tilt upward (negative pitch)
    } else if (KEYS.arrowdown) {
      this.controls.rotate(0, ORBIT_SPEED * delta, true); // Tilt downward (positive pitch)
    }

    this.controls.update(delta);
  }
}

export default Camera;
