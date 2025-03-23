class SoundManager {
  constructor() {
    this.sounds = {};
    this.activeLoops = {};
    this.footstepIndex = 0; // Track which footstep sound to play next
    
    // Preload common sounds
    this.preloadSound('grassWalk1', '/assets/sounds/grassWalk1.MP3');
    this.preloadSound('grassWalk2', '/assets/sounds/grassWalk2.MP3');
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
  
  // New method for alternating footstep sounds
  startFootsteps(options = {}, forceNext = false) {
    // Check if any footstep sound is already playing
    const activeSoundId = this.activeLoops['grassWalk1'] ? 'grassWalk1' : 
                          this.activeLoops['grassWalk2'] ? 'grassWalk2' : null;
    
    // If a sound is playing and playback rate has changed, update it
    if (activeSoundId && !forceNext && options.playbackRate !== undefined) {
      const activeSound = this.activeLoops[activeSoundId];
      if (activeSound && activeSound.playbackRate !== options.playbackRate) {
        activeSound.playbackRate = options.playbackRate;
      }
      return activeSound;
    }
    
    // If already playing a footstep sound and not forcing a new one, don't start another
    if (activeSoundId && !forceNext) {
      return this.activeLoops[activeSoundId];
    }
    
    // Stop any currently playing footsteps if forcing a new sound
    if (forceNext) {
      this.stopFootsteps();
    }
    
    // Alternate between footstep sounds
    const soundId = this.footstepIndex % 2 === 0 ? 'grassWalk1' : 'grassWalk2';
    this.footstepIndex++;
    
    return this.startLoop(soundId, options);
  }
  
  // Force a new footstep sound based on speed/intensity
  startFootstepsForMovementType(movementType, options = {}) {
    if (!movementType) {
      return this.startFootsteps(options, false);
    }
    
    // Check movement animation type to determine playback rate
    let playbackRate = 1.0;
    let forceNewSound = false;
    
    const movementTypeLower = movementType.toLowerCase();
    
    // For running animations, use faster playback rate
    if (movementTypeLower.includes('run')) {
      playbackRate = 1.8; // Make run footsteps significantly faster
      forceNewSound = true;
    }
    // For strafing animations, use slightly faster playback
    else if (movementTypeLower.includes('strafe')) {
      // Regular strafing
      if (!movementTypeLower.includes('run')) {
        playbackRate = 1.2; // Make strafe slightly faster than regular walk
      }
      // Strafe running animations are already handled by the 'run' check above
    }
    
    // Apply playback rate to options
    const soundOptions = { 
      ...options,
      playbackRate: playbackRate
    };
    
    // Return the started footstep sound
    return this.startFootsteps(soundOptions, forceNewSound);
  }
  
  stopFootsteps() {
    this.stopLoop('grassWalk1');
    this.stopLoop('grassWalk2');
  }
}

export default SoundManager; 