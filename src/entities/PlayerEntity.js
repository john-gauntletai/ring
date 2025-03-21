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

    this.runVelocity = 6;
    this.walkVelocity = 1.5;
    this.moveDirection = new THREE.Vector3();
    this.rotateAngle = new THREE.Vector3(0, 1, 0);
    this.rotateQuaternion = new THREE.Quaternion(); // Used for smooth rotation

    // Track attack states
    this.isAttacking = false;
    this.currentAttack = null;
    this.attackAnimationComplete = true;

    // Track currently playing actions for animation completion
    this.activeAction = null;

    // Terrain following
    this.heightmap = null;
    this.terrainSize = 0;
    this.minHeight = 0;
    this.maxHeight = 3;
    this.heightOffset = 0;

    console.log('this.animations', this.animations);
    // this.init();
  }

  // Set terrain data for height sampling
  setTerrainData(heightmap, terrainSize, minHeight, maxHeight) {
    this.heightmap = heightmap;
    this.terrainSize = terrainSize;
    this.minHeight = minHeight;
    this.maxHeight = maxHeight;
    console.log('Terrain data set for player:', { terrainSize, minHeight, maxHeight });
  }

  // Sample height from the heightmap at the player's position
  sampleHeight(worldX, worldZ) {
    if (!this.heightmap) {
      console.warn('No heightmap available for sampling');
      return 0;
    }
    
    try {
      // Convert world coordinates to heightmap UV coordinates (0-1)
      const uvX = (worldX + (this.terrainSize / 2)) / this.terrainSize;
      const uvZ = (worldZ + (this.terrainSize / 2)) / this.terrainSize;
      
      // Clamp UVs to 0-1 range to prevent sampling outside the heightmap
      const clampedUvX = Math.max(0, Math.min(1, uvX));
      const clampedUvZ = Math.max(0, Math.min(1, uvZ));
      
      if (uvX !== clampedUvX || uvZ !== clampedUvZ) {
        // Position is outside terrain bounds
        return this.minHeight;
      }
      
      // Check if we can access heightmap data directly
      if (this.heightmap.image && this.heightmap.image.data) {
        // Get image dimensions
        const width = this.heightmap.image.width || 256;
        const height = this.heightmap.image.height || 256;
        
        // Convert UV to pixel coordinates
        const pixelX = Math.floor(clampedUvX * (width - 1));
        const pixelZ = Math.floor(clampedUvZ * (height - 1));
        
        // Calculate pixel index in the data array
        const pixelIndex = pixelZ * width + pixelX;
        
        // Get height value (handle both Uint8 and Float32 formats)
        let heightValue;
        if (this.heightmap.image.data instanceof Float32Array) {
          // If using float format (0-1 range)
          heightValue = this.heightmap.image.data[pixelIndex];
        } else {
          // If using standard 8-bit format (0-255 range)
          heightValue = this.heightmap.image.data[pixelIndex] / 255.0;
        }
        
        // Scale by height range
        const calculatedHeight = this.minHeight + (heightValue * (this.maxHeight - this.minHeight));
        
        return calculatedHeight;
      } else {
        // Fallback to a simple height function if heightmap can't be accessed
        const heightNoise = Math.sin(worldX * 0.2) * Math.cos(worldZ * 0.2) * 0.5 + 0.5;
        return this.minHeight + heightNoise * (this.maxHeight - this.minHeight);
      }
    } catch (error) {
      console.error('Error sampling height:', error);
      return this.minHeight;
    }
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
      
      // Calculate new position
      const newX = this.model.position.x + moveX;
      const newZ = this.model.position.z + moveZ;
      
      // Update X and Z position
      this.model.position.x = newX;
      this.model.position.z = newZ;
      
      // Update camera position in X and Z
      this.updateCamera(moveX, moveZ, 0);
    }
    
    // Always update height, whether moving or not
    if (this.heightmap) {
      this.updatePlayerHeight(delta);
    }
  }
  
  // New method to handle height updates separately
  updatePlayerHeight(delta) {
    // Sample height at current position
    const terrainHeight = this.sampleHeight(this.model.position.x, this.model.position.z);
    
    // Calculate target Y with offset
    const targetY = terrainHeight + this.heightOffset;
    
    // Calculate current height difference
    const heightDiff = targetY - this.model.position.y;
    
    // Use smooth damping for height adjustment
    // Smaller height differences use faster adjustment speed
    const smoothingFactor = Math.min(1, delta * 5);
    
    // Apply smaller movements when close to target height
    const moveY = heightDiff * smoothingFactor;
    
    // Only update if the change is significant enough
    if (Math.abs(moveY) > 0.001) {
      this.model.position.y += moveY;
      
      // Update camera height to follow player
      // Do not update camera directly for small changes to prevent jitter
      if (Math.abs(moveY) > 0.01) {
        this.updateCamera(0, 0, moveY);
      }
    }
  }

  updateCamera(moveX, moveZ, moveY) {
    // move camera
    CAMERA.locations.behindPlayer.position.x += moveX;
    CAMERA.locations.behindPlayer.position.z += moveZ;
    
    // Only update camera Y if the change is significant
    if (Math.abs(moveY) > 0.01) {
      CAMERA.locations.behindPlayer.position.y += moveY * 0.8; // Reduced vertical follow
    }

    if (CAMERA.activeLocation === 'behindPlayer') {
      const currentCameraPos = new THREE.Vector3();
      CAMERA.controls.getPosition(currentCameraPos);
      
      // Create a new position with full X/Z movement but damped Y movement
      const newCameraPos = currentCameraPos.clone().add(
        new THREE.Vector3(moveX, Math.abs(moveY) > 0.01 ? moveY * 0.8 : 0, moveZ)
      );
      
      CAMERA.controls.setPosition(newCameraPos.x, newCameraPos.y, newCameraPos.z, false);
      CAMERA.lookAtPlayer(this);
    }
  }
}

export default PlayerEntity;
