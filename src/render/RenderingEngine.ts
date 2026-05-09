import { DirtyFlag, type DirtyFlags, type RenderLayerSpec, type ViewTransform } from './types';
import { TextureCache } from './TextureCache';
import {
  QUAD_VERT,
  CHECKERBOARD_FRAG,
  COMPOSITE_FRAG,
  BLIT_FRAG,
  GRID_FRAG,
} from './shaders';

interface ShaderProgram {
  program: WebGLProgram;
  attribs: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

interface FBOTarget {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

const BLEND_MODE_INDEX: Record<string, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  add: 4,
  subtract: 5,
};

// Screen-space NDC for the full framebuffer (top-left to bottom-right in GL convention)
const FULLSCREEN_NDC = { minX: -1, minY: 1, maxX: 1, maxY: -1 };

// Safe uniform location accessor — Record<string,V> indexing yields V|undefined under noUncheckedIndexedAccess
function u(prog: ShaderProgram, name: string): WebGLUniformLocation | null {
  return prog.uniforms[name] ?? null;
}

export class RenderingEngine {
  private gl!: WebGL2RenderingContext;
  private checkerProg!: ShaderProgram;
  private compositeProg!: ShaderProgram;
  private blitProg!: ShaderProgram;
  private gridProg!: ShaderProgram;
  private quadVAO!: WebGLVertexArrayObject;
  private quadVBO!: WebGLBuffer;
  private fboA!: FBOTarget;
  private fboB!: FBOTarget;
  private scratchFBO!: FBOTarget;
  private texCache!: TextureCache;

  private canvasW = 1;
  private canvasH = 1;
  private viewportW = 1;
  private viewportH = 1;
  private transform: ViewTransform = { panX: 0, panY: 0, zoom: 1 };
  private layers: RenderLayerSpec[] = [];
  private pendingData = new Map<string, Uint8ClampedArray>();
  private dirty: DirtyFlags = DirtyFlag.FULL;
  private showGrid = false;
  private showCheckerboard = true;
  private rafId: number | null = null;

  // Scratch (in-progress stroke preview)
  private pendingScratch: Uint8ClampedArray | null = null;
  private scratchActive = false;
  private scratchClearPending = false;
  private scratchErase = false;
  private activeLayerId = '';

  // Onion skinning — up to 5 prev + 5 next tinted overlays
  private static readonly MAX_ONION = 5;
  private onionPrevFBOs: FBOTarget[] = [];
  private onionNextFBOs: FBOTarget[] = [];
  private onionPrevCount = 0;
  private onionNextCount = 0;
  private pendingOnionPrev: (Uint8ClampedArray | null)[] = [];
  private pendingOnionNext: (Uint8ClampedArray | null)[] = [];
  private onionOpacity = 0.5;
  private onionPendingUpdate = false;

  // ── Initialization ──────────────────────────────────────────────────────────

  init(canvas: HTMLCanvasElement): void {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) throw new Error('WebGL2 is not supported in this environment');
    this.gl = gl;

    this.checkerProg = this.compileProgram(QUAD_VERT, CHECKERBOARD_FRAG, {
      attribs: ['a_position'],
      uniforms: ['u_ndcMin', 'u_ndcMax', 'u_quadScreenSize', 'u_tileScreenSize', 'u_color0', 'u_color1'],
    });
    this.compositeProg = this.compileProgram(QUAD_VERT, COMPOSITE_FRAG, {
      attribs: ['a_position'],
      uniforms: ['u_ndcMin', 'u_ndcMax', 'u_layer', 'u_composite', 'u_opacity', 'u_blendMode', 'u_scratch', 'u_applyErase'],
    });
    this.blitProg = this.compileProgram(QUAD_VERT, BLIT_FRAG, {
      attribs: ['a_position'],
      uniforms: [
        'u_ndcMin', 'u_ndcMax',
        'u_texture', 'u_scratchTex',
        'u_eraseMode', 'u_globalAlpha', 'u_tintColor',
      ],
    });
    this.gridProg = this.compileProgram(QUAD_VERT, GRID_FRAG, {
      attribs: ['a_position'],
      uniforms: ['u_ndcMin', 'u_ndcMax', 'u_quadScreenSize', 'u_zoom', 'u_color'],
    });

    this.quadVAO = gl.createVertexArray();
    this.quadVBO = gl.createBuffer();
    gl.bindVertexArray(this.quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    // Unit quad triangle strip: TL, TR, BL, BR (a_position y=0 is top, y=1 is bottom)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.texCache = new TextureCache(gl);
    this.fboA = this.createFBO(1, 1);
    this.fboB = this.createFBO(1, 1);
    this.scratchFBO = this.createFBO(1, 1);
    for (let i = 0; i < RenderingEngine.MAX_ONION; i++) {
      this.onionPrevFBOs.push(this.createFBO(1, 1));
      this.onionNextFBOs.push(this.createFBO(1, 1));
    }

    this.dirty = DirtyFlag.FULL;
  }

  // ── Public data API ─────────────────────────────────────────────────────────

  setCanvasSize(w: number, h: number): void {
    if (this.canvasW === w && this.canvasH === h) return;
    this.canvasW = w;
    this.canvasH = h;
    // Evict all cached layer textures — they were allocated at the old size.
    // texSubImage2D would fail with GL_INVALID_VALUE if we tried to upload
    // new-size pixel data into an old-size texture.
    this.texCache.flush();
    this.resizeFBO(this.fboA, w, h);
    this.resizeFBO(this.fboB, w, h);
    this.resizeFBO(this.scratchFBO, w, h);
    for (const fbo of [...this.onionPrevFBOs, ...this.onionNextFBOs]) {
      this.resizeFBO(fbo, w, h);
    }
    this.markDirty(DirtyFlag.FULL);
  }

  /**
   * Supply pre-composited RGBA pixel arrays for onion skin frames.
   * prevFrames[0] = 1 frame back, prevFrames[1] = 2 frames back, etc.
   * Pass empty arrays to disable onion skin rendering.
   */
  setOnionFrames(
    prevFrames: (Uint8ClampedArray | null)[],
    nextFrames: (Uint8ClampedArray | null)[],
    opacity: number,
  ): void {
    this.pendingOnionPrev = prevFrames.slice(0, RenderingEngine.MAX_ONION);
    this.pendingOnionNext = nextFrames.slice(0, RenderingEngine.MAX_ONION);
    this.onionOpacity = opacity;
    this.onionPendingUpdate = true;
    this.markDirty(DirtyFlag.OVERLAY);
  }

  resize(viewportW: number, viewportH: number): void {
    if (this.viewportW === viewportW && this.viewportH === viewportH) return;
    this.viewportW = viewportW;
    this.viewportH = viewportH;
    this.gl.viewport(0, 0, viewportW, viewportH);
    this.markDirty(DirtyFlag.FULL);
  }

  setTransform(panX: number, panY: number, zoom: number): void {
    this.transform = { panX, panY, zoom };
    this.markDirty(DirtyFlag.OVERLAY);
  }

  setLayers(specs: RenderLayerSpec[]): void {
    this.layers = specs;
    this.markDirty(DirtyFlag.LAYER_ORDER);
  }

  uploadLayerData(layerId: string, data: Uint8ClampedArray): void {
    this.pendingData.set(layerId, data);
    this.markDirty(DirtyFlag.LAYER_DATA);
  }

  markDirty(flags: DirtyFlags): void {
    this.dirty |= flags;
  }

  setShowGrid(v: boolean): void {
    if (this.showGrid !== v) {
      this.showGrid = v;
      this.markDirty(DirtyFlag.OVERLAY);
    }
  }

  setShowCheckerboard(v: boolean): void {
    if (this.showCheckerboard !== v) {
      this.showCheckerboard = v;
      this.markDirty(DirtyFlag.FULL);
    }
  }

  /** Uploads in-progress stroke pixels to the scratch GPU texture. */
  updateScratch(data: Uint8ClampedArray): void {
    this.pendingScratch = data;
    this.scratchActive = true;
    this.markDirty(DirtyFlag.OVERLAY);
  }

  /** Clears the scratch GPU texture (called on pointerUp / tool cancel). */
  clearScratch(): void {
    this.scratchActive = false;
    this.scratchClearPending = true;
    this.pendingScratch = null;
    this.scratchErase = false;
    this.markDirty(DirtyFlag.OVERLAY);
  }

  /**
   * Switch scratch overlay blend mode:
   *   false → normal SRC_OVER (pencil/line preview)
   *   true  → DST_OUT (eraser preview — punches through composite to checkerboard)
   */
  setScratchErase(on: boolean): void {
    if (this.scratchErase !== on) {
      this.scratchErase = on;
      this.markDirty(DirtyFlag.OVERLAY);
    }
  }

  setActiveLayer(id: string): void {
    if (this.activeLayerId !== id) {
      this.activeLayerId = id;
      this.markDirty(DirtyFlag.OVERLAY);
    }
  }

  // ── Render loop ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.rafId !== null) return;
    const loop = () => {
      this.texCache.tick();
      if (this.dirty) {
        this.render();
        this.dirty = 0;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ── Pixel reading (eyedropper) ───────────────────────────────────────────────

  readPixel(cx: number, cy: number): [number, number, number, number] {
    const { gl, fboA } = this;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fboA.fbo);
    const px = new Uint8Array(4);
    gl.readPixels(
      Math.floor(cx),
      this.canvasH - 1 - Math.floor(cy), // flip Y (GL origin = bottom-left)
      1, 1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      px,
    );
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    return [px[0]!, px[1]!, px[2]!, px[3]!];
  }

  dispose(): void {
    this.stop();
    const { gl } = this;
    this.texCache.dispose();
    this.deleteFBO(this.fboA);
    this.deleteFBO(this.fboB);
    this.deleteFBO(this.scratchFBO);
    for (const fbo of [...this.onionPrevFBOs, ...this.onionNextFBOs]) {
      this.deleteFBO(fbo);
    }
    gl.deleteBuffer(this.quadVBO);
    gl.deleteVertexArray(this.quadVAO);
    for (const p of [this.checkerProg, this.compositeProg, this.blitProg, this.gridProg]) {
      gl.deleteProgram(p.program);
    }
  }

  // ── Onion helpers ────────────────────────────────────────────────────────────

  private uploadOnionTexture(fbo: FBOTarget, data: Uint8ClampedArray | null): void {
    const { gl } = this;
    if (!data) {
      // Clear to transparent
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      gl.viewport(0, 0, this.canvasW, this.canvasH);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.viewportW, this.viewportH);
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.canvasW, this.canvasH, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  // ── Internal rendering ───────────────────────────────────────────────────────

  private render(): void {
    // Upload any pending layer data before compositing
    for (const [id, data] of this.pendingData) {
      this.texCache.upload(id, data, this.canvasW, this.canvasH);
    }
    this.pendingData.clear();

    // Upload pending scratch buffer (re-uses the scratch FBO's color texture)
    if (this.pendingScratch) {
      const { gl } = this;
      gl.bindTexture(gl.TEXTURE_2D, this.scratchFBO.texture);
      // UNPACK_FLIP_Y_WEBGL mirrors the row order on upload so that after the
      // Y-flip in blit.frag, scratch pixel (x, y) appears at canvas coord (x, y).
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        this.canvasW,
        this.canvasH,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.pendingScratch,
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      this.pendingScratch = null;
    }
    // Upload pending onion frames — only when setOnionFrames was explicitly called
    if (this.onionPendingUpdate) {
      for (let i = 0; i < this.pendingOnionPrev.length; i++) {
        const data = this.pendingOnionPrev[i] ?? null;
        const fbo = this.onionPrevFBOs[i];
        if (fbo) this.uploadOnionTexture(fbo, data);
      }
      this.onionPrevCount = this.pendingOnionPrev.length;
      for (let i = 0; i < this.pendingOnionNext.length; i++) {
        const data = this.pendingOnionNext[i] ?? null;
        const fbo = this.onionNextFBOs[i];
        if (fbo) this.uploadOnionTexture(fbo, data);
      }
      this.onionNextCount = this.pendingOnionNext.length;
      this.pendingOnionPrev = [];
      this.pendingOnionNext = [];
      this.onionPendingUpdate = false;
    }

    if (this.scratchClearPending) {
      // Clear the scratch texture to fully transparent
      const { gl } = this;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.scratchFBO.fbo);
      gl.viewport(0, 0, this.canvasW, this.canvasH);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.viewportW, this.viewportH);
      this.scratchClearPending = false;
    }

    const needComposite = this.dirty & (DirtyFlag.LAYER_DATA | DirtyFlag.LAYER_ORDER | DirtyFlag.FULL);
    const eraseOverlay = this.scratchActive && this.scratchErase && (this.dirty & DirtyFlag.OVERLAY);
    if (needComposite || eraseOverlay) {
      this.compositeToFBO();
    }

    this.drawToScreen();
  }

  /** Composites all visible layers bottom-to-top into fboA via ping-pong. */
  private compositeToFBO(): void {
    const { gl, fboA, fboB } = this;

    // Clear fboA (starting composite is transparent)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA.fbo);
    gl.viewport(0, 0, this.canvasW, this.canvasH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.compositeProg.program);
    gl.bindVertexArray(this.quadVAO);

    // FBO draws use fullscreen NDC (the FBO is exactly canvas-sized)
    const { minX, minY, maxX, maxY } = FULLSCREEN_NDC;
    this.setNdcUniforms(this.compositeProg, minX, minY, maxX, maxY);

    // Texture units
    gl.uniform1i(u(this.compositeProg, 'u_layer'), 0);
    gl.uniform1i(u(this.compositeProg, 'u_composite'), 1);
    gl.uniform1i(u(this.compositeProg, 'u_scratch'), 2);

    // Bind scratch texture to TEXTURE2 for erase preview
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.scratchFBO.texture);

    let src = fboA;
    let dst = fboB;

    for (const layer of this.layers) {
      if (!layer.visible) continue;
      const tex = this.texCache.get(layer.id);
      if (!tex) continue;

      // Bind destination FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, this.canvasW, this.canvasH);

      // u_layer = this layer's texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);

      // u_composite = current accumulated composite
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, src.texture);

      gl.uniform1f(u(this.compositeProg, 'u_opacity'), layer.opacity);
      gl.uniform1i(u(this.compositeProg, 'u_blendMode'), BLEND_MODE_INDEX[layer.blendMode] ?? 0);
      // Apply erase preview only to the active layer
      const applyErase = this.scratchActive && this.scratchErase && layer.id === this.activeLayerId ? 1 : 0;
      gl.uniform1i(u(this.compositeProg, 'u_applyErase'), applyErase);

      gl.disable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Swap ping-pong buffers
      const tmp = src;
      src = dst;
      dst = tmp;
    }

    // If src is not fboA, copy result into fboA so callers always read from fboA
    if (src !== fboA) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fboA.fbo);
      gl.blitFramebuffer(
        0, 0, this.canvasW, this.canvasH,
        0, 0, this.canvasW, this.canvasH,
        gl.COLOR_BUFFER_BIT,
        gl.NEAREST,
      );
    }

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.viewportW, this.viewportH);
  }

  /** Draws the final frame to the screen canvas. */
  private drawToScreen(): void {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.viewportW, this.viewportH);

    // Clear to the editor background color (--bg-0: #0d0d0f)
    gl.clearColor(0.051, 0.051, 0.059, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const { minX, minY, maxX, maxY } = this.canvasQuadNdc();
    const qw = this.canvasW * this.transform.zoom;
    const qh = this.canvasH * this.transform.zoom;

    // 1. Checkerboard (opaque, no blend)
    if (this.showCheckerboard) {
      gl.useProgram(this.checkerProg.program);
      gl.bindVertexArray(this.quadVAO);
      this.setNdcUniforms(this.checkerProg, minX, minY, maxX, maxY);
      gl.uniform2f(u(this.checkerProg, 'u_quadScreenSize'), qw, qh);
      // Each checker tile = one canvas pixel on screen (zoom screen pixels wide).
      // Clamp to a minimum so sub-pixel zoom doesn't collapse to zero tile size.
      gl.uniform1f(u(this.checkerProg, 'u_tileScreenSize'), Math.max(this.transform.zoom, 1));
      gl.uniform4f(u(this.checkerProg, 'u_color0'), 0.376, 0.376, 0.376, 1.0); // #606060
      gl.uniform4f(u(this.checkerProg, 'u_color1'), 0.251, 0.251, 0.251, 1.0); // #404040
      gl.disable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Setup blitProg — shared for onion, composite, and scratch passes
    gl.useProgram(this.blitProg.program);
    gl.bindVertexArray(this.quadVAO);
    this.setNdcUniforms(this.blitProg, minX, minY, maxX, maxY);
    // Bind scratch to TEXTURE1 (shared across all blit passes)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.scratchFBO.texture);
    gl.uniform1i(u(this.blitProg, 'u_scratchTex'), 1);
    gl.uniform1i(u(this.blitProg, 'u_eraseMode'), 0);
    gl.uniform4f(u(this.blitProg, 'u_tintColor'), 0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 2a. Onion skin — prev frames (red tint), rendered before the composite
    for (let i = this.onionPrevCount - 1; i >= 0; i--) {
      const fbo = this.onionPrevFBOs[i];
      if (!fbo) continue;
      const alpha = this.onionOpacity * (1 - i * 0.2);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
      gl.uniform1i(u(this.blitProg, 'u_texture'), 0);
      gl.uniform1f(u(this.blitProg, 'u_globalAlpha'), alpha);
      gl.uniform4f(u(this.blitProg, 'u_tintColor'), 1.0, 0.2, 0.2, 0.4); // red tint
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // 2b. Onion skin — next frames (blue tint)
    for (let i = this.onionNextCount - 1; i >= 0; i--) {
      const fbo = this.onionNextFBOs[i];
      if (!fbo) continue;
      const alpha = this.onionOpacity * (1 - i * 0.2);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
      gl.uniform1i(u(this.blitProg, 'u_texture'), 0);
      gl.uniform1f(u(this.blitProg, 'u_globalAlpha'), alpha);
      gl.uniform4f(u(this.blitProg, 'u_tintColor'), 0.2, 0.4, 1.0, 0.4); // blue tint
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // 2c. Blit composite FBO (alpha blended over checkerboard/onion).
    //     When erasing, the shader cuts holes via scratch alpha (no DST_OUT artifacts).
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboA.texture);
    gl.uniform1i(u(this.blitProg, 'u_texture'), 0);
    gl.uniform1i(u(this.blitProg, 'u_eraseMode'), 0); // erase handled in compositeToFBO
    gl.uniform1f(u(this.blitProg, 'u_globalAlpha'), 1.0);
    gl.uniform4f(u(this.blitProg, 'u_tintColor'), 0, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2d. Scratch SRC_OVER for non-erase preview (pencil/line)
    if (this.scratchActive && !this.scratchErase) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.scratchFBO.texture);
      gl.uniform1i(u(this.blitProg, 'u_texture'), 0);
      gl.uniform1i(u(this.blitProg, 'u_eraseMode'), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.BLEND);

    // 3. Pixel grid (only at zoom >= 2)
    if (this.showGrid && this.transform.zoom >= 2) {
      gl.useProgram(this.gridProg.program);
      gl.bindVertexArray(this.quadVAO);
      this.setNdcUniforms(this.gridProg, minX, minY, maxX, maxY);
      gl.uniform2f(u(this.gridProg, 'u_quadScreenSize'), qw, qh);
      gl.uniform1f(u(this.gridProg, 'u_zoom'), this.transform.zoom);
      gl.uniform4f(u(this.gridProg, 'u_color'), 0.0, 0.0, 0.0, 0.3);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disable(gl.BLEND);
    }

    gl.bindVertexArray(null);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Computes the NDC bounding box of the canvas quad at the current transform. */
  private canvasQuadNdc(): { minX: number; minY: number; maxX: number; maxY: number } {
    const { panX, panY, zoom } = this.transform;
    const { viewportW: vw, viewportH: vh, canvasW, canvasH } = this;
    // Screen coords of canvas corners
    const screenL = panX;
    const screenT = panY;
    const screenR = panX + canvasW * zoom;
    const screenB = panY + canvasH * zoom;
    // NDC: x = s/vw*2-1, y = 1-s/vh*2 (Y-flip for GL)
    return {
      minX: (screenL / vw) * 2 - 1,
      minY: 1 - (screenT / vh) * 2, // top of canvas quad
      maxX: (screenR / vw) * 2 - 1,
      maxY: 1 - (screenB / vh) * 2, // bottom of canvas quad
    };
  }

  private setNdcUniforms(
    prog: ShaderProgram,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): void {
    this.gl.uniform2f(u(prog, 'u_ndcMin'), minX, minY);
    this.gl.uniform2f(u(prog, 'u_ndcMax'), maxX, maxY);
  }

  // ── FBO management ───────────────────────────────────────────────────────────

  private createFBO(width: number, height: number): FBOTarget {
    const { gl } = this;
    const fbo = gl.createFramebuffer();
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, texture, width, height };
  }

  private resizeFBO(target: FBOTarget, width: number, height: number): void {
    const { gl } = this;
    target.width = width;
    target.height = height;
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  private deleteFBO(target: FBOTarget): void {
    this.gl.deleteFramebuffer(target.fbo);
    this.gl.deleteTexture(target.texture);
  }

  // ── Shader compilation ───────────────────────────────────────────────────────

  private compileProgram(
    vertSrc: string,
    fragSrc: string,
    schema: { attribs: string[]; uniforms: string[] },
  ): ShaderProgram {
    const { gl } = this;
    const vert = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);

    // Bind attrib locations before linking
    schema.attribs.forEach((name, idx) => gl.bindAttribLocation(program, idx, name));

    gl.linkProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`WebGL program link error: ${log}`);
    }

    const attribs: Record<string, number> = {};
    for (const name of schema.attribs) {
      attribs[name] = gl.getAttribLocation(program, name);
    }
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of schema.uniforms) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }

    return { program, attribs, uniforms };
  }

  private compileShader(type: number, src: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`WebGL shader compile error: ${log}`);
    }
    return shader;
  }
}
