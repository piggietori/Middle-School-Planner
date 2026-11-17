// The models the tag classifier eval can compare, and how to reach each one. Every model here takes the
// same request (Anthropic's Messages format, with a JSON schema for the answer), so the classifier and the
// grading are the same for all of them; only the address and the key differ.
// Each model's runs live in their own folder, so its run names (baseline, v1, ...) never mix with another's.
export const MODELS = {
  "claude-opus-5-5": {
    label: "Claude Opus 5.5", provider: "Anthropic", flow: ".claude/hillclimb/tag-classifier",
    keyEnv: "ANTHROPIC_API_KEY",
  },
  // Meta Model API, Anthropic-compatible endpoint: https://dev.meta.ai/docs/protocols/messages
  // The key goes as a bearer token (Authorization header), not x-api-key.
  "muse-ember-1.0": {
    label: "Muse Ember", provider: "Meta", flow: ".claude/hillclimb/tag-classifier-muse-ember",
    keyEnv: "MODEL_API_KEY", baseURL: "https://api.meta.ai",
  },
};

export const modelFor = id => {
  const m = MODELS[id];
  if (!m) throw new Error(`unknown model '${id}'; the eval knows ${Object.keys(MODELS).join(", ")} (scripts/lib/tag-models.js)`);
  return m;
};

// The options for an Anthropic SDK client that reaches this model. The key is passed explicitly, so the
// SDK reads no other key from the environment: your Anthropic key is never sent to Meta, or the reverse.
export function clientOptions(id, env = process.env) {
  const m = modelFor(id);
  const key = env[m.keyEnv];
  if (!key) throw new Error(`no ${m.provider} API key: set ${m.keyEnv} (docs/testing.md, Tag classifier eval)`);
  return m.baseURL ? {baseURL: m.baseURL, authToken: key} : {apiKey: key};
}
