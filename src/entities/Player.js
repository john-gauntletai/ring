import * as THREE from "three";
import { getDirectionOffset } from "../_lib/helpers";
import KEYS from "../_lib/keys";
import CAMERA from "./Camera";

const PLAYER = {
    model: undefined,
    animations: {},
    prevAction: null,
    runVelocity: 3,
    walkVelocity: 1,
    moveDirection: new THREE.Vector3(),
    rotateAngle: new THREE.Vector3(0, 1, 0),
    rotateQuaternion: new THREE.Quaternion(), // Used for smooth rotation
    mixer: undefined,
    
    // Track attack states
    isAttacking: false,
    currentAttack: null,
    attackAnimationComplete: true,
    
    // Track currently playing actions for animation completion
    activeAction: null,
    
    fadeToAction(action, loop = true) {
      if (this.prevAction !== action) {
        action.reset();
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        action.crossFadeFrom(
          this.prevAction || this.animations.idle.action,
          0.2,
          true
        );
        
        // Set looping behavior
        action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
        
        // For non-looping animations, set up to detect when finished
        if (!loop) {
          action.clampWhenFinished = true;
          
          // Store the current action and track when it will end
          this.activeAction = action;
          
          // Calculate when this animation will end
          if (this.mixer) {
            // Remove any existing finishing event listeners
            this.mixer.removeEventListener('finished', this.onAnimationFinished);
            
            // Add a new finishing event listener
            this.mixer.addEventListener('finished', this.onAnimationFinished);
          }
        }
        
        action.play();
      }
      this.prevAction = action;
    },
    
    // Handler for animation finished events
    onAnimationFinished: function(e) {
      // Reset attack state when attack animation finishes
      if (this.isAttacking) {
        this.isAttacking = false;
        this.currentAttack = null;
        this.attackAnimationComplete = true;
        
        // Transition back to idle animation
        if (this.animations.idle) {
          this.fadeToAction(this.animations.idle.action, true);
        }
      }
    },
  
    update(delta) {
      // Movement and rotation logic
      const isMoving = KEYS.w || KEYS.s || KEYS.a || KEYS.d;
      const isWalking = KEYS.shift;
      
      // Handle attack inputs only if not already attacking
      if (this.attackAnimationComplete) {
        if (KEYS.j) {
          this.isAttacking = true;
          this.currentAttack = 'attack1';
          this.attackAnimationComplete = false;
        } else if (KEYS.k) {
          this.isAttacking = true;
          this.currentAttack = 'slash';
          this.attackAnimationComplete = false;
        } else if (KEYS.l) {
          this.isAttacking = true;
          this.currentAttack = 'high spin';
          this.attackAnimationComplete = false;
        }
      }
      
      // Animation state management
      if (this.isAttacking) {
        // Play the appropriate attack animation once
        if (this.currentAttack === 'attack1' && this.animations.attack1) {
          this.fadeToAction(this.animations.attack1.action, false);
        } else if (this.currentAttack === 'slash' && this.animations.slash) {
          this.fadeToAction(this.animations.slash.action, false);
        } else if (this.currentAttack === 'high spin' && this.animations['high spin']) {
          this.fadeToAction(this.animations['high spin'].action, false);
        }
      } else if (isMoving) {
        if (isWalking) {
          this.fadeToAction(this.animations.walk.action);
        } else {
          this.fadeToAction(this.animations.run.action);
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

  export default PLAYER;