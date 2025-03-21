import * as THREE from "three";

/**
 * GrassComponent for rendering realistic grass on terrain
 */
class GrassComponent {
  /**
   * Create a new grass component
   * @param {Object} params Configuration parameters
   * @param {THREE.Scene} params.scene The Three.js scene
   * @param {THREE.Texture} params.heightmap Terrain height map
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
    this.heightmap = params.heightmap;
    this.terrainSize = params.terrainSize || 100;
    this.maxHeight = params.maxHeight || 1;
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
    this.grassWidth = 0.01;
    this.grassHeight = 0.5;
    
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
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      
      // Noise functions for wind effect
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      // Rotate vector around Y axis
      vec3 rotateY(float angle, vec3 v) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(c * v.x - s * v.z, v.y, s * v.x + c * v.z);
      }
      
      void main() {
        vUv = uv;
        
        // Calculate position in model space
        vec3 pos = position;
        
        // Get instance matrix and extract position, rotation, scale
        mat4 instanceMatrix = instanceMatrix;
        vec4 worldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        
        // Pass world position to fragment shader for lighting
        vWorldPosition = worldPos.xyz;
        
        // Calculate normalized height (0 at bottom, 1 at top)
        vHeight = position.y;
        
        // Apply wind effect - stronger at the top, none at the bottom
        float windStrength = 0.06 * vHeight;
        float windFrequency = 0.8;
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
        
        // Create rounded normals similar to the image technique
        // Determine width percent (how far from center we are)
        float widthPercent = abs(position.x / 0.075); // 0.075 is half blade width
        
        // Base normal for a flat plane facing forward (standard normal)
        vec3 grassVertexNormal = normal;
        
        // Create two rotated normals by rotating slightly around Y
        vec3 rotatedNormal1 = rotateY(3.14159 * 0.3, grassVertexNormal);
        vec3 rotatedNormal2 = rotateY(3.14159 * -0.3, grassVertexNormal);
        
        // Mix the two rotated normals based on width percent
        vec3 mixedNormal = mix(rotatedNormal1, rotatedNormal2, widthPercent);
        
        // Normalize to ensure proper length
        mixedNormal = normalize(mixedNormal);
        
        // Pass the rounded normal to fragment shader
        vNormal = normalMatrix * mixedNormal;
        
        // Transform with instance matrix
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
      }
    `;
    
    // Fragment shader for grass with afternoon lighting (2-3 hours before sunset)
    this.fragmentShader = `
      uniform float time;
      
      varying vec2 vUv;
      varying float vHeight;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      
      void main() {
        // Define sun direction (from positive X, higher in the sky to match main.js)
        vec3 sunDirection = normalize(vec3(1.0, 0.8, 0.2));
        
        // Brighter afternoon colors - less orange, more natural green
        vec3 tipColor = vec3(0.5, 0.8, 0.15);    // Bright green tips in sunlight
        vec3 midColor = vec3(0.4, 0.7, 0.1);     // Medium green
        vec3 rootColor = vec3(0.25, 0.45, 0.05); // Darker base
        
        // Afternoon sunlight - brighter, less golden
        vec3 sunlightColor = vec3(1.0, 0.95, 0.8); // Slightly warm but not orange
        
        // Use the varying normal that has the rounded effect
        vec3 normal = normalize(vNormal);
        
        // Calculate sun contribution with height variation using rounded normal
        float sunContribution = max(0.3, dot(normal, sunDirection));
        
        // Adjust sun contribution based on X position to match HDR sun from +X
        float sunPositionFactor = smoothstep(-150.0, 150.0, vWorldPosition.x) * 0.3 + 0.7;
        sunContribution *= sunPositionFactor;
        
        // Base color interpolated by height
        vec3 grassColor;
        if (vHeight < 0.5) {
            // Bottom half: root to mid
            grassColor = mix(rootColor, midColor, vHeight * 2.0);
        } else {
            // Top half: mid to tip
            grassColor = mix(midColor, tipColor, (vHeight - 0.5) * 2.0);
        }
        
        // Add sunlight influence - brighter, less dramatic than sunset
        vec3 litColor = mix(grassColor, grassColor * sunlightColor, sunContribution * 0.4);
        
        // Add gentle swaying color variation
        float colorNoise = sin(time * 0.3 + vWorldPosition.x * 0.05 + vWorldPosition.z * 0.05) * 0.03;
        
        // Final color with subtle noise
        vec3 finalColor = litColor * (1.0 + colorNoise);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
    
    console.log('Shaders loaded successfully');
    return true;
  }
  
  /**
   * Create the shader material using loaded shaders
   */
  createMaterial() {
    // Sun direction for sunset lighting (positive X, partially down)
    const sunDirection = new THREE.Vector3(0.8, 0.4, 0.0).normalize();
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      uniforms: {
        time: { value: 0 },
        heightmap: { value: this.heightmap },
        playerPosition: { value: new THREE.Vector3() },
        terrainSize: { value: this.terrainSize },
        maxHeight: { value: this.maxHeight },
        minHeight: { value: this.minHeight },
        heightOffset: { value: this.heightOffset },
        lodDistance: { value: this.lodDistance },
        maxLodDistance: { value: this.maxLodDistance },
        sunDirection: { value: sunDirection },
        sunColor: { value: new THREE.Color(1.0, 0.8, 0.4) } // Golden sunset color
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
      // Only show debug markers in development mode
      debugMarker.visible = false;
      this.scene.add(debugMarker);
      
      // Calculate number of grass blades in this patch
      const instanceCount = Math.floor(this.patchSize * this.patchSize * this.density);
      
      // Create grass blades using simple plane geometry with more segments for better bending
      const bladeGeometry = new THREE.PlaneGeometry(0.15, 1.5, 1, 8); // Added more vertical segments for smoother taper
      
      // Adjust vertices to create a sharp pointed tip
      const positions = bladeGeometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        const y = positions[i + 1];
        // Only modify vertices above the base
        if (y > 0) {
          const heightRatio = y / 1.5;
          
          // Make blade thinner as it gets higher, with sharper taper toward the tip
          const taperFactor = Math.pow(1.0 - heightRatio, 0.5); // Adjusted power curve for sharper taper
          positions[i] *= taperFactor;
          
          // Add a slight curve but maintain the sharp tip
          if (heightRatio < 0.9) {
            // Add curve to the lower 90% of the blade
            positions[i] += 0.03 * Math.sin(heightRatio * Math.PI);
          } else {
            // Make the tip extremely thin and sharp
            positions[i] *= (1.0 - heightRatio) * 5; // Gets very thin at the top
          }
        }
      }
      
      // Create instance matrices for each grass blade
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      
      // Create shader material with uniforms for afternoon lighting
      const grassMaterial = new THREE.ShaderMaterial({
        vertexShader: this.vertexShader,
        fragmentShader: this.fragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          time: { value: 0 },
          playerPos: { value: new THREE.Vector3() },
          sunDirection: { value: new THREE.Vector3(1.0, 0.8, 0.2).normalize() },
          sunColor: { value: new THREE.Color(1.0, 0.95, 0.8) },
          terrainSize: { value: this.terrainSize }
        }
      });
      
      // Create mesh with instanced geometry
      const instancedGrass = new THREE.InstancedMesh(
        bladeGeometry,
        grassMaterial,
        instanceCount
      );
      
      // Windows XP-style green color variations for afternoon lighting
      const grassColors = [
        new THREE.Color(0.4, 0.75, 0.1),   // Bright green
        new THREE.Color(0.45, 0.8, 0.15),  // Vibrant green
        new THREE.Color(0.35, 0.65, 0.1),  // Medium green
        new THREE.Color(0.3, 0.55, 0.05),  // Darker green
      ];
      
      // Place grass blades
      for (let i = 0; i < instanceCount; i++) {
        // Random position within patch
        const x = worldX + Math.random() * this.patchSize;
        const z = worldZ + Math.random() * this.patchSize;
        
        // Get height at this position
        const y = this.sampleHeight(x, z);
        
        // Set position
        position.set(x, y, z);
        
        // Vary rotation to make blade faces different directions
        // More blades facing the sunset (+X direction) will catch more light
        let facingSunsetFactor = 0;
        
        // 60% of blades somewhat aligned toward sun for better light catching
        if (Math.random() > 0.4) {
          // Rotation that somewhat faces the sunset (positive X)
          facingSunsetFactor = (Math.random() * 0.5) + 0.5; // 0.5 to 1.0
          quaternion.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), 
            Math.PI * (facingSunsetFactor + Math.random() * 0.3)
          );
        } else {
          // Random rotation
          quaternion.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), 
            Math.random() * Math.PI * 2
          );
        }
        
        // Random scale with height variation based on sunset exposure
        // Taller grass on areas exposed to sun (positive X side)
        const sunExposureFactor = (x > 0) ? 0.2 : 0;
        const height = 0.4 + Math.random() * 0.6 + sunExposureFactor; // Height between 0.4 and 1.0+
        const width = 0.1 + Math.random() * 0.15; // Thinner width between 0.1 and 0.25
        
        scale.set(width, height, 1);
        
        // Randomly select a color from the array with bias for sunlit areas
        let colorIndex;
        if (x > 0 && Math.random() > 0.4) {
          // Positive X (sunlit side) gets more yellow-green colors
          colorIndex = Math.floor(Math.random() * 2); // Use first two colors (more yellow)
        } else {
          // Otherwise use full range with bias toward darker colors for negative X
          colorIndex = Math.floor(Math.random() * grassColors.length);
          if (x < 0 && Math.random() > 0.5) {
            colorIndex = 3; // More dark green on shadowed side
          }
        }
        
        instancedGrass.setColorAt(i, grassColors[colorIndex]);
        
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
   * Update patches based on player position and camera field of view
   */
  updatePatches() {
    if (!this.playerObject) return;
    
    // Get player position
    const playerX = this.playerObject.position.x;
    const playerZ = this.playerObject.position.z;
    
    // Calculate player grid position
    const terrainHalfSize = this.terrainSize / 2;
    // Convert from world coordinates to grid coordinates
    const playerGridX = Math.floor((playerX + terrainHalfSize) / this.patchSize);
    const playerGridZ = Math.floor((playerZ + terrainHalfSize) / this.patchSize);
    
    console.log(`Player at grid position: (${playerGridX}, ${playerGridZ})`);
    
    // Track which patches should be active
    const shouldBeActive = new Set();
    
    // 1. ALWAYS create the four patches directly around the player (2x2 grid)
    for (let dx = 0; dx <= 1; dx++) {
      for (let dz = 0; dz <= 1; dz++) {
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
    
    // 2. Get camera for frustum calculations
    const camera = window.CAMERA ? window.CAMERA.camera : null;
    if (camera) {
      // Create temporary frustum to check visibility
      const frustum = new THREE.Frustum();
      const projScreenMatrix = new THREE.Matrix4();
      
      // Update projection matrix with current camera settings
      projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix, 
        camera.matrixWorldInverse
      );
      
      frustum.setFromProjectionMatrix(projScreenMatrix);
      
      // Extend render distance for patches within/near camera view
      const viewDistance = 4; // How many patches to check around player
      
      // Check patches in a square around player for visibility
      for (let dx = -viewDistance; dx <= viewDistance; dx++) {
        for (let dz = -viewDistance; dz <= viewDistance; dz++) {
          // Skip the 2x2 area around player (already added)
          if (dx >= 0 && dx <= 1 && dz >= 0 && dz <= 1) continue;
          
          const gridX = playerGridX + dx;
          const gridZ = playerGridZ + dz;
          
          // Make sure we stay within valid grid coordinates
          if (gridX >= 0 && gridX < this.gridSize && gridZ >= 0 && gridZ < this.gridSize) {
            // Calculate world position of patch center
            const worldX = (gridX * this.patchSize) - (this.terrainSize / 2) + (this.patchSize / 2);
            const worldZ = (gridZ * this.patchSize) - (this.terrainSize / 2) + (this.patchSize / 2);
            const worldY = this.sampleHeight(worldX, worldZ);
            
            // Create a bounding sphere for the patch
            const center = new THREE.Vector3(worldX, worldY, worldZ);
            const radius = this.patchSize * Math.SQRT2 / 2; // Diagonal distance / 2
            
            // Check if patch or its immediate surroundings are in or near frustum
            const sphere = new THREE.Sphere(center, radius * 1.5); // Slightly larger to catch nearby patches
            
            if (frustum.intersectsSphere(sphere)) {
              const key = `${gridX},${gridZ}`;
              shouldBeActive.add(key);
              
              // Create patch if it doesn't exist
              if (!this.activePatches.has(key)) {
                this.createPatch(gridX, gridZ);
              }
              
              // Also add patches 1 grid cell away from visible patches
              // This creates a buffer around the visible patches
              for (let nx = -1; nx <= 1; nx++) {
                for (let nz = -1; nz <= 1; nz++) {
                  if (nx === 0 && nz === 0) continue; // Skip the patch itself
                  
                  const neighborX = gridX + nx;
                  const neighborZ = gridZ + nz;
                  
                  if (neighborX >= 0 && neighborX < this.gridSize && 
                      neighborZ >= 0 && neighborZ < this.gridSize) {
                    const neighborKey = `${neighborX},${neighborZ}`;
                    shouldBeActive.add(neighborKey);
                    
                    // Create neighbor patch if it doesn't exist
                    if (!this.activePatches.has(neighborKey)) {
                      this.createPatch(neighborX, neighborZ);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      // Fallback if camera isn't accessible - just use a static render distance
      const renderDistance = 2;
      console.log(`Camera not found. Using fallback render distance: ${renderDistance} grid cells`);
      
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
   * Update the grass patches and animations
   * @param {number} deltaTime Time since last update in seconds
   */
  update(deltaTime) {
    // Update uniform time
    const worldTime = performance.now() * 0.001; // Convert to seconds
    
    // Add periodic updates here if needed
    setTimeout(() => {
      this.updatePatches();
    }, 500);
    
    // Update uniforms for all active grass patches
    this.activePatches.forEach(patch => {
      if (patch.mesh && patch.mesh.material && patch.mesh.material.uniforms) {
        // Update time uniform
        if (patch.mesh.material.uniforms.time) {
          patch.mesh.material.uniforms.time.value = worldTime;
        }
        
        // Update player position for interaction
        if (patch.mesh.material.uniforms.playerPos && this.playerObject) {
          patch.mesh.material.uniforms.playerPos.value.copy(this.playerObject.position);
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
    if (!this.heightmap) {
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
      
      // Check if we can access heightmap data directly (preferred method)
      if (this.heightmap.image && this.heightmap.image.data) {
        // Get image dimensions
        const width = this.heightmap.image.width || 256;
        const height = this.heightmap.image.height || 256;
        
        // Convert UV to pixel coordinates
        const pixelX = Math.floor(clampedUvX * (width - 1));
        const pixelZ = Math.floor(clampedUvZ * (height - 1));
        
        // Calculate pixel index in the data array
        const pixelIndex = pixelZ * width + pixelX;
        
        // Get height value (handle both Uint8 and Float32 formats)
        let heightValue;
        if (this.heightmap.image.data instanceof Float32Array) {
          // If using float format (0-1 range)
          heightValue = this.heightmap.image.data[pixelIndex];
        } else {
          // If using standard 8-bit format (0-255 range)
          heightValue = this.heightmap.image.data[pixelIndex] / 255.0;
        }
        
        // Scale by height range and add offset
        const calculatedHeight = this.minHeight + (heightValue * (this.maxHeight - this.minHeight)) + this.heightOffset;
        
        return calculatedHeight;
      } else {
        // Fallback to noise-based height calculation if image data can't be accessed
        // This gives us a wavy terrain for testing even if heightmap can't be accessed
        const heightNoise = Math.sin(worldX * 0.2) * Math.cos(worldZ * 0.2) * 0.5 + 0.5;
        const calculatedHeight = this.minHeight + heightNoise * (this.maxHeight - this.minHeight) + this.heightOffset;
        
        return calculatedHeight;
      }
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