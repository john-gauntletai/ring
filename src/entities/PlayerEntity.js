import * as THREE from "three";
import { getDirectionOffset } from "../_lib/helpers";
import KEYS from "../_lib/keys";

class PlayerEntity {
  constructor(model, animations, mixer) {
    this.model = model;
    // rotate model 180 degrees
    this.model.rotation.y = Math.PI;
    this.animations = animations;
    this.mixer = mixer;

    this.runVelocity = 3;
    this.walkVelocity = 1;
    this.moveDirection = new THREE.Vector3();
    this.rotateAngle = new THREE.Vector3(0, 1, 0);
    this.rotateQuaternion = new THREE.Quaternion(); // Used for smooth rotation

    // Track attack states
    this.isAttacking = false;
    this.currentAttack = null;
    this.attackAnimationComplete = true;

    // Track currently playing actions for animation completion
    this.activeAction = null;

    console.log('this.animations', this.animations);
    // this.init();
  }

  init() {
    this.markAsLoopOnce(this.animations.attack.action);
    this.markAsLoopOnce(this.animations.slash.action);
    this.markAsLoopOnce(this.animations["jump attack"].action);
    this.markAsLoopOnce(this.animations.block.action);
    this.markAsLoopOnce(this.animations.death.action);
  }

  markAsLoopOnce(action) {
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
  }

  fadeToAction(action, loop = true) {
    if (this.activeAction !== action) {
      action.reset();
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(1);
      action.crossFadeFrom(
        this.activeAction || this.animations.idle.action,
        0.5,
        true
      );
      action.play();
    }
    this.activeAction = action;
  }

  // Handler for animation finished events
  // onAnimationFinished: function(e) {
  //   // Reset attack state when attack animation finishes
  //   if (this.isAttacking) {
  //     this.isAttacking = false;
  //     this.currentAttack = null;
  //     this.attackAnimationComplete = true;

  //     // Transition back to idle animation
  //     if (this.animations.idle) {
  //       this.fadeToAction(this.animations.idle.action, true);
  //     }
  // }
  // }

  update(delta) {
    // Movement and rotation logic
    const isMoving = KEYS.w || KEYS.s || KEYS.a || KEYS.d;
    const isWalking = KEYS.shift;

    if (isMoving) {
      if (isWalking) {
        this.fadeToAction(this.animations.walkForward.action);
      } else {
        this.fadeToAction(this.animations.runForward.action);
      }
    } else {
      this.fadeToAction(this.animations.idle.action);
    }

    // Update the mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Only allow movement if not attacking
    if (isMoving && !this.isAttacking) {
      // calculate towards camera direction
      const angleYCameraDirection = Math.atan2(
        CAMERA.camera.position.x - this.model.position.x,
        CAMERA.camera.position.z - this.model.position.z
      );

      const directionOffset = getDirectionOffset(KEYS);

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
  }

  updateCamera(moveX, moveZ) {
    // move camera
    CAMERA.locations.behindPlayer.position.x += moveX;
    CAMERA.locations.behindPlayer.position.z += moveZ;

    if (CAMERA.activeLocation === 'behindPlayer') {
      const currentCameraPos = new THREE.Vector3();
      CAMERA.controls.getPosition(currentCameraPos);
      const newCameraPos = currentCameraPos.clone().add(new THREE.Vector3(moveX, 0, moveZ));
      CAMERA.controls.setPosition(newCameraPos.x, newCameraPos.y, newCameraPos.z, false);
      // CAMERA.camera.position.copy(CAMERA.locations[CAMERA.activeLocation].position);
      // CAMERA.camera.position.x += moveX;
      // CAMERA.camera.position.z += moveZ;
      CAMERA.lookAtPlayer(this);
    }

    
  }
}

export default PlayerEntity;
