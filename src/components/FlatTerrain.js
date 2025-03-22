import * as THREE from "three";

/**
 * A simple flat terrain component
 */
class FlatTerrain {
  constructor(size = 500, resolution = 32) {
    this.size = size;
    this.resolution = resolution;
    this.mesh = null;
    this.terrain = null;
    this.textures = {
      diffuse: null,
      normal: null,
      roughness: null
    };
  }

  /**
   * Initialize the terrain
   */
  init() {
    // Load textures first
    this.loadTextures();
    
    // Create a flat plane geometry
    const geometry = new THREE.PlaneGeometry(
      this.size,
      this.size,
      this.resolution,
      this.resolution
    );

    // Rotate to be horizontal (facing up)
    geometry.rotateX(-Math.PI / 2);

    // Create a material with textures
    const material = new THREE.MeshStandardMaterial({
      map: this.textures.diffuse,
      normalMap: this.textures.normal,
      roughnessMap: this.textures.roughness,
      normalScale: new THREE.Vector2(1.5, 1.5),
      side: THREE.DoubleSide,
      wireframe: false,
      roughness: 0.9,
      metalness: 0.02,
      color: 0x403a32,
      envMapIntensity: 0.15,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    
    // Set texture repeat based on terrain size
    const repeat = this.size / 20; // Adjust this value to control texture tiling
    if (this.textures.diffuse) {
      this.textures.diffuse.repeat.set(repeat, repeat);
      this.textures.diffuse.wrapS = this.textures.diffuse.wrapT = THREE.RepeatWrapping;
      this.textures.diffuse.colorSpace = THREE.SRGBColorSpace;
      this.textures.diffuse.anisotropy = 16;
    }
    if (this.textures.normal) {
      this.textures.normal.repeat.set(repeat, repeat);
      this.textures.normal.wrapS = this.textures.normal.wrapT = THREE.RepeatWrapping;
      this.textures.normal.anisotropy = 16;
    }
    if (this.textures.roughness) {
      this.textures.roughness.repeat.set(repeat, repeat);
      this.textures.roughness.wrapS = this.textures.roughness.wrapT = THREE.RepeatWrapping;
      this.textures.roughness.anisotropy = 16;
    }
    
    // Create a container for the terrain
    this.terrain = new THREE.Group();
    this.terrain.add(this.mesh);
  }
  
  /**
   * Load terrain textures
   */
  loadTextures() {
    const textureLoader = new THREE.TextureLoader();
    
    // Load diffuse (color) texture with proper settings
    this.textures.diffuse = textureLoader.load('/assets/textures/dirt/brown_mud_leaves_01_diff_2k.jpg');
    this.textures.diffuse.colorSpace = THREE.SRGBColorSpace;
    
    // Load normal map texture
    this.textures.normal = textureLoader.load('/assets/textures/dirt/brown_mud_leaves_01_nor_gl_2k.jpg');
    this.textures.normal.colorSpace = THREE.LinearSRGBColorSpace; // Normal maps should not use sRGB
    
    // Load roughness texture
    this.textures.roughness = textureLoader.load('/assets/textures/dirt/brown_mud_leaves_01_arm_2k.jpg');
    this.textures.roughness.colorSpace = THREE.LinearSRGBColorSpace; // Roughness maps should not use sRGB
    
    // Apply common settings to all textures
    [this.textures.diffuse, this.textures.normal, this.textures.roughness].forEach(texture => {
      if (texture) {
        texture.anisotropy = 16;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
      }
    });
  }

  /**
   * Add the terrain to a scene
   */
  addToScene(scene) {
    scene.add(this.terrain);
  }

  /**
   * Get height at the given X,Z coordinate (always 0 for flat terrain)
   */
  getHeightAtPosition(x, z) {
    return 0;
  }
}

export default FlatTerrain; 