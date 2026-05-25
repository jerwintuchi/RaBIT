/** GLSL fragment shader — renders the canvas as a 3×3 tiled grid.
 *
 * Uniforms
 *   u_texture     — composited canvas texture
 *   u_resolution  — viewport size in pixels
 *   u_canvasSize  — canvas size in pixels
 *   u_panOffset   — pan offset (screen pixels, top-left origin)
 *   u_zoom        — current zoom level
 *
 * The shader maps each fragment back to a canvas pixel using modulo arithmetic
 * and samples the texture with that UV. Fragments that fall outside the 3×3
 * tile region get a dark grey checkerboard background.
 */
export const TILE_FRAG = /* glsl */ `#version 300 es
precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_canvasSize;
uniform vec2 u_panOffset;
uniform float u_zoom;

out vec4 fragColor;

// Checkerboard pattern for the area outside the tiled canvas
vec4 checkerBg(vec2 fragCoord) {
  float tileSize = 8.0;
  vec2 tile = floor(fragCoord / tileSize);
  float checker = mod(tile.x + tile.y, 2.0);
  return mix(vec4(0.10, 0.10, 0.11, 1.0), vec4(0.14, 0.14, 0.15, 1.0), checker);
}

void main() {
  // Fragment position in screen space (top-left origin)
  vec2 fragCoord = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);

  // Canvas size in screen pixels
  vec2 canvasScreen = u_canvasSize * u_zoom;

  // Offset of this fragment relative to the top-left of the canvas on screen
  vec2 relScreen = fragCoord - u_panOffset;

  // The 3×3 tile grid spans [-canvasScreen .. 2*canvasScreen] in each axis.
  // Check if this fragment is within that region.
  if (relScreen.x < -canvasScreen.x || relScreen.x >= 2.0 * canvasScreen.x ||
      relScreen.y < -canvasScreen.y || relScreen.y >= 2.0 * canvasScreen.y) {
    fragColor = checkerBg(fragCoord);
    return;
  }

  // Map to canvas pixel using modulo
  vec2 canvasPixel = mod(relScreen / u_zoom, u_canvasSize);
  // Clamp to valid range (handles floating-point edge cases)
  canvasPixel = clamp(canvasPixel, vec2(0.0), u_canvasSize - vec2(1.0));

  vec2 uv = canvasPixel / u_canvasSize;
  // Flip V because texture is stored top-to-bottom but GL UV is bottom-to-top
  uv.y = 1.0 - uv.y;

  fragColor = texture(u_texture, uv);
}
`;
