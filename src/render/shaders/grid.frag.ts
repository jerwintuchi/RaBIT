// Pixel grid overlay. Draws 1-screen-pixel lines at canvas pixel boundaries.
// Only called when zoom >= 2 (enforced by JS caller).
// v_uv: [0,1] over the canvas quad.
// u_quadScreenSize: canvas quad size in screen pixels (canvasW*zoom, canvasH*zoom).
// u_zoom: current zoom level (integer).
// u_color: grid line color (e.g. rgba(0,0,0,0.3)).
export const GRID_FRAG = /* glsl */ `#version 300 es
precision mediump float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_quadScreenSize;
uniform float u_zoom;
uniform vec4 u_color;

void main() {
  vec2 screenPos = v_uv * u_quadScreenSize;
  // Position within the current canvas pixel in screen pixels
  vec2 withinPixel = mod(screenPos, u_zoom);
  // Draw a 1px line at the leading edge of each canvas pixel
  if (withinPixel.x < 1.0 || withinPixel.y < 1.0) {
    fragColor = u_color;
  } else {
    discard;
  }
}
`;
