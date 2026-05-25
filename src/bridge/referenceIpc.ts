import { invoke } from '@tauri-apps/api/core';

export interface ReferenceImageResult {
  pixels: number[];
  width: number;
  height: number;
}

export async function ipcLoadReferenceImage(path: string): Promise<ReferenceImageResult> {
  return invoke('load_reference_image', { path });
}
