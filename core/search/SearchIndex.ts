import { SearchableItem } from './types';

/**
 * Normalizes a string by converting to lowercase, removing accents/diacritics,
 * and replacing special characters/punctuation with spaces.
 */
export function normalizeSearchString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics / accents
    .replace(/[^a-z0-9\s]/g, ' ') // Replace non-alphanumeric chars with space
    .replace(/\s+/g, ' ')
    .trim();
}

// Common Spanish stop words to exclude during multi-word queries
const COMMON_STOPWORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'en', 'un', 'una', 'unos', 'unas',
  'y', 'o', 'a', 'al', 'con', 'por', 'para', 'su', 'sus', 'que', 'es'
]);

interface NormalizedCacheEntry {
  title: string;
  subtitle: string;
  content: string;
  tags: string;
}

export class SearchIndex {
  private items: Map<string, SearchableItem> = new Map();
  private normalizedCache: Map<string, NormalizedCacheEntry> = new Map();
  public readonly version: string = 'v1.0.0';

  // Incremental index updates
  upsertItem(item: SearchableItem): void {
    this.items.set(item.id, item);
    this.normalizedCache.set(item.id, {
      title: normalizeSearchString(item.title),
      subtitle: normalizeSearchString(item.subtitle || ''),
      content: normalizeSearchString(item.content || ''),
      tags: normalizeSearchString((item.affinityTags || []).join(' '))
    });
  }

  removeItem(itemId: string): void {
    this.items.delete(itemId);
    this.normalizedCache.delete(itemId);
  }

  clearModule(moduleId: string): void {
    for (const [id, item] of this.items.entries()) {
      if (item.moduleId === moduleId) {
        this.items.delete(id);
        this.normalizedCache.delete(id);
      }
    }
  }

  clearAll(): void {
    this.items.clear();
    this.normalizedCache.clear();
  }

  /**
   * Optimized Universal Search
   * Supports:
   * - Accent/diacritic insensitivity (e.g. "cotizacion" matches "Cotización")
   * - Token-based multi-term matching (e.g. "levantamientos desamparados")
   * - High-precision relevance scoring
   */
  search(query: string, allowedModules: string[]): SearchableItem[] {
    if (!query || query.trim() === '') return [];

    const rawNormalized = normalizeSearchString(query);
    if (!rawNormalized) return [];

    // Split query into individual search tokens
    const allTokens = rawNormalized.split(' ').filter(Boolean);
    if (allTokens.length === 0) return [];

    // Filter out stopwords if multiple tokens are present and non-stopwords exist
    const nonStopTokens = allTokens.filter(t => !COMMON_STOPWORDS.has(t));
    const queryTokens = (allTokens.length > 1 && nonStopTokens.length > 0) ? nonStopTokens : allTokens;

    const allowedModulesSet = new Set(allowedModules);
    const results: SearchableItem[] = [];

    for (const item of this.items.values()) {
      if (!allowedModulesSet.has(item.moduleId)) continue;

      const norm = this.normalizedCache.get(item.id);
      if (!norm) continue;

      const combinedText = `${norm.title} ${norm.subtitle} ${norm.content} ${norm.tags}`;

      // Verify that ALL search tokens are present in the item
      let allTokensMatch = true;
      for (const token of queryTokens) {
        if (!combinedText.includes(token)) {
          allTokensMatch = false;
          break; // Fast-fail if any token is missing
        }
      }

      if (!allTokensMatch) continue;

      // Relevance Engine Scoring
      let score = 0;

      // 1. Exact or Prefix match on Title (Highest Priority)
      if (norm.title === rawNormalized) {
        score += 500;
      } else if (norm.title.startsWith(rawNormalized)) {
        score += 350;
      } else if (norm.title.includes(rawNormalized)) {
        score += 200;
      }

      // 2. Exact phrase match on Subtitle
      if (norm.subtitle && norm.subtitle.includes(rawNormalized)) {
        score += 100;
      }

      // 3. Individual token score in Title
      for (const token of queryTokens) {
        if (norm.title.includes(token)) {
          score += 60;
          // Word boundary exact match bonus in title
          if (new RegExp(`\\b${token}\\b`).test(norm.title)) {
            score += 30;
          }
        }
      }

      // 4. Individual token score in Subtitle
      for (const token of queryTokens) {
        if (norm.subtitle.includes(token)) {
          score += 35;
        }
      }

      // 5. Individual token score in Affinity Tags / Metadata
      for (const token of queryTokens) {
        if (norm.tags.includes(token)) {
          score += 20;
        }
      }

      // 6. Token score in Content body
      for (const token of queryTokens) {
        if (norm.content.includes(token)) {
          score += 10;
        }
      }

      // 7. Small tie-breaker for recent items
      if (item.updatedAt) {
        const ageHours = (Date.now() - item.updatedAt) / (1000 * 60 * 60);
        if (ageHours < 24) score += 5;
      }

      if (score > 0) {
        results.push({ ...item, score });
      }
    }

    // Sort by relevance score descending
    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  getTotalItems(): number {
    return this.items.size;
  }
}
