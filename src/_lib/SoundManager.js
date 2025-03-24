class SoundManager {
  constructor() {
    this.sounds = {};
    this.activeLoops = {};
    this.footstepIndex = 0; // Track which footstep sound to play next
    this.footstepInterval = null; // For interval-based footsteps
    this.lastFootstepTime = 0; // Track when the last footstep was played
    this.currentMovementType = null; // Track current movement type
    this.currentSurfaceType = 'grass'; // Default surface type
    
    // Preload common sounds
    this.preloadSound('grassWalk1', '/assets/sounds/grassWalk1.MP3');
    this.preloadSound('grassWalk2', '/assets/sounds/grassWalk2.MP3');
    this.preloadSound('grassWalk3', '/assets/sounds/grassWalk3.MP3');
    this.preloadSound('grassWalk4', '/assets/sounds/grassWalk4.MP3');
    this.preloadSound('grassWalk5', '/assets/sounds/grassWalk5.MP3');
    this.preloadSound('grassWalk6', '/assets/sounds/grassWalk6.MP3');
    
    // Preload action sounds
    this.preloadSound('roll', '/assets/sounds/roll.mp3');
    
    // Preload ambient sounds
    this.preloadAmbientSounds();
    
    // Define sound sets for different surfaces
    this.surfaceSounds = {
      grass: ['grassWalk1', 'grassWalk2', 'grassWalk3', 'grassWalk4', 'grassWalk5', 'grassWalk6'],
      // Add more surface types when assets are available
      // stone: ['stoneWalk1', 'stoneWalk2'],
      // wood: ['woodWalk1', 'woodWalk2'],
      // water: ['waterWalk1', 'waterWalk2'],
    };
  }
  
  /**
   * Preload ambient sounds used throughout the game
   */
  preloadAmbientSounds() {
    // Preload the ambient wind sound
    this.preloadSound('ambientWind', '/assets/sounds/windBlowing.mp3');
    
    // Add other ambient sounds as needed
  }
  
  preloadSound(id, url) {
    const audio = new Audio(url);
    audio.load();
    this.sounds[id] = audio;
    return audio;
  }
  
  playSound(id, options = {}) {
    if (!this.sounds[id]) {
      console.warn(`Sound not found: ${id}`);
      return null;
    }
    
    // Clone the audio to allow overlapping sounds
    const sound = this.sounds[id].cloneNode();
    
    // Apply options
    if (options.volume !== undefined) sound.volume = options.volume;
    if (options.loop !== undefined) sound.loop = options.loop;
    if (options.playbackRate !== undefined) sound.playbackRate = options.playbackRate;
    
    sound.play();
    return sound;
  }
  
  startLoop(id, options = {}) {
    // If already playing this loop, don't start again
    if (this.activeLoops[id]) {
      // If playback rate needs to be updated, update it
      if (options.playbackRate !== undefined && this.activeLoops[id].playbackRate !== options.playbackRate) {
        this.activeLoops[id].playbackRate = options.playbackRate;
      }
      return this.activeLoops[id];
    }
    
    const sound = this.playSound(id, { ...options, loop: true });
    if (sound) {
      this.activeLoops[id] = sound;
    }
    return sound;
  }
  
  stopLoop(id) {
    if (this.activeLoops[id]) {
      this.activeLoops[id].pause();
      this.activeLoops[id].currentTime = 0;
      delete this.activeLoops[id];
    }
  }
  
  stopAllLoops() {
    Object.keys(this.activeLoops).forEach(id => {
      this.stopLoop(id);
    });
  }
  
  // New method to set the current surface type
  setSurfaceType(surfaceType) {
    if (this.surfaceSounds[surfaceType]) {
      this.currentSurfaceType = surfaceType;
    } else {
      console.warn(`Unknown surface type: ${surfaceType}, defaulting to grass`);
      this.currentSurfaceType = 'grass';
    }
  }
  
  // Play a single footstep sound
  playFootstep(options = {}) {
    // Get the sound set for the current surface
    const soundSet = this.surfaceSounds[this.currentSurfaceType];
    
    // Choose a random sound from the available set
    // With a bias towards not repeating the most recent sound
    let soundIndex;
    const lastIndex = this.footstepIndex % soundSet.length;
    
    if (Math.random() < 0.85) {
      // 85% chance to pick a random sound that's not the last one played
      do {
        soundIndex = Math.floor(Math.random() * soundSet.length);
      } while (soundIndex === lastIndex && soundSet.length > 1);
    } else {
      // 15% chance to repeat the last sound
      soundIndex = lastIndex;
    }
    
    const soundId = soundSet[soundIndex];
    this.footstepIndex++;
    
    // Randomize volume slightly for more natural variation
    const baseVolume = options.volume || 0.3;
    const volumeVariation = 0.15; // ±15% volume variation
    const randomizedVolume = baseVolume * (1 - volumeVariation + Math.random() * volumeVariation * 2);
    
    // Use consistent playback rate but randomized volume
    const soundOptions = {
      ...options,
      volume: randomizedVolume,
      playbackRate: 1.0 // Consistent playback rate for all footsteps
    };
    
    return this.playSound(soundId, soundOptions);
  }
  
  // Start playing footstep sounds at intervals based on velocity
  startFootstepsForMovementType(movementType, options = {}, velocity = null) {
    // Clear any existing footstep interval
    this.stopFootsteps();
    
    // Store current movement type
    this.currentMovementType = movementType;
    
    // Determine the interval based on velocity or movement type
    let interval = 500; // Default interval in ms (2 steps per second)
    
    if (velocity !== null) {
      // If velocity is provided, calculate the interval directly
      // Higher velocity = shorter interval = more frequent steps
      interval = 1000 / (velocity * 0.333); // Scale factor can be adjusted
      interval = Math.max(200, Math.min(800, interval)); // Clamp between 200ms and 800ms
    } else {
      // Fallback to using movement type if velocity not provided
      const movementTypeLower = movementType.toLowerCase();
      
      if (movementTypeLower.includes('run')) {
        interval = 250; // 4 steps per second for running
      } else if (movementTypeLower.includes('strafe')) {
        interval = 400; // 2.5 steps per second for strafing
      } else if (movementTypeLower.includes('walk')) {
        interval = 600; // Slower for walking
      }
    }
    
    // Play first footstep immediately
    this.playFootstep(options);
    this.lastFootstepTime = Date.now();
    
    // Set up interval for subsequent footsteps
    this.footstepInterval = setInterval(() => {
      this.playFootstep(options);
    }, interval);
    
    return true;
  }
  
  stopFootsteps() {
    // Clear the footstep interval
    if (this.footstepInterval) {
      clearInterval(this.footstepInterval);
      this.footstepInterval = null;
    }
    
    // Stop any ongoing looped footstep sounds (from old implementation)
    this.stopLoop('grassWalk1');
    this.stopLoop('grassWalk2');
    this.stopLoop('grassWalk3');
    this.stopLoop('grassWalk4');
    this.stopLoop('grassWalk5');
    this.stopLoop('grassWalk6');
    
    this.currentMovementType = null;
  }
  
  // Update footstep frequency based on current velocity
  updateFootstepFrequency(velocity) {
    if (!this.currentMovementType || !this.footstepInterval) return;
    
    // Calculate new interval based on velocity
    let newInterval = 1000 / (velocity * 0.333); // Scale factor can be adjusted
    newInterval = Math.max(200, Math.min(800, newInterval)); // Clamp between 200ms and 800ms
    
    // Only update if the interval has changed significantly (avoid constant changes)
    const timeSinceLastStep = Date.now() - this.lastFootstepTime;
    
    // If it's been long enough since the last step (75% of the new interval) and 
    // the new interval is significantly different from the old one
    if (timeSinceLastStep >= newInterval * 0.75) {
      // Clear existing interval
      clearInterval(this.footstepInterval);
      
      // Play a step immediately
      this.playFootstep({ volume: 0.2 });
      this.lastFootstepTime = Date.now();
      
      // Set new interval
      this.footstepInterval = setInterval(() => {
        this.playFootstep({ volume: 0.2 });
      }, newInterval);
    }
  }
}

export default SoundManager; 