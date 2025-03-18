import * as THREE from "three";

class Player {
  player: THREE.Object3D;
  constructor() {
    this.player = new THREE.Object3D();
  }

  init() {
    this.player = new THREE.Object3D();
  }

  update() {
    this.player.rotation.y += 0.01;
  }
}



export default Player;