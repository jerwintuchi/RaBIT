// Checkerboard transparency pattern.
// v_uv: [0,1] over the canvas quad (0,0 = top-left canvas pixel).
// u_quadScreenSize: width and height of the canvas quad in screen pixels (canvasW*zoom, canvasH*zoom).
// u_color0, u_color1: the two checker colors (light/dark).
export const CHECKERBOARD_FRAG = /* glsl */ `#version 300 es
precision mediump float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_quadScreenSize;
uniform vec4 u_color0;
uniform vec4 u_color1;

void main() {
  // Convert UV to screen pixels within the canvas quad
  vec2 screenPos = v_uv * u_quadScreenSize;
  // 8-screen-pixel checker tiles
  float cx = floor(screenPos.x / 8.0);
  float cy = floor(screenPos.y / 8.0);
  float checker = mod(cx + cy, 2.0);
  fragColor = mix(u_color0, u_color1, checker);
}
`;
