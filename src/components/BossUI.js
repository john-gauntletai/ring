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
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 40px;
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
      font-family: 'Arial', sans-serif;
      font-size: 16px;
      margin-bottom: 5px;
      text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
    `;

    // Create health bar container
    this.healthBarContainer = document.createElement('div');
    this.healthBarContainer.className = 'boss-health-bar-container';
    this.healthBarContainer.style.cssText = `
      width: 100%;
      height: 12px;
      background-color: rgba(0, 0, 0, 0.6);
      border: 2px solid #666;
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    `;

    // Create health bar
    this.healthBar = document.createElement('div');
    this.healthBar.className = 'boss-health-bar';
    this.healthBar.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(to right, #ff3838, #ff6b6b);
      transition: width 0.4s ease;
    `;

    // Create damage overlay (for delayed health reduction effect)
    this.damageOverlay = document.createElement('div');
    this.damageOverlay.className = 'boss-health-damage-overlay';
    this.damageOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: #ffffff;
      transform: scaleX(0);
      transform-origin: right;
      transition: transform 0.3s ease;
    `;

    // Add elements to DOM
    this.healthBarContainer.appendChild(this.healthBar);
    this.healthBarContainer.appendChild(this.damageOverlay);
    this.container.appendChild(this.nameElement);
    this.container.appendChild(this.healthBarContainer);
    document.body.appendChild(this.container);

    // Set up event listeners
    this.setupEventListeners();

    // Boss data
    this.bossData = null;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for boss detected event
    document.addEventListener('boss_detected', this.handleBossDetected.bind(this));
    
    // Listen for boss health change events
    document.addEventListener('boss_health_changed', this.handleHealthChanged.bind(this));
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
    this.updateHealthBar(health, maxHealth);
    
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
      this.bossData.health = health;
      this.updateHealthBar(health, maxHealth);
    }
  }

  /**
   * Update health bar display
   * @param {number} health - Current health
   * @param {number} maxHealth - Maximum health
   */
  updateHealthBar(health, maxHealth) {
    const healthPercentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));
    this.healthBar.style.width = `${healthPercentage}%`;
    
    // Flash effect on damage
    this.damageOverlay.style.opacity = '0.7';
    this.damageOverlay.style.transform = `scaleX(${1 - healthPercentage / 100})`;
    
    setTimeout(() => {
      this.damageOverlay.style.opacity = '0';
    }, 300);
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