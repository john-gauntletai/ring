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

    // Only initialize on mobile devices
    if (this.isMobile) {
      this.init();
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
    // Create movement joystick (left)
    this.moveJoystick = nipplejs.create({
      zone: this.leftZone,
      mode: 'static',
      position: { left: '50%', bottom: '50%' },
      color: 'rgba(255, 255, 255, 0.5)',
      size: 100,
      restOpacity: 0.4,
      fadeTime: 250,
      lockX: false,
      lockY: false,
      shape: 'circle',
    });

    // Create camera joystick (right)
    this.cameraJoystick = nipplejs.create({
      zone: this.rightZone,
      mode: 'static',
      position: { right: '50%', bottom: '50%' },
      color: 'rgba(255, 255, 255, 0.5)',
      size: 100,
      restOpacity: 0.4,
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

      // Forward / Backward (W/S)
      if (angle > 45 && angle < 135) {
        KEYS['d'] = true; // Right
      } else if (angle > 225 && angle < 315) {
        KEYS['a'] = true; // Left
      }

      if (angle > 315 || angle < 45) {
        KEYS['w'] = true; // Up
      } else if (angle > 135 && angle < 225) {
        KEYS['s'] = true; // Down
      }

      // Diagonal movement
      if ((angle > 0 && angle < 45) || (angle > 315 && angle < 360)) {
        KEYS['w'] = true; // Up-right
        KEYS['d'] = true;
      } else if (angle > 45 && angle < 90) {
        KEYS['d'] = true; // Right-up
        KEYS['w'] = true;
      } else if (angle > 90 && angle < 135) {
        KEYS['d'] = true; // Right-down
        KEYS['s'] = true;
      } else if (angle > 135 && angle < 180) {
        KEYS['s'] = true; // Down-right
        KEYS['d'] = true;
      } else if (angle > 180 && angle < 225) {
        KEYS['s'] = true; // Down-left
        KEYS['a'] = true;
      } else if (angle > 225 && angle < 270) {
        KEYS['a'] = true; // Left-down
        KEYS['s'] = true;
      } else if (angle > 270 && angle < 315) {
        KEYS['a'] = true; // Left-up
        KEYS['w'] = true;
      }
    });

    // Reset movement keys when joystick is released
    this.moveJoystick.on('end', () => {
      KEYS['w'] = false;
      KEYS['a'] = false;
      KEYS['s'] = false;
      KEYS['d'] = false;
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

      // Main directions
      if (angle > 45 && angle < 135) {
        KEYS['arrowright'] = true; // Right
      } else if (angle > 225 && angle < 315) {
        KEYS['arrowleft'] = true; // Left
      }

      if (angle > 315 || angle < 45) {
        KEYS['arrowup'] = true; // Up
      } else if (angle > 135 && angle < 225) {
        KEYS['arrowdown'] = true; // Down
      }

      // Diagonal camera movement
      if ((angle > 0 && angle < 45) || (angle > 315 && angle < 360)) {
        KEYS['arrowup'] = true; // Up-right
        KEYS['arrowright'] = true;
      } else if (angle > 45 && angle < 90) {
        KEYS['arrowright'] = true; // Right-up
        KEYS['arrowup'] = true;
      } else if (angle > 90 && angle < 135) {
        KEYS['arrowright'] = true; // Right-down
        KEYS['arrowdown'] = true;
      } else if (angle > 135 && angle < 180) {
        KEYS['arrowdown'] = true; // Down-right
        KEYS['arrowright'] = true;
      } else if (angle > 180 && angle < 225) {
        KEYS['arrowdown'] = true; // Down-left
        KEYS['arrowleft'] = true;
      } else if (angle > 225 && angle < 270) {
        KEYS['arrowleft'] = true; // Left-down
        KEYS['arrowdown'] = true;
      } else if (angle > 270 && angle < 315) {
        KEYS['arrowleft'] = true; // Left-up
        KEYS['arrowup'] = true;
      }
    });

    // Reset camera keys when joystick is released
    this.cameraJoystick.on('end', () => {
      KEYS['arrowup'] = false;
      KEYS['arrowleft'] = false;
      KEYS['arrowdown'] = false;
      KEYS['arrowright'] = false;
    });
  }

  /**
   * Create action buttons for mobile
   */
  createActionButtons() {
    // Button configurations
    const buttons = [
      { id: 'slash-btn', text: 'SLASH', key: 'u' },
      { id: 'kick-btn', text: 'KICK', key: 'k' },
      { id: 'lock-btn', text: 'LOCK', key: 'l' },
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
      });

      button.addEventListener('touchend', (e) => {
        e.preventDefault();
        KEYS[btnConfig.key] = false;
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
