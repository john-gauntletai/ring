import nipplejs from 'nipplejs';
import KEYS from '../_lib/keys';

/**
 * Mobile controls using nipplejs
 * Only initializes on touch-capable devices
 */
class MobileControls {
  constructor() {
    this.isMobile = this.detectMobile();
    this.joysticks = [];
    this.moveJoystick = null;
    this.cameraJoystick = null;
    this.actionButtons = [];
    this.initialized = false;
    this.isLandscape = window.innerWidth > window.innerHeight;

    // Only initialize on mobile devices
    if (this.isMobile) {
      this.init();
      this.setupOrientationListener();
    }
  }

  /**
   * Detect if the current device is a mobile device
   * @returns {boolean} - Whether the device is mobile
   */
  detectMobile() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    );
  }

  /**
   * Set up listener for orientation changes
   */
  setupOrientationListener() {
    window.addEventListener('resize', () => {
      const wasLandscape = this.isLandscape;
      this.isLandscape = window.innerWidth > window.innerHeight;

      // Only rebuild joysticks if orientation changed
      if (wasLandscape !== this.isLandscape) {
        console.log(
          `Orientation changed to ${
            this.isLandscape ? 'landscape' : 'portrait'
          }`
        );
        this.rebuildJoysticks();
      }
    });
  }

  /**
   * Rebuild joysticks based on current orientation
   */
  rebuildJoysticks() {
    // Destroy existing joysticks
    if (this.moveJoystick) {
      this.moveJoystick.destroy();
    }

    if (this.cameraJoystick) {
      this.cameraJoystick.destroy();
    }

    // Clear joysticks array
    this.joysticks = [];

    // Recreate joysticks with appropriate positioning
    this.createJoysticks();
  }

  /**
   * Initialize mobile controls
   */
  init() {
    if (this.initialized) return;

    // Create container for mobile controls
    this.createControlContainer();

    // Create joysticks
    this.createJoysticks();

    // Create action buttons
    this.createActionButtons();

    this.initialized = true;
    console.log('Mobile controls initialized');
  }

  /**
   * Create the container for mobile controls
   */
  createControlContainer() {
    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'mobile-controls';

    // Create left joystick zone
    this.leftZone = document.createElement('div');
    this.leftZone.id = 'left-joystick';

    // Create right joystick zone
    this.rightZone = document.createElement('div');
    this.rightZone.id = 'right-joystick';

    // Create action buttons container
    this.buttonContainer = document.createElement('div');
    this.buttonContainer.id = 'action-buttons';

    // Add to DOM
    this.container.appendChild(this.leftZone);
    this.container.appendChild(this.rightZone);
    this.container.appendChild(this.buttonContainer);
    document.body.appendChild(this.container);
  }

  /**
   * Create joysticks using nipplejs
   */
  createJoysticks() {
    // Determine position based on orientation
    const leftPosition = this.isLandscape
      ? { left: '15%', bottom: '25%' }
      : { left: '50%', bottom: '50%' };
    const rightPosition = this.isLandscape
      ? { right: '15%', bottom: '25%' }
      : { right: '50%', bottom: '50%' };

    // Create movement joystick (left)
    this.moveJoystick = nipplejs.create({
      zone: this.leftZone,
      mode: 'static',
      position: leftPosition,
      color: 'rgba(100, 100, 100, 0.8)',
      size: 140,
      restOpacity: 0.9,
      fadeTime: 250,
      lockX: false,
      lockY: false,
      shape: 'circle',
    });

    // Create camera joystick (right)
    this.cameraJoystick = nipplejs.create({
      zone: this.rightZone,
      mode: 'static',
      position: rightPosition,
      color: 'rgba(100, 100, 100, 0.8)',
      size: 140,
      restOpacity: 0.9,
      fadeTime: 250,
      lockX: false,
      lockY: false,
      shape: 'circle',
    });

    // Store both joysticks
    this.joysticks.push(this.moveJoystick, this.cameraJoystick);

    // Set up event listeners for joysticks
    this.setupJoystickEvents();
  }

  /**
   * Setup joystick event listeners
   */
  setupJoystickEvents() {
    // Movement joystick events (WASD keys)
    this.moveJoystick.on('move', (evt, data) => {
      // Reset all movement keys
      KEYS['w'] = false;
      KEYS['a'] = false;
      KEYS['s'] = false;
      KEYS['d'] = false;

      // Set keys based on direction
      const angle = data.angle.degree;
      const force = Math.min(data.force, 1);

      // Visual feedback - change color based on force
      if (this.moveJoystick.ui && this.moveJoystick.ui.front) {
        // Change color intensity based on force
        const r = Math.round(100 + force * 155);
        const g = Math.round(100 + force * 155);
        const b = Math.round(150 + force * 105);
        this.moveJoystick.ui.front.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
      }

      // Get direction vector from nipplejs data
      const directionX = Math.cos(data.angle.radian);
      const directionY = Math.sin(data.angle.radian);

      // Map direction vector to WASD keys
      // W = up (negative Y)
      // A = left (negative X)
      // S = down (positive Y)
      // D = right (positive X)

      // Check Y axis (up/down)
      // Note: In nipplejs, Y is inverted from our desired mapping
      // Up/forward is positive Y in nipplejs but we want it to be W
      if (directionY > 0.25) {
        KEYS['w'] = true; // Forward
      } else if (directionY < -0.25) {
        KEYS['s'] = true; // Backward
      }

      // Check X axis (left/right)
      if (directionX < -0.25) {
        KEYS['a'] = true; // Left
      } else if (directionX > 0.25) {
        KEYS['d'] = true; // Right
      }
    });

    // Reset movement keys when joystick is released
    this.moveJoystick.on('end', () => {
      KEYS['w'] = false;
      KEYS['a'] = false;
      KEYS['s'] = false;
      KEYS['d'] = false;

      // Reset joystick color
      if (this.moveJoystick.ui && this.moveJoystick.ui.front) {
        this.moveJoystick.ui.front.style.backgroundColor =
          'rgba(200, 200, 200, 0.9)';
      }
    });

    // Camera joystick events (Arrow keys)
    this.cameraJoystick.on('move', (evt, data) => {
      // Reset all camera keys
      KEYS['arrowup'] = false;
      KEYS['arrowleft'] = false;
      KEYS['arrowdown'] = false;
      KEYS['arrowright'] = false;

      // Set keys based on direction
      const angle = data.angle.degree;
      const force = Math.min(data.force, 1);

      // Visual feedback - change color based on force
      if (this.cameraJoystick.ui && this.cameraJoystick.ui.front) {
        // Change color intensity based on force
        const r = Math.round(100 + force * 155);
        const g = Math.round(100 + force * 155);
        const b = Math.round(150 + force * 105);
        this.cameraJoystick.ui.front.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
      }

      // Get direction vector from nipplejs data
      const directionX = Math.cos(data.angle.radian);
      const directionY = Math.sin(data.angle.radian);

      // Map direction vector to arrow keys
      // ArrowUp = up (negative Y)
      // ArrowLeft = left (negative X)
      // ArrowDown = down (positive Y)
      // ArrowRight = right (positive X)

      // Check Y axis (up/down)
      // Note: In nipplejs, Y is inverted from our desired mapping
      // Up is positive Y in nipplejs but we want it to be arrowUp
      if (directionY > 0.25) {
        KEYS['arrowup'] = true; // Up
      } else if (directionY < -0.25) {
        KEYS['arrowdown'] = true; // Down
      }

      // Check X axis (left/right)
      if (directionX < -0.25) {
        KEYS['arrowleft'] = true; // Left
      } else if (directionX > 0.25) {
        KEYS['arrowright'] = true; // Right
      }
    });

    // Reset camera keys when joystick is released
    this.cameraJoystick.on('end', () => {
      KEYS['arrowup'] = false;
      KEYS['arrowleft'] = false;
      KEYS['arrowdown'] = false;
      KEYS['arrowright'] = false;

      // Reset joystick color
      if (this.cameraJoystick.ui && this.cameraJoystick.ui.front) {
        this.cameraJoystick.ui.front.style.backgroundColor =
          'rgba(200, 200, 200, 0.9)';
      }
    });
  }

  /**
   * Create action buttons for mobile
   */
  createActionButtons() {
    // Button configurations with corresponding actions
    const buttons = [
      {
        id: 'slash-btn',
        text: 'SLASH',
        key: 'u',
        action: () => {
          if (window.PLAYER && typeof window.PLAYER.slash === 'function') {
            window.PLAYER.slash();
          }
        },
      },
      {
        id: 'kick-btn',
        text: 'KICK',
        key: 'k',
        action: () => {
          if (window.PLAYER && typeof window.PLAYER.kick === 'function') {
            window.PLAYER.kick();
          }
        },
      },
      {
        id: 'lock-btn',
        text: 'LOCK',
        key: 'l',
        action: () => {
          if (
            window.PLAYER &&
            typeof window.PLAYER.toggleLockOn === 'function'
          ) {
            // If ENEMY is available, toggle lock on it, otherwise just toggle lock
            if (window.ENEMY && window.PLAYER.lockOnEntity === window.ENEMY) {
              window.PLAYER.toggleLockOn();
            } else if (window.ENEMY) {
              window.PLAYER.toggleLockOn(window.ENEMY);
            } else {
              window.PLAYER.toggleLockOn();
            }
          }
        },
      },
      {
        id: 'heal-btn',
        text: 'HEAL',
        key: 'p',
        action: () => {
          if (window.PLAYER && typeof window.PLAYER.powerUp === 'function') {
            window.PLAYER.powerUp();
          }
        },
      },
    ];

    // Create each button
    buttons.forEach((btnConfig) => {
      const button = document.createElement('button');
      button.id = btnConfig.id;
      button.textContent = btnConfig.text;

      // Add touch event listeners
      button.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent default touch behavior
        KEYS[btnConfig.key] = true;

        // Directly call the player action
        if (btnConfig.action) {
          btnConfig.action();
        }

        // Visual feedback
        button.style.transform = 'scale(0.95)';
      });

      button.addEventListener('touchend', (e) => {
        e.preventDefault();
        KEYS[btnConfig.key] = false;

        // Reset visual feedback
        button.style.transform = 'scale(1)';
      });

      this.buttonContainer.appendChild(button);
      this.actionButtons.push(button);
    });
  }

  /**
   * Show mobile controls
   */
  show() {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  /**
   * Hide mobile controls
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Clean up event listeners and remove elements
   */
  destroy() {
    // Clean up joysticks
    this.joysticks.forEach((joystick) => {
      if (joystick) {
        joystick.destroy();
      }
    });

    // Remove DOM elements
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.initialized = false;
  }
}

export default MobileControls;
