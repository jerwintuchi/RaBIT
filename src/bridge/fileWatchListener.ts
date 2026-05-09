import type { ExternalChangeEvent } from './projectIpc';
import { listenExternalChange } from './projectIpc';

/**
 * Registers the file:external_change event listener once on app startup.
 * Returns an unlisten function for cleanup on unmount.
 */
export async function startFileWatchListener(
  onExternalChange: (event: ExternalChangeEvent) => void,
): Promise<() => void> {
  return listenExternalChange(onExternalChange);
}
