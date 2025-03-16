import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createNoise2D } from "simplex-noise";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const loader = new GLTFLoader();
let mixer;
let dragon;

loader.load(
  "/public/assets/models/dragonkin/scene.gltf",
  function (gltf) {
    scene.add(gltf.scene);
    mixer = new THREE.AnimationMixer(gltf.scene);
    const action = mixer.clipAction(gltf.animations[2]); // First animation (e.g., flying)
    action.play();
  },
  function (progress) {
    // console.log(progress);
  },
  function (error) {
    console.error(error);
  }
);

const noise = createNoise2D();
const groundGeometry = new THREE.PlaneGeometry(100, 100, 64, 64); // Higher resolution
const vertices = groundGeometry.attributes.position.array;
for (let i = 0; i < vertices.length; i += 3) {
  const x = vertices[i];
  const y = vertices[i + 1];
  vertices[i + 2] = noise(x * 0.05, y * 0.05) * 5; // Height variation
}
groundGeometry.computeVertexNormals(); // For smooth lighting
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const ambientLight = new THREE.AmbientLight(0x404040); // Soft light
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

const playerGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 1, 0); // Above ground
scene.add(player);

const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));

const moveSpeed = 0.1;
function updatePlayer() {
  if (keys["w"]) player.position.z -= moveSpeed;
  if (keys["s"]) player.position.z += moveSpeed;
  if (keys["a"]) player.position.x -= moveSpeed;
  if (keys["d"]) player.position.x += moveSpeed;
}

camera.position.set(0, 5, 10); // Initial camera position
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  updatePlayer();

  if (mixer) {
    mixer.update(clock.getDelta());
  }

  camera.position.x = player.position.x;
  camera.position.z = player.position.z + 10; // Follow behind player
  camera.lookAt(player.position);
  renderer.render(scene, camera);
}
animate();
