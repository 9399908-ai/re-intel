// Compatibility scoring ported from python/matching_engine.py so match
// suggestions can be served live by the API. The Python version remains the
// reference implementation for future ML retraining work.

const COMPLEMENTARY_ROLES = {
  owner: ['broker', 'vendor', 'investor'],
  broker: ['owner', 'vendor', 'investor'],
  vendor: ['owner', 'broker', 'investor'],
  investor: ['owner', 'broker'],
};

/**
 * Score compatibility between two users (0-100).
 * Factors: complementary roles (+25), shared market (+20), shared asset class (+20).
 */
export function calculateCompatibility(user1, user2) {
  let score = 0;

  if ((COMPLEMENTARY_ROLES[user1.role] || []).includes(user2.role)) {
    score += 25;
  }

  const markets1 = new Set(user1.markets || []);
  const sharedMarkets = (user2.markets || []).filter((m) => markets1.has(m));
  if (sharedMarkets.length > 0) score += 20;

  const assets1 = new Set(user1.assetTypes || []);
  const sharedAssets = (user2.assetTypes || []).filter((a) => assets1.has(a));
  if (sharedAssets.length > 0) score += 20;

  return Math.min(score, 100);
}

/**
 * Generate top match suggestions per user across all verified users.
 * Returns [{ userId, userName, matchedUserId, matchedName, matchedTitle, matchedCompany, score }]
 */
export function suggestMatches(users, perUser = 2) {
  const suggestions = [];

  for (const user of users) {
    const scored = users
      .filter((other) => other.id !== user.id)
      .map((other) => ({
        userId: user.id,
        userName: user.name,
        matchedUserId: other.id,
        matchedName: other.name,
        matchedTitle: other.title,
        matchedCompany: other.company,
        score: calculateCompatibility(user, other),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, perUser);

    suggestions.push(...scored);
  }

  return suggestions;
}
