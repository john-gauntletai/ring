import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export const addResizeEventListeners = (camera, renderer) => {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
};

export const getModelHeight = (model) => {
  const box = new THREE.Box3().setFromObject(model);
  return box.max.y - box.min.y;
};

export const getDirectionOffset = (keys) => {
  let directionOffset = 0; // w

  if (keys.w) {
    if (keys.a) {
      directionOffset = Math.PI / 4; // w+a
    } else if (keys.d) {
      directionOffset = -Math.PI / 4; // w+d
    }
  } else if (keys.s) {
    if (keys.a) {
      directionOffset = Math.PI / 4 + Math.PI / 2; // s+a
    } else if (keys.d) {
      directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d
    } else {
      directionOffset = Math.PI; // s
    }
  } else if (keys.a) {
    directionOffset = Math.PI / 2; // a
  } else if (keys.d) {
    directionOffset = -Math.PI / 2; // d
  }

  return directionOffset;
};

export const applyEnvMapToModel = (model, envMap) => {
  model.traverse((node) => {
    if (node.isMesh && node.material) {
      const material = node.material;

      // Check if the material supports envMap (e.g., Standard or Physical)
      if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
        material.envMap = envMap;
        material.envMapIntensity = 1.0; // Adjust intensity as needed
        material.needsUpdate = true; // Ensure the material updates
      }
    }
  });
};

export const loadModel = async (filePath, scene, LOADING_MANAGER) => {
  if (filePath.slice(-4) === '.fbx') {
    return loadFbxModel(filePath, scene, LOADING_MANAGER);
  }

  const animations = {};

  const loader = new GLTFLoader(LOADING_MANAGER);
  const dracoLoader = new DRACOLoader();
  // dracoLoader.setDecoderPath('/assets/draco/');
  dracoLoader.setDecoderPath(
    'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
  );
  dracoLoader.setDecoderConfig({ type: 'js' });

  loader.setDRACOLoader(dracoLoader);
  const gltfData = await loader.loadAsync(filePath);

  const model = gltfData.scene;
  model.traverse(function (child) {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(model);

  let mixer;

  if (gltfData.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);

    gltfData.animations.forEach((animation) => {
      const action = mixer.clipAction(animation);

      animations[animation.name] = {
        action,
        clip: animation,
      };
    });
  }

  return {
    model,
    animations,
    mixer,
  };
};

export const loadMutantModel = async (scene, LOADING_MANAGER) => {
  const animations = {};
  const loader = new FBXLoader(LOADING_MANAGER);
  const model = await loader.loadAsync('/assets/models/mutant/mutant.fbx');

  // Enhance mutant model brightness by adjusting materials
  model.traverse((node) => {
    if (node.isMesh && node.material) {
      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];

      materials.forEach((material) => {
        // Increase emissive for a subtle glow
        if (material.emissive) {
          material.emissive.set(0x553322); // Warm glow that matches the mutant's color scheme
        }

        // Brighten the color
        if (material.color) {
          const hsl = { h: 0, s: 0, l: 0 };
          material.color.getHSL(hsl);

          // Increase lightness by 30%, capped at 0.95
          hsl.l = Math.min(hsl.l * 1.3, 0.95);

          // Apply the new lightness
          material.color.setHSL(hsl.h, hsl.s, hsl.l);
        }

        // Adjust other material properties
        if (material.roughness !== undefined) {
          material.roughness = Math.max(material.roughness * 0.7, 0.2);
        }

        if (material.metalness !== undefined) {
          material.metalness = Math.min(material.metalness + 0.2, 0.8);
        }

        // Set material for better light response
        material.flatShading = false; // Smoother shading
        material.needsUpdate = true;
      });
    }
  });

  let mixer = new THREE.AnimationMixer(model);

  const _OnLoad = (animName, anim) => {
    const clip = anim.animations[0];
    const action = mixer.clipAction(clip);

    animations[animName] = {
      clip: clip,
      action: action,
    };
  };

  loader.setPath('/assets/models/mutant/animations/');
  const idle = await loader.loadAsync('idle.fbx');
  _OnLoad('idle', idle);
  const flex = await loader.loadAsync('flex.fbx');
  _OnLoad('flex', flex);
  const punch = await loader.loadAsync('punch.fbx');
  _OnLoad('punch', punch);
  const run = await loader.loadAsync('run.fbx');
  _OnLoad('run', run);
  const leftTurn = await loader.loadAsync('leftTurn.fbx');
  _OnLoad('leftTurn', leftTurn);
  const rightTurn = await loader.loadAsync('rightTurn.fbx');
  _OnLoad('rightTurn', rightTurn);
  const swipe = await loader.loadAsync('swipe.fbx');
  _OnLoad('swipe', swipe);
  const roar = await loader.loadAsync('roar.fbx');
  _OnLoad('roar', roar);

  model.scale.setScalar(0.0225);

  scene.add(model);

  return {
    model,
    animations,
    mixer,
  };
};
