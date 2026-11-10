// The settings families see (privacy notice, help address) must be real before release, not placeholders.
import test from "node:test";
import assert from "node:assert/strict";
import {HELP_EMAIL, SUPABASE_REGION} from "../../src/config.js";

test("the help address and data region are filled in", () => {
  assert.match(HELP_EMAIL, /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i, "set HELP_EMAIL in src/config.js");
  assert.doesNotMatch(HELP_EMAIL, /TBD|example\./i, "set HELP_EMAIL in src/config.js");
  assert.doesNotMatch(SUPABASE_REGION, /TBD/, "set SUPABASE_REGION in src/config.js");
});
