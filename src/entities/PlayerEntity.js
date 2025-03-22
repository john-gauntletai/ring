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
    
    // Combat properties
    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.attackPower = 25;
    this.currentState = "IDLE"; // IDLE, ATTACKING, BLOCKING, DODGE, STAGGERED, DEAD
    this.invulnerable = false;
    this.staggerTime = 0;
    this.attackCooldown = 0;
    
    // References
    this.combatManager = null;

    console.log('this.animations', this.animations);
    this.init();
  }

  init() {
    this.markAsLoopOnce(this.animations.slash.action);
    this.markAsLoopOnce(this.animations.jumpAttack.action);
    this.markAsLoopOnce(this.animations.block.action);
    this.markAsLoopOnce(this.animations.death.action);
    
    // Set up animation complete callbacks
    this.setupAnimationCallbacks();
  }
  
  // Set up callbacks for animation completion
  setupAnimationCallbacks() {
    if (this.animations.attack) {
      this.animations.attack.action.getMixer().addEventListener('finished', (e) => {
        if (e.action === this.animations.attack.action) {
          this.onAttackComplete();
        }
      });
    }
    
    if (this.animations.slash) {
      this.animations.slash.action.getMixer().addEventListener('finished', (e) => {
        if (e.action === this.animations.slash.action) {
          this.onAttackComplete();
        }
      });
    }
    
    if (this.animations["jump attack"]) {
      this.animations["jump attack"].action.getMixer().addEventListener('finished', (e) => {
        if (e.action === this.animations["jump attack"].action) {
          this.onAttackComplete();
        }
      });
    }
  }
  
  // Called when attack animations complete
  onAttackComplete() {
    this.isAttacking = false;
    this.currentAttack = null;
    this.attackAnimationComplete = true;
    this.currentState = "IDLE";
    console.log("Attack complete");
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
  
  // Perform a light attack
  attack() {
    if (this.isAttacking || this.currentState === "STAGGERED" || this.currentState === "DEAD" || this.attackCooldown > 0) {
      return;
    }
    
    this.isAttacking = true;
    this.attackAnimationComplete = false;
    this.currentState = "ATTACKING";
    this.currentAttack = "light";
    
    // Play attack animation
    this.fadeToAction(this.animations.attack.action, false);
    
    // Create hitbox in front of player after a slight delay (mid animation)
    if (this.combatManager) {
      // Schedule hitbox creation
      setTimeout(() => {
        const hitboxOffset = new THREE.Vector3(0, 1, -1.5); // In front of player (player faces -Z)
        const hitboxSize = new THREE.Vector3(1.5, 1, 2); // Size of the hitbox
        
        this.combatManager.createHitbox(
          this.model,           // Parent object
          hitboxOffset,         // Position offset
          hitboxSize,           // Size
          this.attackPower,     // Damage
          0.2,                 // Duration in seconds
          { owner: this, knockback: 2 }  // Additional options
        );
        
        console.log("Created player attack hitbox");
      }, 300); // 300ms into the animation
    }
    
    // Set attack cooldown
    this.attackCooldown = 0.8; // 0.8 seconds before next attack
  }
  
  // Perform a heavy attack
  heavyAttack() {
    if (this.isAttacking || this.currentState === "STAGGERED" || this.currentState === "DEAD" || this.attackCooldown > 0) {
      return;
    }
    
    this.isAttacking = true;
    this.attackAnimationComplete = false;
    this.currentState = "ATTACKING";
    this.currentAttack = "heavy";
    
    // Play heavy attack animation
    this.fadeToAction(this.animations.slash.action, false);
    
    // Create larger hitbox in front of player after a delay
    if (this.combatManager) {
      // Schedule hitbox creation
      setTimeout(() => {
        const hitboxOffset = new THREE.Vector3(0, 1, -2); // Further in front for heavy attack
        const hitboxSize = new THREE.Vector3(2.5, 1.2, 2.5); // Larger size for heavy attack
        
        this.combatManager.createHitbox(
          this.model,           // Parent object
          hitboxOffset,         // Position offset
          hitboxSize,           // Size
          this.attackPower * 1.5, // Higher damage
          0.3,                 // Duration in seconds
          { owner: this, knockback: 4 }  // More knockback
        );
        
        console.log("Created player heavy attack hitbox");
      }, 500); // 500ms into the animation (heavy attack has longer windup)
    }
    
    // Set attack cooldown (longer for heavy attack)
    this.attackCooldown = 1.2; // 1.2 seconds before next attack
  }
  
  // Take damage from an attack
  takeDamage(damage) {
    if (this.invulnerable || this.currentState === "DEAD") {
      return;
    }
    
    this.health -= damage;
    console.log(`Player took ${damage} damage. Health: ${this.health}/${this.maxHealth}`);
    
    // Check for death
    if (this.health <= 0) {
      this.health = 0;
      this.die();
      return;
    }
    
    // Get staggered
    this.getStaggered();
  }
  
  // Enter staggered state
  getStaggered() {
    this.currentState = "STAGGERED";
    this.staggerTime = 0.5; // Staggered for 0.5 seconds
    
    // Play stagger animation (e.g., flinch or hit reaction)
    // For now we'll use the block animation as a placeholder
    this.fadeToAction(this.animations.block.action, false);
  }
  
  // Die
  die() {
    this.currentState = "DEAD";
    this.fadeToAction(this.animations.death.action, false);
    console.log("Player died");
  }
  
  // Set debug visualization mode
  setDebugVisualization(enabled) {
    // No specific debug visualization for player currently
    console.log(`Player debug visualization: ${enabled ? 'enabled' : 'disabled'}`);
  }


  update(delta) {
    // Update cooldown timers
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }
    
    // Handle staggered state
    if (this.currentState === "STAGGERED") {
      this.staggerTime -= delta;
      if (this.staggerTime <= 0) {
        this.currentState = "IDLE";
      }
      
      // Early return - no movement or attacks while staggered
      return;
    }
    
    // Skip remaining logic if dead or attacking
    if (this.currentState === "DEAD" || this.isAttacking) {
      // Update the mixer
      if (this.mixer) {
        this.mixer.update(delta);
      }
      return;
    }

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
