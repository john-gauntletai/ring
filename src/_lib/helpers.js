import * as THREE from 'three';
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

      animations[animation.name.replace('Mon_BlackDragon31_', '')] = {
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

// Remove all meshes in bottom half of the kingdom model
export const removeBottomHalf = (model) => {
  const modelBounds = new THREE.Box3().setFromObject(model);
  const modelHeight = modelBounds.max.y - modelBounds.min.y;
  const midHeight = modelBounds.min.y + modelHeight / 2;

  // Store meshes to remove
  const meshesToRemove = [];

  // First identify meshes in the bottom half
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const meshBounds = new THREE.Box3().setFromObject(child);

      // Check if this mesh is primarily in the bottom half
      if (
        meshBounds.max.y < midHeight ||
        (meshBounds.min.y < midHeight &&
          meshBounds.max.y - meshBounds.min.y < modelHeight * 0.3)
      ) {
        meshesToRemove.push(child);
      }
    }
  });

  // Then remove them (can't remove while traversing)
  meshesToRemove.forEach((mesh) => {
    // Dispose of geometry and materials to prevent memory leaks
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
    }

    // Remove from parent
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
  });
};

// Darken and blur the kingdom model
export const applyKingdomEffects = (model) => {
  // Calculate distance to position the blur plane
  const modelBounds = new THREE.Box3().setFromObject(model);
  const modelCenter = new THREE.Vector3();
  modelBounds.getCenter(modelCenter);

  console.log('Applying enhanced darkening effects to kingdom model');

  // Traverse model and modify all materials
  model.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      // Handle both single materials and material arrays
      if (Array.isArray(child.material)) {
        child.material.forEach((mat, index) => {
          // Create a new material that inherits from the original
          const newMat = mat.clone();

          // Darken the material significantly more
          newMat.color.multiplyScalar(0.4); // Darkened from 0.7 to 0.4
          newMat.emissive = new THREE.Color(0x000000); // No emissive
          if (newMat.roughness !== undefined)
            newMat.roughness = Math.min(1.0, newMat.roughness * 1.5); // Increased roughness from 1.3 to 1.5
          if (newMat.metalness !== undefined)
            newMat.metalness = Math.min(0.9, newMat.metalness * 1.4); // Increased metalness from 1.2 to 1.4

          // Reduce any reflectivity
          if (newMat.envMapIntensity !== undefined) {
            newMat.envMapIntensity *= 0.3; // Significantly reduce environment map reflections
          }

          // Apply modified material
          child.material[index] = newMat;
        });
      } else {
        // Create a new material that inherits from the original
        const newMat = child.material.clone();

        // Darken the material significantly more
        newMat.color.multiplyScalar(0.4); // Darkened from 0.7 to 0.4
        newMat.emissive = new THREE.Color(0x000000); // No emissive
        if (newMat.roughness !== undefined)
          newMat.roughness = Math.min(1.0, newMat.roughness * 1.5); // Increased roughness
        if (newMat.metalness !== undefined)
          newMat.metalness = Math.min(0.9, newMat.metalness * 1.4); // Increased metalness

        // Reduce any reflectivity
        if (newMat.envMapIntensity !== undefined) {
          newMat.envMapIntensity *= 0.3; // Significantly reduce environment map reflections
        }

        // Apply modified material
        child.material = newMat;
      }
    }
  });

  // No blur plane effect
};
