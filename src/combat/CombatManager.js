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
      attackType: options.attackType || 'slash', // Store attack type for sound selection
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
      // Pass options to takeDamage to support different attack types with different sounds
      entity.takeDamage(hitbox.damage, {
        attackType: hitbox.attackType || 'slash', // Default to slash if no type specified
        knockback: hitbox.knockback,
        attacker: hitbox.owner
      });
    }
    
    // Create spark effect for non-kick attacks after a delay
    if (hitbox.attackType !== 'kick' && entity.model && hitbox.owner && hitbox.owner.model) {
      // Calculate impact position (halfway between attacker and hit entity)
      const attackerPos = hitbox.owner.model.position.clone();
      const entityPos = entity.model.position.clone();
      const impactPos = new THREE.Vector3().addVectors(attackerPos, entityPos).multiplyScalar(0.5);
      
      // Add a slight offset to bring the effect up to weapon/body height
      impactPos.y += 1.0;
      
      // Calculate direction from attacker to victim (for spark direction)
      const sparkDirection = new THREE.Vector3().subVectors(entityPos, attackerPos).normalize();
      
      // Wait 0.3 seconds before creating the spark effect
      setTimeout(() => {
        // Create spark effect at impact position
        this.createSparkEffect(impactPos, sparkDirection);
      }, 300); // 300ms delay
    }
    
    // Create hit effect
    this.createHitEffect(entity.model.position.clone());
    
    // Emit hit event
    document.dispatchEvent(
      new CustomEvent('combat_hit', {
        detail: {
          attacker: hitbox.owner,
          target: entity,
          damage: hitbox.damage,
          position: entity.model.position.clone(),
          attackType: hitbox.attackType
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
  
  /**
   * Create a spark particle effect at the impact point
   * @param {THREE.Vector3} position - Position for the spark effect
   * @param {THREE.Vector3} direction - Direction to bias sparks (normalized)
   */
  createSparkEffect(position, direction = null) {
    if (!this.scene) return;
    
    // Create particle geometry
    const particleCount = 320; // Doubled from 160 to 320
    const particles = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = [];
    
    // Create a coordinate system based on the impact direction
    let up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3();
    
    if (direction) {
      // Make sure we have a normalized direction
      direction.normalize();
      
      // Get perpendicular vectors to create a coordinate system
      right.crossVectors(up, direction).normalize();
      up.crossVectors(direction, right).normalize();
    }
    
    // Initialize particles at impact point
    for (let i = 0; i < particleCount; i++) {
      // Start all particles at impact point
      particles[i * 3] = position.x;
      particles[i * 3 + 1] = position.y;
      particles[i * 3 + 2] = position.z;
      
      // Compute a random direction biased to spray away from attacker
      let particleDir;
      
      if (direction) {
        // Create a wide arc of directions facing away from the attacker
        // Use a hemisphere distribution biased in the direction away from the attacker
        
        // Random angle in a hemisphere facing away from attacker (plus/minus 90 degrees)
        const angleSpread = Math.PI * 0.9; // 162 degrees spread
        const centralAngle = Math.random() * angleSpread - (angleSpread / 2); // -81 to +81 degrees
        
        // Random vertical angle (biased upward slightly)
        const verticalAngle = Math.random() * Math.PI * 0.7 - Math.PI * 0.1; // -18 to +108 degrees
        
        // Create direction vector in the coordinate system
        particleDir = new THREE.Vector3()
          .copy(direction) // Start with forward direction
          .applyAxisAngle(up, centralAngle) // Rotate around up vector
          .applyAxisAngle(right, verticalAngle); // Rotate around right vector
        
      } else {
        // Fallback to random direction if no direction provided
        const angle = Math.random() * Math.PI * 2;
        const verticalAngle = Math.random() * Math.PI;
        
        particleDir = new THREE.Vector3(
          Math.sin(angle) * Math.sin(verticalAngle),
          Math.cos(verticalAngle),
          Math.cos(angle) * Math.sin(verticalAngle)
        );
      }
      
      // Apply random speed
      const speed = 0.5 + Math.random() * 2.5;
      particleDir.multiplyScalar(speed);
      
      // Store velocity
      velocities.push({
        x: particleDir.x,
        y: particleDir.y,
        z: particleDir.z
      });
      
      // Set particle colors - yellow/orange/white for sparks
      const colorChoice = Math.random();
      if (colorChoice < 0.2) {
        // Bright center (reduced white/yellow)
        colors[i * 3] = 1.0;     // Red
        colors[i * 3 + 1] = 0.9;  // Green
        colors[i * 3 + 2] = 0.6;  // Blue
      } else if (colorChoice < 0.6) {
        // More orange (increased proportion)
        colors[i * 3] = 1.0;     // Red
        colors[i * 3 + 1] = 0.4;  // Green (reduced to make more orange)
        colors[i * 3 + 2] = 0.0;  // Blue
      } else {
        // Red edge (increased proportion)
        colors[i * 3] = 1.0;     // Red
        colors[i * 3 + 1] = 0.2;  // Green (reduced further)
        colors[i * 3 + 2] = 0.0;  // Blue
      }
      
      // Set particle sizes (much smaller - half the previous size)
      sizes[i] = 0.0025 + Math.random() * 0.005;
    }
    
    // Create particle geometry and material
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Create particle material with texture
    const material = new THREE.PointsMaterial({
      size: 0.125, // Reduced base size by half (from 0.25)
      transparent: true,
      opacity: 0.8,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: this.createSparkTexture(),
      alphaTest: 0.1
    });
    
    // Create particle system
    const particleSystem = new THREE.Points(geometry, material);
    particleSystem.name = 'spark-particles';
    this.scene.add(particleSystem);
    
    // Store velocities in userData
    particleSystem.userData = { velocities };
    
    // Create animation for particles
    let lifetime = 0;
    const maxLifetime = 1.0; // 1 second
    
    const animateParticles = () => {
      lifetime += 0.016; // Approximately 60fps
      
      if (lifetime >= maxLifetime) {
        // Clean up particles
        this.scene.remove(particleSystem);
        particleSystem.geometry.dispose();
        particleSystem.material.dispose();
        return;
      }
      
      const positions = particleSystem.geometry.attributes.position.array;
      const sizes = particleSystem.geometry.attributes.size.array;
      
      // Update particles
      for (let i = 0; i < particleCount; i++) {
        // Apply velocity
        positions[i * 3] += velocities[i].x;
        positions[i * 3 + 1] += velocities[i].y;
        positions[i * 3 + 2] += velocities[i].z;
        
        // Apply gravity
        velocities[i].y -= 0.05;
        
        // Fade out particles by reducing size
        sizes[i] *= 0.96;
      }
      
      // Gradually reduce opacity
      particleSystem.material.opacity = 1.0 - (lifetime / maxLifetime);
      
      // Update buffers
      particleSystem.geometry.attributes.position.needsUpdate = true;
      particleSystem.geometry.attributes.size.needsUpdate = true;
      
      // Continue animation
      requestAnimationFrame(animateParticles);
    };
    
    // Start animation
    animateParticles();
  }
  
  /**
   * Create a spark particle texture
   * @returns {THREE.Texture} The spark texture
   */
  createSparkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Create a radial gradient with more orange and red
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');     // White hot center
    gradient.addColorStop(0.1, 'rgba(255, 230, 150, 0.9)'); // Yellow-orange transition
    gradient.addColorStop(0.25, 'rgba(255, 150, 50, 0.8)'); // Deep orange
    gradient.addColorStop(0.5, 'rgba(255, 80, 10, 0.5)');   // Red-orange
    gradient.addColorStop(1, 'rgba(200, 40, 0, 0)');        // Deep red fade out
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
}

export default CombatManager; 