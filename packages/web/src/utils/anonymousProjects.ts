const STORAGE_KEY = 'mockd_anonymous_projects';

interface AnonymousProjectEntry {
  id: string;
  createdAt: string; // ISO timestamp
}

/**
 * Get all anonymous project IDs from localStorage
 */
export function getAnonymousProjectIds(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const entries: AnonymousProjectEntry[] = JSON.parse(stored);
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Filter out expired entries (older than 1 week)
    const validEntries = entries.filter(entry => {
      const createdTime = new Date(entry.createdAt).getTime();
      return createdTime > oneWeekAgo;
    });

    // If some entries were filtered out, update storage
    if (validEntries.length !== entries.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validEntries));
    }

    return validEntries.map(e => e.id);
  } catch {
    return [];
  }
}

/**
 * Add an anonymous project ID to localStorage
 */
export function addAnonymousProjectId(projectId: string): void {
  try {
    const ids = getAnonymousProjectIds();
    if (ids.includes(projectId)) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    const entries: AnonymousProjectEntry[] = stored ? JSON.parse(stored) : [];

    entries.push({
      id: projectId,
      createdAt: new Date().toISOString(),
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Remove an anonymous project ID from localStorage
 */
export function removeAnonymousProjectId(projectId: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const entries: AnonymousProjectEntry[] = JSON.parse(stored);
    const filtered = entries.filter(e => e.id !== projectId);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Check if a project ID is in the anonymous projects list
 */
export function isAnonymousProjectOwned(projectId: string): boolean {
  return getAnonymousProjectIds().includes(projectId);
}
