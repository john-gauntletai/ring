import * as THREE from 'three';

// Function to create a single grass blade geometry
function createGrassBladeGeometry() {
    const width = 0.1; // Width of the grass blade
    const height = 1.0; // Height of the grass blade
    const segments = 4; // Number of segments for tapering

    const geometry = new THREE.PlaneGeometry(width, height, 1, segments);

    // Taper the grass blade to make it look more natural
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const y = vertices[i + 1]; // Y-coordinate of the vertex
        const t = y / height; // Normalize y to [0, 1] from bottom to top
        const taper = 1 - t; // Taper factor: wider at the bottom, narrower at the top
        vertices[i] *= taper; // Scale the x-coordinate to create the taper
    }

    geometry.computeVertexNormals();
    return geometry;
}

export function createInstancedGrass(terrain, heightmap, widthSegments, lengthSegments, terrainWidth, terrainLength, grassCount = 50000) {
    // Get the grass blade geometry and material
    const bladeGeometry = createGrassBladeGeometry();
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a6b35, // A darker green for the grass
        side: THREE.DoubleSide,
    });

    // Create the InstancedMesh
    const instancedGrass = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, grassCount);
    const dummy = new THREE.Object3D(); // Helper for setting transformations

    // Calculate the terrain dimensions for positioning
    const halfWidth = terrainWidth / 2;
    const halfLength = terrainLength / 2;

    // Scatter grass blades across the terrain
    for (let i = 0; i < grassCount; i++) {
        // Random position on the terrain
        const x = (Math.random() - 0.5) * terrainWidth; // Random x in [-halfWidth, halfWidth]
        const z = (Math.random() - 0.5) * terrainLength; // Random z in [-halfLength, halfLength]

        // Map the position to the heightmap grid
        const u = (x + halfWidth) / terrainWidth; // Normalize x to [0, 1]
        const v = (z + halfLength) / terrainLength; // Normalize z to [0, 1]
        const gridX = Math.floor(u * (widthSegments - 1));
        const gridZ = Math.floor(v * (lengthSegments - 1));

        // Get the height from the heightmap
        const heightValue = heightmap[gridZ * widthSegments + gridX] || 0;

        // Set the position of the grass blade
        dummy.position.set(x, heightValue, z);

        // Random rotation around the y-axis for natural variation
        dummy.rotation.y = Math.random() * Math.PI * 2;

        // Random scale for variation in grass height
        const scale = 0.5 + Math.random() * 0.5; // Scale between 0.5 and 1.0
        dummy.scale.set(1, scale, 1);

        // Update the matrix for this instance
        dummy.updateMatrix();
        instancedGrass.setMatrixAt(i, dummy.matrix);
    }

    // Update the instance matrices and enable shadows
    instancedGrass.instanceMatrix.needsUpdate = true;
    instancedGrass.castShadow = true;
    instancedGrass.receiveShadow = true;

    return instancedGrass;
}