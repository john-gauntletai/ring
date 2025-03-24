/**
 * BossUI component for displaying enemy health bar
 * Creates and manages the UI elements for boss health display
 */
class BossUI {
  constructor() {
    // Create UI container
    this.container = document.createElement('div');
    this.container.className = 'boss-ui-container';
    this.container.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 35px;
      display: none;
      flex-direction: column;
      align-items: center;
      transition: opacity 0.8s ease, transform 0.5s ease;
      z-index: 1000;
    `;

    // Create boss name element
    this.nameElement = document.createElement('div');
    this.nameElement.className = 'boss-name';
    this.nameElement.style.cssText = `
      color: #ffffff;
      font-family: 'CormorantGaramond', serif;
      font-size: 20px;
      margin-bottom: 5px;
      text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
      font-weight: 600;
      align-self: flex-start;
      margin-left: 10px;
    `;

    // Create a wrapper for the health bar and frame
    this.healthBarWrapper = document.createElement('div');
    this.healthBarWrapper.className = 'boss-health-bar-wrapper';
    this.healthBarWrapper.style.cssText = `
      position: relative;
      width: 100%;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create the frame container
    this.frameContainer = document.createElement('div');
    this.frameContainer.className = 'boss-health-frame';
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
    this.leftDiamond.className = 'boss-health-diamond left';
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
    this.rightDiamond.className = 'boss-health-diamond right';
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
    this.topFrame.className = 'boss-health-frame-top';
    this.topFrame.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1.8px;
      background: linear-gradient(90deg, transparent 2%, #967c30 10%, #d8c070 35%, #e5d498 50%, #d8c070 65%, #967c30 90%, transparent 98%);
      z-index: 1;
      box-shadow: 0 0 4px #b69642;
      background-image:
        linear-gradient(90deg, transparent 2%, #967c30 10%, #d8c070 35%, #e5d498 50%, #d8c070 65%, #967c30 90%, transparent 98%),
        url("data:image/svg+xml,%3Csvg width='40' height='1' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h5v1H0zm10 0h5v1h-5zm10 0h5v1h-5zm10 0h5v1h-5zm10 0h5v1h-5z' fill='%23000000' fill-opacity='0.2'/%3E%3C/svg%3E");
      opacity: 0.9;
    `;

    // Create the bottom frame
    this.bottomFrame = document.createElement('div');
    this.bottomFrame.className = 'boss-health-frame-bottom';
    this.bottomFrame.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1.8px;
      background: linear-gradient(90deg, transparent 2%, #967c30 10%, #d8c070 35%, #e5d498 50%, #d8c070 65%, #967c30 90%, transparent 98%);
      z-index: 1;
      box-shadow: 0 0 4px #b69642;
      background-image:
        linear-gradient(90deg, transparent 2%, #967c30 10%, #d8c070 35%, #e5d498 50%, #d8c070 65%, #967c30 90%, transparent 98%),
        url("data:image/svg+xml,%3Csvg width='40' height='1' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h5v1H0zm10 0h5v1h-5zm10 0h5v1h-5zm10 0h5v1h-5zm10 0h5v1h-5z' fill='%23000000' fill-opacity='0.2'/%3E%3C/svg%3E");
      opacity: 0.9;
    `;

    // Create decorative filigree designs
    this.topFiligree = document.createElement('div');
    this.topFiligree.className = 'boss-health-filigree top';
    this.topFiligree.style.cssText = `
      position: absolute;
      top: -3px;
      left: calc(50% - 50px);
      width: 100px;
      height: 6px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='6' viewBox='0 0 100 6'%3E%3Cpath d='M0,3 C10,0 15,6 25,3 C35,0 40,6 50,3 C60,0 65,6 75,3 C85,0 90,6 100,3' stroke='%23d8c070' stroke-width='1' fill='none' /%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      opacity: 0.7;
      z-index: 3;
      filter: drop-shadow(0 0 2px #b69642);
    `;

    this.bottomFiligree = document.createElement('div');
    this.bottomFiligree.className = 'boss-health-filigree bottom';
    this.bottomFiligree.style.cssText = `
      position: absolute;
      bottom: -3px;
      left: calc(50% - 50px);
      width: 100px;
      height: 6px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='6' viewBox='0 0 100 6'%3E%3Cpath d='M0,3 C10,6 15,0 25,3 C35,6 40,0 50,3 C60,6 65,0 75,3 C85,6 90,0 100,3' stroke='%23d8c070' stroke-width='1' fill='none' /%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      opacity: 0.7;
      z-index: 3;
      filter: drop-shadow(0 0 2px #b69642);
    `;

    // Create the left frame
    this.leftFrame = document.createElement('div');
    this.leftFrame.className = 'boss-health-frame-left';
    this.leftFrame.style.cssText = `
      position: absolute;
      top: 1.8px;
      left: 0;
      width: 1.8px;
      height: calc(100% - 3.6px);
      background: linear-gradient(to bottom, #967c30 10%, #d8c070 40%, #e5d498 50%, #d8c070 60%, #967c30 90%);
      z-index: 1;
      box-shadow: 0 0 4px #b69642;
      background-image:
        linear-gradient(to bottom, #967c30 10%, #d8c070 40%, #e5d498 50%, #d8c070 60%, #967c30 90%),
        url("data:image/svg+xml,%3Csvg width='2' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h2v2H0zm0 5h2v2H0zm0 5h2v2H0zm0 5h2v2H0zm0 5h2v2H0z' fill='%23000000' fill-opacity='0.2'/%3E%3C/svg%3E");
      opacity: 0.9;
    `;

    // Create the right frame
    this.rightFrame = document.createElement('div');
    this.rightFrame.className = 'boss-health-frame-right';
    this.rightFrame.style.cssText = `
      position: absolute;
      top: 1.8px;
      right: 0;
      width: 1.8px;
      height: calc(100% - 3.6px);
      background: linear-gradient(to bottom, #967c30 10%, #d8c070 40%, #e5d498 50%, #d8c070 60%, #967c30 90%);
      z-index: 1;
      box-shadow: 0 0 4px #b69642;
      background-image:
        linear-gradient(to bottom, #967c30 10%, #d8c070 40%, #e5d498 50%, #d8c070 60%, #967c30 90%),
        url("data:image/svg+xml,%3Csvg width='2' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h2v2H0zm0 5h2v2H0zm0 5h2v2H0zm0 5h2v2H0zm0 5h2v2H0z' fill='%23000000' fill-opacity='0.2'/%3E%3C/svg%3E");
      opacity: 0.9;
    `;

    // Add corner decorations for the frame
    this.topLeftCorner = document.createElement('div');
    this.topLeftCorner.className = 'boss-health-corner top-left';
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
    this.topRightCorner.className = 'boss-health-corner top-right';
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
    this.bottomLeftCorner.className = 'boss-health-corner bottom-left';
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
    this.bottomRightCorner.className = 'boss-health-corner bottom-right';
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
    this.healthBarContainer.className = 'boss-health-bar-container';
    this.healthBarContainer.style.cssText = `
      width: calc(100% - 4px);
      height: 12px;
      background-color: #0f1b36;
      border-radius: 0;
      overflow: hidden;
      position: relative;
      border: none;
      box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.7);
      background-image: 
        url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v20h2v2H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20z' fill='%23131f38' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E");
    `;

    // Create health bar
    this.healthBar = document.createElement('div');
    this.healthBar.className = 'boss-health-bar';
    this.healthBar.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(to right, #4d0000, #650000);
      transition: width 0.4s ease;
    `;

    // Create damage overlay (for delayed health reduction effect)
    this.damageOverlay = document.createElement('div');
    this.damageOverlay.className = 'boss-health-damage-overlay';
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
    
    this.container.appendChild(this.nameElement);
    this.container.appendChild(this.healthBarWrapper);
    document.body.appendChild(this.container);

    // Set up event listeners
    this.setupEventListeners();

    // Boss data
    this.bossData = null;

    // Create animation style for the glowing effect
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
      @keyframes diamond-glow {
        0% { box-shadow: 0 0 4px 1px #b69642; }
        50% { box-shadow: 0 0 7px 2px #d8c070; }
        100% { box-shadow: 0 0 5px 1px #b69642; }
      }
    `;
    document.head.appendChild(styleElement);
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for boss detected event
    document.addEventListener('boss_detected', this.handleBossDetected.bind(this));
    
    // Listen for boss health change events
    document.addEventListener('boss_health_changed', this.handleHealthChanged.bind(this));
    
    // Listen for boss defeated event
    document.addEventListener('boss_defeated', this.handleBossDefeated.bind(this));
  }

  /**
   * Handle boss detected event
   * @param {CustomEvent} event - The boss detected event
   */
  handleBossDetected(event) {
    const { name, health, maxHealth } = event.detail;
    
    // Store boss data
    this.bossData = {
      name,
      health,
      maxHealth
    };
    
    // Update UI
    this.nameElement.textContent = name;
    this.updateHealthBar(health, maxHealth, undefined);
    
    // Show UI with animation
    this.show();
    
    console.log(`Boss UI displayed for: ${name}`);
  }

  /**
   * Handle health changed event
   * @param {CustomEvent} event - The health changed event
   */
  handleHealthChanged(event) {
    const { health, maxHealth } = event.detail;
    
    if (this.bossData) {
      // Store previous health before updating
      const previousHealth = this.bossData.health;
      
      // Update current health
      this.bossData.health = health;
      
      // Update health bar with previous health for damage preview
      this.updateHealthBar(health, maxHealth, previousHealth);
    }
  }

  /**
   * Handle boss defeated event
   * @param {CustomEvent} event - The boss defeated event
   */
  handleBossDefeated(event) {
    const { name } = event.detail;
    
    console.log(`Boss defeated: ${name}`);
    
    // Hide the UI
    this.hide();
    
    // Clear boss data
    this.bossData = null;
  }

  /**
   * Update health bar display
   * @param {number} health - Current health
   * @param {number} maxHealth - Maximum health
   * @param {number} previousHealth - Previous health value (for damage preview)
   */
  updateHealthBar(health, maxHealth, previousHealth) {
    const healthPercentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));
    
    // If we have a previous health value and damage was taken
    if (previousHealth !== undefined && previousHealth > health) {
      const previousHealthPercentage = Math.max(0, Math.min(100, (previousHealth / maxHealth) * 100));
      
      // Calculate the size of damage preview (yellow bar)
      const damageWidth = previousHealthPercentage - healthPercentage;
      
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
      // For healing or initial display, just update the health bar
      this.healthBar.style.width = `${healthPercentage}%`;
      this.damageOverlay.style.width = '0';
    }
  }

  /**
   * Show the boss UI
   */
  show() {
    this.container.style.display = 'flex';
    this.container.style.opacity = '0';
    this.container.style.transform = 'translate(-50%, 20px)';
    
    // Trigger animation
    setTimeout(() => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'translate(-50%, 0)';
    }, 50);
  }

  /**
   * Hide the boss UI
   */
  hide() {
    this.container.style.opacity = '0';
    this.container.style.transform = 'translate(-50%, 20px)';
    
    // Remove from DOM after animation
    setTimeout(() => {
      this.container.style.display = 'none';
    }, 800);
  }
  
  /**
   * Update the UI (called every frame)
   */
  update() {
    // Any update logic if needed
  }
}

export default BossUI; 