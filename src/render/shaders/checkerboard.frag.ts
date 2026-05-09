// Checkerboard transparency pattern.
// v_uv: [0,1] over the canvas quad (0,0 = top-left canvas pixel).
// u_quadScreenSize: canvas quad size in screen pixels (canvasW*zoom, canvasH*zoom).
// u_tileScreenSize: screen pixels per canvas pixel (= zoom). Each checker tile
//   is exactly one canvas pixel so the pattern aligns with the pixel grid.
// u_color0, u_color1: the two checker colors (light/dark).
export const CHECKERBOARD_FRAG = /* glsl */ `#version 300 es
precision mediump float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_quadScreenSize;
uniform float u_tileScreenSize;
uniform vec4 u_color0;
uniform vec4 u_color1;

void main() {
  // Map UV to screen pixels, then to canvas pixel coordinates.
  // One checker tile = one canvas pixel.
  vec2 screenPos = v_uv * u_quadScreenSize;
  float cx = floor(screenPos.x / u_tileScreenSize);
  float cy = floor(screenPos.y / u_tileScreenSize);
  float checker = mod(cx + cy, 2.0);
  fragColor = mix(u_color0, u_color1, checker);
}
`;
