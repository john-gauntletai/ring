import * as THREE from "three";

import { createNoise2D } from 'simplex-noise';

// Function to generate a heightmap using Simplex noise
export const generateHeightmap = (width, length, scale = 0.005, amplitude = 10, octaves = 4, persistence = 0.5) => {
  const noise2D = createNoise2D();  
  const heightmap = new Float32Array(width * length);

    // Loop through each point in the heightmap
    for (let y = 0; y < length; y++) {
        for (let x = 0; x < width; x++) {
            let value = 0;
            let frequency = scale;
            let maxValue = 0;

            // Combine multiple octaves of noise for more natural variation
            for (let i = 0; i < octaves; i++) {
                value += noise2D(x * frequency, y * frequency) * amplitude * Math.pow(persistence, i);
                maxValue += amplitude * Math.pow(persistence, i);
                frequency *= 2; // Double the frequency for each octave
            }

            // Normalize the value to the range [0, 1] and scale by amplitude
            value = (value / maxValue) * amplitude;
            heightmap[y * width + x] = value;
        }
    }

    return heightmap;
}

export const generateTerrain = (width, height, widthSegments, heightSegments, heightmap) => {
    // Create a plane geometry with the specified dimensions and segments
    const geometry = new THREE.PlaneGeometry(width, height, widthSegments - 1, heightSegments - 1);

    // Apply the heightmap to the geometry's vertices
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = i / 3 % widthSegments;
        const y = Math.floor(i / 3 / widthSegments);
        const heightValue = heightmap[y * widthSegments + x];
        vertices[i + 2] = heightValue; // Set the z-coordinate (height) of the vertex
    }

    // Recalculate normals for proper lighting
    geometry.computeVertexNormals();

    // Create a basic material (you can replace this with a custom material later)
    const material = new THREE.MeshStandardMaterial({
        color: 0x4a8f45, // A grassy green color
        side: THREE.DoubleSide,
        wireframe: false
    });

    // Create the terrain mesh
    const terrain = new THREE.Mesh(geometry, material);

    // Rotate the plane to lie flat (PlaneGeometry is vertical by default)
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    terrain.castShadow = true;

    return terrain;
}