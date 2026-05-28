// Composites one layer over the accumulated composite using the correct blend mode.
// Used in the ping-pong FBO pass (reads u_composite, writes blended result).
// u_layer:      current layer texture (straight RGBA)
// u_composite:  accumulated composite so far (straight RGBA)
// u_opacity:    layer opacity [0..1]
// u_blendMode:  0=normal 1=multiply 2=screen 3=overlay 4=add 5=subtract
// u_scratch:    scratch texture (eraser preview mask, alpha channel)
// u_applyErase: 1 = cut scratch alpha from this layer before compositing (active layer only)
export const COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_layer;
uniform sampler2D u_composite;
uniform float u_opacity;
uniform int u_blendMode;
uniform sampler2D u_scratch;
uniform int u_applyErase;
uniform int u_flipLayerY; // 1 when u_layer is an FBO texture (canvas-top at v=1)

vec3 blendMultiply(vec3 s, vec3 d) { return s * d; }
vec3 blendScreen(vec3 s, vec3 d)   { return 1.0 - (1.0 - s) * (1.0 - d); }
vec3 blendOverlay(vec3 s, vec3 d) {
  return mix(2.0 * s * d, 1.0 - 2.0 * (1.0 - s) * (1.0 - d), step(0.5, d));
}
vec3 blendAdd(vec3 s, vec3 d)      { return min(s + d, vec3(1.0)); }
vec3 blendSubtract(vec3 s, vec3 d) { return max(d - s, vec3(0.0)); }

void main() {
  // u_layer is a CPU-uploaded texture: v=0 = canvas top (array row 0 at GL bottom).
  // u_composite is an FBO texture: GL renders NDC y=+1 to FBO row height-1 → texture v=1,
  // so canvas top is at v=1. Flip Y when reading the accumulated composite so that both
  // textures are sampled at the same canvas position for any given v_uv.
  vec2 uvFlipped = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 layerUv = u_flipLayerY != 0 ? uvFlipped : v_uv;
  vec4 layer = texture(u_layer, layerUv);
  vec4 comp  = texture(u_composite, uvFlipped);

  // u_scratch was uploaded with UNPACK_FLIP_Y; sample with flipped Y to match u_layer coordinates.
  float scratchCut = u_applyErase != 0 ? texture(u_scratch, vec2(v_uv.x, 1.0 - v_uv.y)).a : 0.0;
  float as_ = layer.a * (1.0 - scratchCut) * u_opacity;
  float ad  = comp.a;

  // Straight-alpha source and dest colors
  vec3 Cs = as_ > 0.0 ? layer.rgb : vec3(0.0);
  vec3 Cd = comp.rgb;

  vec3 Cm;
  if      (u_blendMode == 1) Cm = blendMultiply(Cs, Cd);
  else if (u_blendMode == 2) Cm = blendScreen(Cs, Cd);
  else if (u_blendMode == 3) Cm = blendOverlay(Cs, Cd);
  else if (u_blendMode == 4) Cm = blendAdd(Cs, Cd);
  else if (u_blendMode == 5) Cm = blendSubtract(Cs, Cd);
  else                        Cm = Cs; // Normal

  // Porter-Duff "over" alpha compositing
  float aOut = as_ + ad * (1.0 - as_);
  vec3 cOut;
  if (aOut > 0.0) {
    cOut = (Cm * as_ + Cd * ad * (1.0 - as_)) / aOut;
  } else {
    cOut = vec3(0.0);
  }

  fragColor = vec4(cOut, aOut);
}
`;
