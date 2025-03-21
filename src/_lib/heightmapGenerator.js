import * as THREE from "three";

/**
 * Generate a procedural heightmap using Perlin noise
 * @param {number} size Width/height of the heightmap in pixels
 * @param {number} scale Noise scale factor
 * @param {number} elevation Elevation factor for height
 * @param {number} iterations Number of noise iterations (octaves)
 * @returns {THREE.DataTexture} Heightmap texture
 */
export function generateHeightmap(size = 256, scale = 0.03, elevation = 1.0, iterations = 4) {
  // Create data array for the heightmap (R channel only)
  const data = new Float32Array(size * size);
  
  // Generate Perlin noise-like heightmap
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Initialize height
      let height = 0;
      
      // Multiple noise iterations with different frequencies
      let frequency = scale;
      let amplitude = 1.0;
      
      for (let i = 0; i < iterations; i++) {
        // Simple noise function (not true Perlin, but good enough for demo)
        const nx = x * frequency;
        const ny = y * frequency;
        
        // Improvised noise using sine functions
        const noise = Math.sin(nx) * Math.cos(ny) + 
                      Math.sin(nx * 0.7) * Math.cos(ny * 1.3) * 0.5;
        
        // Add to height with current amplitude
        height += noise * amplitude;
        
        // Increase frequency and decrease amplitude for next iteration
        frequency *= 2.0;
        amplitude *= 0.5;
      }
      
      // Normalize to 0-1 range
      height = (height + 1) * 0.5;
      
      // Apply elevation factor
      height = Math.pow(height, elevation);
      
      // Store in data array
      data[y * size + x] = height;
    }
  }
  
  // Create texture from data
  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RedFormat,
    THREE.FloatType
  );
  
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * Create a terrain mesh using a heightmap
 * @param {THREE.Texture} heightmap Heightmap texture
 * @param {number} width Width of the terrain
 * @param {number} height Height (max elevation) of the terrain
 * @param {number} segments Number of segments in the terrain grid
 * @returns {THREE.Mesh} Terrain mesh
 */
export function createTerrainMesh(heightmap, width = 100, height = 10, segments = 100) {
  // Create geometry
  const geometry = new THREE.PlaneGeometry(width, width, segments, segments);
  
  // Create material with heightmap
  const material = new THREE.MeshStandardMaterial({
    map: null,
    displacementMap: heightmap,
    displacementScale: height,
    wireframe: false,
    color: new THREE.Color(0.3, 0.5, 0.2),
    metalness: 0.1,
    roughness: 0.8,
    side: THREE.DoubleSide
  });
  
  // Create mesh
  const terrain = new THREE.Mesh(geometry, material);
  
  // Rotate to horizontal plane
  terrain.rotation.x = -Math.PI / 2;
  
  return terrain;
}

export default {
  generateHeightmap,
  createTerrainMesh
}; 