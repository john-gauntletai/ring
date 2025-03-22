import * as THREE from "three";

/**
 * EnemyEntity class for managing enemy behavior
 * Handles state transitions, combat, and animations
 */
class EnemyEntity {
  constructor(model, animations, mixer) {
    this.model = model;
    this.animations = animations;
    this.mixer = mixer;
    
    // Enemy data based on COMBAT_TODO.md
    this.data = {
      health: 500,
      maxHealth: 500,
      name: "The Golden Knight",
      isHostile: false,
      detectionRadius: 50,
      attackRange: 3,
      attackDamage: 15,
      attackCooldown: 2.0
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
    
    // Animation properties
    this.currentAction = null;
    this.previousAction = null;
    
    // Materials for different states
    this.materials = {
      default: null,
      damaged: null,
      dead: null
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
    this.model.position.set(80, 0, 0);

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
      this.model.traverse(child => {
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
    const detectionGeometry = new THREE.SphereGeometry(this.data.detectionRadius, 16, 16);
    const detectionMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.1,
      wireframe: true
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
    Object.keys(this.animations).forEach(animationName => {
      const animationData = this.animations[animationName];
      if (animationData && animationData.action) {
        // Set loop mode based on animation type
        if (["comboAttack", "impact", "death"].includes(animationName)) {
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
    this.playAnimation('idle');
  }
  
  /**
   * Set up callbacks for animation completion
   */
  setupAnimationCallbacks() {
    // Set up callback for attack animation completion
    if (this.animations.comboAttack && this.animations.comboAttack.action) {
      const attackAction = this.animations.comboAttack.action;
      
      // Remove any existing listeners to avoid duplicates
      attackAction.getMixer().removeEventListener('finished', this.onAttackFinished);
      
      // Create a bound callback to handle animation completion
      this.onAttackFinished = (e) => {
        if (e.action === attackAction) {
          console.log("Enemy attack animation finished");
          this.isAttacking = false;
          this.attackCooldown = this.data.attackCooldown;
          
          // Return to idle animation
          if (this.currentState === "ATTACK") {
            this.playAnimation('idle');
          }
        }
      };
      
      // Add the event listener to the mixer
      attackAction.getMixer().addEventListener('finished', this.onAttackFinished);
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
        this.playAnimation('idle');
        break;
        
      case "AWARE":
        // Aware but not yet chasing - face player and prepare
        this.faceTarget();
        this.playAnimation('idle');
        
        // Transition to chase if player moves closer or after delay
        if (distanceToPlayer < this.data.detectionRadius * 0.7) {
          this.setState("CHASE");
        }
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
    this.playAnimation('walk');
  }
  
  /**
   * Become hostile towards player
   */
  becomeHostile() {
    if (!this.data.isHostile) {
      this.data.isHostile = true;
      console.log(`${this.data.name} has become hostile!`);
      
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
    
    console.log(`${this.data.name} state: ${oldState} -> ${newState}`);
    
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
   * Play the specified animation
   * @param {string} name - Name of the animation to play
   * @param {number} crossFadeDuration - Duration of crossfade between animations
   */
  playAnimation(name, crossFadeDuration = 0.3) {
    if (!this.animations || !this.animations[name]) {
      console.warn(`Animation '${name}' not found for Golden Knight`);
      return;
    }
    
    const newAction = this.animations[name].action;
    
    if (this.currentAction === newAction) return;
    
    if (this.currentAction) {
      this.previousAction = this.currentAction;
      this.previousAction.fadeOut(crossFadeDuration);
    }
    
    newAction.reset().fadeIn(crossFadeDuration).play();
    this.currentAction = newAction;
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
    console.log(`Enemy took ${damage} damage. Health: ${this.data.health}/${this.data.maxHealth}`);
    
    // Visual feedback
    this.model.material = this.materials.damaged;
    setTimeout(() => {
      if (this.currentState !== "DEAD") {
        this.model.material = this.materials.default;
      }
    }, 200);
    
    // Check for death
    if (this.data.health <= 0) {
      this.die();
      return;
    }
    
    // Get staggered if damage is significant
    if (damage >= 20) {
      this.setState("STAGGERED");
      
      // Play stagger animation
      this.playAnimation('hit');
      
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
    
    // Play death animation
    this.playAnimation('death');
    
    // Change material to indicate death
    this.model.material = this.materials.dead;
    
    console.log("Enemy died");
    
    // Disable detection sphere
    if (this.detectionSphere) {
      this.detectionSphere.visible = false;
    }
  }
  
  /**
   * Trigger the boss UI to appear
   */
  triggerBossUI() {
    // This will be implemented in UI task
    console.log("Boss health bar should appear now");
    // Create a custom event for the UI system to handle
    document.dispatchEvent(
      new CustomEvent('boss_detected', { 
        detail: { 
          name: this.data.name,
          health: this.data.health,
          maxHealth: this.data.maxHealth
        } 
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
    }
    
    // Add more debug visualizations here as needed
    
    console.log(`Enemy debug visualization ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Face the target
   */
  faceTarget() {
    if (!this.targetEntity || !this.targetEntity.model) return;
    
    const direction = new THREE.Vector3()
      .subVectors(this.targetEntity.model.position, this.model.position)
      .normalize();
    
    // Calculate target rotation
    const targetRotation = Math.atan2(direction.x, direction.z);
    
    // Smooth rotation
    const rotationSpeed = 0.1;
    const angleDiff = (targetRotation - this.model.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    this.model.rotation.y += angleDiff * rotationSpeed;
  }
  
  /**
   * Attack the player
   * @param {number} delta - Time since last frame
   */
  attack(delta) {
    if (!this.targetEntity) return;
    
    // If not in attack range, chase instead
    const distance = this.model.position.distanceTo(this.targetEntity.model.position);
    if (distance > this.data.attackRange) {
      this.setState("CHASE");
      return;
    }
    
    // Face the player
    this.faceTarget();
    
    // Check if we're currently attacking or in cooldown
    if (this.isAttacking) {
      // Let the attack animation finish - handled by animation callback
      return;
    } else if (this.attackCooldown <= 0) {
      // Start a new attack
      this.isAttacking = true;
      
      // Play attack animation - its completion will be handled by the animation callback
      this.playAnimation('comboAttack');
      
      // Create hitbox after a delay to match animation
      if (this.combatManager) {
        setTimeout(() => {
          // Only create hitbox if still in attack state
          if (this.currentState === "ATTACK" && this.isAttacking) {
            const hitboxOffset = new THREE.Vector3(0, 1, -1.5);
            const hitboxSize = new THREE.Vector3(1.2, 1, 1.5);
            
            this.combatManager.createHitbox(
              this.model,
              hitboxOffset,
              hitboxSize,
              this.data.attackDamage,
              0.2,
              { owner: this, knockback: 1 }
            );
            
            console.log("Created enemy attack hitbox");
          }
        }, 400); // Delay hitbox creation to match animation timing
      }
    } else {
      // Still in cooldown, reduce timer
      this.attackCooldown -= delta;
    }
  }
}

export default EnemyEntity;
