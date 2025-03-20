
import * as THREE from "three";

const DRAGON = {
    model: undefined,
    animations: {},
    prevAction: null,
    runVelocity: 50,
    walkVelocity: 15,
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

    update(delta) {
      
      this.mixer.update(delta);
  
    },
  
   
  };

  export default DRAGON;