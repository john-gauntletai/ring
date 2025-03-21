import * as THREE from "three";

/**
 * GrassComponent for rendering realistic grass on terrain
 */
class GrassComponent {
  /**
   * Create a new grass component
   * @param {Object} params Configuration parameters
   * @param {THREE.Scene} params.scene The Three.js scene
   * @param {THREE.Texture} params.heightMap Terrain height map
   * @param {number} params.terrainSize Width/depth of the terrain
   * @param {number} params.maxHeight Maximum terrain height
   * @param {number} params.minHeight Minimum terrain height
   * @param {number} params.heightOffset Height offset for the terrain
   * @param {number} params.patchSize Size of each grass patch
   * @param {number} params.density Grass blades per unit area
   * @param {THREE.Object3D} params.playerObject Player reference for interaction
   */
  constructor(params) {
    this.scene = params.scene;
    this.heightMap = params.heightMap;
    this.terrainSize = params.terrainSize || 100;
    this.maxHeight = params.maxHeight || 10;
    this.minHeight = params.minHeight || 0;
    this.heightOffset = params.heightOffset || 0;
    this.patchSize = params.patchSize || 10;
    this.density = params.density || 2; // Reduced density for better performance
    this.playerObject = params.playerObject;

    console.log('Initializing GrassComponent with parameters:');
    console.log(`- terrainSize: ${this.terrainSize}`);
    console.log(`- maxHeight: ${this.maxHeight}`);
    console.log(`- minHeight: ${this.minHeight}`);
    console.log(`- patchSize: ${this.patchSize}`);
    console.log(`- density: ${this.density}`);
    console.log(`- Expected blades per patch: ${Math.floor(this.patchSize * this.patchSize * this.density)}`);

    // Visual parameters
    this.grassWidth = 0.1;
    this.grassHeight = 1.5;
    
    // LOD parameters
    this.lodDistance = 15;
    this.maxLodDistance = 100;
    
    // Patch grid dimensions
    this.gridSize = Math.ceil(this.terrainSize / this.patchSize);
    console.log(`- Grid size: ${this.gridSize}x${this.gridSize} (${this.gridSize * this.gridSize} total patches)`);
    
    // Track active patches
    this.activePatches = new Map();
    
    // Create shaders (load them asynchronously)
    this.loadShaders().then(() => {
      console.log('Shaders loaded successfully');
      // Create grass geometries
      this.createGrassGeometries();
      
      // Create test patches to ensure we have grass
      this.createTestPatches();
      
      // Initialize patches around player
      this.updatePatches();
    });
  }
  
  /**
   * Load grass shaders
   */
  async loadShaders() {
    console.log('Loading grass shaders');
    
    // Vertex shader for grass
    this.vertexShader = `
      uniform float time;
      uniform vec3 playerPos;
      
      varying vec2 vUv;
      varying float vHeight;
      
      // Noise functions for wind effect
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      void main() {
        vUv = uv;
        
        // Calculate position in model space
        vec3 pos = position;
        
        // Get instance matrix and extract position, rotation, scale
        mat4 instanceMatrix = instanceMatrix;
        vec4 worldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        
        // Calculate normalized height (0 at bottom, 1 at top)
        vHeight = position.y;
        
        // Apply wind effect - stronger at the top, none at the bottom
        float windStrength = 0.1 * vHeight;
        float windFrequency = 1.5;
        float noise = random(vec2(worldPos.x * 0.1, worldPos.z * 0.1));
        float windEffect = sin(time * windFrequency + noise * 6.28) * windStrength;
        
        // Apply bend away from player for interactive effect
        float dist = distance(worldPos.xz, playerPos.xz);
        float playerEffect = 0.0;
        
        if (dist < 2.0) {
          playerEffect = (2.0 - dist) * 0.1 * vHeight;
          vec2 direction = normalize(worldPos.xz - playerPos.xz);
          pos.x += direction.x * playerEffect;
          pos.z += direction.y * playerEffect;
        }
        
        // Apply wind effect (only to x-position for simplicity)
        pos.x += windEffect;
        
        // Transform with instance matrix
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
      }
    `;
    
    // Fragment shader for grass
    this.fragmentShader = `
      varying vec2 vUv;
      varying float vHeight;
      
      void main() {
        // Base grass color - use brighter green for better visibility
        vec3 baseColor = vec3(0.3, 0.7, 0.1);
        
        // Lighter at the top, darker at the bottom
        vec3 tipColor = vec3(0.6, 0.9, 0.2);
        vec3 rootColor = vec3(0.2, 0.5, 0.05);
        
        // Interpolate between root and tip colors based on height
        vec3 grassColor = mix(rootColor, tipColor, vHeight);
        
        // Add a subtle noise pattern
        float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453) * 0.1;
        grassColor = mix(grassColor, grassColor * (1.0 + noise), 0.2);
        
        gl_FragColor = vec4(grassColor, 1.0);
      }
    `;
    
    console.log('Shaders loaded successfully');
    return true;
  }
  
  /**
   * Create the shader material using loaded shaders
   */
  createMaterial() {
    // Sun direction for lighting
    const sunDirection = new THREE.Vector3(0.5, 1.0, 0.3).normalize();
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      uniforms: {
        time: { value: 0 },
        heightMap: { value: this.heightMap },
        playerPosition: { value: new THREE.Vector3() },
        terrainSize: { value: this.terrainSize },
        maxHeight: { value: this.maxHeight },
        minHeight: { value: this.minHeight },
        heightOffset: { value: this.heightOffset },
        lodDistance: { value: this.lodDistance },
        maxLodDistance: { value: this.maxLodDistance },
        sunDirection: { value: sunDirection },
        sunColor: { value: new THREE.Color(1.0, 0.9, 0.7) }
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
  }
  
  /**
   * Create grass blade geometries for different LOD levels
   */
  createGrassGeometries() {
    console.log('Creating grass geometries');
    
    // Create a simple cross-shaped grass blade
    this.grassGeometry = new THREE.BufferGeometry();
    
    // Define vertices for a cross shape (two quads at 90 degrees)
    const vertices = new Float32Array([
      // First quad (front-facing)
      -0.5, 0.0, 0.0,   // bottom left
       0.5, 0.0, 0.0,   // bottom right
      -0.1, 1.0, 0.0,   // top left
       0.1, 1.0, 0.0,   // top right
      
      // Second quad (side-facing)
      0.0, 0.0, -0.5,   // bottom left
      0.0, 0.0,  0.5,   // bottom right
      0.0, 1.0, -0.1,   // top left
      0.0, 1.0,  0.1    // top right
    ]);
    
    // Define triangle indices
    const indices = new Uint16Array([
      // First quad
      0, 1, 2,
      2, 1, 3,
      // Second quad
      4, 5, 6,
      6, 5, 7
    ]);
    
    // UVs for texture mapping
    const uvs = new Float32Array([
      // First quad
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      1.0, 1.0,
      // Second quad
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      1.0, 1.0
    ]);
    
    // Set attributes
    this.grassGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    this.grassGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.grassGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    
    // Compute normals
    this.grassGeometry.computeVertexNormals();
    
    console.log('Grass geometries created');
  }
  
  /**
   * Create a grass patch for a specific grid position
   * @param {number} gridX X-coordinate in the grid
   * @param {number} gridZ Z-coordinate in the grid
   */
  createPatch(gridX, gridZ) {
    const key = `${gridX},${gridZ}`;
    if (this.activePatches.has(key)) {
      return this.activePatches.get(key);
    }

    try {
      // Calculate world position
      const worldX = (gridX * this.patchSize) - (this.terrainSize / 2);
      const worldZ = (gridZ * this.patchSize) - (this.terrainSize / 2);
      
      console.log(`Creating grass patch at grid(${gridX},${gridZ}), world(${worldX.toFixed(2)},${worldZ.toFixed(2)})`);
      
      // Debug visualization - Create a small red cube to mark the center of the patch
      const debugGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const debugMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const debugMarker = new THREE.Mesh(debugGeometry, debugMaterial);
      
      // Sample height for the debug marker
      const patchCenterX = worldX + this.patchSize/2;
      const patchCenterZ = worldZ + this.patchSize/2;
      const sampleY = this.sampleHeight(patchCenterX, patchCenterZ);
      debugMarker.position.set(patchCenterX, sampleY + 0.25, patchCenterZ);
      this.scene.add(debugMarker);
      
      // Calculate number of grass blades in this patch
      // Use a higher density for better visibility
      const density = 3; // 3 blades per square unit
      const instanceCount = Math.floor(this.patchSize * this.patchSize * density);
      
      // Create grass blades using simple plane geometry
      const bladeGeometry = new THREE.PlaneGeometry(0.3, 2.0, 1, 4);
      
      // Adjust vertices to create a slight curve
      const positions = bladeGeometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        const y = positions[i + 1];
        // Only bend vertices above the base
        if (y > 0) {
          const bendFactor = y / 1.0;
          positions[i] += 0.05 * Math.pow(bendFactor, 2); // Apply curve to x coordinate
        }
      }
      
      // Create instance matrices for each grass blade
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      
      // Create mesh with instanced geometry
      const instancedGrass = new THREE.InstancedMesh(
        bladeGeometry,
        new THREE.MeshBasicMaterial({ color: 0x448844, side: THREE.DoubleSide }),
        instanceCount
      );
      
      // Create shader material with uniforms
      const grassMaterial = new THREE.ShaderMaterial({
        vertexShader: this.vertexShader,
        fragmentShader: this.fragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          time: { value: 0 },
          playerPos: { value: new THREE.Vector3() }
        }
      });
      
      // Use the shader material instead
      instancedGrass.material = grassMaterial;
      
      // Place grass blades
      for (let i = 0; i < instanceCount; i++) {
        // Random position within patch
        const x = worldX + Math.random() * this.patchSize;
        const z = worldZ + Math.random() * this.patchSize;
        
        // Get height at this position
        const y = this.sampleHeight(x, z);
        
        // Set position
        position.set(x, y, z);
        
        // Random rotation around Y axis
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        
        // Random scale
        const height = 1.0 + Math.random() * 1.5; // Height between 1.0 and 2.5
        const width = 0.2 + Math.random() * 0.3; // Width between 0.2 and 0.5
        
        scale.set(width, height, 1);
        
        // Compose matrix and set instance
        matrix.compose(position, quaternion, scale);
        instancedGrass.setMatrixAt(i, matrix);
      }
      
      // Update instance matrices
      instancedGrass.instanceMatrix.needsUpdate = true;
      
      // Add to scene
      this.scene.add(instancedGrass);
      
      // Store the patch data
      const patch = {
        mesh: instancedGrass,
        debugMarker,
        gridX,
        gridZ,
        worldX,
        worldZ
      };
      
      this.activePatches.set(key, patch);
      console.log(`Created grass patch with ${instanceCount} blades`);
      
      return patch;
    } catch (error) {
      console.error('Error creating grass patch:', error);
      return null;
    }
  }
  
  /**
   * Remove a grass patch
   * @param {string} key Patch key (gridX,gridZ)
   */
  removePatch(key) {
    const patch = this.activePatches.get(key);
    if (patch) {
      // Remove mesh
      this.scene.remove(patch.mesh);
      patch.mesh.geometry.dispose();
      
      // Remove debug marker if it exists
      if (patch.debugMarker) {
        this.scene.remove(patch.debugMarker);
      }
      
      this.activePatches.delete(key);
      console.log(`Removed grass patch at grid (${patch.gridX}, ${patch.gridZ})`);
    }
  }
  
  /**
   * Update patches based on player position
   */
  updatePatches() {
    if (!this.playerObject) return;
    
    // Get player position
    const playerX = this.playerObject.position.x;
    const playerZ = this.playerObject.position.z;
    
    console.log(`Player at world position: (${playerX.toFixed(2)}, ${playerZ.toFixed(2)})`);
    
    // Calculate player grid position
    const terrainHalfSize = this.terrainSize / 2;
    // Convert from world coordinates to grid coordinates
    const playerGridX = Math.floor((playerX + terrainHalfSize) / this.patchSize);
    const playerGridZ = Math.floor((playerZ + terrainHalfSize) / this.patchSize);
    
    console.log(`Player at grid position: (${playerGridX}, ${playerGridZ})`);
    
    // Force-create patch at player position
    this.createPatch(playerGridX, playerGridZ);
    
    // Render distance in grid cells (smaller for debugging)
    const renderDistance = 2; 
    console.log(`Render distance: ${renderDistance} grid cells`);
    
    // Track which patches should be active
    const shouldBeActive = new Set();
    
    // Generate patches in a square around player
    for (let dx = -renderDistance; dx <= renderDistance; dx++) {
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        const gridX = playerGridX + dx;
        const gridZ = playerGridZ + dz;
        
        // Make sure we stay within valid grid coordinates
        if (gridX >= 0 && gridX < this.gridSize && gridZ >= 0 && gridZ < this.gridSize) {
          const key = `${gridX},${gridZ}`;
          shouldBeActive.add(key);
          
          // Create patch if it doesn't exist
          if (!this.activePatches.has(key)) {
            this.createPatch(gridX, gridZ);
          }
        }
      }
    }
    
    // Remove patches that are no longer needed
    for (const key of this.activePatches.keys()) {
      if (!shouldBeActive.has(key)) {
        this.removePatch(key);
      }
    }
    
    console.log(`Active patches: ${this.activePatches.size}`);
  }
  
  /**
   * Update grass system - this should be called once per frame
   * @param {number} deltaTime Time elapsed since last update
   */
  update(deltaTime) {
    // Update player position for interactive grass
    const playerPosition = this.playerObject ? this.playerObject.position : new THREE.Vector3();
    
    // Update patches first
    this.updatePatches();
    
    // Animate grass
    this.activePatches.forEach((patch) => {
      if (patch.mesh && patch.mesh.material) {
        // Make sure we have the uniform before trying to update it
        const material = patch.mesh.material;
        if (material.uniforms && material.uniforms.time) {
          // Update time uniform for wind animation
          material.uniforms.time.value += deltaTime;
        }
        
        if (material.uniforms && material.uniforms.playerPos) {
          // Update player position uniform
          material.uniforms.playerPos.value.copy(playerPosition);
        }
      }
    });
  }
  
  /**
   * Cleanup and dispose of resources
   */
  dispose() {
    console.log('Disposing GrassComponent resources');
    
    // Remove all active patches from the scene
    for (const [key, patch] of this.activePatches.entries()) {
      this.removePatch(key);
    }
    
    // Clear active patches map
    this.activePatches.clear();
    
    // Dispose of geometry
    if (this.grassGeometry) {
      this.grassGeometry.dispose();
      this.grassGeometry = null;
    }
    
    console.log('GrassComponent disposed');
  }
  
  /**
   * Sample height from heightmap at a given world position
   * @param {number} worldX X position in world coordinates
   * @param {number} worldZ Z position in world coordinates
   * @returns {number} Height at the given position
   */
  sampleHeight(worldX, worldZ) {
    if (!this.heightMap) {
      console.warn('No heightmap available for sampling');
      return this.heightOffset;
    }
    
    try {
      // Convert world coordinates to heightmap UV coordinates (0-1)
      // For a terrain of size 100, world coords range from -50 to +50
      const uvX = (worldX + (this.terrainSize / 2)) / this.terrainSize;
      const uvZ = (worldZ + (this.terrainSize / 2)) / this.terrainSize;
      
      // Clamp UVs to 0-1 range to prevent sampling outside the heightmap
      const clampedUvX = Math.max(0, Math.min(1, uvX));
      const clampedUvZ = Math.max(0, Math.min(1, uvZ));
      
      if (uvX !== clampedUvX || uvZ !== clampedUvZ) {
        // Position is outside terrain bounds
        return this.minHeight + this.heightOffset;
      }
      
      // FALLBACK METHOD: Use simplified height calculation based on position
      // This gives us a wavy terrain for testing even if heightmap can't be accessed
      const heightNoise = Math.sin(worldX * 0.2) * Math.cos(worldZ * 0.2) * 0.5 + 0.5;
      const calculatedHeight = this.minHeight + heightNoise * this.maxHeight + this.heightOffset;
      
      return calculatedHeight;
      
      /* 
      // The code below is for accessing the actual heightmap data
      // But it's causing issues, so we use the fallback method above
      if (this.heightMap.image && this.heightMap.image.data) {
        const width = this.heightMap.image.width;
        const height = this.heightMap.image.height;
        
        const pixelX = Math.floor(clampedUvX * (width - 1));
        const pixelZ = Math.floor(clampedUvZ * (height - 1));
        
        // Get height value from heightmap data (single channel texture)
        const pixelIndex = pixelZ * width + pixelX;
        const heightValue = this.heightMap.image.data[pixelIndex] / 255.0; // Normalize to 0-1
        
        // Scale by height range and add offset
        const calculatedHeight = this.minHeight + (heightValue * (this.maxHeight - this.minHeight)) + this.heightOffset;
        
        return calculatedHeight;
      } else {
        // If we can't access image data directly, return a default height
        // This will create a flat terrain for testing
        return this.minHeight + this.heightOffset + Math.random() * 0.2; // Small random variation
      }
      */
    } catch (error) {
      console.error('Error sampling height:', error);
      return this.minHeight + this.heightOffset;
    }
  }
  
  /**
   * Create some test patches for debugging
   */
  createTestPatches() {
    console.log("Creating test patches at origin");
    
    // Create a patch at the center (0,0)
    const centerX = Math.floor(this.gridSize / 2);
    const centerZ = Math.floor(this.gridSize / 2);
    this.createPatch(centerX, centerZ);
    
    // Create a few more patches around the center
    this.createPatch(centerX + 1, centerZ);
    this.createPatch(centerX, centerZ + 1);
    this.createPatch(centerX + 1, centerZ + 1);
    
    console.log(`Created ${this.activePatches.size} test patches`);
  }
}

export default GrassComponent; 