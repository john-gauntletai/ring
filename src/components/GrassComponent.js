import * as THREE from "three";

// Constants for grass configuration
const NUM_GRASS = 70 * 70; // Reduced blade count per patch for better performance
const GRASS_SEGMENTS_LOW = 1; // Low LOD segments
const GRASS_SEGMENTS_HIGH = 4; // Reduced high LOD segments for better performance
const GRASS_VERTICES_LOW = (GRASS_SEGMENTS_LOW + 1) * 2;
const GRASS_VERTICES_HIGH = (GRASS_SEGMENTS_HIGH + 1) * 2;
const GRASS_LOD_DIST = 7; // Increased LOD distance for better performance
const GRASS_MAX_DIST = 150; // Reduced max distance to avoid unnecessary rendering
const GRASS_PATCH_SIZE = 10; // Size of each grass patch
const GRASS_WIDTH = 0.05; // Increased width from 0.02 to 0.03 for slightly thicker blades
const GRASS_HEIGHT = 0.9; // Increased grass blade height from 0.9 to 1.1 for taller grass
// More reasonable patch radius for performance while ensuring coverage
const PATCH_RADIUS = 9; // Standard patch radius for areas in front of player
const BEHIND_PATCH_RADIUS = 3; // Reduced patch radius for areas behind player
const TERRAIN_SIZE = 300; // Match the terrain size for full coverage

class GrassComponent {
  constructor(scene, playerObject) {
    this.scene = scene;
    this.playerObject = playerObject;

    // Create container for all grass objects
    this.grassGroup = new THREE.Group();
    this.grassGroup.name = "GRASS";

    // Initialize arrays for both LOD levels
    this.meshesLow = [];
    this.meshesHigh = [];

    // Track time for animation
    this.totalTime = 0;

    // Materials and geometries will be initialized in init()
    this.grassMaterialLow = null;
    this.grassMaterialHigh = null;
    this.geometryLow = null;
    this.geometryHigh = null;

    // Flag to track if initial patches have been created
    this.initialized = false;

    // Stats tracking
    this.statsTimer = 0;
    this.statsInterval = 5.0; // Log stats every 5 seconds
    this.lastPatchCount = 0;
    this.lastBladeCount = 0;
  }

  /**
   * Helper function to generate deterministic noise from a position
   * Used for spatial color variation to avoid checkerboard patterns
   */
  noise(position) {
    // Simple 2D noise function based on sin
    return Math.abs(
      Math.sin(
        this.dot(position, new THREE.Vector2(12.9898, 78.233)) * 43758.5453
      ) % 1
    );
  }

  /**
   * Helper function to calculate dot product
   */
  dot(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
  }

  /**
   * Initialize the grass component
   */
  init() {
    // Add grass group to scene
    this.scene.add(this.grassGroup);

    // Create shader materials for both LOD levels
    this.createMaterials();

    // Create geometries for both LOD levels
    this.geometryLow = this.createGeometry(GRASS_SEGMENTS_LOW);
    this.geometryHigh = this.createGeometry(GRASS_SEGMENTS_HIGH);

    // Initial update to place grass around the starting position
    if (this.playerObject) {
      const dummyCamera = {
        position: new THREE.Vector3(0, 2, 0),
        projectionMatrix: new THREE.Matrix4(),
        matrixWorldInverse: new THREE.Matrix4(),
      };
      this.updateGrassPatches(dummyCamera);
    }
  }

  /**
   * Create materials for grass rendering
   */
  createMaterials() {
    // Create shader materials for both LOD levels
    this.grassMaterialLow = this.createGrassMaterial(
      GRASS_SEGMENTS_LOW,
      GRASS_VERTICES_LOW
    );
    this.grassMaterialHigh = this.createGrassMaterial(
      GRASS_SEGMENTS_HIGH,
      GRASS_VERTICES_HIGH
    );
  }

  /**
   * Create a grass material with appropriate shader settings
   */
  createGrassMaterial(segments, vertices) {
    // Create shader material
    const material = new THREE.ShaderMaterial({
      vertexShader: this.getGrassVertexShader(),
      fragmentShader: this.getGrassFragmentShader(),
      uniforms: {
        time: { value: 0.0 },
        playerPosition: { value: new THREE.Vector3() },
        sunDirection: { value: new THREE.Vector3(0.75, 0.6, 0.15).normalize() },
        sunColor: { value: new THREE.Vector3(1.0, 0.9, 0.7) },
        terrainSize: { value: GRASS_PATCH_SIZE * 10 },
        maxHeight: { value: GRASS_HEIGHT },
        minHeight: { value: 0.0 },
        heightOffset: { value: 0.0 },
        lodDistance: { value: GRASS_LOD_DIST },
        maxLodDistance: { value: GRASS_MAX_DIST },
        grassParams: {
          value: new THREE.Vector4(segments, vertices, GRASS_HEIGHT, 0.0),
        },
        grassSize: { value: new THREE.Vector2(GRASS_WIDTH, GRASS_HEIGHT) },
      },
      side: THREE.DoubleSide, // Important: render both sides of the geometry
      transparent: false,
      alphaTest: 0.0,
      depthWrite: true,
      depthTest: true,
      flatShading: false, // Use smooth shading for better appearance
    });

    return material;
  }

  /**
   * Create geometry for grass blades
   */
  createGeometry(segments) {
    // Create instanced buffer geometry for efficient rendering
    const geometry = new THREE.InstancedBufferGeometry();

    // Create basic blade geometry as a cross shape for better visibility from all angles
    const positions = [];
    const indices = [];
    const normals = [];
    const uvs = [];

    // Create vertices for a single blade with specified segments
    const vertexCount = (segments + 1) * 4; // 4 vertices per segment for cross shape

    // Generate indices for the blade triangles (two perpendicular quads)
    for (let i = 0; i < segments; i++) {
      const vi = i * 4;

      // First quad (front-back)
      indices.push(vi + 0);
      indices.push(vi + 1);
      indices.push(vi + 4);

      indices.push(vi + 4);
      indices.push(vi + 1);
      indices.push(vi + 5);

      // Second quad (left-right, perpendicular to first)
      indices.push(vi + 2);
      indices.push(vi + 3);
      indices.push(vi + 6);

      indices.push(vi + 6);
      indices.push(vi + 3);
      indices.push(vi + 7);
    }

    // Create blade vertices - cross shape with two perpendicular quads
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      // Calculate width with a curve that makes the base thicker
      // Root is 40% thicker than the standard width, then tapers up
      const baseFactor = 1.4 - t * 0.7; // 1.4 at base (t=0), then tapers to 0.7 at tip (t=1)

      // Additional aggressive taper for the top portion
      const tipTaper = t > 0.6 ? 1.0 - ((t - 0.6) * 0.6) / 0.4 : 1.0;

      // Combined taper effect: thicker at base, standard in middle, thin at tip
      const width = baseFactor * tipTaper;

      // First plane (front-back) - slightly wider width with base thickening
      positions.push(-0.5 * width * 0.7, t, 0); // left vertex, now 30% thinner instead of 40%
      positions.push(0.5 * width * 0.7, t, 0); // right vertex, now 30% thinner instead of 40%

      // Second plane (left-right, perpendicular to first) - slightly wider width with base thickening
      positions.push(0, t, -0.5 * width * 0.7); // back vertex, now 30% thinner instead of 40%
      positions.push(0, t, 0.5 * width * 0.7); // front vertex, now 30% thinner instead of 40%

      // Normals - different for each plane
      normals.push(0, 0, 1); // first plane normal
      normals.push(0, 0, 1);

      normals.push(1, 0, 0); // second plane normal
      normals.push(1, 0, 0);

      // UVs
      uvs.push(0, t);
      uvs.push(1, t);
      uvs.push(0, t);
      uvs.push(1, t);
    }

    // Set geometry attributes
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3)
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    // Create instanced attributes for position, height, width, color, and randomness
    const instancePositions = new Float32Array(NUM_GRASS * 3);
    const instanceHeights = new Float32Array(NUM_GRASS);
    const instanceWidths = new Float32Array(NUM_GRASS);
    const instanceColors = new Float32Array(NUM_GRASS * 3);
    const instanceBend = new Float32Array(NUM_GRASS);
    const instanceRandom = new Float32Array(NUM_GRASS);
    const instanceDepth = new Float32Array(NUM_GRASS); // Add depth offset for z-fighting prevention

    // Initialize with random values - more uniform distribution with less variation
    for (let i = 0; i < NUM_GRASS; i++) {
      // Random position within patch, with better distribution
      // Use a grid-based approach to avoid clumping
      const gridSize = Math.sqrt(NUM_GRASS);
      const gridX = Math.floor(i % gridSize) / gridSize - 0.5;
      const gridZ = Math.floor(i / gridSize) / gridSize - 0.5;

      // Add just a small amount of jitter within the grid cell
      instancePositions[i * 3] =
        (gridX + (Math.random() * 0.5 - 0.25) / gridSize) * GRASS_PATCH_SIZE;
      instancePositions[i * 3 + 1] = 0; // Flat terrain
      instancePositions[i * 3 + 2] =
        (gridZ + (Math.random() * 0.5 - 0.25) / gridSize) * GRASS_PATCH_SIZE;

      // Less height variation (0.8 to 1.1 of base height)
      instanceHeights[i] = 0.8 + Math.random() * 0.3;

      // Width variation for thicker blades
      instanceWidths[i] = 0.6 + Math.random() * 0.2;

      // Generate a lower frequency noise pattern for more coherent spatial variation
      const noiseScale1 = 0.05; // Large scale variation
      const noiseScale2 = 0.15; // Medium scale variation
      const noiseScale3 = 0.4; // Small scale variation

      // Sample noise at multiple frequencies for more natural pattern
      const noise1 = this.noise(
        new THREE.Vector2(
          instancePositions[i * 3] * noiseScale1,
          instancePositions[i * 3 + 2] * noiseScale1
        )
      );

      const noise2 = this.noise(
        new THREE.Vector2(
          instancePositions[i * 3] * noiseScale2 + 43.3,
          instancePositions[i * 3 + 2] * noiseScale2 + 17.1
        )
      );

      const noise3 = this.noise(
        new THREE.Vector2(
          instancePositions[i * 3] * noiseScale3 + 87.2,
          instancePositions[i * 3 + 2] * noiseScale3 + 33.7
        )
      );

      // Combine noise at different scales for natural-looking clumps
      // Weight toward the larger patterns for more coherent grouping
      const spatialFactor = noise1 * 0.6 + noise2 * 0.3 + noise3 * 0.1;

      // Add some pure randomness to break up any remaining patterns (40% random, 60% spatial)
      const colorType = Math.random() * 0.4 + spatialFactor * 0.6;

      if (colorType < 0.2) {
        // Main grass color - lush green (20% of blades)
        instanceColors[i * 3] = 0.07 + Math.random() * 0.05; // R: 0.07-0.12 (reduced red for more intense green)
        instanceColors[i * 3 + 1] = 0.48 + Math.random() * 0.14; // G: 0.48-0.62 (increased green)
        instanceColors[i * 3 + 2] = 0.02 + Math.random() * 0.03; // B: 0.02-0.05 (minimal blue)
      } else if (colorType < 0.6) {
        // Yellowish-green variation (40% of blades)
        instanceColors[i * 3] = 0.22 + Math.random() * 0.08; // R: 0.22-0.30 (increased red for more yellow)
        instanceColors[i * 3 + 1] = 0.42 + Math.random() * 0.14; // G: 0.42-0.56 (similar green)
        instanceColors[i * 3 + 2] = 0.01 + Math.random() * 0.02; // B: 0.01-0.03 (minimal blue)
      } else if (colorType < 0.85) {
        // Darker green variation (25% of blades)
        instanceColors[i * 3] = 0.04 + Math.random() * 0.04; // R: 0.04-0.08 (minimal red for darker green)
        instanceColors[i * 3 + 1] = 0.3 + Math.random() * 0.1; // G: 0.30-0.40 (reduced green for darker green)
        instanceColors[i * 3 + 2] = 0.01 + Math.random() * 0.02; // B: 0.01-0.03 (minimal blue)
      } else {
        // Light sun-bleached tips (15% of blades)
        instanceColors[i * 3] = 0.28 + Math.random() * 0.1; // R: 0.28-0.38 (increased red for more golden)
        instanceColors[i * 3 + 1] = 0.52 + Math.random() * 0.15; // G: 0.52-0.67 (increased green)
        instanceColors[i * 3 + 2] = 0.06 + Math.random() * 0.08; // B: 0.06-0.14 (slightly more blue for beige tint)
      }

      // Add positional variation to blend between adjacent color types for smoother transitions
      // Use different frequency noise for blending than for color type selection
      const blendNoise = this.noise(
        new THREE.Vector2(
          instancePositions[i * 3] * 0.25 + 123.4,
          instancePositions[i * 3 + 2] * 0.25 + 87.6
        )
      );

      // Create more continuous blending across color categories
      const blendFactor = blendNoise * 0.2;

      // Apply subtle blending between color types based on position
      // This creates smoother transitions between color zones
      if (colorType < 0.3) {
        // Near the boundary between lush green and yellowish-green
        // Create a smooth transition between these types
        const transitionFactor = colorType / 0.3; // 0-1.0 as we approach the boundary
        const edgeBlend = transitionFactor * blendFactor;

        // Blend colors proportionally to boundary proximity
        instanceColors[i * 3] += edgeBlend * 0.12; // Increase red (moving toward yellow)
        instanceColors[i * 3 + 1] -= edgeBlend * 0.04; // Slightly decrease green
      } else if (colorType < 0.7) {
        // Near boundary between yellowish-green and darker green
        const transitionFactor = (colorType - 0.3) / 0.4; // 0-1.0 as we approach the boundary
        const edgeBlend =
          (1.0 - Math.abs(transitionFactor - 0.5) * 2.0) * blendFactor;

        // Blend colors based on transition factor
        instanceColors[i * 3] -= edgeBlend * 0.1; // Adjust red toward darker green
        instanceColors[i * 3 + 1] -= edgeBlend * 0.05; // Decrease green slightly
      } else {
        // Near boundary between darker green and sun-bleached
        const transitionFactor = (colorType - 0.7) / 0.3; // 0-1.0 as we approach the boundary
        const edgeBlend = transitionFactor * blendFactor;

        // Blend toward sun-bleached color
        instanceColors[i * 3] += edgeBlend * 0.14; // Increase red significantly
        instanceColors[i * 3 + 1] += edgeBlend * 0.12; // Increase green
        instanceColors[i * 3 + 2] += edgeBlend * 0.04; // Increase blue slightly
      }

      // Add slight random variation to each color to further break up patterns
      instanceColors[i * 3] += (Math.random() - 0.5) * 0.03;
      instanceColors[i * 3 + 1] += (Math.random() - 0.5) * 0.03;
      instanceColors[i * 3 + 2] += (Math.random() - 0.5) * 0.01;

      // Add positional variation - grass near patch edges slightly different color
      const distFromCenter = Math.sqrt(gridX * gridX + gridZ * gridZ) * 2; // 0 at center, ~1 at edges

      // Edges slightly more yellow/dry
      if (distFromCenter > 0.7) {
        const edgeFactor = (distFromCenter - 0.7) / 0.3; // 0-1 scale for outer 30%
        instanceColors[i * 3] += edgeFactor * 0.08; // More red at edges
        instanceColors[i * 3 + 1] -= edgeFactor * 0.05; // Less green at edges
      }

      // Moderate bend factor for less dramatic wind movement
      instanceBend[i] = 0.3 + Math.random() * 0.4;

      // Random value for misc effects (kept for compatibility)
      instanceRandom[i] = Math.random();

      // Random depth offset to prevent z-fighting between grass blades
      instanceDepth[i] = Math.random();
    }

    // Set instanced attributes
    geometry.setAttribute(
      "instancePosition",
      new THREE.InstancedBufferAttribute(instancePositions, 3)
    );
    geometry.setAttribute(
      "instanceHeight",
      new THREE.InstancedBufferAttribute(instanceHeights, 1)
    );
    geometry.setAttribute(
      "instanceWidth",
      new THREE.InstancedBufferAttribute(instanceWidths, 1)
    );
    geometry.setAttribute(
      "instanceColor",
      new THREE.InstancedBufferAttribute(instanceColors, 3)
    );
    geometry.setAttribute(
      "instanceBend",
      new THREE.InstancedBufferAttribute(instanceBend, 1)
    );
    geometry.setAttribute(
      "instanceRandom",
      new THREE.InstancedBufferAttribute(instanceRandom, 1)
    );
    geometry.setAttribute(
      "instanceDepth",
      new THREE.InstancedBufferAttribute(instanceDepth, 1)
    );

    // Set instance count
    geometry.instanceCount = NUM_GRASS;

    return geometry;
  }

  /**
   * Create a new grass mesh using the appropriate LOD level
   */
  createMesh(distToCamera) {
    // Select appropriate geometry and material based on distance
    const isLowDetail = distToCamera > GRASS_LOD_DIST;
    const geometry = isLowDetail ? this.geometryLow : this.geometryHigh;
    const material = isLowDetail
      ? this.grassMaterialLow
      : this.grassMaterialHigh;

    // Create new mesh
    const mesh = new THREE.Mesh(geometry, material);

    // Store LOD type for updates
    mesh.userData.isLowDetail = isLowDetail;

    // Disable frustum culling on the mesh so it's always rendered
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;

    // Set a high render order to ensure grass renders after terrain
    mesh.renderOrder = 2000;

    // Apply a small y-offset to prevent z-fighting with terrain
    mesh.position.y = 0.01;

    // Add to scene
    this.grassGroup.add(mesh);

    // Store in appropriate array for tracking
    if (isLowDetail) {
      this.meshesLow.push(mesh);
    } else {
      this.meshesHigh.push(mesh);
    }

    return mesh;
  }

  /**
   * Update grass (animation, LOD, etc.)
   */
  update(delta, camera, shouldLog = false) {
    // Update time for animation
    this.totalTime += delta;

    // Update stats timer
    this.statsTimer += delta;

    // Update uniforms
    this.grassMaterialLow.uniforms.time.value = this.totalTime;
    this.grassMaterialHigh.uniforms.time.value = this.totalTime;

    // Update player position for grass interaction
    if (this.playerObject) {
      // Handle different player object structures
      let playerPos;
      if (this.playerObject.position) {
        playerPos = this.playerObject.position.clone();
      } else if (this.playerObject.model && this.playerObject.model.position) {
        playerPos = this.playerObject.model.position.clone();
      } else {
        playerPos = new THREE.Vector3();
      }

      // Set position in shader uniforms
      this.grassMaterialLow.uniforms.playerPosition.value.copy(playerPos);
      this.grassMaterialHigh.uniforms.playerPosition.value.copy(playerPos);
    }

    // Update LOD for existing patches
    this.updateLOD(camera, shouldLog);

    // Update grass patch visibility based on camera and player position
    // Do this every frame since camera view and player position change frequently
    this.updateGrassPatches(camera, shouldLog);

    // Log stats at regular intervals
    if (this.statsTimer >= this.statsInterval) {
      this.logRenderingStats();
      this.statsTimer = 0; // Reset timer
    }
  }

  /**
   * Update LOD levels for existing patches based on camera distance
   */
  updateLOD(camera, shouldLog) {
    let lodSwitches = 0;

    // Update LOD for all patches based on current camera position
    for (const mesh of this.grassGroup.children) {
      const distToCamera = camera.position.distanceTo(mesh.position);
      const shouldBeLowDetail = distToCamera > GRASS_LOD_DIST;

      // Check if we need to switch LOD
      if (mesh.userData.isLowDetail !== shouldBeLowDetail) {
        // Get current arrays
        const fromArray = mesh.userData.isLowDetail
          ? this.meshesLow
          : this.meshesHigh;
        const toArray = mesh.userData.isLowDetail
          ? this.meshesHigh
          : this.meshesLow;

        // Remove from old array
        const index = fromArray.indexOf(mesh);
        if (index !== -1) {
          fromArray.splice(index, 1);
        }

        // Update mesh
        mesh.geometry = shouldBeLowDetail
          ? this.geometryLow
          : this.geometryHigh;
        mesh.material = shouldBeLowDetail
          ? this.grassMaterialLow
          : this.grassMaterialHigh;
        mesh.userData.isLowDetail = shouldBeLowDetail;

        // Add to new array
        toArray.push(mesh);

        lodSwitches++;
      }
    }

    if (shouldLog && lodSwitches > 0) {
      console.log(`LOD updates: ${lodSwitches}`);
    }
  }

  /**
   * Update grass patches based on camera position
   */
  updateGrassPatches(camera, shouldLog = false) {
    // Get the player position or use camera position if player not available
    let playerPos;
    let playerDir;

    if (this.playerObject) {
      if (this.playerObject.position) {
        playerPos = this.playerObject.position.clone();
        // Get player direction from model's forward vector (Z-axis in local space)
        if (this.playerObject.model) {
          const forward = new THREE.Vector3(0, 0, 1);
          forward.applyQuaternion(this.playerObject.model.quaternion);
          playerDir = forward.normalize();
        } else {
          // Default direction is looking forward along z-axis
          playerDir = new THREE.Vector3(0, 0, 1);
        }
      } else if (this.playerObject.model && this.playerObject.model.position) {
        playerPos = this.playerObject.model.position.clone();
        // Get player direction from model's forward vector (Z-axis in local space)
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.playerObject.model.quaternion);
        playerDir = forward.normalize();
      } else {
        playerPos = camera.position.clone();
        // Use camera direction if player direction not available
        playerDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
          camera.quaternion
        );
      }
    } else {
      playerPos = camera.position.clone();
      // Use camera direction if player not available
      playerDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion
      );
    }

    // Ensure Y is 0 for flat terrain
    playerPos.y = 0;
    playerDir.y = 0;
    playerDir.normalize();

    // Create frustum for camera view culling
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // Track all existing patches by their position string key
    const existingPatchPositions = new Map();
    for (const mesh of this.grassGroup.children) {
      const key = `${Math.round(mesh.position.x)},${Math.round(
        mesh.position.z
      )}`;
      existingPatchPositions.set(key, mesh);

      // Start by hiding all patches - we'll show only the ones we need
      mesh.visible = false;
    }

    let visiblePatches = 0;
    let playerPatchX = Math.round(playerPos.x / GRASS_PATCH_SIZE);
    let playerPatchZ = Math.round(playerPos.z / GRASS_PATCH_SIZE);

    // Calculate terrain coverage in patch units
    const terrainHalfSize = TERRAIN_SIZE / 2;
    const minPatchX = Math.floor(-terrainHalfSize / GRASS_PATCH_SIZE);
    const maxPatchX = Math.ceil(terrainHalfSize / GRASS_PATCH_SIZE);
    const minPatchZ = Math.floor(-terrainHalfSize / GRASS_PATCH_SIZE);
    const maxPatchZ = Math.ceil(terrainHalfSize / GRASS_PATCH_SIZE);

    // Create a complete grid of patches covering the entire terrain
    for (let x = minPatchX; x <= maxPatchX; x++) {
      for (let z = minPatchZ; z <= maxPatchZ; z++) {
        // Calculate patch center position
        const patchPos = new THREE.Vector3(
          x * GRASS_PATCH_SIZE,
          0, // Flat terrain
          z * GRASS_PATCH_SIZE
        );

        // Create a key for this position to check if we already have this patch
        const key = `${Math.round(patchPos.x)},${Math.round(patchPos.z)}`;

        // Determine if this patch is within the standard or reduced radius
        const relativePos = new THREE.Vector3().subVectors(patchPos, playerPos);

        // Determine if the patch is behind the player using dot product
        const dotProduct = relativePos.dot(playerDir);
        const isBehindPlayer = dotProduct < 0;

        // Calculate distance in patch units
        const patchDistanceX = Math.abs(x - playerPatchX);
        const patchDistanceZ = Math.abs(z - playerPatchZ);
        const patchDistance = Math.max(patchDistanceX, patchDistanceZ);

        // Use different patch radius depending on direction
        const effectiveRadius = isBehindPlayer
          ? BEHIND_PATCH_RADIUS
          : PATCH_RADIUS;

        // Skip patches that are too far from player based on the effective radius
        if (patchDistance > effectiveRadius) {
          // Create bounding box for frustum test
          const box = new THREE.Box3();
          box.setFromCenterAndSize(
            patchPos,
            new THREE.Vector3(
              GRASS_PATCH_SIZE,
              GRASS_HEIGHT * 2,
              GRASS_PATCH_SIZE
            )
          );

          // Check if it's in the view frustum
          // Keep patches in frustum regardless of distance
          let isInFrustum = frustum.intersectsBox(box);

          // Skip if not in frustum and beyond effective radius
          if (!isInFrustum) {
            continue;
          }
        }

        // Get or create the mesh for this patch
        let mesh;

        // If we already have this patch, reuse it
        if (existingPatchPositions.has(key)) {
          mesh = existingPatchPositions.get(key);
          existingPatchPositions.delete(key); // Remove from map since we're using it
        } else {
          // Create a new mesh for this position
          const distToCamera = camera.position.distanceTo(patchPos);
          mesh = this.createMesh(distToCamera);
          mesh.position.copy(patchPos);
        }

        // Show the mesh
        mesh.visible = true;

        visiblePatches++;
      }
    }

    if (shouldLog) {
      console.log(
        `Visible patches: ${visiblePatches} of ${this.grassGroup.children.length} total patches`
      );
    }
  }

  /**
   * Get vertex shader code for grass
   */
  getGrassVertexShader() {
    return `
      uniform float time;
      uniform vec3 playerPosition;
      uniform float terrainSize;
      uniform float maxHeight;
      uniform float minHeight;
      uniform float heightOffset;
      uniform float lodDistance;
      uniform float maxLodDistance;
      uniform vec2 grassSize;
      uniform vec4 grassParams;
      
      // Instanced attributes
      attribute vec3 instancePosition;
      attribute float instanceHeight;
      attribute float instanceWidth;
      attribute vec3 instanceColor;
      attribute float instanceBend;
      attribute float instanceRandom;
      attribute float instanceDepth;
      
      // Varying variables to pass to fragment shader
      varying vec3 vColor;
      varying float vLod;
      varying float vDistanceToCamera;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      // Noise function for wind effect
      float noise(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      // Wind effect
      vec3 applyWind(vec3 pos, float bendFactor, float heightPercent, vec3 worldPos) {
        // Calculate wind strength based on time and position
        float windStrength = 0.8; // Reduced from 1.8 to 0.8 for moderate wind
        
        // Wave propagation parameters
        float waveSpeed = 3.2; // Increased from 1.8 to 3.2 for faster wind movement
        float wavePeriod = 10.0; // Medium period for moderate gusts
        
        // Calculate moving wave patterns - this creates a sweeping motion across the terrain
        // Primary wave moving along negative X axis
        float wavePosition = worldPos.z + time * waveSpeed;
        float windWave = sin(wavePosition / wavePeriod);
        
        // More moderate transitions for gentler gusts
        windWave = smoothstep(-0.6, 0.6, windWave) * 1.2;
        
        // Secondary wave at different frequency and phase
        float secondaryWavePosition = worldPos.z + time * waveSpeed * 0.9 + 10.0; // Faster secondary wave
        float secondaryWindWave = sin(secondaryWavePosition / (wavePeriod * 0.7));
        secondaryWindWave = smoothstep(-0.4, 0.6, secondaryWindWave) * 1.0;
        
        // Tertiary wave at different angle (diagonal movement)
        float tertiaryWavePosition = worldPos.x * 0.6 + worldPos.z * 0.6 + time * waveSpeed * 1.5; // Faster tertiary wave
        float tertiaryWindWave = sin(tertiaryWavePosition / (wavePeriod * 0.5));
        tertiaryWindWave = smoothstep(-0.5, 0.5, tertiaryWindWave) * 1.0;
        
        // Combine waves with weights to create more complex motion with moderate grouping
        float windIntensityVariation = 0.4 + 0.7 * windWave + 0.5 * secondaryWindWave + 0.3 * tertiaryWindWave;
        
        // Local position-based variation for subtle differences within groups
        float localVariation = noise(worldPos.xz * 0.5);
        
        // Combine all factors into final wind strength with moderate grouping effect
        float finalWindStrength = windStrength * windIntensityVariation * (0.85 + 0.15 * localVariation);
        
        // Apply wind to X direction with increased effect at the top
        float heightFactor = heightPercent * heightPercent * heightPercent; // Cubic for stronger top movement
        pos.x -= finalWindStrength * heightFactor * bendFactor * 1.0; // Reduced multiplier from 1.5 to 1.0
        
        // Add faster vertical motion
        pos.y += sin(time * 2.5 + worldPos.x * 0.4) * 0.03 * heightFactor * bendFactor;
        
        // Add faster lateral z-movement
        pos.z += sin(time * 3.0 + worldPos.x * 0.5) * 0.015 * heightFactor * bendFactor;
        
        return pos;
      }
      
      // Calculate player interaction (bending away from player)
      vec3 applyPlayerInteraction(vec3 pos, vec3 worldPosition) {
        float playerDistance = distance(worldPosition.xz, playerPosition.xz);
        float influence = 1.0 - clamp(playerDistance / 3.0, 0.0, 1.0);
        
        if (influence > 0.0) {
          // Direction away from player
          vec2 direction = normalize(worldPosition.xz - playerPosition.xz);
          
          // Bend the grass more at the top
          float heightFactor = pos.y;
          
          // Apply bend
          pos.x += direction.x * influence * heightFactor * 0.5;
          pos.z += direction.y * influence * heightFactor * 0.5;
        }
        
        return pos;
      }
      
      // Calculate normal for lighting
      // Use a more stable normal that doesn't change as much with camera movement
      void main() {
        // Scale the grass blade by instance attributes
        vec3 pos = position;
        
        // Apply small z-offset based on instanceDepth to prevent z-fighting between grass blades
        // This creates a small depth variation between blades
        pos.z += (instanceDepth - 0.5) * 0.05;
        
        // Scale height and width
        pos.y *= instanceHeight * maxHeight;
        
        // Scale width differently, preserving the cross shape
        // For X and Z components, scale them but preserve the cross structure
        if (abs(position.x) > 0.01) {
          // Front-back plane 
          pos.x *= instanceWidth * grassSize.x;
        } else if (abs(position.z) > 0.01) {
          // Left-right plane
          pos.z *= instanceWidth * grassSize.x;
        }
        
        // Calculate vertex height percentage along the blade
        float heightPercent = position.y;
        
        // Get the mesh position from the model matrix (this is the patch position)
        vec3 meshPosition = vec3(modelMatrix[3].x, modelMatrix[3].y, modelMatrix[3].z);
        
        // Calculate world position by combining:
        // 1. The mesh position (patch center from model matrix)
        // 2. The instance position (position within the patch)
        // 3. The vertex position (position within the blade)
        vec3 worldPos = meshPosition + instancePosition;
        
        // Apply vertical bend based on instance attribute - using world position for wave effect
        pos = applyWind(pos, instanceBend, heightPercent, worldPos);
        
        // Calculate the full world position after wind
        vec3 vertexWorldPosition = worldPos + pos;
        
        // Store original local position before player interaction
        vec3 posBeforeInteraction = pos;
        
        // Apply player interaction to local position
        pos = applyPlayerInteraction(pos, worldPos);
        
        // Recalculate world position by applying the delta from player interaction
        vec3 positionDelta = pos - posBeforeInteraction;
        vertexWorldPosition = vertexWorldPosition + positionDelta;
        
        // Transform to clip space using view and projection matrices
        // (don't use model matrix again since we manually applied it)
        vec4 viewPosition = viewMatrix * vec4(vertexWorldPosition, 1.0);
        
        // Calculate distance to camera for LOD
        float distanceToCamera = length(viewPosition.xyz);
        vDistanceToCamera = distanceToCamera;
        
        // LOD transition factor (0 = high detail, 1 = low detail)
        vLod = smoothstep(lodDistance * 0.8, lodDistance * 1.2, distanceToCamera);
        
        // Pass color to fragment shader (without random jitter)
        vColor = instanceColor;
        
        // Create very sharp tips for the blades
        float tipSharpness = 6.0; // Higher value means even sharper tip
        
        // Only apply tip thinning to the top 40% of the blade
        float tipStartHeight = 0.6;
        float tipThinning = 1.0;
        
        if (heightPercent > tipStartHeight) {
          // Calculate how far into the tip section we are (0 at start, 1 at very top)
          float tipProgress = (heightPercent - tipStartHeight) / (1.0 - tipStartHeight);
          // Apply progressive thinning
          tipThinning = 1.0 - pow(tipProgress, tipSharpness);
        }
        
        // Adjust width based on height (thinner at top to create a sharp point)
        // Apply the thinning to whichever component is non-zero (to preserve the cross)
        if (abs(position.x) > 0.01) {
          pos.x *= tipThinning;
        } else if (abs(position.z) > 0.01) {
          pos.z *= tipThinning;
        }
        
        // Make tip converge to a single point at the very top
        if (heightPercent > 0.9) { // Start point convergence later for better shape
          // Force blades to approach 0 at the very top (creating a point)
          float pointFactor = (heightPercent - 0.9) / 0.1; // 0 at 0.9, 1 at 1.0
          if (abs(position.x) > 0.01) {
            pos.x *= (1.0 - pointFactor);
          } else if (abs(position.z) > 0.01) {
            pos.z *= (1.0 - pointFactor);
          }
        }
        
        // Pass the actual vertex normal for better lighting from all angles
        // but still adjust it to be more consistent
        vec3 adjustedNormal = normal;
        // Blend with a fixed up-vector for more consistent lighting
        vec3 upVector = vec3(0.0, 1.0, 0.0);
        float blendFactor = 0.3; // How much to blend with up vector
        adjustedNormal = normalize(mix(adjustedNormal, upVector, blendFactor * heightPercent));
        vNormal = normalMatrix * adjustedNormal;
        
        // Pass position for effects
        vPosition = vertexWorldPosition;
        
        // Final position
        gl_Position = projectionMatrix * viewPosition;
      }
    `;
  }

  /**
   * Get fragment shader code for grass
   */
  getGrassFragmentShader() {
    return `
      uniform float time;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      uniform float maxLodDistance;
      
      // Variables from vertex shader
      varying vec3 vColor;
      varying float vLod;
      varying float vDistanceToCamera;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        // Basic lighting calculation with sun direction
        vec3 normal = normalize(vNormal);
        
        // Apply height-based color variation - greener at bottom, slightly yellower at top
        float heightRatio = clamp(vPosition.y / 1.1, 0.0, 1.0); // Height relative to max grass height
        
        // Base color from the instance attribute
        vec3 baseColor = vColor;
        
        // Enhanced color variations based on height
        vec3 tipColor, rootColor;
        
        // For main lush green grass blades (20%)
        if (vColor.g > 0.45 && vColor.r < 0.15) {
          // Lush green grass - maintain intense green with minimal yellowing at tips
          tipColor = vec3(
            baseColor.r + 0.06, 
            baseColor.g + 0.08, 
            baseColor.b + 0.02
          );
          
          // Darker at the roots
          rootColor = vec3(
            baseColor.r * 0.65,
            baseColor.g * 0.75,
            baseColor.b * 0.8
          );
        }
        // For yellowish-green grass blades (40%)
        else if (vColor.r > 0.2) {
          // Pronounced yellow tips for dry grass
          tipColor = vec3(
            baseColor.r + 0.12,
            baseColor.g + 0.04,
            baseColor.b + 0.01
          );
          
          // Slightly darker, more green at roots
          rootColor = vec3(
            baseColor.r * 0.75,
            baseColor.g * 0.85,
            baseColor.b * 0.7
          );
        }
        // For darker green grass blades (25%)
        else if (vColor.g < 0.4) {
          // Slightly lighter tips
          tipColor = vec3(
            baseColor.r + 0.03,
            baseColor.g + 0.08,
            baseColor.b + 0.01
          );
          
          // Very dark roots
          rootColor = vec3(
            baseColor.r * 0.55,
            baseColor.g * 0.65,
            baseColor.b * 0.7
          );
        }
        // For light sun-bleached blades (15%)
        else {
          // Very light golden tips
          tipColor = vec3(
            baseColor.r + 0.15,
            baseColor.g + 0.08,
            baseColor.b + 0.05
          );
          
          // More green at the base
          rootColor = vec3(
            baseColor.r * 0.7,
            baseColor.g * 0.9,
            baseColor.b * 0.65
          );
        }
        
        // Create a non-linear gradient from root to tip
        // Using smoothstep for a more natural transition
        float tipInfluence = smoothstep(0.0, 0.9, heightRatio);  // More sudden change near top
        
        // Apply color gradient - mix between root color and tip color
        vec3 color = mix(rootColor, tipColor, tipInfluence);
        
        // Add slight color variation based on time and position for subtle movement effect
        float colorNoise = sin(time * 0.5 + vPosition.x * 0.1 + vPosition.z * 0.1) * 0.02;
        color.g += colorNoise;  // Subtle green variation
        
        // Ambient light - adjusted for early morning lighting
        float ambientStrength = 0.5; // Slightly reduced for more pronounced directional light
        vec3 ambient = ambientStrength * sunColor;
        
        // Add subtle blue tint to shadowed areas for morning atmosphere
        vec3 skyColor = vec3(0.75, 0.85, 1.0);
        vec3 morningAmbient = mix(skyColor, sunColor, 0.5) * 0.3;
        ambient += morningAmbient;
        
        // Diffuse light with reduced view dependency
        // Calculate diffuse lighting from sun direction for stronger morning rays
        float mainDiff = max(dot(normal, normalize(sunDirection)), 0.0);
        
        // Add some light from above for more consistent illumination
        float topDiff = max(dot(normal, vec3(0.0, 1.0, 0.0)), 0.0) * 0.3;
        
        // Add a small amount of light from all directions
        float hemisphereDiff = 0.5 + 0.5 * dot(normal, vec3(0.0, 1.0, 0.0));
        
        // Combine the different lighting sources with weights adjusted for morning light
        vec3 diffuse = (mainDiff * 0.5 + topDiff * 0.2 + hemisphereDiff * 0.2) * sunColor;
        
        // Enhanced backlighting for morning sun rim effect
        float backFactor = max(0.0, -dot(normal, normalize(sunDirection)));
        float backlight = 0.25 * pow(backFactor, 2.0); // Stronger rim lighting
        vec3 backlighting = backlight * vec3(1.0, 0.9, 0.7); // Warm backlight color
        
        // Apply lighting to color
        color = color * (ambient + diffuse) + backlighting * 0.3;
        
        // Ensure minimum brightness to prevent grass from getting too dark
        float luminance = dot(color, vec3(0.299, 0.587, 0.114));
        float minLuminance = 0.2; // Darker shadows for morning
        if (luminance < minLuminance) {
          color *= minLuminance / max(0.001, luminance);
        }
        
        // Apply slight distance-based fog/desaturation for atmospheric depth
        if (vDistanceToCamera > maxLodDistance * 0.5) {
          float fogFactor = smoothstep(maxLodDistance * 0.5, maxLodDistance * 0.9, vDistanceToCamera) * 0.3;
          vec3 fogColor = vec3(0.8, 0.9, 1.0); // Blueish distance fog
          color = mix(color, fogColor, fogFactor);
        }
        
        // Output final color
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }

  /**
   * Log statistics about grass rendering
   */
  logRenderingStats() {
    // Count visible patches
    let visiblePatchCount = 0;
    let visibleHighLOD = 0;
    let visibleLowLOD = 0;
    let totalBlades = 0;
    let totalTriangles = 0;

    for (const mesh of this.grassGroup.children) {
      if (mesh.visible) {
        visiblePatchCount++;

        // Count blades based on LOD level
        const bladeCount = NUM_GRASS;
        totalBlades += bladeCount;

        // Count triangles - each blade has different triangle count based on LOD
        const trianglesPerBlade = mesh.userData.isLowDetail
          ? GRASS_SEGMENTS_LOW * 4 // 4 triangles per segment (2 per side of the cross)
          : GRASS_SEGMENTS_HIGH * 4;
        totalTriangles += bladeCount * trianglesPerBlade;

        if (mesh.userData.isLowDetail) {
          visibleLowLOD++;
        } else {
          visibleHighLOD++;
        }
      }
    }

    // Format numbers with commas
    const formatNumber = (num) => {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Calculate percent change for patch count
    const patchPercentChange =
      this.lastPatchCount > 0
        ? (
            ((visiblePatchCount - this.lastPatchCount) / this.lastPatchCount) *
            100
          ).toFixed(1) + "%"
        : "N/A";

    // Calculate percent change for blade count
    const bladePercentChange =
      this.lastBladeCount > 0
        ? (
            ((totalBlades - this.lastBladeCount) / this.lastBladeCount) *
            100
          ).toFixed(1) + "%"
        : "N/A";

    // Estimate memory usage (very rough approximation)
    // Each vertex has position (3), normal (3), uv (2) = 8 floats * 4 bytes = 32 bytes per vertex
    // Each instance has multiple attributes totaling roughly 10 floats * 4 bytes = 40 bytes
    const bytesPerVertex = 32;
    const bytesPerInstance = 40;
    const verticesHighLOD = (GRASS_SEGMENTS_HIGH + 1) * 4; // 4 vertices per segment level
    const verticesLowLOD = (GRASS_SEGMENTS_LOW + 1) * 4;
    const memoryUsageMB =
      (visibleHighLOD * NUM_GRASS * bytesPerInstance +
        visibleHighLOD * verticesHighLOD * bytesPerVertex +
        visibleLowLOD * NUM_GRASS * bytesPerInstance +
        visibleLowLOD * verticesLowLOD * bytesPerVertex) /
      (1024 * 1024);

    // Store current values for next comparison
    this.lastPatchCount = visiblePatchCount;
    this.lastBladeCount = totalBlades;

    // Create styled console output
    console.log(
      "%c 🌿 GRASS RENDERING STATS 🌿 ",
      "background: #2c3e50; color: #2ecc71; font-weight: bold; padding: 4px 0;"
    );
    console.log(
      `Patches: ${visiblePatchCount} (${patchPercentChange} change) | ` +
        `High LOD: ${visibleHighLOD} | Low LOD: ${visibleLowLOD}`
    );
    console.log(
      `Grass Blades: ${formatNumber(
        totalBlades
      )} (${bladePercentChange} change)`
    );
    console.log(
      `Memory: ~${memoryUsageMB.toFixed(2)} MB | Time: ${this.totalTime.toFixed(
        1
      )}s`
    );
  }
}

export default GrassComponent;
