/**
 * PlayerUI component for displaying player health bar
 * Creates and manages the UI elements for player health display
 */
class PlayerUI {
  constructor() {
    // Create UI container
    this.container = document.createElement('div');
    this.container.className = 'player-ui-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      width: 15%;
      height: 35px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      transition: opacity 0.8s ease;
      z-index: 10;
    `;

    // Create a wrapper for the health bar and frame
    this.healthBarWrapper = document.createElement('div');
    this.healthBarWrapper.className = 'player-health-bar-wrapper';
    this.healthBarWrapper.style.cssText = `
      position: relative;
      width: 100%;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create the frame container
    this.frameContainer = document.createElement('div');
    this.frameContainer.className = 'player-health-frame';
    this.frameContainer.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      pointer-events: none;
    `;

    // Create left diamond ornament
    this.leftDiamond = document.createElement('div');
    this.leftDiamond.className = 'player-health-diamond left';
    this.leftDiamond.style.cssText = `
      position: absolute;
      left: -5.5px;
      width: 11px;
      height: 11px;
      background: linear-gradient(135deg, #8a7020 10%, #d8c070 40%, #b69642 60%, #cbb978 80%);
      transform: rotate(45deg);
      box-shadow: 0 0 6px #b69642, inset 0 0 2px rgba(0,0,0,0.8);
      z-index: 2;
      border: 0.5px solid #a08a3d;
      opacity: 0.95;
      animation: diamond-glow 3s infinite alternate;
      background-image:
        linear-gradient(135deg, #8a7020 10%, #d8c070 40%, #b69642 60%, #cbb978 80%),
        url("data:image/svg+xml,%3Csvg width='8' height='8' viewBox='0 0 8 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h4v4H0V0zm4 4h4v4H4V4z' fill='%23000000' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E");
    `;

    // Create right diamond ornament
    this.rightDiamond = document.createElement('div');
    this.rightDiamond.className = 'player-health-diamond right';
    this.rightDiamond.style.cssText = `
      position: absolute;
      right: -5.5px;
      width: 11px;
      height: 11px;
      background: linear-gradient(135deg, #8a7020 10%, #d8c070 40%, #b69642 60%, #cbb978 80%);
      transform: rotate(45deg);
      box-shadow: 0 0 6px #b69642, inset 0 0 2px rgba(0,0,0,0.8);
      z-index: 2;
      border: 0.5px solid #a08a3d;
      opacity: 0.95;
      animation: diamond-glow 3s infinite alternate;
      background-image:
        linear-gradient(135deg, #8a7020 10%, #d8c070 40%, #b69642 60%, #cbb978 80%),
        url("data:image/svg+xml,%3Csvg width='8' height='8' viewBox='0 0 8 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h4v4H0V0zm4 4h4v4H4V4z' fill='%23000000' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E");
    `;

    // Create the top frame
    this.topFrame = document.createElement('div');
    this.topFrame.className = 'player-health-frame-top';
    this.topFrame.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1.8px;
      background: linear-gradient(90deg, transparent 2%, #967c30 10%, #d8c070 35%, #e5d498 50%, #d8c070 65%, #967c30 90%, transparent 98%);
      z-index: 1;
      box-shadow: 0 0 2px #b69642;
      background-image:
        linear-gradient(90deg, transparent 2%, #967c30 10%, #d8c070 35%, #e5d498 50%, #d8c070 65%, #967c30 90%, transparent 98%),
        url("data:image/svg+xml,%3Csvg width='40' height='1' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h5v1H0zm10 0h5v1h-5zm10 0h5v1h-5zm10 0h5v1h-5zm10 0h5v1h-5z' fill='%23000000' fill-opacity='0.2'/%3E%3C/svg%3E");
      opacity: 0.9;
    `;

    // Create the bottom frame
    this.bottomFrame = document.createElement('div');
    this.bottomFrame.className = 'player-health-frame-bottom';
    this.bottomFrame.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1.8px;
      background: linear-gradient(90deg, transparent 2%, #967c30 10%, #d8c070 35%, #e5d498 50%, #d8c070 65%, #967c30 90%, transparent 98%);
      z-index: 1;
      box-shadow: 0 0 2px #b69642;
      background-image:
        linear-gradient(90deg, transparent 2%, #967c30 10%, #d8c070 35%, #e5d498 50%, #d8c070 65%, #967c30 90%, transparent 98%),
        url("data:image/svg+xml,%3Csvg width='40' height='1' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h5v1H0zm10 0h5v1h-5zm10 0h5v1h-5zm10 0h5v1h-5zm10 0h5v1h-5z' fill='%23000000' fill-opacity='0.2'/%3E%3C/svg%3E");
      opacity: 0.9;
    `;

    // Create decorative filigree designs
    this.topFiligree = document.createElement('div');
    this.topFiligree.className = 'player-health-filigree top';
    this.topFiligree.style.cssText = `
      position: absolute;
      top: -3px;
      left: calc(50% - 40px);
      width: 80px;
      height: 5px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='6' viewBox='0 0 100 6'%3E%3Cpath d='M0,3 C10,0 15,6 25,3 C35,0 40,6 50,3 C60,0 65,6 75,3 C85,0 90,6 100,3' stroke='%23d8c070' stroke-width='1' fill='none' /%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      opacity: 0.4;
      z-index: 3;
      filter: drop-shadow(0 0 1px #b69642);
    `;

    this.bottomFiligree = document.createElement('div');
    this.bottomFiligree.className = 'player-health-filigree bottom';
    this.bottomFiligree.style.cssText = `
      position: absolute;
      bottom: -3px;
      left: calc(50% - 40px);
      width: 80px;
      height: 5px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='6' viewBox='0 0 100 6'%3E%3Cpath d='M0,3 C10,6 15,0 25,3 C35,6 40,0 50,3 C60,6 65,0 75,3 C85,6 90,0 100,3' stroke='%23d8c070' stroke-width='1' fill='none' /%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      opacity: 0.4;
      z-index: 3;
      filter: drop-shadow(0 0 1px #b69642);
    `;

    // Create the left frame
    this.leftFrame = document.createElement('div');
    this.leftFrame.className = 'player-health-frame-left';
    this.leftFrame.style.cssText = `
      position: absolute;
      top: 1.8px;
      left: 0;
      width: 1.8px;
      height: calc(100% - 3.6px);
      background: linear-gradient(to bottom, #967c30 10%, #d8c070 40%, #e5d498 50%, #d8c070 60%, #967c30 90%);
      z-index: 1;
      box-shadow: 0 0 2px #b69642;
      background-image:
        linear-gradient(to bottom, #967c30 10%, #d8c070 40%, #e5d498 50%, #d8c070 60%, #967c30 90%),
        url("data:image/svg+xml,%3Csvg width='2' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h2v2H0zm0 5h2v2H0zm0 5h2v2H0zm0 5h2v2H0zm0 5h2v2H0z' fill='%23000000' fill-opacity='0.2'/%3E%3C/svg%3E");
      opacity: 0.9;
    `;

    // Create the right frame
    this.rightFrame = document.createElement('div');
    this.rightFrame.className = 'player-health-frame-right';
    this.rightFrame.style.cssText = `
      position: absolute;
      top: 1.8px;
      right: 0;
      width: 1.8px;
      height: calc(100% - 3.6px);
      background: linear-gradient(to bottom, #967c30 10%, #d8c070 40%, #e5d498 50%, #d8c070 60%, #967c30 90%);
      z-index: 1;
      box-shadow: 0 0 2px #b69642;
      background-image:
        linear-gradient(to bottom, #967c30 10%, #d8c070 40%, #e5d498 50%, #d8c070 60%, #967c30 90%),
        url("data:image/svg+xml,%3Csvg width='2' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h2v2H0zm0 5h2v2H0zm0 5h2v2H0zm0 5h2v2H0zm0 5h2v2H0z' fill='%23000000' fill-opacity='0.2'/%3E%3C/svg%3E");
      opacity: 0.9;
    `;

    // Add corner decorations for the frame
    this.topLeftCorner = document.createElement('div');
    this.topLeftCorner.className = 'player-health-corner top-left';
    this.topLeftCorner.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 3.6px;
      height: 3.6px;
      background: #d8c070;
      z-index: 3;
      box-shadow: 0 0 3px #b69642;
      border-radius: 0 0 100% 0;
      opacity: 0.9;
    `;

    this.topRightCorner = document.createElement('div');
    this.topRightCorner.className = 'player-health-corner top-right';
    this.topRightCorner.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 3.6px;
      height: 3.6px;
      background: #d8c070;
      z-index: 3;
      box-shadow: 0 0 3px #b69642;
      border-radius: 0 0 0 100%;
      opacity: 0.9;
    `;

    this.bottomLeftCorner = document.createElement('div');
    this.bottomLeftCorner.className = 'player-health-corner bottom-left';
    this.bottomLeftCorner.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      width: 3.6px;
      height: 3.6px;
      background: #d8c070;
      z-index: 3;
      box-shadow: 0 0 3px #b69642;
      border-radius: 0 100% 0 0;
      opacity: 0.9;
    `;

    this.bottomRightCorner = document.createElement('div');
    this.bottomRightCorner.className = 'player-health-corner bottom-right';
    this.bottomRightCorner.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 3.6px;
      height: 3.6px;
      background: #d8c070;
      z-index: 3;
      box-shadow: 0 0 3px #b69642;
      border-radius: 100% 0 0 0;
      opacity: 0.9;
    `;

    // Create health bar container with a subtle pattern
    this.healthBarContainer = document.createElement('div');
    this.healthBarContainer.className = 'player-health-bar-container';
    this.healthBarContainer.style.cssText = `
      width: calc(100% - 4px);
      height: 14px;
      background-color: #0f1b36;
      border-radius: 0;
      overflow: hidden;
      position: relative;
      border: none;
      box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.7);
      background-image: 
        url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v20h2v2H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20z' fill='%23131f38' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E");
    `;

    // Create health bar with a green gradient (different from the boss red)
    this.healthBar = document.createElement('div');
    this.healthBar.className = 'player-health-bar';
    this.healthBar.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(to right, #004d00, #006500);
      transition: width 0.4s ease;
    `;

    // Create damage overlay (for delayed health reduction effect)
    this.damageOverlay = document.createElement('div');
    this.damageOverlay.className = 'player-health-damage-overlay';
    this.damageOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 100%;
      background-color: #f7d06a;
      opacity: 0.8;
      transition: width 0.3s ease;
    `;

    // Add elements to DOM
    this.healthBarContainer.appendChild(this.healthBar);
    this.healthBarContainer.appendChild(this.damageOverlay);

    this.frameContainer.appendChild(this.topFrame);
    this.frameContainer.appendChild(this.bottomFrame);
    this.frameContainer.appendChild(this.leftFrame);
    this.frameContainer.appendChild(this.rightFrame);
    this.frameContainer.appendChild(this.leftDiamond);
    this.frameContainer.appendChild(this.rightDiamond);
    this.frameContainer.appendChild(this.topFiligree);
    this.frameContainer.appendChild(this.bottomFiligree);
    this.frameContainer.appendChild(this.topLeftCorner);
    this.frameContainer.appendChild(this.topRightCorner);
    this.frameContainer.appendChild(this.bottomLeftCorner);
    this.frameContainer.appendChild(this.bottomRightCorner);

    this.healthBarWrapper.appendChild(this.healthBarContainer);
    this.healthBarWrapper.appendChild(this.frameContainer);

    this.container.appendChild(this.healthBarWrapper);

    // Add healing spell indicator
    this.createHealingSpellIndicator();

    // Add container to document body
    document.body.appendChild(this.container);

    // Set up event listeners
    this.setupEventListeners();

    // Player data
    this.playerData = {
      health: 100,
      maxHealth: 100,
      healingSpellsRemaining: 2,
    };

    // Set initial health
    this.updateHealthBar(this.playerData.health, this.playerData.maxHealth);

    // Make sure the diamond-glow animation exists
    if (!document.querySelector('style[data-animation="diamond-glow"]')) {
      const styleElement = document.createElement('style');
      styleElement.setAttribute('data-animation', 'diamond-glow');
      styleElement.innerHTML = `
        @keyframes diamond-glow {
          0% { box-shadow: 0 0 4px 1px #b69642; }
          50% { box-shadow: 0 0 7px 2px #d8c070; }
          100% { box-shadow: 0 0 5px 1px #b69642; }
        }
      `;
      document.head.appendChild(styleElement);
    }

    // Add healing pulse animation
    if (!document.querySelector('style[data-animation="healing-pulse"]')) {
      const pulseStyle = document.createElement('style');
      pulseStyle.setAttribute('data-animation', 'healing-pulse');
      pulseStyle.innerHTML = `
        @keyframes healingPulse {
          0% { transform: scale(1); box-shadow: 0 0 5px rgba(0, 0, 0, 0.5), inset 0 0 8px rgba(0, 25, 0, 0.5); }
          50% { transform: scale(1.1); box-shadow: 0 0 8px rgba(0, 100, 0, 0.6), inset 0 0 10px rgba(0, 100, 0, 0.6); }
          100% { transform: scale(1); box-shadow: 0 0 5px rgba(0, 0, 0, 0.5), inset 0 0 8px rgba(0, 25, 0, 0.5); }
        }
      `;
      document.head.appendChild(pulseStyle);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for player health change events
    document.addEventListener(
      'player_health_changed',
      this.handleHealthChanged.bind(this)
    );

    // Listen for healing spell change events
    document.addEventListener('healing_spells_changed', (e) => {
      this.handleHealingSpellsChanged(e);
    });
  }

  /**
   * Handle health changed event
   * @param {CustomEvent} event - The health changed event
   */
  handleHealthChanged(event) {
    const { health, maxHealth } = event.detail;

    this.playerData.health = health;
    this.playerData.maxHealth = maxHealth || this.playerData.maxHealth;
    this.updateHealthBar(health, this.playerData.maxHealth);
  }

  /**
   * Handle healing spells changed event
   * @param {CustomEvent} e - The healing spells changed event
   */
  handleHealingSpellsChanged(e) {
    const remaining = e.detail.remaining;
    this.playerData.healingSpellsRemaining = remaining;
    this.updateHealingSpellIndicator(remaining);
  }

  /**
   * Update health bar display
   * @param {number} health - Current health
   * @param {number} maxHealth - Maximum health
   */
  updateHealthBar(health, maxHealth) {
    const oldHealthPercentage = this.playerData.previousHealth
      ? Math.max(
          0,
          Math.min(100, (this.playerData.previousHealth / maxHealth) * 100)
        )
      : Math.max(0, Math.min(100, (health / maxHealth) * 100));

    // If player is dead, force health to zero
    if (health <= 0) {
      health = 0;

      // Change health bar color to indicate death
      this.healthBar.style.background =
        'linear-gradient(to right, #2a2a2a, #444444)';
      this.healthBar.style.width = '0%';

      // Add subtle pulsing red glow to the health container to indicate death
      this.healthBarContainer.style.boxShadow =
        'inset 0 0 15px rgba(80, 0, 0, 0.7)';

      // Store current health for future comparison
      this.playerData.previousHealth = health;
      return; // Exit early - no animations needed for death state
    } else {
      // Reset to normal color if not dead
      this.healthBar.style.background =
        'linear-gradient(to right, #004d00, #006500)';
      this.healthBarContainer.style.boxShadow =
        'inset 0 0 15px rgba(0, 0, 0, 0.7)';
    }

    const healthPercentage = Math.max(
      0,
      Math.min(100, (health / maxHealth) * 100)
    );

    // Store current health for future comparison
    this.playerData.previousHealth = health;

    // Determine if damage was taken
    const damageTaken = oldHealthPercentage > healthPercentage;

    if (damageTaken) {
      // Calculate the size of damage preview (yellow bar)
      const damageWidth = oldHealthPercentage - healthPercentage;

      // Set damage overlay (yellow) to show the amount of damage taken
      this.damageOverlay.style.backgroundColor = '#f7d06a'; // Pale yellow
      this.damageOverlay.style.opacity = '0.8';
      this.damageOverlay.style.width = `${damageWidth}%`;
      this.damageOverlay.style.left = `${healthPercentage}%`;

      // Update health bar immediately
      this.healthBar.style.width = `${healthPercentage}%`;

      // Animate the damage overlay to shrink horizontally
      setTimeout(() => {
        this.damageOverlay.style.width = `${damageWidth * 0.75}%`;
        setTimeout(() => {
          this.damageOverlay.style.width = `${damageWidth * 0.5}%`;
          setTimeout(() => {
            this.damageOverlay.style.width = `${damageWidth * 0.25}%`;
            setTimeout(() => {
              this.damageOverlay.style.width = '0%';
            }, 30);
          }, 30);
        }, 30);
      }, 1000);
    } else {
      // For healing, just update the health bar
      this.healthBar.style.width = `${healthPercentage}%`;
      this.damageOverlay.style.width = '0';
    }
  }

  /**
   * Set health directly
   * @param {number} health - Current health
   * @param {number} maxHealth - Maximum health (optional)
   */
  setHealth(health, maxHealth) {
    if (maxHealth) {
      this.playerData.maxHealth = maxHealth;
    }
    this.playerData.health = health;
    this.updateHealthBar(health, this.playerData.maxHealth);
  }

  /**
   * Show the player UI
   */
  show() {
    this.container.style.opacity = '1';
  }

  /**
   * Hide the player UI
   */
  hide() {
    this.container.style.opacity = '0';
  }

  /**
   * Update the UI (called every frame)
   */
  update() {
    // Any update logic if needed
  }

  /**
   * Create a healing spell indicator that shows the number of healing spells remaining
   */
  createHealingSpellIndicator() {
    // Create container for healing spell indicator
    this.healingSpellContainer = document.createElement('div');
    this.healingSpellContainer.className = 'healing-spell-container';
    this.healingSpellContainer.style.cssText = `
      margin-top: 8px;
      display: flex;
      align-items: center;
    `;

    // Create the healing spell icon
    this.healingSpellIcon = document.createElement('div');
    this.healingSpellIcon.className = 'healing-spell-icon';
    this.healingSpellIcon.style.cssText = `
      width: 24px;
      height: 24px;
      background-color: rgba(0, 0, 0, 0.6);
      border: 1px solid #d8c070;
      border-radius: 6px;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      box-shadow: 0 0 5px rgba(0, 0, 0, 0.5), inset 0 0 8px rgba(0, 25, 0, 0.5);
    `;

    // Create the healing cross symbol
    this.healingCross = document.createElement('div');
    this.healingCross.className = 'healing-cross';
    this.healingCross.style.cssText = `
      position: absolute;
      width: 14px;
      height: 14px;
      background-color: transparent;
    `;

    // Create vertical line of cross
    this.crossVertical = document.createElement('div');
    this.crossVertical.style.cssText = `
      position: absolute;
      top: 0;
      left: 6px;
      width: 2px;
      height: 14px;
      background-color: #3fcc3f;
      box-shadow: 0 0 3px #3fcc3f;
    `;

    // Create horizontal line of cross
    this.crossHorizontal = document.createElement('div');
    this.crossHorizontal.style.cssText = `
      position: absolute;
      top: 6px;
      left: 0;
      width: 14px;
      height: 2px;
      background-color: #3fcc3f;
      box-shadow: 0 0 3px #3fcc3f;
    `;

    // Create counter for remaining healing spells
    this.healingSpellCounter = document.createElement('div');
    this.healingSpellCounter.className = 'healing-spell-counter';
    this.healingSpellCounter.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 2px;
      color: #d8c070;
      font-family: 'CormorantGaramond', serif;
      font-size: 11px;
      text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.9);
      font-weight: 600;
    `;
    this.healingSpellCounter.textContent = '2';

    // Add cross parts to cross element
    this.healingCross.appendChild(this.crossVertical);
    this.healingCross.appendChild(this.crossHorizontal);

    // Add healing cross to healing spell icon
    this.healingSpellIcon.appendChild(this.healingCross);
    this.healingSpellIcon.appendChild(this.healingSpellCounter);

    // Add elements to healing spell container
    this.healingSpellContainer.appendChild(this.healingSpellIcon);

    // Add healing spell container to main UI container
    this.container.appendChild(this.healingSpellContainer);
  }

  /**
   * Update healing spell indicator based on remaining healing spells
   * @param {number} remainingSpells - Number of healing spells remaining
   */
  updateHealingSpellIndicator(remainingSpells) {
    // Update counter text
    this.healingSpellCounter.textContent = remainingSpells;

    // Update appearance based on availability
    if (remainingSpells <= 0) {
      this.healingSpellIcon.style.opacity = '0.5';
      this.healingCross.style.opacity = '0.5';
      this.healingSpellCounter.style.color = '#836c2f';
    } else {
      this.healingSpellIcon.style.opacity = '1';
      this.healingCross.style.opacity = '1';
      this.healingSpellCounter.style.color = '#d8c070';

      // Add a pulse effect when spell is used
      this.healingSpellIcon.style.animation = 'none';
      setTimeout(() => {
        this.healingSpellIcon.style.animation = 'healingPulse 0.6s';
      }, 10);
    }
  }
}

export default PlayerUI;
