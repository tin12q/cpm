const DEFAULT_STAGE_ITEMS = [
  { key: "backlog", name: "Backlog", color: "amber" },
  { key: "in-progress", name: "In Progress", color: "blue" },
  { key: "review", name: "Review", color: "violet" },
  { key: "done", name: "Done", color: "green" },
];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeStages(stages) {
  const source = Array.isArray(stages) && stages.length > 0 ? stages : DEFAULT_STAGE_ITEMS;
  const seen = new Set();

  return source
    .map((stage, index) => {
      if (typeof stage === "string") {
        const name = stage.trim();
        const key = slugify(name || `stage-${index + 1}`);
        return key ? { key, name: name || `Stage ${index + 1}`, color: "slate", order: index } : null;
      }

      const name = String(stage?.name || stage?.label || stage?.key || "").trim();
      const key = slugify(stage?.key || name || `stage-${index + 1}`);
      if (!name || !key || seen.has(key)) return null;
      seen.add(key);
      return {
        key,
        name,
        color: String(stage?.color || "slate").trim() || "slate",
        order: Number.isFinite(stage?.order) ? Number(stage.order) : index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .map((stage, index) => ({ ...stage, order: index }));
}

export function getStageKey(value, stages) {
  const normalized = normalizeStages(stages);
  const raw = String(value || "").trim();
  const direct = normalized.find((stage) => stage.key === raw);
  if (direct) return direct.key;

  const byName = normalized.find((stage) => stage.name.toLowerCase() === raw.toLowerCase());
  if (byName) return byName.key;

  return normalized[0]?.key || DEFAULT_STAGE_ITEMS[0].key;
}

export function getStageName(key, stages) {
  const normalized = normalizeStages(stages);
  const found = normalized.find((stage) => stage.key === key);
  return found?.name || key || normalized[0]?.name || DEFAULT_STAGE_ITEMS[0].name;
}

