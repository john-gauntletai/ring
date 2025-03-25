import * as THREE from "three";

class DragonEntity {
  constructor(model, animations, mixer, soundManager) {
    this.model = model;
    this.animations = animations;
    this.mixer = mixer;
    this.soundManager = soundManager;
    console.log('Dragon animations', this.animations);

    // modify this to set where the dragon is originally
    this.model.scale.setScalar(0.35);
    this.model.position.set(0, 0, 0);
    
    // Track if the dragon has landed (set by EnemyEntity when 'down' animation plays)
    this.hasLanded = false;
    
    // Initialize the dragon
    this.init();
  }

  init() {
    this.markAsLoopOnce(this.animations.attack.action);
    this.markAsLoopOnce(this.animations.down.action);
    this.markAsLoopOnce(this.animations.fire.action);
    this.markAsLoopOnce(this.animations.roar.action);
    this.markAsLoopOnce(this.animations.roar1.action);
    this.markAsLoopOnce(this.animations.stop.action);
  }

  markAsLoopOnce(action) {
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
  }

  update(delta) {
    // Update the animation mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }
    
    // Make the dragon face the player at all times
    this.facePlayer();
    
    // If the dragon has landed, ensure it stays at ground level
    // This reinforces the logic in EnemyEntity.playDragonAnimationAndSound
    if (this.hasLanded && this.model) {
      // Get ground level from player position
      const groundLevel = window.PLAYER && window.PLAYER.model ? 
        window.PLAYER.model.position.y : 0;
        
      // Keep the dragon at ground level
      this.model.position.y = groundLevel;
    }
  }
  
  /**
   * Make the dragon face the player at all times
   */
  facePlayer() {
    // Skip if no player exists or if player isn't initialized yet
    if (!window.PLAYER || !window.PLAYER.model) {
      return;
    }
    
    // Store the current position to ensure it doesn't change during rotation
    const currentPosition = this.model.position.clone();
    
    // Get player position
    const playerPosition = window.PLAYER.model.position.clone();
    
    // Calculate direction vector from dragon to player
    const directionToPlayer = new THREE.Vector3().subVectors(
      playerPosition,
      this.model.position
    ).normalize();
    
    // Calculate the angle in the XZ plane (horizontal rotation)
    const targetAngle = Math.atan2(directionToPlayer.x, directionToPlayer.z);
    
    // Set the dragon's Y rotation directly to face the player
    // For this specific dragon model, we need to adjust the angle by testing different values
    
    // Store the original rotation
    const originalRotation = this.model.rotation.clone();
    
    // Try the direct angle without adjustment
    this.model.rotation.y = targetAngle;
    
    // Uncomment one of these if the dragon isn't facing correctly
    // Option 2: Add PI/2 rotation (90 degrees)
    // this.model.rotation.y = targetAngle + Math.PI/2;
    
    // Option 3: Subtract PI/2 rotation (-90 degrees)
    // this.model.rotation.y = targetAngle - Math.PI/2;
    
    // Option 4: Add full PI rotation (180 degrees)
    // this.model.rotation.y = targetAngle + Math.PI;
    
    // Ensure the position hasn't changed - force it back to original
    if (!this.model.position.equals(currentPosition)) {
      this.model.position.copy(currentPosition);
      console.log("Position corrected after rotation");
    }
    
    // If the rotation somehow changed the dragon's Y position and it has landed,
    // make sure it stays on the ground
    if (this.hasLanded) {
      const groundLevel = window.PLAYER && window.PLAYER.model ? 
        window.PLAYER.model.position.y : 0;
      this.model.position.y = groundLevel;
    }
  }
}

export default DragonEntity;