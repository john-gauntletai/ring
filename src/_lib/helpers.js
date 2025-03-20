import * as THREE from "three";

export const addEventListeners = (camera, renderer) => {
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
