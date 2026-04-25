// Blits a texture to the screen quad with straight-alpha blending.
// Used to draw the composite FBO onto the screen canvas over the checkerboard.
export const BLIT_FRAG = /* glsl */ `#version 300 es
precision mediump float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_texture;

void main() {
  fragColor = texture(u_texture, v_uv);
}
`;
