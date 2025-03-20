
import * as THREE from "three";

const AUSTEN = {
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

  export default AUSTEN;