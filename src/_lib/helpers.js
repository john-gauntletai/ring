import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

export const addResizeEventListeners = (camera, renderer) => {
  window.addEventListener("resize", () => {
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

export const loadModel = async (filePath, scene, LOADING_MANAGER) => {
  const animations = {};

  const loader = new GLTFLoader(LOADING_MANAGER);
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("three/examples/jsm/libs/draco/");
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
  loader.setDRACOLoader(dracoLoader);
  const gltfData = await loader.loadAsync(filePath);

  const model = gltfData.scene;
  model.traverse(function (child) {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const modelHeight = box.max.y - box.min.y;
  console.log(filePath, "height:", modelHeight);

  scene.add(model);

  const mixer = new THREE.AnimationMixer(model);

  gltfData.animations.forEach((animation) => {
    const action = mixer.clipAction(animation);

    animations[animation.name] = {
      action,
      clip: animation,
    };
  });

  return {
    model,
    animations,
    mixer,
  };
}