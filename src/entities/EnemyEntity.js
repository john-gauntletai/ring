import * as THREE from 'three';

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
    console.log('Enemy animations:', this.animations);
    // Enemy data based on COMBAT_TODO.md
    this.data = {
      health: 300,
      maxHealth: 300,
      name: 'Adult Warwulf',
      isHostile: false,
      detectionRadius: 20,
      attackRange: 4,
      attackDamage: 40,
      attackCooldown: 1,
      velocity: 10,
      dashVelocity: 10,
    };

    // State management
    this.currentState = 'IDLE'; // IDLE, AWARE, CHASE, ATTACK, STAGGERED, DEAD
    this.targetEntity = null;
    this.isPerformingChaseAction = false; // Flag for special chase actions

    // Combat properties
    this.isAttacking = false;
    this.lastAttackTime = 0;
    this.attackCooldown = 0; // current cooldown timer
    this.attackCallbackSet = false;
    this.availableAttacks = ['punch', 'swipe'];
    this.currentAttackType = 'swipe'; // Default attack

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

  markAsLoopOnce(animation) {
    console.log(animation);
    animation.action.loop = THREE.LoopOnce;
    animation.action.clampWhenFinished = true;
  }

  init() {
    // Position the enemy at initial coordinates
    this.model.position.set(0, 0, -30);

    this.markAsLoopOnce(this.animations.roar);
    this.markAsLoopOnce(this.animations.flex);
    this.markAsLoopOnce(this.animations.death);
    this.markAsLoopOnce(this.animations.punch);
    this.markAsLoopOnce(this.animations.swipe);

    // Setup animation callbacks for attack completion
    this.setupAnimationCallbacks();

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
    this.playAnimation('idle');
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
    if (this.currentState === 'DEAD') {
      return;
    }

    // Track the player as target
    this.targetEntity = player;

    // If player is dead, return to idle state
    if (player && player.currentState === 'DEAD') {
      // Stop any ongoing movement sounds
      if (this.isMoving) {
        this.stopMovementSound();
        this.isMoving = false;
        this.currentMovementType = null;
      }

      // Reset hostility and return to idle state
      this.data.isHostile = false;
      this.setState('IDLE');
      return;
    }

    // Check if player is within detection radius
    if (player && player.model) {
      const distance = this.model.position.distanceTo(player.model.position);

      // Transition to hostile if player is within detection radius
      if (distance <= this.data.detectionRadius && !this.data.isHostile) {
        this.becomeHostile();
      }

      // Face the target between animations if hostile, not attacking, and not performing a special action
      if (
        this.data.isHostile &&
        !this.isAttacking &&
        !this.isPerformingChaseAction &&
        this.currentState !== 'DEAD' &&
        this.currentState !== 'IDLE'
      ) {
        this.faceTarget();
      }

      // Update behavior based on current state
      this.updateStateBehavior(delta, distance);

      // Safety check: If we're supposed to be hostile but not in a valid state, reset to CHASE
      if (
        this.data.isHostile &&
        !['AWARE', 'CHASE', 'ATTACK', 'STAGGERED', 'DEAD'].includes(
          this.currentState
        )
      ) {
        console.log(
          'State safety check: Enemy is hostile but in invalid state, resetting to CHASE'
        );
        this.setState('CHASE');
      }

      // Safety check: Make sure the enemy stays in the idle animation when attacking
      if (
        this.isAttacking &&
        ['punch', 'swipe'].includes(this.currentAttackType) &&
        this.currentState === 'ATTACK'
      ) {
        // Ensure we're not playing the run animation during attacks
        if (this.currentAction === this.animations.run?.action) {
          console.log(
            'Animation safety check: Enemy should not be running during attack, stopping movement'
          );
          this.playAnimation('idle', 0.1);
        }
      }
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
      case 'IDLE':
        // If hostile but idle, use the run animation
        if (this.data.isHostile) {
          this.playAnimation('run');
          // If the enemy is hostile but idle, it should probably chase the player
          console.log('Enemy is hostile but idle, switching to CHASE');
          this.setState('CHASE');
        } else {
          // Just idle
          this.playAnimation('idle');
        }
        break;

      case 'AWARE':
        // When in AWARE state, face the player but don't move yet
        // The roar animation and transition to CHASE is handled in setState
        this.faceTarget();
        break;

      case 'CHASE':
        // Chase the player
        this.moveTowardsPlayer(delta);

        // If close enough to attack
        if (distanceToPlayer <= this.data.attackRange) {
          console.log(
            `Enemy in attack range (${distanceToPlayer.toFixed(
              2
            )} units), switching to ATTACK`
          );
          this.setState('ATTACK');
        }
        break;

      case 'ATTACK':
        // Attack the player
        this.attack(delta);
        break;

      case 'DEAD':
        // Already handled in die
        break;

      default:
        this.setState('IDLE');
        break;
    }
  }

  /**
   * Move towards the player
   * @param {number} delta - Time since last frame
   */
  moveTowardsPlayer(delta) {
    if (!this.targetEntity || !this.targetEntity.model) return;

    // If attacking or performing a special chase action, don't move
    if (this.isAttacking || this.isPerformingChaseAction) {
      return;
    }

    // Random chance for special chase behaviors
    const chanceRoll = Math.random();

    // 0.02% chance to stop and roar during chase (reduced from 5%) DO NOT CHANGE THIS
    if (chanceRoll < 0.0002) {
      this.isPerformingChaseAction = true;
      console.log('Enemy stopping to roar during chase');

      // Play roar animation
      this.playAnimation('roar', 0.2, 1.5);

      // Play dragon roar sound
      this.playDragonRoarSound();

      // Setup completion handler
      const roarAction = this.animations.roar.action;
      const roarCompletionHandler = (e) => {
        if (e.action === roarAction) {
          this.isPerformingChaseAction = false;
          console.log('Chase roar completed, resuming chase');

          // Remove the listener
          roarAction
            .getMixer()
            .removeEventListener('finished', roarCompletionHandler);
        }
      };

      // Add the event listener
      roarAction.getMixer().addEventListener('finished', roarCompletionHandler);

      return;
    }

    // Regular chase behavior
    // Get direction to player
    const targetPosition = this.targetEntity.model.position.clone();
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, this.model.position)
      .normalize();

    // Move towards player
    const speed = this.data.velocity; // units per second
    this.model.position.x += direction.x * speed * delta;
    this.model.position.z += direction.z * speed * delta;

    // Rotate to face the player
    const targetAngle = Math.atan2(direction.x, direction.z);
    this.model.rotation.y = targetAngle;

    // Play run/chase animation and update movement sounds
    this.playAnimation('run');
    this.updateMovementSound();
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

      // Start the boss battle music immediately
      this.startBossBattleMusic();

      // Transition to aware state first
      this.setState('AWARE');
    }
  }

  /**
   * Transition to a new state
   * @param {string} newState - The new state to transition to
   */
  setState(newState) {
    const oldState = this.currentState;
    this.currentState = newState;

    console.log(`Enemy state transition: ${oldState} -> ${newState}`);

    // Additional state transition logic can be added here
    switch (newState) {
      case 'CHASE':
        // Force run animation when entering chase state
        this.playAnimation('run');
        break;

      case 'ATTACK':
        // Reset attack cooldown when entering attack state
        this.attackCooldown = 0;
        break;

      case 'AWARE':
        // If transitioning from IDLE to AWARE, play roar animation and sound
        if (oldState === 'IDLE') {
          // Play roar animation if available
          if (this.animations.roar && this.animations.roar.action) {
            this.playAnimation('roar', 0.3, 2.0); // High priority to ensure it plays

            // After roar animation completes, transition to chase state
            const roarAction = this.animations.roar.action;

            // Make sure it's a one-time animation
            roarAction.loop = THREE.LoopOnce;
            roarAction.clampWhenFinished = true;

            // Set up listener for animation completion if not already set
            const roarCompletionHandler = (e) => {
              if (e.action === roarAction) {
                console.log('Roar animation completed, transitioning to CHASE');
                this.setState('CHASE');

                // Remove the listener to avoid memory leaks
                roarAction
                  .getMixer()
                  .removeEventListener('finished', roarCompletionHandler);
              }
            };

            // Add the event listener to the mixer
            roarAction
              .getMixer()
              .addEventListener('finished', roarCompletionHandler);

            // Play dragon roar sound
            this.playDragonRoarSound();
          } else {
            console.warn('Roar animation not available, using fallback');
            // If no roar animation available, still play the sound
            this.playDragonRoarSound();

            // Use a timeout to mimic the animation duration before transitioning to CHASE
            setTimeout(() => {
              if (this.currentState === 'AWARE') {
                this.setState('CHASE');
              }
            }, 2000); // 2 seconds delay
          }
        } else {
          // No need to start boss battle music here, it's already started in becomeHostile
          // We'll keep this block to handle any other transitions to AWARE state that don't come from becomeHostile
        }
        break;

      // Add other state transition logic as needed
    }
  }

  /**
   * Start playing the boss battle music
   */
  startBossBattleMusic() {
    if (
      this.soundManager &&
      !this.isBossMusicPlaying &&
      !this.isBossMusicPreparing
    ) {
      // Preload the boss battle music if it wasn't already
      if (!this.soundManager.sounds['bossBattleMusic']) {
        this.soundManager.preloadSound(
          'bossBattleMusic',
          '/assets/sounds/bossBattleMusic.mp3'
        );
      }

      console.log('Starting boss battle music...');

      // Set a flag to prevent multiple timeouts
      this.isBossMusicPreparing = true;

      // Wait 1 second before starting the boss battle music (reduced from 3 seconds)
      setTimeout(() => {
        // Start with lower volume and gradually increase for a fade-in effect
        this.soundManager.startLoop('bossBattleMusic', { volume: 0.05 });
        this.isBossMusicPlaying = true;

        // Fade in the volume over 2 seconds
        setTimeout(() => {
          if (this.soundManager.activeLoops['bossBattleMusic']) {
            this.soundManager.activeLoops['bossBattleMusic'].volume = 0.1;
          }

          setTimeout(() => {
            if (this.soundManager.activeLoops['bossBattleMusic']) {
              this.soundManager.activeLoops['bossBattleMusic'].volume = 0.15;
            }
            this.isBossMusicPreparing = false;
            console.log('Boss battle music now playing at full volume');
          }, 1000);
        }, 1000);

        // Add a listener for player death to stop the music
        this.playerDeathListener = (event) => {
          if (this.isBossMusicPlaying) {
            this.stopBossBattleMusic();
          }
        };

        // Listen for the player_died event that would be dispatched by the player entity
        document.addEventListener('player_died', this.playerDeathListener);
      }, 1000); // 1-second delay (reduced from 3 seconds)
    }
  }

  /**
   * Stop the boss battle music
   */
  stopBossBattleMusic() {
    if (this.soundManager && this.isBossMusicPlaying) {
      this.soundManager.stopLoop('bossBattleMusic');
      this.isBossMusicPlaying = false;
      console.log('Stopped boss battle music');

      // Play victory sound 1 second after the battle music ends
      setTimeout(() => {
        this.playVictorySound();
      }, 500);

      // Remove the player death event listener
      if (this.playerDeathListener) {
        document.removeEventListener('player_died', this.playerDeathListener);
        this.playerDeathListener = null;
      }
    }
  }

  /**
   * Play the victory sound
   */
  playVictorySound() {
    if (this.soundManager) {
      // Preload the victory sound if it wasn't already
      if (!this.soundManager.sounds['victory']) {
        this.soundManager.preloadSound('victory', '/assets/sounds/victory.mp3');
      }

      // Play the victory sound
      this.soundManager.playSound('victory', { volume: 0.1 });
      console.log('Played victory sound');
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
    const isRunningAnimation = name === 'run';

    if (this.currentAction === newAction) return;

    // Special case: If the current animation is "death", don't interrupt it with anything
    if (
      this.currentAction &&
      this.currentAction === this.animations.death?.action &&
      name !== 'death'
    ) {
      console.log('Death animation cannot be interrupted');
      return;
    }

    // Set special priorities for certain animations
    if (name === 'death') {
      // Death animation gets highest priority (3.0)
      priority = 3.0;
    }

    // Handle interruption logic:
    // 1. Death animation (priority 3.0) always interrupts
    // 2. High priority animations (impact, priority 2.0) interrupt most animations
    // 3. Don't interrupt attack animations with low priority animations
    if (
      priority < 2.0 &&
      this.isAttacking &&
      !['punch', 'swipe'].includes(name)
    ) {
      // Low priority animation during attack - don't interrupt
      return;
    }

    // For high priority animations, log the interruption
    if (priority >= 2.0) {
      console.log(
        `High priority animation '${name}' interrupting current animation`
      );
    }

    if (this.currentAction) {
      this.previousAction = this.currentAction;
      this.previousAction.fadeOut(crossFadeDuration);
    }

    newAction.reset().fadeIn(crossFadeDuration).play();
    this.currentAction = newAction;

    // For attack animations, ensure they complete
    if (['punch', 'swipe', 'roar', 'flex'].includes(name)) {
      newAction.enabled = true;
      newAction.clampWhenFinished = true;
      newAction.zeroSlopeAtEnd = false; // Ensures smooth end of animation
      newAction.loop = THREE.LoopOnce;
    }

    // Handle movement sounds
    if (isRunningAnimation) {
      this.startMovementSound('run');
      this.isMoving = true;
      this.currentMovementType = 'run';
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
      // Pass the enemy's velocity to the sound manager for footstep timing
      this.soundManager.startFootstepsForMovementType(
        movementType,
        { volume: 0.4 },
        this.data.velocity
      );
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
   * Update movement sound frequency based on current velocity
   */
  updateMovementSound() {
    // If moving, update the footstep frequency based on current velocity
    if (this.isMoving && this.soundManager) {
      this.soundManager.updateFootstepFrequency(this.data.velocity);
    }
  }

  /**
   * Take damage from an attack
   * @param {number} damage - Amount of damage to take
   * @param {object} options - Additional options
   */
  takeDamage(damage, options = {}) {
    // Don't take damage if already dead
    if (this.currentState === 'DEAD') {
      return;
    }

    // Apply damage
    this.data.health -= damage;
    console.log(
      `Enemy took ${damage} damage. Health: ${this.data.health}/${this.data.maxHealth}`
    );

    // Play sword slash sound if the attacker is the player
    if (
      this.soundManager &&
      options.attacker &&
      options.attacker === window.PLAYER
    ) {
      // Choose the appropriate sound based on attack type
      if (options.attackType === 'kick') {
        // Keep kick sound different
        this.soundManager.playSound('kickSound', { volume: 0.5 });
      } else {
        // For all other attacks, play a random sword slash sound
        this.soundManager.playRandomSwordSlash({ volume: 0.5 });
      }
    }

    // Update boss health UI
    document.dispatchEvent(
      new CustomEvent('boss_health_changed', {
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
      if (this.currentState !== 'DEAD') {
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

    // Get staggered only if damage is significant
    if (damage >= 20) {
      this.setState('STAGGERED');

      // Return to chase after stagger time
      setTimeout(() => {
        if (this.currentState === 'STAGGERED') {
          // Play run animation before transitioning back to CHASE
          this.playAnimation('run', 0.3);
          this.setState('CHASE');
        }
      }, 1000);
    } else {
      // Become aware and hostile if not already
      this.becomeHostile();

      // If we were knocked out of an animation but not staggered, ensure we're moving
      if (this.currentState !== 'CHASE' && this.currentState !== 'ATTACK') {
        this.setState('CHASE');
      }
    }
  }

  /**
   * Die and clean up
   */
  die() {
    this.setState('DEAD');

    // Stop boss battle music when enemy dies
    this.stopBossBattleMusic();

    // Cancel any attack state
    this.isAttacking = false;
    this.currentAttackType = null;
    this.isPerformingChaseAction = false;

    // Cancel any ongoing dash or run away animations
    if (this.dashAnimationFrame) {
      cancelAnimationFrame(this.dashAnimationFrame);
      this.dashAnimationFrame = null;
    }

    if (this.runAwayAnimationFrame) {
      cancelAnimationFrame(this.runAwayAnimationFrame);
      this.runAwayAnimationFrame = null;
    }

    // Play death animation with highest priority
    // The priority is set to 3.0 in the playAnimation method
    this.playAnimation('death', 0.2, 3.0);

    // Change material to indicate death
    this.model.material = this.materials.dead;

    console.log('Enemy died');

    // Disable detection sphere
    if (this.detectionSphere) {
      this.detectionSphere.visible = false;
    }

    // Check if this enemy is the player's lockOnEntity, and if so, toggle it off
    if (window.PLAYER && window.PLAYER.lockOnEntity === this) {
      console.log('Removing lock-on from dying enemy');
      window.PLAYER.toggleLockOn(); // Call with no parameters to clear the lock-on
    }

    setTimeout(() => {
      this.showEnemyFelledOverlay();
    }, 500);

    // Hide the boss UI after 3 seconds
    setTimeout(() => {
      // Dispatch custom event to hide the UI
      document.dispatchEvent(
        new CustomEvent('boss_defeated', {
          detail: {
            name: this.data.name,
          },
        })
      );
      console.log('Boss UI hidden after death');
    }, 3000);
  }

  /**
   * Show the Enemy Felled overlay
   */
  showEnemyFelledOverlay() {
    // Get the enemy felled overlay element
    const enemyFelledOverlay = document.getElementById('enemy-felled-overlay');
    if (!enemyFelledOverlay) {
      console.warn('Enemy felled overlay element not found');
      return;
    }

    // Play victory sound at the same time as showing the overlay
    if (this.soundManager) {
      // Preload the victory sound if it wasn't already
      if (!this.soundManager.sounds['victory']) {
        this.soundManager.preloadSound('victory', '/assets/sounds/victory.mp3');
      }

      // Play the victory sound
      this.soundManager.playSound('victory', { volume: 0.2 });
      console.log('Played victory sound with enemy felled overlay');
    }

    // Show the overlay with fade in
    enemyFelledOverlay.style.display = 'flex';
    // Trigger a reflow before setting opacity for the transition to work
    enemyFelledOverlay.offsetHeight;
    // Make the overlay visible with transition
    enemyFelledOverlay.style.opacity = '1';

    // Hide the overlay after 4 seconds
    setTimeout(() => {
      enemyFelledOverlay.style.opacity = '0';
      // Wait for the fade-out transition to complete before hiding the element
      setTimeout(() => {
        enemyFelledOverlay.style.display = 'none';

        // Play the "Well Done" sound 0.5 seconds after the overlay completes
        setTimeout(() => {
          this.playWellDoneSound();
        }, 500); // 0.5 seconds after the overlay is fully hidden
      }, 1500); // 1.5 seconds for fade-out transition
    }, 2500); // Display for 2.5 seconds before starting fade-out
  }

  /**
   * Play the "Well Done" sound
   */
  playWellDoneSound() {
    if (this.soundManager) {
      // Preload the well done sound if it wasn't already
      if (!this.soundManager.sounds['wellDone']) {
        this.soundManager.preloadSound(
          'wellDone',
          '/assets/sounds/wellDone.mp3'
        );
      }

      // Play the well done sound
      this.soundManager.playSound('wellDone', { volume: 0.5 });
      console.log('Played well done sound');
    }
  }

  /**
   * Trigger the boss UI to appear
   */
  triggerBossUI() {
    // This will be implemented in UI task
    console.log('Boss health bar should appear now');
    // Create a custom event for the UI system to handle
    document.dispatchEvent(
      new CustomEvent('boss_detected', {
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
      `Enemy debug visualization ${enabled ? 'enabled' : 'disabled'}`
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
      console.log('Enemy out of attack range, switching to CHASE');
      this.setState('CHASE');
      return;
    }

    // Always face the target when in attack state
    this.faceTarget();

    // Check if we're currently attacking or in cooldown
    if (this.isAttacking) {
      // Let the attack animation finish - handled by animation callback
      // Don't move during attack animations
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
      console.log('Enemy starting new attack');

      // Track the starting position for animations that move the enemy
      this.attackStartPosition = this.model.position.clone();

      // First filter to only include attacks that have animations
      const validAttacks = this.availableAttacks.filter(
        (attackType) =>
          this.animations[attackType] && this.animations[attackType].action
      );

      // Random chance to determine attack type
      const rand = Math.random();

      if (validAttacks.length > 0) {
        // Choose a random attack from valid attacks with weighted probability
        // Make swipe more common (60% chance) and punch less common (40% chance)
        let attackIndex;
        const randAttack = Math.random();

        if (validAttacks.includes('swipe') && validAttacks.includes('punch')) {
          // Both attacks available - use weighted selection
          attackIndex =
            randAttack < 0.6
              ? validAttacks.indexOf('swipe')
              : validAttacks.indexOf('punch');
        } else {
          // Just use random selection if not both available
          attackIndex = Math.floor(randAttack * validAttacks.length);
        }

        this.currentAttackType = validAttacks[attackIndex];
        console.log(`Enemy using ${this.currentAttackType} attack`);

        // Position the enemy at the appropriate attack range before playing animation
        if (distance > this.data.attackRange * 0.75) {
          // Get direction to player
          const targetPosition = this.targetEntity.model.position.clone();
          const direction = new THREE.Vector3()
            .subVectors(targetPosition, this.model.position)
            .normalize();

          // Move to optimal attack position - only once before the attack animation
          const optimalDistance = this.data.attackRange * 0.75;
          const distanceToMove = distance - optimalDistance;

          if (distanceToMove > 0) {
            this.model.position.x += direction.x * distanceToMove;
            this.model.position.z += direction.z * distanceToMove;
            console.log(
              `Enemy positioned for attack at optimal range: ${optimalDistance.toFixed(
                2
              )}`
            );
          }
        }

        // Play the selected attack animation with high priority to prevent interruption
        this.playAnimation(this.currentAttackType, 0.2, 1.0); // Fast crossfade, high priority

        // Create hitbox after a delay to match animation
        if (this.combatManager) {
          // Different hitbox configurations based on attack type
          let hitboxDelay = 400; // Default delay
          let hitboxOffset = new THREE.Vector3(0, 1, -2.5); // Moved further forward (from -1.5)
          let hitboxSize = new THREE.Vector3(1.5, 1.5, 2.0); // Extended forward rather than wider
          let damage = this.data.attackDamage;
          let knockback = 1;

          // Customize hitbox based on attack type
          switch (this.currentAttackType) {
            case 'swipe':
              hitboxDelay = 400;
              hitboxOffset = new THREE.Vector3(0, 1, -3.0); // Moved further forward (from -2)
              hitboxSize = new THREE.Vector3(3.0, 2.0, 2.5); // More focused in front direction
              damage = Math.floor(this.data.attackDamage * 1.2);
              knockback = 1.2;
              break;
            case 'punch':
              hitboxDelay = 300;
              hitboxOffset = new THREE.Vector3(0, 1, -2.5); // Moved further forward (from -1.5)
              hitboxSize = new THREE.Vector3(2.0, 2.0, 2.5); // More focused in front direction
              damage = this.data.attackDamage;
              knockback = 0.8;
              break;
            // Other attack types can be added here
          }

          setTimeout(() => {
            // Only create hitbox if still in attack state
            if (this.currentState === 'ATTACK' && this.isAttacking) {
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
        console.warn('No valid attack animations available');
        this.isAttacking = false;
      }
    } else {
      // Still in cooldown, reduce timer
      this.attackCooldown -= delta;

      // Always face the target during cooldown
      this.faceTarget();

      // When cooldown is complete, transition back to chase
      if (this.attackCooldown <= 0 && this.currentState === 'ATTACK') {
        console.log('Attack cooldown complete, returning to CHASE state');
        this.setState('CHASE');

        // Force run animation to ensure visual feedback of state change
        setTimeout(() => {
          if (this.currentState === 'CHASE') {
            this.playAnimation('run');
          }
        }, 50);
      }
    }
  }

  /**
   * Perform the flex-dash-swipe combo attack
   * Sequence: 1. Flex animation, 2. Dash to player, 3. Swipe attack
   * @param {Function} onComboComplete - Optional callback when combo is complete
   */
  performFlexDashSwipeCombo(onComboComplete) {
    if (!this.targetEntity || !this.animations.flex || !this.animations.swipe) {
      console.warn("Can't perform flex-dash-swipe combo, missing animations");
      this.isAttacking = false;
      if (onComboComplete) onComboComplete();
      return;
    }

    // Step 1: Play flex animation
    this.playAnimation('flex', 0.2, 2.0); // Fast crossfade, high priority

    // Set up a sequence of actions
    // After flex animation completes, dash to player and then swipe
    const flexAction = this.animations.flex.action;

    // Create a handler for flex completion
    const flexCompletionHandler = (e) => {
      if (e.action === flexAction) {
        console.log('Flex animation completed, starting dash');

        // Remove the listener to avoid memory leaks
        flexAction
          .getMixer()
          .removeEventListener('finished', flexCompletionHandler);

        // Step 2: Dash towards player
        this.performDashToTarget(() => {
          // Step 3: After dash completes, perform swipe attack
          console.log('Dash completed, performing swipe attack');

          // Set current attack type for hitbox creation
          this.currentAttackType = 'swipe';

          // Play swipe animation
          this.playAnimation('swipe', 0.1, 1.5); // Very quick crossfade, high priority

          // Create an enhanced swipe hitbox after appropriate delay
          if (this.combatManager) {
            setTimeout(() => {
              if (this.currentState === 'ATTACK' && this.isAttacking) {
                this.combatManager.createHitbox(
                  this.model,
                  new THREE.Vector3(0, 1, -3.5), // Further in front (from -2)
                  new THREE.Vector3(2.5, 1.8, 3.0), // More focused in front direction
                  Math.floor(this.data.attackDamage * 1.5), // 50% more damage for combo
                  0.25, // Slightly longer duration
                  {
                    owner: this,
                    knockback: 1.5, // More knockback for the combo attack
                    preserveAnimation: true,
                  }
                );
                console.log(
                  'Created enhanced swipe hitbox after flex-dash combo'
                );
              }
            }, 350); // Slightly quicker hitbox timing for combo
          }

          // Set up completion handler for the swipe
          const swipeAction = this.animations.swipe.action;
          const swipeCompletionHandler = (e) => {
            if (e.action === swipeAction) {
              console.log('Combo attack sequence completed');
              this.isAttacking = false;
              this.attackCooldown = this.data.attackCooldown * 1.75; // Longer cooldown after combo

              // Remove the listener
              swipeAction
                .getMixer()
                .removeEventListener('finished', swipeCompletionHandler);

              // Return to normal velocity after combo completes
              console.log('Returning to normal velocity after combo');

              // Execute callback if provided
              if (onComboComplete) onComboComplete();
            }
          };

          // Add listener for swipe completion
          swipeAction
            .getMixer()
            .addEventListener('finished', swipeCompletionHandler);
        });
      }
    };

    // Add the event listener for flex completion
    flexAction.getMixer().addEventListener('finished', flexCompletionHandler);
  }

  /**
   * Perform a dash toward the target, then execute a callback when complete
   * @param {Function} onDashComplete - Callback to execute when dash is complete
   */
  performDashToTarget(onDashComplete) {
    if (!this.targetEntity) {
      if (onDashComplete) onDashComplete();
      return;
    }

    // Get direction to player
    const targetPosition = this.targetEntity.model.position.clone();
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, this.model.position)
      .normalize();

    // Calculate distance to target
    const distance = this.model.position.distanceTo(targetPosition);

    // Calculate dash distance (leave some space to not overshoot)
    const dashDistance = Math.max(0, distance - this.data.attackRange / 2);

    // Play running animation during dash
    this.playAnimation('run', 0.1, 1.0);

    // Use dashVelocity for faster movement
    const originalVelocity = this.data.velocity;
    const dashVelocity = this.data.dashVelocity;

    // Determine dash duration based on distance and speed
    const dashDuration = dashDistance / dashVelocity;

    console.log(
      `Starting dash: distance=${dashDistance.toFixed(
        2
      )}, duration=${dashDuration.toFixed(2)}s`
    );

    // Start the dash with animation
    const startTime = performance.now();
    const initialPosition = this.model.position.clone();

    // Create the dash animation function
    const performDashStep = () => {
      const elapsed = (performance.now() - startTime) / 1000; // Convert to seconds
      const progress = Math.min(elapsed / dashDuration, 1.0);

      // If dash is complete
      if (progress >= 1.0) {
        // Clear the animation frame
        if (this.dashAnimationFrame) {
          cancelAnimationFrame(this.dashAnimationFrame);
          this.dashAnimationFrame = null;
        }

        // Execute completion callback
        if (onDashComplete) onDashComplete();

        return;
      }

      // Calculate new position based on progress
      const newPosition = new THREE.Vector3().copy(initialPosition);
      newPosition.x += direction.x * dashDistance * progress;
      newPosition.z += direction.z * dashDistance * progress;

      // Update enemy position
      this.model.position.copy(newPosition);

      // Continue dash on next frame
      this.dashAnimationFrame = requestAnimationFrame(performDashStep);
    };

    // Start the dash animation
    this.dashAnimationFrame = requestAnimationFrame(performDashStep);
  }

  /**
   * Play the dragon roar sound
   */
  playDragonRoarSound() {
    if (this.soundManager) {
      // Preload the dragon roar sound if it wasn't already
      if (!this.soundManager.sounds['dragonRoar']) {
        this.soundManager.preloadSound(
          'dragonRoar',
          '/assets/sounds/dragon roar.mp3'
        );
      }

      // Play the dragon roar sound
      this.soundManager.playSound('dragonRoar', { volume: 0.7 });
      console.log('Played dragon roar sound');
    }
  }

  /**
   * Play dragon animation and sound simultaneously
   * @param {string} animationName - The name of the dragon animation to play
   * @param {string} soundName - The name of the sound file to play
   */
  playDragonAnimationAndSound(animationName, soundFileName) {
    // Get the dragon entity from window or scene
    const dragon = window.DRAGON;

    if (!dragon) {
      console.warn(
        'Dragon entity not found, cannot play animation:',
        animationName
      );
      return;
    }

    console.log('Dragon entity found:', dragon);

    // Play dragon animation
    if (dragon.animations && dragon.animations[animationName]) {
      // Reset and play the animation
      const action = dragon.animations[animationName].action;
      action.reset().play();
      console.log(`Playing dragon ${animationName} animation`);

      // Special case for 'down' animation - land the dragon
      if (animationName === 'down') {
        console.log(
          "Dragon 'down' animation started, will handle landing sequence"
        );

        // Record initial position
        const initialPosition = dragon.model.position.clone();
        console.log('Initial dragon position:', initialPosition);

        // 1. Let animation play for a bit (0.5 seconds)
        setTimeout(() => {
          try {
            // 2. Get current position but keep height at 0 (ground level)
            const newPosition = dragon.model.position.clone();

            // 3. Stop the animation completely
            action.stop();

            // 4. Get the mixer and reset it
            if (dragon.mixer) {
              // Reset all active animations
              dragon.mixer.stopAllAction();
            }

            // 5. Force the dragon model to ground level
            // Use the player's position as reference for ground height
            let groundLevel = 0;
            if (
              window.PLAYER &&
              window.PLAYER.model &&
              window.PLAYER.model.position
            ) {
              // Get the y-position of the player as our ground reference
              groundLevel = window.PLAYER.model.position.y;
              console.log(
                "Using player's position as ground reference:",
                groundLevel
              );
            }

            // 6. Set the position to match current x/z but with ground-level y
            dragon.model.position.set(
              newPosition.x,
              groundLevel,
              newPosition.z
            );
            console.log(
              'Dragon positioned at ground level:',
              dragon.model.position
            );

            // 7. Apply the position directly to all child meshes as well
            if (dragon.model.children && dragon.model.children.length > 0) {
              console.log(
                'Adjusting all child elements to match new parent position'
              );
              dragon.model.updateMatrixWorld(true); // Update the world matrix
            }

            // 8. Create a visually distinctive effect when the dragon lands
            if (window.SCENE) {
              // Create dust effect or ground impact visuals
              console.log(
                'Would add landing impact effect here if implemented'
              );
            }

            // 9. Record that we've landed the dragon
            dragon.hasLanded = true;
          } catch (error) {
            console.error('Error during dragon landing sequence:', error);
          }
        }, 500); // 0.5 seconds delay before stopping animation

        // 10. Apply permanent override to prevent the dragon from floating again
        // This creates a custom update handler if it doesn't already exist
        if (!dragon._originalUpdateMethod) {
          dragon._originalUpdateMethod = dragon.update;

          // Override the update method
          dragon.update = function (delta) {
            // Call the original update first
            if (this._originalUpdateMethod) {
              this._originalUpdateMethod.call(this, delta);
            }

            // After update, if the dragon has landed, force its position to ground
            if (this.hasLanded && this.model) {
              // Keep x and z, but force y to ground level
              const groundLevel =
                window.PLAYER && window.PLAYER.model
                  ? window.PLAYER.model.position.y
                  : 0;

              // Maintain current x/z but enforce ground level y
              this.model.position.y = groundLevel;
            }
          };

          console.log("Added position override to dragon's update method");
        }
      }
    } else {
      console.warn(`Dragon animation ${animationName} not found`);
    }

    // Play the corresponding sound
    if (this.soundManager) {
      // Ensure the sound is loaded
      const soundId = `dragon_${animationName}`;
      if (!this.soundManager.sounds[soundId]) {
        this.soundManager.preloadSound(
          soundId,
          `/assets/sounds/${soundFileName}`
        );
      }

      // Play the sound
      this.soundManager.playSound(soundId, { volume: 0.5 });
      console.log(`Playing dragon sound: ${soundFileName}`);
    } else {
      console.warn(
        'Sound manager not available, cannot play sound:',
        soundFileName
      );
    }
  }

  /**
   * Perform run away sequence and then execute callback
   * @param {Function} onComplete - Callback function to execute when run away is complete
   */
  performRunAway(onComplete) {
    if (!this.targetEntity) {
      this.isAttacking = false; // Reset attacking flag if no target
      if (onComplete) onComplete();
      return;
    }

    console.log('Starting run-away sequence');

    // Get direction AWAY from player (reverse of towards direction)
    const targetPosition = this.targetEntity.model.position.clone();
    const directionAway = new THREE.Vector3()
      .subVectors(this.model.position, targetPosition)
      .normalize();

    // Calculate the run away distance (15 units)
    const runAwayDistance = 15;
    const runAwayDestination = new THREE.Vector3().copy(this.model.position);
    runAwayDestination.x += directionAway.x * runAwayDistance;
    runAwayDestination.z += directionAway.z * runAwayDistance;

    console.log(`Running away ${runAwayDistance} units from player`);

    // Play run animation
    this.playAnimation('run', 0.2, 1.0);

    // Determine run duration based on regular velocity
    const runAwayDuration = runAwayDistance / this.data.velocity;

    // Start the run away animation
    const startTime = performance.now();
    const initialPosition = this.model.position.clone();

    // Store the animation frame reference for cleanup
    this.runAwayAnimationFrame = null;

    // Create the run away animation function
    const performRunAwayStep = () => {
      const elapsed = (performance.now() - startTime) / 1000; // Convert to seconds
      const progress = Math.min(elapsed / runAwayDuration, 1.0);

      // If run away is complete
      if (progress >= 1.0) {
        // Clear the animation frame
        if (this.runAwayAnimationFrame) {
          cancelAnimationFrame(this.runAwayAnimationFrame);
          this.runAwayAnimationFrame = null;
        }

        // Once we've run away, rotate to face player
        this.faceTarget();

        console.log('Run away complete');

        // Execute the callback
        if (onComplete) onComplete();

        return;
      }

      // Calculate new position based on progress
      const newPosition = new THREE.Vector3().copy(initialPosition);
      newPosition.x += directionAway.x * runAwayDistance * progress;
      newPosition.z += directionAway.z * runAwayDistance * progress;

      // Update enemy position
      this.model.position.copy(newPosition);

      // Look away from player during run
      this.model.rotation.y = Math.atan2(directionAway.x, directionAway.z);

      // Continue animation on next frame
      this.runAwayAnimationFrame = requestAnimationFrame(performRunAwayStep);
    };

    // Start the run away animation
    this.runAwayAnimationFrame = requestAnimationFrame(performRunAwayStep);
  }

  setupAnimationCallbacks() {
    // Set up callbacks for all attack animations
    const attackTypes = ['punch', 'swipe', 'roar', 'flex'];

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

          // Skip additional logic for roar and flex since they're handled separately
          if (attackType === 'roar' || attackType === 'flex') {
            // Still need to reset attacking state
            this.isAttacking = false;
            continue;
          }

          this.isAttacking = false;
          this.attackCooldown = this.data.attackCooldown;

          // Face the target after animation completes
          if (this.targetEntity) {
            this.faceTarget();
          }

          // Return to idle animation
          if (this.currentState === 'ATTACK') {
            this.playAnimation('idle');

            // Transition back to CHASE after attack completes
            setTimeout(() => {
              if (this.currentState === 'ATTACK') {
                console.log(
                  `${attackType} attack complete, returning to CHASE state`
                );
                this.setState('CHASE');

                // Force run animation to ensure visual feedback of state change
                setTimeout(() => {
                  if (this.currentState === 'CHASE') {
                    this.playAnimation('run');
                  }
                }, 50);
              }
            }, 250); // Small delay before chasing again
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
          .removeEventListener('finished', this.onAttackFinished);

        // Add the event listener to the mixer
        attackAction
          .getMixer()
          .addEventListener('finished', this.onAttackFinished);

        // Set up non-looping for attack animations with clampWhenFinished
        attackAction.loop = THREE.LoopOnce;
        attackAction.clampWhenFinished = true;
        attackAction.repetitions = 1; // Ensure it plays exactly once
      }
    }
  }
}

export default EnemyEntity;
