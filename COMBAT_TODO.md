# Combat System Implementation Checklist

## Enemy Setup
- [ ] Position the golden-knight at initial coordinates (150, 0, 0)
- [ ] Implement detection radius (50 units) around the golden-knight
- [ ] Create hostility state for the golden-knight (passive/aggressive)
- [ ] Implement state transition when player enters detection radius
- [ ] Create an enemy data object with properties:
  ```javascript
  {
    health: 100,
    maxHealth: 100,
    name: "The Golden Knight",
    isHostile: false,
    detectionRadius: 50,
    attackRadius: 3,
    damageValues: {
      lightAttack: 10,
      heavyAttack: 25,
      specialAttack: 40
    }
  }
  ```

## Enemy AI & State Machine
- [ ] Create an EnemyStateMachine class with states:
  - [ ] IDLE: Default state when not hostile
  - [ ] AWARE: Player detected but not yet engaged
  - [ ] CHASE: Moving towards player
  - [ ] ATTACK: Performing an attack
  - [ ] STAGGERED: Recovering from being hit
  - [ ] DEAD: Defeated state
- [ ] Implement basic movement towards player when hostile
  - [ ] Add navigation logic to handle terrain (all terrain is flat)
  - [ ] Implement proper rotation to face player
- [ ] Create attack patterns with different ranges:
  - [ ] Close-range combo attacks (3-hit sequence)
  - [ ] Medium-range lunging attack
  - [ ] AOE ground slam attack 
- [ ] Add cooldown between attacks (1-3 seconds)
- [ ] Implement attack range detection with different zones:
  - [ ] Far: Chase player
  - [ ] Medium: Approach cautiously, prepare attacks
  - [ ] Close: Execute attack combos
- [ ] Create animation controller for the golden-knight with transitions between:
  - [ ] Idle animation
  - [ ] Awareness animation (noticing player)
  - [ ] Walking/Running towards player
  - [ ] Attack windup animations with telegraphing
  - [ ] Various attack animations
  - [ ] Hit reaction animations
  - [ ] Stagger/recovery animations
  - [ ] Death animation sequence

## UI Elements (Elden Ring Style)
- [ ] Create enemy health bar container at bottom center with:
  - [ ] Boss name text element ("Godrick the Grafted")
  - [ ] Health bar with gradient fill
  - [ ] Decorative frame elements
- [ ] Implement fade-in animation when enemy becomes hostile:
  ```javascript
  // Example animation sequence
  function showBossHealthBar() {
    const healthBar = document.querySelector('.boss-health-bar');
    healthBar.style.opacity = 0;
    healthBar.style.transform = 'translateY(20px)';
    healthBar.style.display = 'block';
    
    // Animate in
    setTimeout(() => {
      healthBar.style.transition = 'opacity 0.8s ease, transform 0.5s ease';
      healthBar.style.opacity = 1;
      healthBar.style.transform = 'translateY(0)';
    }, 50);
  }
  ```
- [ ] Add player HUD elements:
  - [ ] Health bar (top left)
  - [ ] Stamina/FP bars (below health)
  - [ ] Stagger/posture bar (center, appears when blocking)
- [ ] Implement health bar damage visualization:
  - [ ] Delayed health bar reduction effect
  - [ ] Red "damage taken" portion that depletes gradually
- [ ] Add hit indicators and damage numbers (optional)

## Combat Mechanics
- [ ] Create a hitbox system using THREE.js collision detection:
  ```javascript
  // Example hitbox approach
  class Hitbox {
    constructor(parent, offsetPosition, size, damageValue, knockback) {
      this.collider = new THREE.Box3();
      this.parent = parent;
      this.offset = offsetPosition;
      this.size = size;
      this.damage = damageValue;
      this.knockback = knockback;
      this.active = false;
    }
    
    update() {
      if (!this.active) return;
      
      // Update position based on parent
      const worldPos = this.parent.localToWorld(this.offset.clone());
      this.collider.setFromCenterAndSize(worldPos, this.size);
    }
    
    checkCollision(targetHurtbox) {
      return this.collider.intersectsBox(targetHurtbox);
    }
  }
  ```
- [ ] Implement player health system (100 base health)
- [ ] Create enemy health system with visible damage effects
- [ ] Add player stagger/guard bar mechanic:
  - [ ] Increases when blocking attacks
  - [ ] Depletes over time when not blocking
  - [ ] Player is staggered when bar fills completely
- [ ] Develop blocking system:
  - [ ] Reduces damage by 80%
  - [ ] Increases stagger bar based on attack strength
  - [ ] Different block animations based on attack direction
- [ ] Implement damage calculation system:
  ```javascript
  function calculateDamage(attack, defense, isBlocking) {
    let damage = attack * (1 - (defense / 100));
    if (isBlocking) {
      damage *= 0.2; // 80% damage reduction
      increaseStaggerBar(damage * 0.5);
    }
    return Math.max(1, Math.floor(damage));
  }
  ```
- [ ] Add invincibility frames (i-frames) after getting hit:
  - [ ] Player becomes temporarily invulnerable (0.8s)
  - [ ] Visual flash effect for invulnerability period
- [ ] Implement hit reactions with variable stagger times based on:
  - [ ] Attack strength
  - [ ] Player poise/stability
  - [ ] Directional knockback

## Player Combat Abilities
- [ ] Implement light attack:
  - [ ] Fast execution (0.5s)
  - [ ] Low stamina cost
  - [ ] Can combo into other attacks
- [ ] Implement heavy attack:
  - [ ] Slower execution (1.2s)
  - [ ] Higher damage and stagger
  - [ ] Higher stamina cost
- [ ] Add blocking mechanic:
  - [ ] Direction-aware blocking
  - [ ] Stamina drain while blocking
  - [ ] Perfect block timing for parry opportunities
- [ ] Create dodge/roll mechanic:
  - [ ] Directional dodging
  - [ ] I-frames during dodge animation
  - [ ] Stamina cost and cooldown
- [ ] Implement attack combos:
  - [ ] Light → Light → Heavy
  - [ ] Heavy → Light → Light
  - [ ] Special weapon skill combo
- [ ] Create stamina system:
  - [ ] Actions consume stamina
  - [ ] Stamina regenerates when not attacking/dodging
  - [ ] Low stamina affects move availability

## Audio and VFX
- [ ] Add sound effects for attacks:
  - [ ] Weapon swing whooshes
  - [ ] Impact sounds based on surface (metal, flesh)
  - [ ] Voice effects for enemy and player
- [ ] Implement spatial audio for attack sounds
- [ ] Create visual effects for weapon trails:
  - [ ] Trail renderer for weapon swings
  - [ ] Color/intensity variation based on attack type
- [ ] Add impact effects when hitting enemy:
  - [ ] Blood particle effects
  - [ ] Spark effects for blocked attacks
  - [ ] Camera shake for heavy hits
- [ ] Implement block/parry effects:
  - [ ] Spark particles
  - [ ] Flash effect
  - [ ] Sound effect
- [ ] Add ambient combat music when enemy becomes hostile:
  - [ ] Transitional music system
  - [ ] Intensity changes based on health percentage

## Death and Victory
- [ ] Implement player death sequence:
  - [ ] Slow-motion effect
  - [ ] Ragdoll physics
  - [ ] "YOU DIED" screen
  - [ ] Respawn mechanic
- [ ] Create enemy death animation and rewards:
  - [ ] Final blow dramatic effect
  - [ ] Death animation sequence
  - [ ] Soul/rune acquisition visual
  - [ ] Victory message
- [ ] Add proper UI messages for:
  - [ ] Player death
  - [ ] Enemy defeated
  - [ ] Items acquired

## Integration Steps (Implementation Order)
1. [ ] Set up basic enemy positioning and detection radius
2. [ ] Implement enemy state machine with chase behavior
3. [ ] Create UI health bar elements
4. [ ] Implement player and enemy health systems
5. [ ] Add basic attack hitbox detection
6. [ ] Implement player attack animations
7. [ ] Create enemy attack patterns
8. [ ] Add blocking and stamina systems
9. [ ] Implement dodge mechanics
10. [ ] Add audio and visual effects
11. [ ] Polish death sequences and victory conditions

## Polish and Refinement
- [ ] Balance damage values and health pools:
  - [ ] Player health: 100-150 range
  - [ ] Enemy health: 300-500 range for boss-type enemy
  - [ ] Light attack: 5-10% of enemy health
  - [ ] Heavy attack: 10-15% of enemy health
- [ ] Tune enemy aggression and attack patterns:
  - [ ] Add attack variation based on distance
  - [ ] Implement more aggressive behavior at low health (<30%)
  - [ ] Create attack chains with variable timing to avoid predictability
- [ ] Add weight to combat animations:
  - [ ] Camera shake on heavy hits (scale based on damage)
  - [ ] Screen distortion effects for special attacks
  - [ ] Controller vibration (if applicable)
- [ ] Implement hit stop/freeze frames for impactful attacks:
  ```javascript
  function applyHitStop(duration) {
    // Pause animations briefly
    scene.animations.forEach(anim => anim.timeScale = 0.05);
    
    // Resume after duration
    setTimeout(() => {
      scene.animations.forEach(anim => anim.timeScale = 1.0);
    }, duration);
  }
  ```
- [ ] Create readable telegraphing for enemy attacks:
  - [ ] Glowing weapon effects before attacks
  - [ ] Brief pause/windup before major attacks
  - [ ] Audio cues for different attack types
- [ ] Add weight to movement and attacks:
  - [ ] Animation blending for smooth transitions
  - [ ] Inertia in movement (acceleration/deceleration)
  - [ ] Footstep effects and sounds

## Testing and Debugging
- [ ] Create debug mode toggleable with keyboard shortcut:
  ```javascript
  let debugMode = false;
  
  window.addEventListener('keydown', (e) => {
    if (e.key === '`') { // Backtick key
      debugMode = !debugMode;
      document.querySelector('.debug-panel').style.display = debugMode ? 'block' : 'none';
    }
  });
  ```
- [ ] Add hitbox visualization in debug mode:
  - [ ] Red boxes for attack hitboxes
  - [ ] Blue boxes for hurtboxes
  - [ ] Green for detection radius
- [ ] Implement enemy AI debugging tools:
  - [ ] State machine visualization
  - [ ] Attack pattern display
  - [ ] Detection radius visualization
  - [ ] Path finding visualization
- [ ] Create combat stats display:
  - [ ] DPS counter
  - [ ] Hit registration log
  - [ ] I-frame visualization
- [ ] Add combat scenario testing:
  - [ ] Test commands to force enemy attack patterns
  - [ ] Health modification controls
  - [ ] Toggle invincibility for testing

## Technical Implementation
- [ ] Create CombatManager class to handle interactions:
  ```javascript
  class CombatManager {
    constructor() {
      this.entities = [];
      this.hitboxes = [];
      this.activeEffects = [];
    }
    
    registerEntity(entity) {
      this.entities.push(entity);
    }
    
    update(deltaTime) {
      // Update all hitboxes
      this.hitboxes.forEach(hitbox => hitbox.update());
      
      // Check for collisions
      this.checkCollisions();
      
      // Update combat effects
      this.updateEffects(deltaTime);
    }
    
    checkCollisions() {
      // Collision detection logic
    }
    
    applyDamage(attacker, target, damage, attackType) {
      // Damage application logic
      
      // Trigger appropriate effects and animations
      target.takeDamage(damage, attackType);
      
      // Create hit effects
      this.createHitEffect(target.position, attackType);
    }
  }
  ```
- [ ] Implement collision layers for combat interactions:
  - [ ] Player attack layer
  - [ ] Enemy attack layer
  - [ ] Player hurtbox layer
  - [ ] Enemy hurtbox layer
  - [ ] Environment collision layer
- [ ] Create event system for combat:
  ```javascript
  const COMBAT_EVENTS = {
    DAMAGE_DEALT: 'damage_dealt',
    DAMAGE_TAKEN: 'damage_taken',
    ENEMY_KILLED: 'enemy_killed',
    PLAYER_KILLED: 'player_killed',
    BLOCK_SUCCESS: 'block_success'
  };
  
  // Example event emitter
  function emitCombatEvent(eventType, data) {
    document.dispatchEvent(new CustomEvent(eventType, { detail: data }));
  }
  
  // Example listener
  document.addEventListener(COMBAT_EVENTS.DAMAGE_DEALT, (e) => {
    console.log(`Damage dealt: ${e.detail.amount}`);
    createDamageNumber(e.detail.position, e.detail.amount);
  });
  ```
- [ ] Implement attack chain system:
  - [ ] Track combo state
  - [ ] Time windows for combo continuation
  - [ ] Different finishers based on combo route
- [ ] Create animation state machine:
  - [ ] Priority system for animations
  - [ ] Interrupt system for high-priority actions
  - [ ] Transition rules between states

## Resources and References
- Elden Ring Combat Reference:
  - Attack telegraphing patterns
  - Health bar UI design
  - Hit effects and animations
  - Boss fight pacing

- Recommended Learning Resources:
  - THREE.js Collision Detection: https://threejs.org/docs/#api/en/math/Box3
  - State Machine Implementation: https://statecharts.dev/
  - Game Combat Design: "Game Feel" by Steve Swink
  - Animation Blending: https://threejs.org/examples/#webgl_animation_skinning_blending

- Asset Needs:
  - Combat sound effects
  - Hit particle effects
  - UI elements for health bars
  - Animation sets for attacks and reactions

- Performance Considerations:
  - Limit active hitboxes
  - Optimize collision checks with spatial partitioning
  - Use LOD for effects when many enemies are present
  - Throttle physics calculations for distant enemies 