// List prices for the models the tag eval compares, in dollars per million tokens (standard tier), and the
// estimated cost of a call from the usage it reported. Only the comparison page reads these; the eval itself
// doesn't, so this file is not one the runner watches and a price change needs no re-approval.
// Re-check when a provider changes its prices, and update PRICES_CHECKED.
export const PRICES_CHECKED = "2026-11-17";

export const PRICES = {
  // Anthropic: cache writes are the 5-minute cache (1.25x input).
  "claude-opus-5-5": {input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5, source: "https://claude.com/pricing"},
  // Meta, Standard mode. A request over 200K input tokens is billed at the long-context rates in full,
  // not only for the tokens past 200K. Meta lists no cache-write price: those tokens are counted as input.
  "muse-ember-1.0": {input: 0.10, output: 0.50, cacheRead: 0.004, source: "https://dev.meta.ai/docs/pricing-rate-limits",
                     longContext: {over: 200_000, input: 0.30, output: 1.50, cacheRead: 0.012}},
};

// usage: a call's reported usage (input_tokens is the uncached input; thinking is inside output_tokens).
// Returns dollars, or null without a price.
export function costOf(usage = {}, price) {
  if (!price) return null;
  const inp = usage.input_tokens ?? 0, read = usage.cache_read_input_tokens ?? 0, write = usage.cache_creation_input_tokens ?? 0;
  const p = price.longContext && inp + read + write > price.longContext.over ? {...price, ...price.longContext} : price;
  return (inp * p.input + read * (p.cacheRead ?? p.input) + write * (p.cacheWrite ?? p.input) + (usage.output_tokens ?? 0) * p.output) / 1e6;
}
