import * as THREE from "three";
import { DISTANCE_TO_PLAYER } from "./_constants";
import { getDirectionOffset } from "../_lib/helpers";
import KEYS from "../_lib/keys";

class PlayerEntity {
  constructor(model, animations, mixer, soundManager) {
    this.model = model;
    // rotate model 180 degrees
    this.model.rotation.y = Math.PI;
    this.animations = animations;
    this.mixer = mixer;
    this.soundManager = soundManager;

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

    // Track roll states
    this.isRolling = false;
    this.rollCooldown = 0;

    // Track currently playing actions for animation completion
    this.activeAction = null;
    
    // Track movement for footstep sounds
    this.isMoving = false;
    this.currentMovementType = null;
    this.movementAnimations = [
      'walkForward', 'walkBack', 'runForward', 'runBack',
      'strafeLeft', 'strafeRight', 'strafeRunLeft', 'strafeRunRight'
    ];

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

    // Collision properties
    this.collisionRadius = 0.7; // Player collision radius (reduced from 0.8)
    this.enemyEntities = []; // Will store references to enemies

    // References
    this.combatManager = null;

    // References to world objects
    this.terrain = null;
    this.currentSurfaceType = 'grass';
    this.lastSurfaceCheck = 0;
    this.surfaceCheckInterval = 500; // Check surface type every 500ms

    console.log("this.animations", this.animations);
    this.init();
    this.updatePlayerUI();
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
      console.log("Animation finished", e.action);
      if (
        e.action === this.animations.slash.action ||
        e.action === this.animations.slash2.action ||
        e.action === this.animations.spinAttack.action ||
        e.action === this.animations.block.action ||
        e.action === this.animations.death.action ||
        e.action === this.animations.powerUp.action ||
        e.action === this.animations.kick.action ||
        e.action === this.animations.impact.action ||
        e.action === this.animations.impact2.action
      ) {
        this.onAttackComplete();
      } else if (e.action === this.animations.roll.action) {
        this.onRollComplete();
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
    
    // Reset state to IDLE (for attacks and blocks)
    if (this.currentState === "ATTACKING" || this.currentState === "BLOCKING") {
      this.currentState = "IDLE";
    }
    
    console.log("Attack or block complete");
  }

  // Called when roll animation completes
  onRollComplete() {
    this.isRolling = false;
    this.currentState = "IDLE";
    this.invulnerable = false;
    
    // Reset camera position if not locked on
    if (!this.lockOnEntity) {
      // Get the current facing direction
      const forwardDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.model.quaternion);
      const backwardDirection = forwardDirection.clone().negate();
      
      // Position camera behind player
      const cameraPos = this.model.position.clone()
        .add(backwardDirection.multiplyScalar(DISTANCE_TO_PLAYER))
        .add(new THREE.Vector3(0, 2, 0)); // Slightly above player
        
      // Update CAMERA.locations.behindPlayer to match
      CAMERA.locations.behindPlayer.position.copy(cameraPos);
        
      // Set camera position with smooth transition
      CAMERA.controls.setPosition(
        cameraPos.x,
        cameraPos.y,
        cameraPos.z,
        true // Smooth transition
      );
      
      // Make camera look at player
      CAMERA.lookAtEntity(this);
    }
    
    console.log("Roll animation complete");
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
      
      // Get the animation name from the action
      let currentAnimName = null;
      Object.keys(this.animations).forEach(animName => {
        if (this.animations[animName].action === action) {
          currentAnimName = animName;
        }
      });
      
      // Check if this is a movement animation
      const isMovementAnimation = currentAnimName && this.movementAnimations.includes(currentAnimName);
      
      // Handle movement sound transitions
      if (isMovementAnimation) {
        // Determine if the animation type has changed (e.g., walk to run)
        const previousWasRun = this.currentMovementType && this.currentMovementType.toLowerCase().includes('run');
        const currentIsRun = currentAnimName && currentAnimName.toLowerCase().includes('run');
        
        // Start/update sound if:
        // 1. We weren't moving before
        // 2. We changed movement types completely
        // 3. We switched between walking and running
        if (!this.isMoving || 
            this.currentMovementType !== currentAnimName ||
            previousWasRun !== currentIsRun) {
          this.startMovementSound(currentAnimName);
        }
        
        this.isMoving = true;
        this.currentMovementType = currentAnimName;
      } else {
        // Stop footstep sound if was moving
        if (this.isMoving) {
          this.stopMovementSound();
        }
        this.isMoving = false;
        this.currentMovementType = null;
      }
    }
    this.activeAction = action;
  }

  startMovementSound(movementType) {
    if (this.soundManager) {
      // Pass the current velocity to the sound manager
      const velocity = this.getCurrentVelocity();
      this.soundManager.startFootstepsForMovementType(movementType, { volume: 0.5 }, velocity);
    }
  }

  stopMovementSound() {
    if (this.soundManager) {
      this.soundManager.stopFootsteps();
    }
  }

  updateMovementSound() {
    // If moving, update the footstep frequency based on current velocity
    if (this.isMoving && this.soundManager) {
      const velocity = this.getCurrentVelocity();
      this.soundManager.updateFootstepFrequency(velocity);
    }
  }

  isUnableToAttack() {
    return (
      this.isAttacking ||
      this.isRolling ||
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
        const hitboxOffset = new THREE.Vector3(0, 1, -1.2); // In front of player (player faces -Z)
        const hitboxSize = new THREE.Vector3(1.0, 0.8, 1.5); // Reduced size of the hitbox

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
        const hitboxOffset = new THREE.Vector3(0, 1, -1.7); // Further in front for heavy attack
        const hitboxSize = new THREE.Vector3(1.8, 1.0, 2.0); // Reduced size for heavy attack

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
        const hitboxOffset = new THREE.Vector3(0, 0.7, -1.2); // Lower position for kick
        const hitboxSize = new THREE.Vector3(0.8, 0.6, 1.3); // Smaller size for kick hitbox

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
        const hitboxSize = new THREE.Vector3(2.5, 0.9, 2.5); // Reduced circular area

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

  // Take damage from an attack
  takeDamage(damage) {
    // Check invulnerability first
    if (this.invulnerable || this.currentState === "DEAD") {
      console.log("Attack avoided! Player is invulnerable");
      return;
    }
    
    // Reduce damage if blocking
    let actualDamage = damage;
    if (this.currentState === "BLOCKING") {
      // Reduce damage by 70% when blocking
      actualDamage = Math.floor(damage * 0.3);
      console.log(`Blocked attack! Damage reduced from ${damage} to ${actualDamage}`);
      
      // Emit block success event
      document.dispatchEvent(
        new CustomEvent('block_success', {
          detail: {
            player: this,
            originalDamage: damage,
            reducedDamage: actualDamage
          }
        })
      );
      
      // Consume stamina when blocking (if implemented)
      if (this.stamina > 0) {
        this.stamina = Math.max(0, this.stamina - 10);
      }
    } else {
      // Not blocking, play impact animation and sword slash sound
      this.fadeToAction(this.animations.impact2.action, false);
      if (this.soundManager) {
        this.soundManager.playRandomSwordSlash({ volume: 0.4 });
      }
      console.log("Player hit! Playing impact animation");
    }

    this.health -= actualDamage;
    console.log(
      `Player took ${actualDamage} damage. Health: ${this.health}/${this.maxHealth}`
    );
    
    // Check for death
    if (this.health <= 0) {
      this.health = 0;
      this.die();
      return;
    }
    
    // Get staggered if not blocking
    if (this.currentState !== "BLOCKING") {
      this.getStaggered();
    }
    
    this.updatePlayerUI();
  }

  // Enter staggered state
  getStaggered() {
    this.currentState = "STAGGERED";
    this.staggerTime = 0.5; // Staggered for 0.5 seconds
    
    // Note: We don't play the animation here anymore since it's already played in takeDamage
    // when the player is hit without blocking
  }

  // Die
  die() {
    this.currentState = "DEAD";
    this.fadeToAction(this.animations.death.action, false);
    console.log("Player died");
  }

  // Set debug visualization mode
  setDebugVisualization(enabled) {
    // Create debug visuals when enabled
    if (enabled) {
      // Create attack range visualization if it doesn't exist
      if (!this.debugAttackRange) {
        // Create a group to hold all debug visualizations
        this.debugAttackRange = new THREE.Group();
        this.debugAttackRange.name = 'player-debug';
        
        // Create a cone to represent the forward attack range
        const coneGeometry = new THREE.ConeGeometry(2, 4, 8);
        coneGeometry.rotateX(Math.PI / 2); // Rotate to point forward
        const coneMaterial = new THREE.MeshBasicMaterial({
          color: 0x00aaff,
          transparent: true,
          opacity: 0.25,
          wireframe: true
        });
        
        const attackCone = new THREE.Mesh(coneGeometry, coneMaterial);
        attackCone.position.set(0, 1, -2); // Position in front of player
        
        // Add to debug group
        this.debugAttackRange.add(attackCone);
        
        // Add debug group to player model
        this.model.add(this.debugAttackRange);
      }
      
      // Show debug visuals
      this.debugAttackRange.visible = true;
    } else {
      // Hide debug visuals
      if (this.debugAttackRange) {
        this.debugAttackRange.visible = false;
      }
    }
    
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
    
    // Update roll cooldown
    if (this.rollCooldown > 0) {
      this.rollCooldown -= delta;
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

    // Skip remaining logic if dead, attacking or rolling
    if (this.currentState === "DEAD" || this.isAttacking || this.isRolling) {
      // Update the mixer
      if (this.mixer) {
        this.mixer.update(delta);
      }
      
      // Also stop movement sounds if they're playing
      if (this.isMoving) {
        this.isMoving = false;
        this.stopMovementSound();
        this.currentMovementType = null;
      }
      
      return;
    }

    // Detect current surface type for footstep sounds
    this.detectSurfaceType();

    // Movement and rotation logic
    const isMoving = KEYS.w || KEYS.s || KEYS.a || KEYS.d;
    const isWalking = KEYS.shift;

    // Track movement state changes for sound
    if (isMoving && !this.isMoving) {
      // Just started moving
      this.isMoving = true;
    } else if (!isMoving && this.isMoving) {
      // Just stopped moving
      this.isMoving = false;
      this.stopMovementSound();
      this.currentMovementType = null;
    }

    // Handle animations and movement differently when locked onto a target
    if (this.lockOnEntity && this.lockOnEntity.model) {
      // Always face the locked entity
      this.faceEntity(this.lockOnEntity);

      if (isMoving) {
        // Choose appropriate animation based on direction and walking/running
        let currentAnimName = 'idle';
        
        if (KEYS.w) {
          // Moving towards target - forward
          currentAnimName = isWalking ? 'walkForward' : 'runForward';
        } else if (KEYS.s) {
          // Moving away from target - backward
          currentAnimName = isWalking ? 'walkBackward' : 'runBackward';
          if (!this.animations[currentAnimName]) {
            currentAnimName = isWalking ? 'walkForward' : 'runForward';
          }
        } else if (KEYS.a) {
          // Strafing left
          currentAnimName = isWalking ? 'strafeLeft' : 'strafeRunLeft';
          if (!this.animations[currentAnimName]) {
            currentAnimName = isWalking ? 'walkForward' : 'runForward';
          }
        } else if (KEYS.d) {
          // Strafing right
          currentAnimName = isWalking ? 'strafeRight' : 'strafeRunRight';
          if (!this.animations[currentAnimName]) {
            currentAnimName = isWalking ? 'walkForward' : 'runForward';
          }
        }
        
        // Play the appropriate animation
        this.fadeToAction(this.animations[currentAnimName].action);
        
        // Handle movement sound - start if not already playing with this type
        if (this.currentMovementType !== currentAnimName) {
          this.currentMovementType = currentAnimName;
          this.startMovementSound(currentAnimName);
        } else {
          // Update the frequency based on current velocity
          this.updateMovementSound();
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

        // Calculate new position
        const newX = this.model.position.x + moveX;
        const newZ = this.model.position.z + moveZ;
        
        // Check for collisions before updating position
        if (!this.checkCollisions(newX, newZ)) {
          // Update position if no collision
          this.model.position.x = newX;
          this.model.position.z = newZ;

          // Update camera position
          this.updateCamera(moveX, moveZ, 0);
        }
      }
    } else {
      // Regular movement (not locked on)
      if (isMoving) {
        // Determine animation based on walking/running
        const currentAnimName = isWalking ? 'walkForward' : 'runForward';
        this.fadeToAction(this.animations[currentAnimName].action);
        
        // Handle movement sound - start if not already playing with this type
        if (this.currentMovementType !== currentAnimName) {
          this.currentMovementType = currentAnimName;
          this.startMovementSound(currentAnimName);
        } else {
          // Update the frequency based on current velocity
          this.updateMovementSound();
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
        
        // Check for collisions before updating position
        if (!this.checkCollisions(newX, newZ)) {
          // Update X and Z position if no collision
          this.model.position.x = newX;
          this.model.position.z = newZ;
          
          // Update camera position in X and Z
          this.updateCamera(moveX, moveZ, 0);
        }
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

  updateCamera(moveX, moveZ, moveY, isRollUpdate = false) {
    // For rolls without lock-on, limit camera movement to prevent excessive displacement
    if (isRollUpdate && !this.lockOnEntity) {
      // Only move camera a fraction of the player's movement for smoother following
      moveX *= 0.5;
      moveZ *= 0.5;
    }
    
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
        .add(playerBackward.multiplyScalar(DISTANCE_TO_PLAYER * 0.7)) // Move behind player
        .add(playerRight.multiplyScalar(-1.2)) // Shift to right shoulder (increased offset)
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

  updatePlayerUI() {
    // Dispatch event that PlayerUI is listening for
    const event = new CustomEvent('player_health_changed', {
      detail: {
        health: this.health,
        maxHealth: this.maxHealth
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Perform a dodge roll with temporary invincibility
   */
  roll() {
    // Don't allow rolling if staggered, or dead
    if (this.currentState === "STAGGERED" || this.currentState === "DEAD") {
      return;
    }
    
    // Check cooldown (prevent roll spam)
    if (this.rollCooldown > 0) {
      return;
    }
    
    this.currentState = "ROLLING";
    this.isRolling = true;
    
    // Play roll sound effect
    if (this.soundManager) {
      this.soundManager.playSound('roll', { volume: 0.3 });
    }
    
    // Store current position for roll calculation
    const startPosition = this.model.position.clone();
    
    // Play roll animation
    console.log(this.activeAction);
    this.fadeToAction(this.animations.roll.action, false);
    
    // Determine roll direction based on input keys
    let direction = new THREE.Vector3();
    
    // Support diagonal rolls
    if (KEYS.w && KEYS.a) {
      // Forward + Left diagonal
      direction.z = -0.707; // Forward (scaled for diagonal)
      direction.x = -0.707; // Left (scaled for diagonal)
    } else if (KEYS.w && KEYS.d) {
      // Forward + Right diagonal
      direction.z = -0.707; // Forward (scaled for diagonal)
      direction.x = 0.707;  // Right (scaled for diagonal)
    } else if (KEYS.s && KEYS.a) {
      // Backward + Left diagonal
      direction.z = 0.707;  // Backward (scaled for diagonal)
      direction.x = -0.707; // Left (scaled for diagonal)
    } else if (KEYS.s && KEYS.d) {
      // Backward + Right diagonal
      direction.z = 0.707;  // Backward (scaled for diagonal)
      direction.x = 0.707;  // Right (scaled for diagonal)
    } else if (KEYS.s) {
      // Roll backward
      direction.z = 1; // Backward is positive Z when player faces -Z
    } else if (KEYS.a) {
      // Roll left
      direction.x = -1;
    } else if (KEYS.d) {
      // Roll right
      direction.x = 1;
    } else {
      // Default: roll forward
      direction.z = -1;
    }
    
    // If locked on, roll direction should be relative to the target
    if (this.lockOnEntity && this.lockOnEntity.model) {
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
      
      // Reset direction
      direction = new THREE.Vector3(0, 0, 0);
      
      // Apply direction based on keys - supporting diagonals for lock-on
      if (KEYS.w && KEYS.a) {
        // Diagonal forward-left
        direction.add(directionToTarget.clone().multiplyScalar(0.707));
        direction.add(perpLeft.clone().multiplyScalar(0.707));
      } else if (KEYS.w && KEYS.d) {
        // Diagonal forward-right
        direction.add(directionToTarget.clone().multiplyScalar(0.707));
        direction.add(perpRight.clone().multiplyScalar(0.707));
      } else if (KEYS.s && KEYS.a) {
        // Diagonal backward-left
        direction.sub(directionToTarget.clone().multiplyScalar(0.707));
        direction.add(perpLeft.clone().multiplyScalar(0.707));
      } else if (KEYS.s && KEYS.d) {
        // Diagonal backward-right
        direction.sub(directionToTarget.clone().multiplyScalar(0.707));
        direction.add(perpRight.clone().multiplyScalar(0.707));
      } else if (KEYS.w || (!KEYS.w && !KEYS.s && !KEYS.a && !KEYS.d)) {
        direction.add(directionToTarget);
      } else if (KEYS.s) {
        direction.sub(directionToTarget);
      } else if (KEYS.a) {
        direction.add(perpLeft);
      } else if (KEYS.d) {
        direction.add(perpRight);
      }
    } else {
      // Not locked on, apply model's rotation to direction
      direction.applyQuaternion(this.model.quaternion);
    }
    
    // Normalize the direction
    if (direction.length() > 0) direction.normalize();
    
    // Check if roll direction would cause collision and adjust if necessary
    this.adjustRollDirection(direction);
    
    // Apply invincibility frames after a short delay (mid-roll)
    this.invulnerable = true;
    console.log("Roll invulnerability activated");
    
    // Roll distance and duration
    const rollDistance = 5; // Units to roll
    const rollDuration = 1; // Seconds
    
    // Set cooldown
    this.rollCooldown = 1.0; // 1 second cooldown
    
    // Perform the roll movement and restore state after completion
    let rollTime = 0;
    const rollInterval = setInterval(() => {
      // Update roll progress
      rollTime += 0.016; // ~60fps
      
      // Apply movement based on cubic ease-in-out curve for smooth roll
      if (rollTime <= rollDuration) {
        // Calculate progress (0 to 1)
        const t = rollTime / rollDuration;
        
        // Cubic ease-in-out curve: acceleration, then deceleration
        let progress;
        if (t < 0.5) {
          progress = 4 * t * t * t;
        } else {
          progress = 1 - Math.pow(-2 * t + 2, 3) / 2;
        }
        
        // Calculate new position
        const newPos = startPosition.clone().add(
          direction.clone().multiplyScalar(rollDistance * progress)
        );
        
        // Apply movement
        this.model.position.copy(newPos);
        
        // Update camera
        const moveX = this.model.position.x - startPosition.x;
        const moveZ = this.model.position.z - startPosition.z;
        this.updateCamera(moveX, moveZ, 0, true);
      }
      
      // End the roll
      if (rollTime >= rollDuration) {
        clearInterval(rollInterval);
        
        // End states (invulnerability now handled in onRollComplete)
        this.isRolling = false;
        this.currentState = "IDLE";
        
        // The camera position reset is now handled in onRollComplete
      }
    }, 16);
    
    // If not locked on, prevent camera from getting too far by triggering immediate camera adjustment
    if (!this.lockOnEntity) {
      // Initialize camera at good position as soon as roll starts
      const forwardDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.model.quaternion);
      const backwardDirection = forwardDirection.clone().negate();
      
      // Set higher follow speed during roll
      CAMERA.controls.followSpeed = 2; // Temporarily increase follow speed
      
      // Schedule reset of follow speed
      setTimeout(() => {
        CAMERA.controls.followSpeed = 1; // Reset to normal follow speed
      }, rollDuration * 1000);
    }
  }

  /**
   * Adjust roll direction to avoid collisions
   * @param {THREE.Vector3} direction - The current roll direction vector (will be modified)
   */
  adjustRollDirection(direction) {
    const rollDistance = 2; // Same as in roll()
    
    // Create a temporary position at the end of the roll
    const tempPosition = this.model.position.clone().add(
      direction.clone().multiplyScalar(rollDistance)
    );
    
    // Check if this position would collide with any enemy
    let willCollide = false;
    let closestEnemy = null;
    let closestDistance = Infinity;
    
    for (const enemy of this.enemyEntities) {
      // Skip if enemy is dead
      if (enemy.currentState === "DEAD") {
        continue;
      }
      
      const enemyPosition = enemy.model.position;
      const distance = tempPosition.distanceTo(enemyPosition);
      
      // Collision radius is sum of player radius and enemy radius (approx 1.0)
      const collisionDistance = this.collisionRadius + 1.0;
      
      if (distance < collisionDistance) {
        willCollide = true;
        // Track the closest enemy for later use
        if (distance < closestDistance) {
          closestDistance = distance;
          closestEnemy = enemy;
        }
      }
    }
    
    // If a collision would occur, adjust the roll direction
    if (willCollide && closestEnemy) {
      console.log("Adjusting roll direction to avoid collision");
      
      // Get vector from player to enemy
      const toEnemy = new THREE.Vector3().subVectors(
        closestEnemy.model.position,
        this.model.position
      ).normalize();
      
      // Calculate dot product to see if we're rolling toward enemy
      const dot = direction.dot(toEnemy);
      
      if (dot > 0) {
        // We're rolling toward the enemy, so we need to roll around them
        
        // Get perpendicular directions (left and right of enemy)
        const perpRight = new THREE.Vector3(-toEnemy.z, 0, toEnemy.x).normalize();
        const perpLeft = perpRight.clone().negate();
        
        // Choose the direction that's most similar to our original roll direction
        const dotRight = direction.dot(perpRight);
        const dotLeft = direction.dot(perpLeft);
        
        // For diagonal rolls, bias slightly more towards original intent
        const originalDirection = direction.clone();
        
        if (dotRight > dotLeft) {
          // Roll to the right of the enemy
          direction.copy(perpRight);
          
          // For diagonal rolls, we want to bias the direction more towards original intent
          if (Math.abs(originalDirection.x) > 0.2 && Math.abs(originalDirection.z) > 0.2) {
            direction.lerp(originalDirection, 0.2); // Add 20% of original direction
            direction.normalize();
          }
        } else {
          // Roll to the left of the enemy
          direction.copy(perpLeft);
          
          // For diagonal rolls, we want to bias the direction more towards original intent
          if (Math.abs(originalDirection.x) > 0.2 && Math.abs(originalDirection.z) > 0.2) {
            direction.lerp(originalDirection, 0.2); // Add 20% of original direction
            direction.normalize();
          }
        }
      } else {
        // We're rolling away from the enemy, which is fine
        // Just make sure we don't roll directly through them
        const perpendicular = new THREE.Vector3(-toEnemy.z, 0, toEnemy.x).normalize();
        
        // Add a slight adjustment to the direction
        // For diagonal rolls, we'll use a different bias
        if (Math.abs(direction.x) > 0.2 && Math.abs(direction.z) > 0.2) {
          // Diagonal roll - use a smaller adjustment
          direction.add(perpendicular.multiplyScalar(0.2)).normalize();
        } else {
          // Regular roll
          direction.add(perpendicular.multiplyScalar(0.3)).normalize();
        }
      }
    }
  }

  /**
   * Enter blocking state
   */
  block() {
    // Don't allow blocking if attacking, rolling, staggered, or dead
    if (this.isAttacking || this.isRolling || this.currentState === "STAGGERED" || this.currentState === "DEAD") {
      return;
    }
    
    // Set state to blocking
    this.currentState = "BLOCKING";
    
    // Play block animation
    this.fadeToAction(this.animations.block.action, false);
    
    console.log("Player blocking");
    
    // Block remains active until animation completes
    // The animation completion is handled in the setupAnimationCallbacks method
  }

  // Helper method to determine movement X
  getMovementX() {
    let moveX = 0;
    if (KEYS.a || KEYS.arrowleft) {
      moveX = -1;
    } else if (KEYS.d || KEYS.arrowright) {
      moveX = 1;
    }
    return moveX;
  }
  
  // Helper method to determine movement Z
  getMovementZ() {
    let moveZ = 0;
    if (KEYS.w || KEYS.arrowup) {
      moveZ = -1;
    } else if (KEYS.s || KEYS.arrowdown) {
      moveZ = 1;
    }
    return moveZ;
  }
  /**
   * Check for collisions with enemies at the given position
   * @param {number} newX - New X position to check
   * @param {number} newZ - New Z position to check
   * @returns {boolean} True if there is a collision, false otherwise
   */
  checkCollisions(newX, newZ) {
    // Skip collision detection during roll since we now handle collision avoidance in the roll logic
    if (this.isRolling) {
      return false;
    }
    
    // Create a temporary point for the proposed position
    const proposedPosition = new THREE.Vector3(newX, this.model.position.y, newZ);
    
    // Check collision with each enemy
    for (const enemy of this.enemyEntities) {
      // Skip if enemy is dead
      if (enemy.currentState === "DEAD") {
        continue;
      }
      
      // Check distance between proposed position and enemy
      const enemyPosition = enemy.model.position;
      const distance = proposedPosition.distanceTo(enemyPosition);
      
      // Collision radius is sum of player radius and enemy radius (approx 1.0)
      const collisionDistance = this.collisionRadius + 1.0;
      
      if (distance < collisionDistance) {
        // Collision detected
        return true;
      }
    }
    
    // No collision detected
    return false;
  }

  /**
   * Set the list of enemies for collision detection
   * @param {Array} enemies - Array of enemy entities
   */
  setEnemies(enemies) {
    this.enemyEntities = enemies;
    console.log(`Player tracking ${enemies.length} enemies for collision detection`);
  }

  /**
   * Set the terrain reference for surface detection
   */
  setTerrain(terrain) {
    this.terrain = terrain;
  }
  
  /**
   * Detect the surface type at the player's current position
   * In a more complex game, this would use raycasting or texture detection
   * For now, we'll use a simple distance-based approach for demonstration
   */
  detectSurfaceType() {
    // Only check periodically to avoid excessive calculations
    const now = Date.now();
    if (now - this.lastSurfaceCheck < this.surfaceCheckInterval) return;
    this.lastSurfaceCheck = now;
    
    if (!this.terrain) return;
    
    // Simple detection based on position
    // This is a placeholder - in a real game you'd use raycasting or terrain texture data
    const distance = Math.sqrt(
      this.model.position.x * this.model.position.x + 
      this.model.position.z * this.model.position.z
    );
    
    // Simple rule: grass in the center, transitions to other surfaces further out
    let surfaceType = 'grass';
    if (distance > 100) {
      // Would transition to different surfaces based on game world design
      // For now, we only have grass implemented in SoundManager
      surfaceType = 'grass';
    }
    
    // Update the sound manager if surface type changed
    if (this.currentSurfaceType !== surfaceType) {
      this.currentSurfaceType = surfaceType;
      this.soundManager.setSurfaceType(surfaceType);
    }
  }
}

export default PlayerEntity;
