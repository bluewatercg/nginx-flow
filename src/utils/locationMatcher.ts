import { LocationConfig } from '@/types/nginx';

export type MatchPriority = 'exact' | 'prefix-priority' | 'regex' | 'prefix' | 'none';

export interface MatchResult {
  matchedLocation: LocationConfig | null;
  priority: MatchPriority;
  priorityLabel: string;
  matchReason: string;
}

const PRIORITY_LABELS = {
  zh: {
    exact: '精确匹配',
    'prefix-priority': '前缀优先 (^~)',
    regex: '正则匹配',
    prefix: '最长前缀匹配',
    none: '无匹配',
  },
  en: {
    exact: 'Exact Match',
    'prefix-priority': 'Prefix Priority (^~)',
    regex: 'Regex Match',
    prefix: 'Longest Prefix Match',
    none: 'No Match',
  },
};

const MATCH_REASONS = {
  zh: {
    exact: (path: string) => `✅ 精确匹配: path === "${path}"`,
    'prefix-priority': (path: string) => `✅ ^~ 前缀优先匹配: "${path}" 阻断了正则搜索`,
    regex: (pattern: string, modifier: string) => 
      `✅ 正则匹配: ${modifier === '~*' ? '(不区分大小写)' : ''} /${pattern}/`,
    prefix: (path: string, length: number) => 
      `✅ 最长前缀匹配: "${path}" (长度: ${length})`,
    none: () => `❌ 无匹配: 404`,
  },
  en: {
    exact: (path: string) => `✅ Exact Match: path === "${path}"`,
    'prefix-priority': (path: string) => `✅ Prefix Priority: "${path}" blocked regex search`,
    regex: (pattern: string, modifier: string) => 
      `✅ Regex Match: ${modifier === '~*' ? '(case-insensitive)' : ''} /${pattern}/`,
    prefix: (path: string, length: number) => 
      `✅ Longest Prefix Match: "${path}" (length: ${length})`,
    none: () => `❌ No Match: 404`,
  },
};

/**
 * Nginx Location Matching Algorithm
 * Implements the official Nginx location matching priority:
 * 
 * 1. Exact match (=) - highest priority, returns immediately
 * 2. Find best prefix candidate (none or ^~)
 * 3. If best prefix is ^~, return immediately (blocks regex)
 * 4. Search regex matches (~ or ~*) in order
 * 5. Fall back to best prefix match
 * 
 * @see http://nginx.org/en/docs/http/ngx_http_core_module.html#location
 */
export function matchLocation(
  requestPath: string,
  locations: LocationConfig[],
  language: 'zh' | 'en' = 'zh'
): MatchResult {
  const labels = PRIORITY_LABELS[language];
  const reasons = MATCH_REASONS[language];

  // ============================================
  // Step 1: Exact Match Check (Priority 1)
  // ============================================
  // If modifier is '=' and path exactly equals requestPath, return immediately
  for (const loc of locations) {
    if (loc.modifier === '=' && loc.path === requestPath) {
      return {
        matchedLocation: loc,
        priority: 'exact',
        priorityLabel: labels.exact,
        matchReason: reasons.exact(loc.path),
      };
    }
  }

  // ============================================
  // Step 2: Find Best Prefix Candidate
  // ============================================
  // Search all non-regex locations (modifier is '' or '^~')
  // Find the one with longest matching prefix
  let bestPrefixNode: LocationConfig | null = null;
  let bestPrefixLength = 0;

  for (const loc of locations) {
    // Only consider non-regex modifiers: none ('') or prefix-priority ('^~')
    if (loc.modifier === '' || loc.modifier === '^~') {
      // Check if requestPath starts with this location's path
      if (requestPath.startsWith(loc.path)) {
        // Keep track of the longest matching prefix
        if (loc.path.length > bestPrefixLength) {
          bestPrefixNode = loc;
          bestPrefixLength = loc.path.length;
        }
      }
    }
  }

  // ============================================
  // Step 3: Check ^~ Optimization (Prefix Priority)
  // ============================================
  // If best prefix has ^~ modifier, stop regex search and return immediately
  if (bestPrefixNode && bestPrefixNode.modifier === '^~') {
    return {
      matchedLocation: bestPrefixNode,
      priority: 'prefix-priority',
      priorityLabel: labels['prefix-priority'],
      matchReason: reasons['prefix-priority'](bestPrefixNode.path),
    };
  }

  // ============================================
  // Step 4: Regex Match Search
  // ============================================
  // Search all regex locations in order (~ for case-sensitive, ~* for case-insensitive)
  // First match wins (order matters!)
  for (const loc of locations) {
    if (loc.modifier === '~' || loc.modifier === '~*') {
      try {
        // ~* means case-insensitive
        const flags = loc.modifier === '~*' ? 'i' : '';
        const regex = new RegExp(loc.path, flags);
        
        if (regex.test(requestPath)) {
          return {
            matchedLocation: loc,
            priority: 'regex',
            priorityLabel: labels.regex,
            matchReason: reasons.regex(loc.path, loc.modifier),
          };
        }
      } catch (e) {
        // Invalid regex pattern, skip this location
        console.warn(`Invalid regex pattern: ${loc.path}`, e);
        continue;
      }
    }
  }

  // ============================================
  // Step 5: Fallback to Best Prefix
  // ============================================
  // If no regex matched, return the best prefix candidate from Step 2
  if (bestPrefixNode) {
    return {
      matchedLocation: bestPrefixNode,
      priority: 'prefix',
      priorityLabel: labels.prefix,
      matchReason: reasons.prefix(bestPrefixNode.path, bestPrefixLength),
    };
  }

  // No match found (404)
  return {
    matchedLocation: null,
    priority: 'none',
    priorityLabel: labels.none,
    matchReason: reasons.none(),
  };
}
