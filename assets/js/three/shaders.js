/* ============================================================
   shaders.js — GLSL sources
   Kept in one place so the scene modules stay readable.
   All shaders are cheap by design: sums of sines rather than any
   real fluid solve, and analytic normals by finite difference.
   ============================================================ */

/* ------------------------------------------------------------
   Water surface
   Four travelling waves plus one expanding ripple, so the
   droplet can actually disturb the tank when it lands.
   ------------------------------------------------------------ */
export const waterVertex = /* glsl */`
uniform float uTime;
uniform float uAmp;
uniform float uSound;
uniform float uDetail;      // 1.0 full, 0.0 reduced (mobile)
uniform vec4  uRipple;      // xz = centre, z = start time, w = strength

varying vec3 vWorld;
varying vec3 vNrm;
varying float vHeight;

float travelling(vec2 p, vec2 dir, float freq, float speed, float amp, float t) {
  return sin(dot(p, dir) * freq + t * speed) * amp;
}

float surface(vec2 p, float t) {
  float h = 0.0;
  h += travelling(p, vec2( 0.944,  0.330), 0.52, 0.80, 0.360, t);
  h += travelling(p, vec2(-0.514,  0.857), 0.86, 1.10, 0.210, t);
  h += travelling(p, vec2( 0.287, -0.958), 1.55, 1.65, 0.090, t) * uDetail;
  h += travelling(p, vec2(-0.928, -0.371), 2.70, 2.25, 0.042, t) * uDetail;

  // droplet impact ring
  float age = t - uRipple.z;
  if (age > 0.0 && age < 7.0) {
    float d = distance(p, uRipple.xy);
    float ring = sin(d * 3.2 - age * 5.4);
    h += ring * exp(-d * 0.42) * exp(-age * 0.85) * uRipple.w;
  }
  return h * uAmp * (1.0 + uSound * 0.055);
}

void main() {
  vec3 pos = position;
  vec2 p = vec2(pos.x, pos.y); // plane is built in XY then rotated

  float e = 0.42;
  float h  = surface(p, uTime);
  float hx = surface(p + vec2(e, 0.0), uTime);
  float hy = surface(p + vec2(0.0, e), uTime);

  pos.z += h;
  vHeight = h;

  // finite-difference normal, in the plane's local space
  vNrm = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const waterFragment = /* glsl */`
uniform vec3  uDeep;
uniform vec3  uShallow;
uniform vec3  uSky;
uniform vec3  uLightDir;
uniform float uTime;
uniform float uOpacity;

varying vec3 vWorld;
varying vec3 vNrm;
varying float vHeight;

void main() {
  // the plane is rotated flat, so rebuild the world normal
  vec3 n = normalize(vec3(vNrm.x, vNrm.z, -vNrm.y));
  vec3 viewDir = normalize(cameraPosition - vWorld);

  float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 2.6);

  vec3 body = mix(uDeep, uShallow, clamp(vHeight * 0.9 + 0.5, 0.0, 1.0));
  vec3 col  = mix(body, uSky, fres * 0.75);

  // specular glint off the crests
  vec3 h = normalize(normalize(uLightDir) + viewDir);
  float spec = pow(max(dot(n, h), 0.0), 120.0);
  col += vec3(0.60, 0.92, 1.0) * spec * 0.85;

  // faint caustic banding, reads as light moving under the surface
  float caustic = sin(vWorld.x * 1.6 + uTime * 0.7) * sin(vWorld.z * 1.9 - uTime * 0.55);
  col += uShallow * smoothstep(0.55, 1.0, caustic) * 0.10;

  // fade the far edge of the tank into the fog
  float dist = length(vWorld.xz);
  float edge = 1.0 - smoothstep(26.0, 46.0, dist);

  gl_FragColor = vec4(col, (0.55 + fres * 0.45) * uOpacity * edge);
}
`;

/* ------------------------------------------------------------
   Pipe flow
   Pulses of light travelling along the tube's length. This is the
   single clearest signal that the facility is actively running.
   ------------------------------------------------------------ */
export const flowVertex = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const flowFragment = /* glsl */`
uniform float uTime;
uniform float uSpeed;
uniform float uSegments;
uniform vec3  uColor;
uniform float uOpacity;

varying vec2 vUv;

void main() {
  // vUv.x runs along the tube
  float travel = fract(vUv.x * uSegments - uTime * uSpeed);
  float pulse  = pow(1.0 - travel, 5.0);

  // soft body so the pipe is visible between pulses
  float body = 0.22;

  // shade the tube's circumference for a little roundness
  float round = sin(vUv.y * 3.14159);

  float a = (body + pulse * 1.4) * round * uOpacity;
  gl_FragColor = vec4(uColor * (0.55 + pulse * 1.6), a);
}
`;

/* ------------------------------------------------------------
   Suspended particles and bubbles
   One Points system, one draw call, all movement on the GPU.
   ------------------------------------------------------------ */
export const particleVertex = /* glsl */`
uniform float uTime;
uniform float uPixelRatio;
uniform float uRise;      // vertical speed
uniform float uSpan;      // wrap height
uniform float uWobble;

attribute float aSeed;
attribute float aScale;

varying float vAlpha;
varying float vSeed;

void main() {
  vec3 pos = position;

  float t = uTime + aSeed * 40.0;

  // rise and wrap
  pos.y = mod(pos.y + t * uRise, uSpan) - uSpan * 0.5;

  // lateral drift, so nothing travels in a straight line
  pos.x += sin(t * 0.45 + aSeed * 6.28) * uWobble;
  pos.z += cos(t * 0.38 + aSeed * 3.14) * uWobble * 0.8;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);

  // fade in at the bottom of the span and out at the top
  float band = (pos.y + uSpan * 0.5) / uSpan;
  vAlpha = smoothstep(0.0, 0.14, band) * (1.0 - smoothstep(0.78, 1.0, band));
  vSeed = aSeed;

  gl_PointSize = aScale * uPixelRatio * (34.0 / max(-mv.z, 0.1));
  gl_Position = projectionMatrix * mv;
}
`;

export const particleFragment = /* glsl */`
uniform vec3  uColor;
uniform float uOpacity;
uniform float uRim;   // 0 = soft mote, 1 = bubble with a bright rim

varying float vAlpha;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;

  float soft = 1.0 - smoothstep(0.0, 1.0, d);
  float rim  = smoothstep(0.62, 0.96, d) * smoothstep(1.0, 0.94, d);
  float shape = mix(soft * soft, soft * 0.30 + rim * 1.5, uRim);

  // a touch of highlight offset inside bubbles
  float glint = uRim * pow(max(0.0, 1.0 - length(uv - vec2(-0.16, 0.16)) * 4.2), 3.0);

  gl_FragColor = vec4(uColor + glint * 0.7, shape * vAlpha * uOpacity);
}
`;

/* ------------------------------------------------------------
   Volumetric light cone
   An open cylinder with additive falloff — cheap god-rays that
   read as lamps over the tanks.
   ------------------------------------------------------------ */
export const volumeVertex = /* glsl */`
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const volumeFragment = /* glsl */`
uniform vec3  uColor;
uniform float uOpacity;
uniform float uTime;

varying vec2 vUv;
varying vec3 vPos;

void main() {
  // bright at the lamp, gone by the water
  float vertical = pow(vUv.y, 1.8);

  // soften the silhouette edges of the cone
  float edge = sin(vUv.x * 3.14159);
  edge = pow(edge, 0.7);

  // slow breathing so it never looks frozen
  float breath = 0.86 + sin(uTime * 0.5 + vPos.x) * 0.14;

  gl_FragColor = vec4(uColor, vertical * edge * uOpacity * breath);
}
`;

/* ------------------------------------------------------------
   Glowing droplet
   Fresnel shell with an emissive core.
   ------------------------------------------------------------ */
export const dropletVertex = /* glsl */`
varying vec3 vNrm;
varying vec3 vWorld;
void main() {
  // world space, so it pairs correctly with cameraPosition below
  vNrm = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const dropletFragment = /* glsl */`
uniform vec3  uCore;
uniform vec3  uRim;
uniform float uTime;
uniform float uOpacity;

varying vec3 vNrm;
varying vec3 vWorld;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(dot(normalize(vNrm), viewDir), 0.0, 1.0), 2.2);

  float pulse = 0.88 + sin(uTime * 1.6) * 0.12;
  vec3 col = mix(uCore, uRim, fres) * pulse;

  gl_FragColor = vec4(col, (0.30 + fres * 0.70) * uOpacity);
}
`;

/* Soft radial sprite used for the droplet's halo and lamp bloom. */
export const glowFragment = /* glsl */`
uniform vec3  uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 3.0);
  gl_FragColor = vec4(uColor, a * uOpacity);
}
`;

export const glowVertex = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
