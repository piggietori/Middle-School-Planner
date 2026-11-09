// One field per line so data pull requests show exactly what changed; short lists and small
// objects (bus routes, subway stops, provenance) stay on one line.
const flat = v => v === null || typeof v !== "object"
  ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(flat).join(", ")}]`
  : `{${Object.keys(v).filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}: ${flat(v[k])}`).join(", ")}}`;

const depth = v => v === null || typeof v !== "object" ? 0 : 1 + Math.max(0, ...Object.values(v).map(depth));

function fmt(v, pad) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  const one = flat(v);
  if (one.length <= 100 && depth(v) <= 3) return one;
  const inner = pad + "  ";
  if (Array.isArray(v)) return v.length ? `[\n${v.map(x => inner + fmt(x, inner)).join(",\n")}\n${pad}]` : "[]";
  const keys = Object.keys(v).filter(k => v[k] !== undefined);
  return `{\n${keys.map(k => `${inner}${JSON.stringify(k)}: ${fmt(v[k], inner)}`).join(",\n")}\n${pad}}`;
}

export const formatJson = v => fmt(v, "") + "\n";
