import * as THREE from "three";
import { addEventListeners } from "./_lib/eventListeners";

let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(
  150,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

let renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.set(0, 0, 2); // Initial camera position

let clock = new THREE.Clock();

function animate() {
  renderer.render(scene, camera);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
}
renderer.setAnimationLoop(animate);

addEventListeners(camera, renderer);