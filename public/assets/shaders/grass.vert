// Grass Vertex Shader
uniform float time;
uniform sampler2D heightMap;
uniform vec3 playerPosition;
uniform float terrainSize;
uniform float maxHeight;
uniform float minHeight;
uniform float heightOffset;
uniform float lodDistance;
uniform float maxLodDistance;

// Instanced attributes
attribute vec3 instancePosition;
attribute float instanceHeight;
attribute float instanceWidth;
attribute vec3 instanceColor;
attribute float instanceBend;
attribute float instanceRandom;

// Standard attributes are already provided by Three.js
// No need to redefine: attribute vec2 uv, attribute vec3 position, attribute vec3 normal

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

// Get height from heightmap 
float getHeight(vec2 position) {
    // Convert world position to heightmap UV coordinates
    // Normalize position from -terrainSize/2 to terrainSize/2 into 0 to 1 range
    vec2 uv = (position + terrainSize * 0.5) / terrainSize;
    
    // Clamp to avoid sampling outside the texture
    uv = clamp(uv, 0.0, 1.0);
    
    // Sample heightmap and convert to world height
    return texture2D(heightMap, uv).r * (maxHeight - minHeight) + minHeight + heightOffset;
}

// Wind effect
vec3 applyWind(vec3 pos, float bendFactor, float heightPercent) {
    // Calculate wind strength based on time and position
    float windStrength = 0.2;
    float windFrequency = 1.5;
    
    // Use noise for natural movement
    float windNoise = noise(pos.xz * 0.1 + time * 0.05);
    
    // Apply wind effect based on height (more at the top)
    float windEffect = sin(time * windFrequency + pos.x * 0.5 + pos.z * 0.5 + windNoise) * windStrength;
    
    // Only apply wind to the x direction, scaled by height along the blade
    pos.x += windEffect * heightPercent * heightPercent * bendFactor;
    
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

void main() {
    // The instance position is the world position of this grass blade
    vec3 worldPosition = instancePosition;
    
    // Debug - print values to fragment color
    // vColor = vec3(worldPosition.x / terrainSize + 0.5, 0.0, worldPosition.z / terrainSize + 0.5);
    
    // Get terrain height at this position
    float terrainHeight = getHeight(worldPosition.xz);
    worldPosition.y = terrainHeight;
    
    // Adjust base position relative to instance position
    vec3 pos = position;
    
    // Scale the grass blade by instance attributes
    pos.y *= instanceHeight;
    pos.xz *= instanceWidth;
    
    // Apply vertical bend based on instance attribute
    pos = applyWind(pos, instanceBend, position.y);
    
    // Calculate this vertex's world position
    vec3 vertexWorldPosition = worldPosition + pos;
    
    // Apply player interaction
    vertexWorldPosition = applyPlayerInteraction(pos, vertexWorldPosition);
    
    // Transform to view space
    vec4 viewPosition = modelViewMatrix * vec4(vertexWorldPosition, 1.0);
    
    // Calculate distance to camera for LOD
    float distanceToCamera = length(viewPosition.xyz);
    vDistanceToCamera = distanceToCamera;
    
    // LOD transition factor (0 = high detail, 1 = low detail)
    vLod = smoothstep(lodDistance * 0.8, lodDistance * 1.2, distanceToCamera);
    
    // Pass color to fragment shader with slight variations
    vColor = instanceColor * (0.9 + instanceRandom * 0.2);
    
    // Pass normal for lighting
    vNormal = normalMatrix * normal;
    
    // Pass position for effects
    vPosition = vertexWorldPosition;
    
    // Final position
    gl_Position = projectionMatrix * viewPosition;
} 