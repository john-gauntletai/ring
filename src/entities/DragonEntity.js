
import * as THREE from "three";

class DragonEntity {
  constructor(model, animations, mixer, soundManager) {
    this.model = model;
    this.animations = animations;
    this.mixer = mixer;
    this.soundManager = soundManager;
    console.log('Dragon animations', this.animations);

    // modify this to set where the dragon is originally
    this.model.position.set(0, 0, 0);
    this.init();
  }

  init() {
    this.markAsLoopOnce(this.animations.attack.action);
    this.markAsLoopOnce(this.animations.down.action);
    this.markAsLoopOnce(this.animations.fire.action);
    this.markAsLoopOnce(this.animations.roar.action);
    this.markAsLoopOnce(this.animations.roar1.action);
    this.markAsLoopOnce(this.animations.stop.action);
  }

  markAsLoopOnce(action) {
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
  }

  update(delta) {
    this.mixer.update(delta);
  }
}

export default DragonEntity;