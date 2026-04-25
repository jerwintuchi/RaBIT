// Vertex shader for all fullscreen and canvas-quad draws.
// a_position is a unit quad [0,1]×[0,1] — (0,0) = top-left, (1,1) = bottom-right.
// u_ndcMin = NDC of top-left, u_ndcMax = NDC of bottom-right.
// v_uv passes [0,1] UVs to the fragment shader (y=0 at top).
export const QUAD_VERT = /* glsl */ `#version 300 es
in vec2 a_position;
uniform vec2 u_ndcMin;
uniform vec2 u_ndcMax;
out vec2 v_uv;

void main() {
  v_uv = a_position;
  float x = mix(u_ndcMin.x, u_ndcMax.x, a_position.x);
  // NDC y is flipped: y=0 (top in UV) maps to u_ndcMin.y (top in NDC = positive)
  float y = mix(u_ndcMin.y, u_ndcMax.y, a_position.y);
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;
