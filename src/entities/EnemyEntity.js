import * as THREE from "three";

/**
 * EnemyEntity class for managing enemy behavior
 * Handles state transitions, combat, and animations
 */
class EnemyEntity {
  constructor(model, animations, mixer, soundManager) {
    this.model = model;
    this.animations = animations;
    this.mixer = mixer;
    this.soundManager = soundManager;
    console.log("Golden Knight animations:", this.animations);
    // Enemy data based on COMBAT_TODO.md
    this.data = {
      health: 500,
      maxHealth: 500,
      name: "Golden Guard of the King",
      isHostile: false,
      detectionRadius: 20,
      attackRange: 3,
      attackDamage: 15,
      attackCooldown: 1.0,
    };

    // State management
    this.currentState = "IDLE"; // IDLE, AWARE, CHASE, ATTACK, STAGGERED, DEAD
    this.targetEntity = null;

    // Combat properties
    this.isAttacking = false;
    this.isBlocking = false;
    this.lastAttackTime = 0;
    this.attackCooldown = 0; // current cooldown timer
    this.attackCallbackSet = false;
    // this.availableAttacks = ["comboAttack", "slash", "kick", "spinAttack", "jumpAttack"];
    this.availableAttacks = [
      "comboAttack",
      "spinAttack",
      "jumpAttack",
      "slash",
      "kick",
    ];
    this.currentAttackType = "comboAttack"; // Default attack

    // Animation properties
    this.currentAction = null;
    this.previousAction = null;

    // Movement sound tracking
    this.isMoving = false;
    this.currentMovementType = null;

    // Materials for different states
    this.materials = {
      default: null,
      damaged: null,
      dead: null,
    };

    // Reference to combat manager
    this.combatManager = null;

    // Initialize the enemy
    this.init();
  }

  /**
   * Initialize the enemy entity
   */
  init() {
    // Position the golden-knight at initial coordinates (150, 0, 0)
    this.model.position.set(0, 0, -50);
    this.model.rotation.y = Math.PI * 0.5;

    // Clone and store default material
    if (this.model.material) {
      // For a single material
      this.materials.default = this.model.material.clone();

      // Create damaged material (red tint)
      this.materials.damaged = this.model.material.clone();
      this.materials.damaged.color.setRGB(1.0, 0.3, 0.3);

      // Create dead material (desaturated)
      this.materials.dead = this.model.material.clone();
      this.materials.dead.color.setRGB(0.5, 0.5, 0.5);
    } else if (this.model.children.length > 0) {
      // Try to find materials in children
      this.model.traverse((child) => {
        if (child.isMesh && child.material) {
          if (!this.materials.default) {
            this.materials.default = child.material.clone();

            // Create damaged material (red tint)
            this.materials.damaged = child.material.clone();
            this.materials.damaged.color.setRGB(1.0, 0.3, 0.3);

            // Create dead material (desaturated)
            this.materials.dead = child.material.clone();
            this.materials.dead.color.setRGB(0.5, 0.5, 0.5);
          }
        }
      });
    }

    // Create detection sphere for visualization
    const detectionGeometry = new THREE.SphereGeometry(
      this.data.detectionRadius,
      16,
      16
    );
    const detectionMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.1,
      wireframe: true,
    });

    this.detectionSphere = new THREE.Mesh(detectionGeometry, detectionMaterial);
    this.detectionSphere.position.set(0, 0, 0); // Centered on enemy
    this.model.add(this.detectionSphere);
    this.detectionSphere.visible = false; // Hide by default, shown in debug mode

    // Initialize animations if available
    this.setupAnimations();

    console.log("Golden Knight initialized at position:", this.model.position);
  }

  /**
   * Initialize animations if available
   */
  setupAnimations() {
    if (!this.animations) {
      console.warn("No animations available for Golden Knight");
      return;
    }

    // Setup animation sequences
    Object.keys(this.animations).forEach((animationName) => {
      const animationData = this.animations[animationName];
      if (animationData && animationData.action) {
        // Set loop mode based on animation type
        if (
          [
            "comboAttack",
            "slash",
            "kick",
            "spinAttack",
            "jumpAttack",
            "impact",
            "death",
          ].includes(animationName)
        ) {
          animationData.action.loop = THREE.LoopOnce;
          animationData.action.clampWhenFinished = true;
        } else {
          animationData.action.loop = THREE.LoopRepeat;
        }
      }
    });

    // Set up animation callbacks for non-looping animations
    this.setupAnimationCallbacks();

    // Start with idle animation
    this.playAnimation("idle");
  }

  /**
   * Set up callbacks for animation completion
   */
  setupAnimationCallbacks() {
    // Set up callbacks for all attack animations
    const attackTypes = [
      "comboAttack",
      "slash",
      "kick",
      "spinAttack",
      "jumpAttack",
    ];

    // Create a bound callback to handle animation completion
    this.onAttackFinished = (e) => {
      // Check which attack animation has finished
      for (const attackType of attackTypes) {
        if (
          this.animations[attackType] &&
          this.animations[attackType].action &&
          e.action === this.animations[attackType].action
        ) {
          console.log(`Enemy ${attackType} animation finished`);

          // Log final position for combo attack
          if (attackType === "comboAttack" && this.attackStartPosition) {
            // Store current position to prevent any teleporting
            const finalPosition = this.model.position.clone();

            console.log(
              `ComboAttack END position: (${finalPosition.x.toFixed(
                2
              )}, ${finalPosition.y.toFixed(2)}, ${finalPosition.z.toFixed(
                2
              )}) - Total movement: ${finalPosition
                .distanceTo(this.attackStartPosition)
                .toFixed(2)} units`
            );
          }

          this.isAttacking = false;
          this.attackCooldown = this.data.attackCooldown;

          // Return to idle animation
          if (this.currentState === "ATTACK") {
            this.playAnimation("idle");
          }
          break;
        }
      }
    };

    // Add listeners for each attack animation
    for (const attackType of attackTypes) {
      if (this.animations[attackType] && this.animations[attackType].action) {
        const attackAction = this.animations[attackType].action;

        // Remove any existing listeners to avoid duplicates
        attackAction
          .getMixer()
          .removeEventListener("finished", this.onAttackFinished);

        // Add the event listener to the mixer
        attackAction
          .getMixer()
          .addEventListener("finished", this.onAttackFinished);

        // Set up non-looping for attack animations with clampWhenFinished
        // This ensures the animation completes and holds its final frame
        attackAction.loop = THREE.LoopOnce;
        attackAction.clampWhenFinished = true;
        attackAction.repetitions = 1; // Ensure it plays exactly once
      }
    }
  }

  /**
   * Update the enemy entity (called every frame)
   * @param {number} delta - Time since last frame
   * @param {PlayerEntity} player - Reference to player entity
   */
  update(delta, player) {
    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Skip further updates if dead
    if (this.currentState === "DEAD") {
      return;
    }

    // Track the player as target
    this.targetEntity = player;

    // Check if player is within detection radius
    if (player && player.model) {
      const distance = this.model.position.distanceTo(player.model.position);

      // Transition to hostile if player is within detection radius
      if (distance <= this.data.detectionRadius && !this.data.isHostile) {
        this.becomeHostile();
      }

      // Update behavior based on current state
      this.updateStateBehavior(delta, distance);
    }

    // If the current state is not CHASE and we're still playing movement sounds, stop them
    if (this.currentState !== 'CHASE' && this.isMoving) {
      this.stopMovementSound();
      this.isMoving = false;
      this.currentMovementType = null;
    }
  }

  /**
   * Update behavior based on current state
   * @param {number} delta - Time since last frame
   * @param {number} distanceToPlayer - Distance to player
   */
  updateStateBehavior(delta, distanceToPlayer) {
    switch (this.currentState) {
      case "IDLE":
        // Just idle
        this.playAnimation("idle");
        break;

      case "AWARE":
        // Aware but not yet chasing - face player and prepare
        this.faceTarget();
        this.playAnimation("idle");
        this.setState("CHASE");
        break;

      case "CHASE":
        // Chase the player
        this.moveTowardsPlayer(delta);

        // If close enough to attack
        if (distanceToPlayer <= this.data.attackRange) {
          this.setState("ATTACK");
        }
        break;

      case "ATTACK":
        // Attack the player
        this.attack(delta);
        break;

      case "STAGGERED":
        // Already handled in takeDamage
        break;

      case "DEAD":
        // Already handled in die
        break;

      default:
        this.setState("IDLE");
        break;
    }
  }

  /**
   * Move towards the player
   * @param {number} delta - Time since last frame
   */
  moveTowardsPlayer(delta) {
    if (!this.targetEntity || !this.targetEntity.model) return;

    // Get direction to player
    const targetPosition = this.targetEntity.model.position.clone();
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, this.model.position)
      .normalize();

    // Move towards player
    const speed = 1; // units per second
    this.model.position.x += direction.x * speed * delta;
    this.model.position.z += direction.z * speed * delta;

    // Rotate to face the player
    const targetAngle = Math.atan2(direction.x, direction.z);
    this.model.rotation.y = targetAngle;

    // Play run/chase animation
    this.playAnimation("walk");
  }

  /**
   * Become hostile towards player
   */
  becomeHostile() {
    if (!this.data.isHostile) {
      this.data.isHostile = true;
      console.log(`${this.data.name} has become hostile!`);

      // Trigger the boss UI to show health bar
      this.triggerBossUI();

      // Transition to aware state first
      this.setState("AWARE");
    }
  }

  /**
   * Transition to a new state
   * @param {string} newState - The new state to transition to
   */
  setState(newState) {
    const oldState = this.currentState;
    this.currentState = newState;

    // console.log(`${this.data.name} state: ${oldState} -> ${newState}`);

    // Additional state transition logic can be added here
    switch (newState) {
      case "ATTACK":
        // Reset attack cooldown when entering attack state
        this.attackCooldown = 0;
        break;

      // Add other state transition logic as needed
    }
  }

  /**
   * Play an animation with optional crossfade
   * @param {string} name - The name of the animation to play
   * @param {number} crossFadeDuration - Duration of crossfade in seconds
   * @param {number} priority - Higher priority animations interrupt lower ones
   */
  playAnimation(name, crossFadeDuration = 0.3, priority = 0) {
    if (!this.animations || !this.animations[name]) {
      console.warn(`Animation '${name}' not found for Golden Knight`);
      return;
    }

    const newAction = this.animations[name].action;
    
    // For movement sound management
    const isWalkingAnimation = name === 'walk';

    if (this.currentAction === newAction) return;

    // Special case: If the current animation is "death", don't interrupt it with anything
    if (this.currentAction && 
        this.currentAction === this.animations.death?.action &&
        name !== "death") {
      console.log("Death animation cannot be interrupted");
      return;
    }
    
    // Set special priorities for certain animations
    if (name === "death") {
      // Death animation gets highest priority (3.0)
      priority = 3.0;
    }

    // Handle interruption logic:
    // 1. Death animation (priority 3.0) always interrupts
    // 2. High priority animations (impact, priority 2.0) interrupt most animations
    // 3. Don't interrupt attack animations with low priority animations
    if (priority < 2.0 && this.isAttacking && 
        !["comboAttack", "slash", "kick", "spinAttack", "jumpAttack"].includes(name)) {
      // Low priority animation during attack - don't interrupt
      return;
    }
    
    // For high priority animations, log the interruption
    if (priority >= 2.0) {
      console.log(`High priority animation '${name}' interrupting current animation`);
    }

    if (this.currentAction) {
      this.previousAction = this.currentAction;
      this.previousAction.fadeOut(crossFadeDuration);
    }

    newAction.reset().fadeIn(crossFadeDuration).play();
    this.currentAction = newAction;

    // For attack animations, ensure they complete
    if (
      ["comboAttack", "slash", "kick", "spinAttack", "jumpAttack", "impact", "death"].includes(
        name
      )
    ) {
      newAction.enabled = true;
      newAction.clampWhenFinished = true;
      newAction.zeroSlopeAtEnd = false; // Ensures smooth end of animation
      newAction.loop = THREE.LoopOnce;
    }
    
    // Handle movement sounds
    if (isWalkingAnimation) {
      this.startMovementSound('walk');
      this.isMoving = true;
      this.currentMovementType = 'walk';
    } else if (this.isMoving) {
      this.stopMovementSound();
      this.isMoving = false;
      this.currentMovementType = null;
    }
  }
  
  /**
   * Start playing movement sound
   */
  startMovementSound(movementType) {
    if (this.soundManager) {
      // For enemy, use a constant velocity based on their movement speed
      // The enemy has a constant movement speed of 1 unit per second defined in moveTowardsPlayer
      const velocity = 1.0; 
      this.soundManager.startFootstepsForMovementType(movementType, { volume: 0.4 }, velocity);
    }
  }
  
  /**
   * Stop playing movement sound
   */
  stopMovementSound() {
    if (this.soundManager) {
      this.soundManager.stopFootsteps();
    }
  }

  /**
   * Take damage from an attack
   * @param {number} damage - Amount of damage to take
   */
  takeDamage(damage) {
    // Don't take damage if already dead
    if (this.currentState === "DEAD") {
      return;
    }

    // Apply damage
    this.data.health -= damage;
    console.log(
      `Enemy took ${damage} damage. Health: ${this.data.health}/${this.data.maxHealth}`
    );

    // Update boss health UI
    document.dispatchEvent(
      new CustomEvent("boss_health_changed", {
        detail: {
          name: this.data.name,
          health: this.data.health,
          maxHealth: this.data.maxHealth,
        },
      })
    );

    // Visual feedback
    this.model.material = this.materials.damaged;
    setTimeout(() => {
      if (this.currentState !== "DEAD") {
        this.model.material = this.materials.default;
      }
    }, 200);

    // Check for death first - this takes highest priority
    if (this.data.health <= 0) {
      this.data.health = 0; // Ensure health doesn't go negative
      this.die(); // This will play the death animation with highest priority
      return;
    }

    // Reset attack state completely
    this.isAttacking = false;
    this.attackCooldown = 0.5; // Add a small cooldown before next attack
    this.currentAttackType = null;
    
    // Interrupt current animation and force play the impact animation with high priority
    this.playAnimation("impact", 0.1, 2.0); // Fast crossfade (0.1s) and high priority (2.0)

    // Get staggered only if damage is significant
    if (damage >= 20) {
      this.setState("STAGGERED");

      // Return to chase after stagger time
      setTimeout(() => {
        if (this.currentState === "STAGGERED") {
          this.setState("CHASE");
        }
      }, 1000);
    } else {
      // Become aware and hostile if not already
      this.becomeHostile();
    }
  }

  /**
   * Die and clean up
   */
  die() {
    this.setState("DEAD");

    // Cancel any attack state
    this.isAttacking = false;
    this.currentAttackType = null;
    
    // Play death animation with highest priority
    // The priority is set to 3.0 in the playAnimation method
    this.playAnimation("death", 0.2, 3.0);

    // Change material to indicate death
    this.model.material = this.materials.dead;

    console.log("Enemy died");

    // Disable detection sphere
    if (this.detectionSphere) {
      this.detectionSphere.visible = false;
    }

    // Hide the boss UI after 3 seconds
    setTimeout(() => {
      // Dispatch custom event to hide the UI
      document.dispatchEvent(
        new CustomEvent("boss_defeated", {
          detail: {
            name: this.data.name,
          },
        })
      );
      console.log("Boss UI hidden after death");
    }, 3000);
  }

  /**
   * Trigger the boss UI to appear
   */
  triggerBossUI() {
    // This will be implemented in UI task
    console.log("Boss health bar should appear now");
    // Create a custom event for the UI system to handle
    document.dispatchEvent(
      new CustomEvent("boss_detected", {
        detail: {
          name: this.data.name,
          health: this.data.health,
          maxHealth: this.data.maxHealth,
        },
      })
    );
  }

  /**
   * Set debug visualization for the enemy
   * @param {boolean} enabled - Whether debug visualization should be enabled
   */
  setDebugVisualization(enabled) {
    if (this.detectionSphere) {
      this.detectionSphere.visible = enabled;

      // Update the detection sphere material to be more visible
      if (enabled) {
        this.detectionSphere.material.color.set(0xff3333);
        this.detectionSphere.material.opacity = 0.15;
        this.detectionSphere.material.wireframe = true;
        this.detectionSphere.material.wireframeLinewidth = 2;

        // Add attack range visualization
        if (!this.attackRangeSphere) {
          const attackGeometry = new THREE.SphereGeometry(
            this.data.attackRange,
            16,
            16
          );
          const attackMaterial = new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.2,
            wireframe: true,
          });

          this.attackRangeSphere = new THREE.Mesh(
            attackGeometry,
            attackMaterial
          );
          this.attackRangeSphere.position.set(0, 0, 0);
          this.model.add(this.attackRangeSphere);
        }

        this.attackRangeSphere.visible = true;
      } else {
        // Hide attack range visualization
        if (this.attackRangeSphere) {
          this.attackRangeSphere.visible = false;
        }
      }
    }

    console.log(
      `Enemy debug visualization ${enabled ? "enabled" : "disabled"}`
    );
  }

  /**
   * Face the target
   * @returns {boolean} Whether the enemy is now fully facing the target
   */
  faceTarget() {
    if (!this.targetEntity || !this.targetEntity.model) return true;

    const direction = new THREE.Vector3()
      .subVectors(this.targetEntity.model.position, this.model.position)
      .normalize();

    // Calculate target rotation
    const targetRotation = Math.atan2(direction.x, direction.z);

    // Smooth rotation with slower speed for more natural turning
    const rotationSpeed = 0.05; // Reduced from 0.1 for smoother turning
    const angleDiff =
      ((targetRotation - this.model.rotation.y + Math.PI * 3) % (Math.PI * 2)) -
      Math.PI;
    
    // Apply rotation step
    this.model.rotation.y += angleDiff * rotationSpeed;
    
    // Return whether we're close enough to target rotation
    return Math.abs(angleDiff) < 0.1; // Consider "facing" if within ~5.7 degrees
  }

  /**
   * Check if the enemy is facing the target within an acceptable threshold
   * @returns {boolean} Whether the enemy is properly facing the target
   */
  isFacingTarget() {
    if (!this.targetEntity || !this.targetEntity.model) return true;

    const direction = new THREE.Vector3()
      .subVectors(this.targetEntity.model.position, this.model.position)
      .normalize();

    // Calculate target rotation
    const targetRotation = Math.atan2(direction.x, direction.z);
    
    // Calculate angle difference
    const angleDiff = Math.abs(
      ((targetRotation - this.model.rotation.y + Math.PI * 3) % (Math.PI * 2)) -
      Math.PI
    );
    
    // Consider "facing" if within ~11.5 degrees (0.2 radians)
    return angleDiff < 0.2;
  }

  /**
   * Attack the player
   * @param {number} delta - Time since last frame
   */
  attack(delta) {
    if (!this.targetEntity) return;

    // If not in attack range, chase instead
    const distance = this.model.position.distanceTo(
      this.targetEntity.model.position
    );
    if (distance > this.data.attackRange) {
      this.setState("CHASE");
      return;
    }

    // Check if we're currently attacking or in cooldown
    if (this.isAttacking) {
      // Let the attack animation finish - handled by animation callback
      return;
    } else if (this.attackCooldown <= 0) {
      // Before attacking, make sure we're facing the target
      // Keep turning until properly facing the target
      if (!this.isFacingTarget()) {
        this.faceTarget();
        return; // Wait until next frame when we're facing the target
      }
      
      // Start a new attack
      this.isAttacking = true;

      // Track the starting position for animations that move the enemy
      this.attackStartPosition = this.model.position.clone();

      // Randomly select an attack type from available attacks
      // First filter to only include attacks that have animations
      const validAttacks = this.availableAttacks.filter(
        (attackType) =>
          this.animations[attackType] && this.animations[attackType].action
      );

      if (validAttacks.length > 0) {
        // Choose a random attack from valid attacks
        this.currentAttackType =
          validAttacks[Math.floor(Math.random() * validAttacks.length)];
        console.log(`Enemy using ${this.currentAttackType} attack`);

        // Log starting position for combo attack
        if (this.currentAttackType === "comboAttack") {
          console.log(
            `ComboAttack START position: (${this.model.position.x.toFixed(
              2
            )}, ${this.model.position.y.toFixed(
              2
            )}, ${this.model.position.z.toFixed(2)})`
          );
        }

        // Play the selected attack animation with high priority to prevent interruption
        this.playAnimation(this.currentAttackType, 0.2, 1.0); // Fast crossfade, high priority

        // For comboAttack, reset the animation time to ensure consistent movement
        if (
          this.currentAttackType === "comboAttack" &&
          this.animations.comboAttack
        ) {
          this.animations.comboAttack.action.time = 0;
        }

        // Create hitbox after a delay to match animation
        if (this.combatManager) {
          // Different hitbox configurations based on attack type
          let hitboxDelay = 400; // Default delay
          let hitboxOffset = new THREE.Vector3(0, 1, -1.5); // Default position
          let hitboxSize = new THREE.Vector3(1.2, 1, 1.5); // Default size
          let damage = this.data.attackDamage;
          let knockback = 1;

          // Customize hitbox based on attack type
          switch (this.currentAttackType) {
            case "slash":
              hitboxOffset = new THREE.Vector3(0, 1, -1.7);
              hitboxSize = new THREE.Vector3(1.5, 1, 1.2);
              break;
            case "kick":
              hitboxDelay = 300;
              hitboxOffset = new THREE.Vector3(0, 0.5, -1.5);
              hitboxSize = new THREE.Vector3(1, 0.7, 1.5);
              damage = Math.floor(this.data.attackDamage * 0.8); // Kick does less damage
              knockback = 1.5; // But more knockback
              break;
            case "spinAttack":
              hitboxDelay = 500;
              hitboxOffset = new THREE.Vector3(0, 1, 0);
              hitboxSize = new THREE.Vector3(2.5, 1, 2.5); // Wider area
              damage = Math.floor(this.data.attackDamage * 1.2); // More damage for spin attack
              break;
            case "jumpAttack":
              hitboxDelay = 700; // Longer delay for jump attack
              hitboxOffset = new THREE.Vector3(0, 0.5, -2);
              hitboxSize = new THREE.Vector3(1.8, 1, 1.8);
              damage = Math.floor(this.data.attackDamage * 1.5); // Jump attack does more damage
              break;
            case "comboAttack":
              // For combo attack, adjust the hitbox to be slightly in front since the enemy moves
              hitboxOffset = new THREE.Vector3(0, 1, -5);
              hitboxSize = new THREE.Vector3(2, 1, 5); // Longer hitbox to account for increased movement
              hitboxDelay = 500; // Increased delay to match with further movement
              break;
          }

          setTimeout(() => {
            // Only create hitbox if still in attack state
            if (this.currentState === "ATTACK" && this.isAttacking) {
              this.combatManager.createHitbox(
                this.model,
                hitboxOffset,
                hitboxSize,
                damage,
                0.2,
                {
                  owner: this,
                  knockback: knockback,
                  // Flag to indicate this hitbox should not interrupt animations
                  preserveAnimation: true,
                }
              );

              console.log(
                `Created enemy ${this.currentAttackType} attack hitbox`
              );
            }
          }, hitboxDelay); // Delay hitbox creation to match animation timing
        }
      } else {
        // Fallback if no valid attacks
        console.warn("No valid attack animations available");
        this.isAttacking = false;
      }
    } else {
      // Still in cooldown, reduce timer
      this.attackCooldown -= delta;
    }
  }
}

export default EnemyEntity;
