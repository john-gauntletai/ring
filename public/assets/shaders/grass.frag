// Grass Fragment Shader
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
    
    // Ambient light
    float ambientStrength = 0.3;
    vec3 ambient = ambientStrength * sunColor;
    
    // Diffuse light
    float diff = max(dot(normal, normalize(sunDirection)), 0.0);
    vec3 diffuse = diff * sunColor;
    
    // Apply lighting to color
    vec3 color = vColor * (ambient + diffuse);
    
    // Add slight variance based on position for natural look
    float noise = fract(sin(dot(vPosition.xz, vec2(12.9898, 78.233))) * 43758.5453123);
    color *= 0.9 + noise * 0.2;
    
    // Apply LOD - fade out at distance
    float distanceFade = 1.0 - smoothstep(maxLodDistance * 0.7, maxLodDistance, vDistanceToCamera);
    
    // Apply distance fade and make alpha depend on distance too
    gl_FragColor = vec4(color, distanceFade);
    
    // Discard very transparent pixels
    if (gl_FragColor.a < 0.1) {
        discard;
    }
} 