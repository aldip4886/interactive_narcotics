// xray.vert.glsl
const xrayVert = `
varying vec3 vNormal;
varying vec3 vViewPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}`;

// xray.frag.glsl
const xrayFrag = `
uniform vec3 glowColor;
uniform float opacity;
varying vec3 vNormal;
varying vec3 vViewPosition;
void main() {
  vec3 normal   = normalize(vNormal);
  vec3 viewDir  = normalize(vViewPosition);
  float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
  float intensity = pow(fresnel, 2.5);
  gl_FragColor = vec4(glowColor, intensity * opacity);
}`;

export { xrayVert, xrayFrag };
