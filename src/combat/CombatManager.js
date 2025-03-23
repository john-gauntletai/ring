import * as THREE from "three";

/**
 * CombatManager class for handling combat interactions
 * Manages hitboxes, damage calculation, and combat effects
 */
class CombatManager {
  constructor() {
    this.entities = [];
    this.hitboxes = [];
    this.activeEffects = [];
    this.debugMode = false;
    this.collisionDetector = new THREE.Raycaster();
    
    // Debug visualization objects
    this.debugObjects = new THREE.Group();
    this.debugObjects.name = 'combat-debug';
    
    // Get the scene
    this.scene = null;
    
    // Combat event system
    this.setupEventSystem();
  }
  
  /**
   * Register an entity with the combat manager
   * @param {Object} entity - Entity to register (player or enemy)
   */
  registerEntity(entity) {
    if (this.entities.includes(entity)) {
      console.warn('Entity already registered with combat manager');
      return;
    }
    
    this.entities.push(entity);
    
    // Store reference to scene if we don't have it yet
    if (!this.scene && entity.model && entity.model.parent) {
      this.scene = entity.model.parent;
      console.log('CombatManager: Scene reference obtained');
      
      // If debug mode is on, add debug objects to scene
      if (this.debugMode) {
        this.scene.add(this.debugObjects);
      }
    }
    
    console.log(`Entity registered with combat manager: ${entity.constructor.name}`);
  }
  
  /**
   * Update all combat-related systems
   * @param {number} deltaTime - Time since last frame
   */
  update(deltaTime) {
    // Update all hitboxes
    this.hitboxes.forEach(hitbox => {
      if (hitbox.active) {
        hitbox.update(deltaTime);
      }
    });
    
    // Check for collisions
    this.checkCollisions();
    
    // Update combat effects
    this.updateEffects(deltaTime);
    
    // Debug visualization
    if (this.debugMode) {
      this.updateDebugVisuals();
    }
  }
  
  /**
   * Create a new hitbox for an attack
   * @param {Object} parent - Parent entity or object
   * @param {THREE.Vector3} offsetPosition - Offset from parent position
   * @param {THREE.Vector3} size - Size of the hitbox
   * @param {number} damageValue - Amount of damage the hitbox deals
   * @param {number} duration - How long the hitbox is active in seconds
   * @param {Object} options - Additional options
   * @returns {Object} The created hitbox
   */
  createHitbox(parent, offsetPosition, size, damageValue, duration, options = {}) {
    const hitbox = {
      id: this.hitboxes.length,
      parent: parent,
      offset: offsetPosition,
      size: size,
      damage: damageValue,
      knockback: options.knockback || 0,
      duration: duration,
      timeRemaining: duration,
      collider: new THREE.Box3(),
      owner: options.owner,
      active: true,
      
      // Debug visualization
      debugMesh: null,
      
      // Update method
      update: function(delta) {
        this.timeRemaining -= delta;
        
        if (this.timeRemaining <= 0) {
          this.active = false;
          // Remove debug mesh when hitbox expires
          if (this.debugMesh && this.debugMesh.parent) {
            this.debugMesh.parent.remove(this.debugMesh);
          }
          return;
        }
        
        // Update position based on parent
        if (this.parent && this.parent.position) {
          const worldPos = new THREE.Vector3();
          
          // If parent is a mesh or object3D with localToWorld method
          if (this.parent.localToWorld) {
            worldPos.copy(this.offset);
            this.parent.localToWorld(worldPos);
          } else {
            // Otherwise just add the offset to parent position
            worldPos.copy(this.parent.position).add(this.offset);
          }
          
          this.collider.setFromCenterAndSize(worldPos, this.size);
          
          // Update debug mesh if it exists
          if (this.debugMesh) {
            this.debugMesh.position.copy(worldPos);
          }
        }
      }
    };
    
    // Create debug visualization if in debug mode
    if (this.debugMode) {
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      
      // Set different colors for player vs enemy hitboxes
      let hitboxColor, opacity;
      
      if (options.owner && options.owner.constructor.name === "PlayerEntity") {
        // Blue for player hitboxes
        hitboxColor = 0x00aaff;
        opacity = 0.4;
      } else {
        // Red for enemy hitboxes
        hitboxColor = 0xff3333;
        opacity = 0.4;
      }
      
      // Create wireframe material for outline
      const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: hitboxColor,
        wireframe: true,
        wireframeLinewidth: 2
      });
      
      // Create solid material with transparency
      const solidMaterial = new THREE.MeshBasicMaterial({
        color: hitboxColor,
        transparent: true,
        opacity: opacity
      });
      
      // Create main mesh with solid material
      hitbox.debugMesh = new THREE.Mesh(geometry, solidMaterial);
      
      // Create wireframe mesh and add as child
      const wireframe = new THREE.Mesh(geometry, wireframeMaterial);
      hitbox.debugMesh.add(wireframe);
      
      // Scale the wireframe slightly to avoid z-fighting
      wireframe.scale.multiplyScalar(1.01);
      
      // Add to scene
      if (this.scene) {
        this.scene.add(hitbox.debugMesh);
      } else if (parent.parent) {
        parent.parent.add(hitbox.debugMesh);
      }
      
      console.log(`Debug hitbox created for ${options.owner ? options.owner.constructor.name : 'unknown'}`);
    }
    
    this.hitboxes.push(hitbox);
    return hitbox;
  }
  
  /**
   * Check for collisions between hitboxes and entities
   */
  checkCollisions() {
    // For each active hitbox
    this.hitboxes.forEach(hitbox => {
      if (!hitbox.active) return;
      
      // Check against each entity
      this.entities.forEach(entity => {
        // Skip if hitbox belongs to this entity
        if (hitbox.owner === entity) return;
        
        // Skip if entity doesn't have a hurtbox or is not alive
        if (!entity.model || entity.currentState === "DEAD") return;
        
        // Create a temporary box for the entity's hurtbox
        // For now, we'll use a simple box around the entity model
        const entityBox = new THREE.Box3().setFromObject(entity.model);
        
        // Check for collision
        if (hitbox.collider.intersectsBox(entityBox)) {
          // Handle the hit!
          this.handleHit(hitbox, entity);
        }
      });
    });
  }
  
  /**
   * Handle a hit between a hitbox and an entity
   * @param {Object} hitbox - The hitbox that hit
   * @param {Object} entity - The entity that was hit
   */
  handleHit(hitbox, entity) {
    // Deactivate the hitbox after it hits
    hitbox.active = false;
    
    // Apply damage to the entity
    if (entity.takeDamage) {
      entity.takeDamage(hitbox.damage);
    }
    
    // We no longer apply knockback to ensure enemies don't get pushed back
    // The impact animation will still play through the takeDamage method
    
    // Create hit effect
    this.createHitEffect(entity.model.position.clone());
    
    // Emit hit event
    document.dispatchEvent(
      new CustomEvent('combat_hit', {
        detail: {
          attacker: hitbox.owner,
          target: entity,
          damage: hitbox.damage,
          position: entity.model.position.clone()
        }
      })
    );
  }
  
  /**
   * Create a visual hit effect at the specified position
   * @param {THREE.Vector3} position - Position for the hit effect
   */
  createHitEffect(position) {
    // This will be implemented later with particle effects
    console.log("Hit effect at", position);
  }
  
  /**
   * Update active combat effects
   * @param {number} deltaTime - Time since last frame
   */
  updateEffects(deltaTime) {
    // Filter out expired effects
    this.activeEffects = this.activeEffects.filter(effect => {
      effect.duration -= deltaTime;
      return effect.duration > 0;
    });
  }
  
  /**
   * Apply damage between two entities
   * @param {Object} attacker - The attacking entity
   * @param {Object} target - The target entity
   * @param {number} damage - Base damage amount
   * @param {string} attackType - Type of attack (light, heavy, special)
   */
  applyDamage(attacker, target, damage, attackType) {
    // Check if target can take damage
    if (!target || !target.takeDamage) return;
    
    // Calculate actual damage (will be more complex later)
    let actualDamage = damage;
    
    // Apply damage to target
    target.takeDamage(actualDamage);
    
    // Create hit effect
    this.createHitEffect(target.model.position.clone());
    
    // Emit damage event
    document.dispatchEvent(
      new CustomEvent('damage_dealt', {
        detail: {
          attacker: attacker,
          target: target,
          damage: actualDamage,
          attackType: attackType,
          position: target.model.position.clone()
        }
      })
    );
  }
  
  /**
   * Setup the combat event system
   */
  setupEventSystem() {
    // Define combat events
    this.COMBAT_EVENTS = {
      DAMAGE_DEALT: 'damage_dealt',
      DAMAGE_TAKEN: 'damage_taken',
      ENEMY_KILLED: 'enemy_killed',
      PLAYER_KILLED: 'player_killed',
      BLOCK_SUCCESS: 'block_success',
      COMBAT_HIT: 'combat_hit'
    };
    
    // Listen for damage dealt
    document.addEventListener(this.COMBAT_EVENTS.DAMAGE_DEALT, (e) => {
      console.log(`Damage dealt: ${e.detail.damage} from ${e.detail.attacker.constructor.name} to ${e.detail.target.constructor.name}`);
    });
  }
  
  /**
   * Set debug visualization mode on or off
   * @param {boolean} enabled - Whether debug mode should be enabled
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    
    if (enabled) {
      console.log("Combat debug mode enabled");
      
      // Add debug objects to scene if we have a scene reference
      if (this.scene) {
        this.scene.add(this.debugObjects);
      }
      
      // Create debug visualizations for all registered entities
      this.entities.forEach(entity => {
        if (entity.setDebugVisualization) {
          entity.setDebugVisualization(true);
        }
      });
      
      // Display hitbox helper message
      const hitboxInfo = document.createElement('div');
      hitboxInfo.id = 'hitbox-debug-info';
      hitboxInfo.style.cssText = `
        position: fixed;
        top: 50px;
        left: 10px;
        color: white;
        background-color: rgba(0, 0, 0, 0.7);
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        z-index: 1000;
      `;
      hitboxInfo.innerHTML = `
        <p>Debug Mode: ON</p>
        <p>Blue hitboxes: Player attacks</p>
        <p>Red hitboxes: Enemy attacks</p>
      `;
      document.body.appendChild(hitboxInfo);
    } else {
      console.log("Combat debug mode disabled");
      
      // Remove debug objects from scene
      if (this.scene && this.debugObjects.parent) {
        this.scene.remove(this.debugObjects);
      }
      
      // Remove entity debug visualizations
      this.entities.forEach(entity => {
        if (entity.setDebugVisualization) {
          entity.setDebugVisualization(false);
        }
      });
      
      // Clean up any existing hitbox debug meshes
      this.hitboxes.forEach(hitbox => {
        if (hitbox.debugMesh && hitbox.debugMesh.parent) {
          hitbox.debugMesh.parent.remove(hitbox.debugMesh);
        }
      });
      
      // Remove hitbox helper message
      const hitboxInfo = document.getElementById('hitbox-debug-info');
      if (hitboxInfo) {
        hitboxInfo.remove();
      }
    }
  }
  
  /**
   * Update debug visualizations
   */
  updateDebugVisuals() {
    // This will be implemented later
  }
}

export default CombatManager; 