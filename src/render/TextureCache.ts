interface CacheEntry {
  texture: WebGLTexture;
  lastUsed: number; // frame counter for LRU eviction
}

export class TextureCache {
  private entries = new Map<string, CacheEntry>();
  private frame = 0;

  constructor(
    private gl: WebGL2RenderingContext,
    private maxSize = 64,
  ) {}

  tick(): void {
    this.frame++;
  }

  /** Returns the cached texture, or null on miss. Marks it as recently used. */
  get(key: string): WebGLTexture | null {
    const e = this.entries.get(key);
    if (!e) return null;
    e.lastUsed = this.frame;
    return e.texture;
  }

  /** Uploads data and returns the texture. Creates or replaces the entry. */
  upload(key: string, data: Uint8ClampedArray, width: number, height: number): WebGLTexture {
    const existing = this.entries.get(key);
    if (existing) {
      const { gl } = this;
      gl.bindTexture(gl.TEXTURE_2D, existing.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      existing.lastUsed = this.frame;
      return existing.texture;
    }

    if (this.entries.size >= this.maxSize) {
      this.evictLRU();
    }

    const texture = this.createTexture(data, width, height);
    this.entries.set(key, { texture, lastUsed: this.frame });
    return texture;
  }

  /** Deletes the cached texture for this key. */
  invalidate(key: string): void {
    const e = this.entries.get(key);
    if (e) {
      this.gl.deleteTexture(e.texture);
      this.entries.delete(key);
    }
  }

  dispose(): void {
    for (const e of this.entries.values()) {
      this.gl.deleteTexture(e.texture);
    }
    this.entries.clear();
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestFrame = Infinity;
    for (const [key, e] of this.entries) {
      if (e.lastUsed < oldestFrame) {
        oldestFrame = e.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) this.invalidate(oldestKey);
  }

  private createTexture(data: Uint8ClampedArray, width: number, height: number): WebGLTexture {
    const { gl } = this;
    const tex = gl.createTexture();
    if (!tex) throw new Error('WebGL: failed to create texture');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return tex;
  }
}
