import * as THREE from "three";
import { DISTANCE_TO_PLAYER } from "./_constants";
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
    this.lockedOnRunVelocity = 4.5;
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

    console.log("this.animations", this.animations);
    this.init();
  }

  init() {
    this.markAsLoopOnce(this.animations.slash.action);
    this.markAsLoopOnce(this.animations.slash2.action);
    this.markAsLoopOnce(this.animations.jumpAttack.action);
    this.markAsLoopOnce(this.animations.spinAttack.action);
    this.markAsLoopOnce(this.animations.block.action);
    this.markAsLoopOnce(this.animations.death.action);
    this.markAsLoopOnce(this.animations.powerUp.action);
    this.markAsLoopOnce(this.animations.kick.action);
    this.markAsLoopOnce(this.animations.impact.action);
    this.markAsLoopOnce(this.animations.impact2.action);
    this.markAsLoopOnce(this.animations.roll.action);
    // Set up animation complete callbacks
    this.setupAnimationCallbacks();
  }

  // Set up callbacks for animation completion
  setupAnimationCallbacks() {
    this.mixer.addEventListener("finished", (e) => {
      if (
        e.action === this.animations.slash.action ||
        e.action === this.animations.slash2.action ||
        e.action === this.animations.jumpAttack.action ||
        e.action === this.animations.spinAttack.action ||
        e.action === this.animations.block.action ||
        e.action === this.animations.death.action ||
        e.action === this.animations.powerUp.action ||
        e.action === this.animations.kick.action ||
        e.action === this.animations.impact.action ||
        e.action === this.animations.impact2.action ||
        e.action === this.animations.roll.action
      ) {
        this.onAttackComplete();
      }
    });
  }

  toggleLockOn(entity) {
    // Remove previous lock-on marker if it exists
    if (this.lockOnMarker) {
      if (this.lockOnEntity && this.lockOnEntity.model) {
        this.lockOnEntity.model.remove(this.lockOnMarker);
      }
      this.lockOnMarker = null;
    }
    
    this.lockOnEntity = entity;
    
    if (entity) {
      // Create a marker group to hold both border and dot
      this.lockOnMarker = new THREE.Group();
      
      // Create black border sphere (just slightly larger than the white dot)
      const borderGeometry = new THREE.SphereGeometry(0.025, 8, 8);
      const borderMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: false,
        depthTest: false
      });
      const border = new THREE.Mesh(borderGeometry, borderMaterial);
      
      // Create white dot indicator
      const dotGeometry = new THREE.SphereGeometry(0.018, 8, 8);
      const dotMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: false,
        depthTest: false
      });
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      
      // Add both meshes to the group
      this.lockOnMarker.add(border);
      this.lockOnMarker.add(dot);
      
      // Position the marker on the entity's chest/body
      this.lockOnMarker.position.set(0, 1.2, 0); // Center of chest/torso
      
      // Add the marker group to the target entity
      entity.model.add(this.lockOnMarker);
      
      console.log("Lock-on indicator with thin border added to entity's body");
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

  isUnableToAttack() {
    return (
      this.isAttacking ||
      this.currentState === "STAGGERED" ||
      this.currentState === "DEAD" ||
      this.attackCooldown > 0
    );
  }

  // Perform a light attack
  slash() {
    if (this.isUnableToAttack()) {
      return;
    }

    this.isAttacking = true;
    this.attackAnimationComplete = false;
    this.currentState = "ATTACKING";
    this.currentAttack = "slash";

    // Play attack animation
    this.fadeToAction(this.animations.slash.action, false);

    // Create hitbox in front of player after a slight delay (mid animation)
    if (this.combatManager) {
      // Schedule hitbox creation
      setTimeout(() => {
        const hitboxOffset = new THREE.Vector3(0, 1, -1.5); // In front of player (player faces -Z)
        const hitboxSize = new THREE.Vector3(1.5, 1, 2); // Size of the hitbox

        this.combatManager.createHitbox(
          this.model, // Parent object
          hitboxOffset, // Position offset
          hitboxSize, // Size
          this.attackPower, // Damage
          0.2, // Duration in seconds
          { owner: this, knockback: 2 } // Additional options
        );

        console.log("Created player attack hitbox");
      }, 300); // 300ms into the animation
    }

    // Set attack cooldown
    this.attackCooldown = 0.8; // 0.8 seconds before next attack
  }

  // Perform a heavy attack
  slash2() {
    if (this.isUnableToAttack()) {
      return;
    }

    this.isAttacking = true;
    this.attackAnimationComplete = false;
    this.currentState = "ATTACKING";
    this.currentAttack = "slash2";

    // Play heavy attack animation
    this.fadeToAction(this.animations.slash2.action, false);

    // Create larger hitbox in front of player after a delay
    if (this.combatManager) {
      // Schedule hitbox creation
      setTimeout(() => {
        const hitboxOffset = new THREE.Vector3(0, 1, -2); // Further in front for heavy attack
        const hitboxSize = new THREE.Vector3(2.5, 1.2, 2.5); // Larger size for heavy attack

        this.combatManager.createHitbox(
          this.model, // Parent object
          hitboxOffset, // Position offset
          hitboxSize, // Size
          this.attackPower * 1.5, // Higher damage
          0.3, // Duration in seconds
          { owner: this, knockback: 4 } // More knockback
        );

        console.log("Created player heavy attack hitbox");
      }, 500); // 500ms into the animation (heavy attack has longer windup)
    }

    // Set attack cooldown (longer for heavy attack)
    this.attackCooldown = 1.2; // 1.2 seconds before next attack
  }

  // Perform a light attack
  kick() {
    if (this.isUnableToAttack()) {
      return;
    }

    this.isAttacking = true;
    this.attackAnimationComplete = false;
    this.currentState = "ATTACKING";
    this.currentAttack = "kick";

    // Play attack animation
    this.fadeToAction(this.animations.kick.action, false);

    // Create hitbox in front of player after a slight delay (mid animation)
    if (this.combatManager) {
      // Schedule hitbox creation
      setTimeout(() => {
        const hitboxOffset = new THREE.Vector3(0, 1, -1.5); // In front of player (player faces -Z)
        const hitboxSize = new THREE.Vector3(1.5, 1, 2); // Size of the hitbox

        this.combatManager.createHitbox(
          this.model, // Parent object
          hitboxOffset, // Position offset
          hitboxSize, // Size
          this.attackPower, // Damage
          0.2, // Duration in seconds
          { owner: this, knockback: 2 } // Additional options
        );

        console.log("Created player attack hitbox");
      }, 300); // 300ms into the animation
    }

    // Set attack cooldown
    this.attackCooldown = 0.8; // 0.8 seconds before next attack
  }

  // Perform a spin attack (wide area attack)
  spinAttack() {
    if (this.isUnableToAttack()) {
      return;
    }

    this.isAttacking = true;
    this.attackAnimationComplete = false;
    this.currentState = "ATTACKING";
    this.currentAttack = "spinAttack";

    // Play spin attack animation (using jump attack animation as fallback if spinAttack not available)
    const animationAction =
      this.animations.spinAttack?.action ||
      this.animations["spin attack"]?.action;
    if (!animationAction) {
      console.warn(
        "Spin attack animation not found, falling back to slash animation"
      );
      this.fadeToAction(this.animations.slash.action, false);
    } else {
      this.fadeToAction(animationAction, false);
    }

    // Create 360-degree hitbox around player after a delay
    if (this.combatManager) {
      setTimeout(() => {
        const hitboxOffset = new THREE.Vector3(0, 1, 0); // Centered on player
        const hitboxSize = new THREE.Vector3(4, 1.2, 4); // Large circular area

        this.combatManager.createHitbox(
          this.model, // Parent object
          hitboxOffset, // Position offset
          hitboxSize, // Size
          this.attackPower * 1.2, // Medium damage
          0.3, // Duration in seconds
          { owner: this, knockback: 3 } // Medium knockback
        );

        console.log("Created player spin attack hitbox");
      }, 400); // 400ms into the animation
    }

    // Set attack cooldown
    this.attackCooldown = 1.5; // 1.5 seconds before next attack (longer cooldown for powerful attack)
  }

  // Perform a jump attack (high damage, forward leap)
  jumpAttack() {
    if (this.isUnableToAttack()) {
      return;
    }

    this.isAttacking = true;
    this.attackAnimationComplete = false;
    this.currentState = "ATTACKING";
    this.currentAttack = "jumpAttack";

    // Play jump attack animation
    const animationAction =
      this.animations.jumpAttack?.action ||
      this.animations["jump attack"]?.action;
    if (!animationAction) {
      console.warn(
        "Jump attack animation not found, falling back to slash animation"
      );
      this.fadeToAction(this.animations.slash.action, false);
    } else {
      this.fadeToAction(animationAction, false);
    }

    // Move player forward during animation
    const initialPosition = this.model.position.clone();
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
      this.model.quaternion
    );

    // Create hitbox in front of player after a delay
    if (this.combatManager) {
      setTimeout(() => {
        // Move player forward by 3 units for the jump attack
        this.model.position.add(direction.multiplyScalar(3));

        const hitboxOffset = new THREE.Vector3(0, 1, -2); // In front of player
        const hitboxSize = new THREE.Vector3(2, 1.5, 3); // Elongated forward

        this.combatManager.createHitbox(
          this.model, // Parent object
          hitboxOffset, // Position offset
          hitboxSize, // Size
          this.attackPower * 2, // High damage
          0.4, // Duration in seconds
          { owner: this, knockback: 5 } // High knockback
        );

        console.log("Created player jump attack hitbox");
      }, 600); // 600ms into the animation (jump has longer windup)
    }

    // Set attack cooldown
    this.attackCooldown = 2.0; // 2 seconds before next attack (longest cooldown for strongest attack)
  }

  // Take damage from an attack
  takeDamage(damage) {
    if (this.invulnerable || this.currentState === "DEAD") {
      return;
    }

    this.health -= damage;
    console.log(
      `Player took ${damage} damage. Health: ${this.health}/${this.maxHealth}`
    );

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
    console.log(
      `Player debug visualization: ${enabled ? "enabled" : "disabled"}`
    );
  }

  getCurrentVelocity() {
    if (KEYS.shift) {
      return this.walkVelocity;
    }

    if (this.lockOnEntity) {
      return this.lockedOnRunVelocity;
    }
    return this.runVelocity;
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

    // Handle animations and movement differently when locked onto a target
    if (this.lockOnEntity && this.lockOnEntity.model) {
      // Always face the locked entity
      this.faceEntity(this.lockOnEntity);

      if (isMoving) {
        // Choose appropriate animation based on direction and walking/running
        if (KEYS.w) {
          // Moving towards target - forward
          if (isWalking) {
            this.fadeToAction(this.animations.walkForward.action);
          } else {
            this.fadeToAction(this.animations.runForward.action);
          }
        } else if (KEYS.s) {
          // Moving away from target - backward
          if (isWalking) {
            this.fadeToAction(
              this.animations.walkBackward
                ? this.animations.walkBackward.action
                : this.animations.walkForward.action
            );
          } else {
            this.fadeToAction(
              this.animations.runBackward
                ? this.animations.runBackward.action
                : this.animations.runForward.action
            );
          }
        } else if (KEYS.a) {
          // Strafing left
          if (isWalking) {
            this.fadeToAction(
              this.animations.strafeLeft
                ? this.animations.strafeLeft.action
                : this.animations.walkForward.action
            );
          } else {
            this.fadeToAction(
              this.animations.strafeRunLeft
                ? this.animations.strafeRunLeft.action
                : this.animations.runForward.action
            );
          }
        } else if (KEYS.d) {
          // Strafing right
          if (isWalking) {
            this.fadeToAction(
              this.animations.strafeRight
                ? this.animations.strafeRight.action
                : this.animations.walkForward.action
            );
          } else {
            this.fadeToAction(
              this.animations.strafeRunRight
                ? this.animations.strafeRunRight.action
                : this.animations.runForward.action
            );
          }
        }
      } else {
        this.fadeToAction(this.animations.idle.action);
      }

      // Update the mixer
      if (this.mixer) {
        this.mixer.update(delta);
      }

      // Handle locked-on movement
      if (isMoving && !this.isAttacking) {
        // Calculate direction to locked entity
        const targetPosition = this.lockOnEntity.model.position.clone();
        const directionToTarget = new THREE.Vector3()
          .subVectors(targetPosition, this.model.position)
          .normalize();

        // Create perpendicular vectors for strafing
        const perpRight = new THREE.Vector3(
          -directionToTarget.z,
          0,
          directionToTarget.x
        ).normalize();
        const perpLeft = perpRight.clone().negate();

        // Calculate movement direction based on pressed keys
        let moveDirection = new THREE.Vector3(0, 0, 0);

        if (KEYS.w) moveDirection.add(directionToTarget);
        if (KEYS.s) moveDirection.sub(directionToTarget);
        if (KEYS.a) moveDirection.add(perpLeft);
        if (KEYS.d) moveDirection.add(perpRight);

        // Normalize the movement direction
        if (moveDirection.length() > 0) moveDirection.normalize();

        // Apply movement speed

        const velocity = this.getCurrentVelocity();
        const moveX = moveDirection.x * velocity * delta;
        const moveZ = moveDirection.z * velocity * delta;

        // Update position
        this.model.position.x += moveX;
        this.model.position.z += moveZ;

        // Update camera position
        this.updateCamera(moveX, moveZ, 0);
      }
    } else {
      // Regular movement (not locked on)
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
  }

  /**
   * Make the player face a specific entity
   * @param {Object} entity - The entity to face
   */
  faceEntity(entity) {
    if (!entity || !entity.model) return;

    // Get target position
    const targetPosition = entity.model.position.clone();

    // Use lookAt to directly face the target
    // First save current y position since lookAt will change it
    const originalY = this.model.position.y;

    // Create a position at same height as player to prevent tilting up/down
    const targetAtSameHeight = new THREE.Vector3(
      targetPosition.x,
      this.model.position.y,
      targetPosition.z
    );

    // Look at the target
    this.model.lookAt(targetAtSameHeight);
  }

  updateCamera(moveX, moveZ, moveY) {
    // move camera
    CAMERA.locations.behindPlayer.position.x += moveX;
    CAMERA.locations.behindPlayer.position.z += moveZ;

    // Only update camera Y if the change is significant
    // if (Math.abs(moveY) > 0.01) {
    CAMERA.locations.behindPlayer.position.y += moveY; // Reduced vertical follow
    // }

    if (CAMERA.activeLocation === "behindPlayer") {
      const currentCameraPos = new THREE.Vector3();
      CAMERA.controls.getPosition(currentCameraPos);

      // Create a new position with full X/Z movement but damped Y movement
      const newCameraPos = currentCameraPos
        .clone()
        .add(
          new THREE.Vector3(
            moveX,
            Math.abs(moveY) > 0.01 ? moveY * 0.8 : 0,
            moveZ
          )
        );

      CAMERA.controls.setPosition(
        newCameraPos.x,
        newCameraPos.y,
        newCameraPos.z,
        true
      );
    }

    if (this.lockOnEntity) {
      // Calculate camera position behind and to the right of the player (over right shoulder)
      // Get the direction vectors that player is facing
      const playerForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
        this.model.quaternion
      );
      const playerBackward = playerForward.clone().negate();
      
      // Get right vector for positioning over the shoulder
      const playerRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
        this.model.quaternion
      );
      
      // Set camera position behind player and to the right (over shoulder)
      const cameraPositionBehind = this.model.position
        .clone()
        .add(playerBackward.multiplyScalar(DISTANCE_TO_PLAYER * 0.8)) // Move behind player
        .add(playerRight.multiplyScalar(-2)) // Shift to right shoulder (increased offset)
        .add(new THREE.Vector3(0, 1.7, 0)); // Raise camera slightly above player's head

      // Set camera position with slight smoothing
      CAMERA.controls.setPosition(
        cameraPositionBehind.x,
        cameraPositionBehind.y,
        cameraPositionBehind.z,
        true // Use smooth transition
      );

      // Make camera look directly at the locked entity instead of a point ahead
      CAMERA.controls.setTarget(
        this.lockOnEntity.model.position.x,
        this.lockOnEntity.model.position.y + 1, // Target slightly above enemy's base
        this.lockOnEntity.model.position.z,
        true // Use smooth transition
      );
    } else {
      CAMERA.lookAtEntity(this);
    }
  }
}

export default PlayerEntity;
