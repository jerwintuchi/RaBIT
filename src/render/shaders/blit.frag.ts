// Blits a texture to the screen quad with straight-alpha blending.
// When u_eraseMode != 0: scratch alpha cuts holes in the composite (eraser preview).
// u_globalAlpha: overall opacity multiplier (1.0 = normal, < 1 for onion skin).
// u_tintColor: RGB tint blended over the output (alpha = tint strength, 0 = no tint).
export const BLIT_FRAG = /* glsl */ `#version 300 es
precision mediump float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform sampler2D u_scratchTex;
uniform int u_eraseMode;
uniform float u_globalAlpha;
uniform vec4 u_tintColor;

void main() {
  // Y-flip: GL texcoord y=0 is texture bottom, but v_uv y=0 is screen top.
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 composite = texture(u_texture, uv);
  if (u_eraseMode != 0) {
    float eraseA = texture(u_scratchTex, uv).a;
    composite.a *= (1.0 - eraseA);
  }
  // Apply tint: lerp toward tint color by tint alpha
  composite.rgb = mix(composite.rgb, u_tintColor.rgb, u_tintColor.a * composite.a);
  composite.a *= u_globalAlpha;
  fragColor = composite;
}
`;
