#!/usr/bin/env node
/**
 * Local OpenRouter image generation with a hard $0.90 session budget.
 * Never logs or writes API keys. Never called from browser code.
 */

import { mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ASSET_SPECS, GEM_IDS } from "./asset-catalog.mjs";
import { generatePlaceholders } from "./procedural-placeholders.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GENERATED = join(ROOT, ".generated-assets");
const RAW = join(GENERATED, "raw");
const BUDGET_PATH = join(GENERATED, "session-budget.json");
const PUBLIC = join(ROOT, "public");

/** Prefer transparent PNG support + low per-image cost at quality=low */
const MODEL = "openai/gpt-image-1-mini";
const PROVIDER = "openrouter";
const SAFE_BUDGET_USD = 0.9;
/** Conservative estimate when usage.cost is missing (observed ~$0.002 at quality=low) */
const FALLBACK_COST_USD = 0.01;
const API_BASE = "https://openrouter.ai/api/v1";

function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function ensureDirs() {
  mkdirSync(RAW, { recursive: true });
  mkdirSync(join(PUBLIC, "assets"), { recursive: true });
}

/**
 * Discover pricing. Token-billed models use a conservative per-image estimate.
 */
async function discoverCostPerImage() {
  try {
    const res = await fetch(`${API_BASE}/images/models/${MODEL}/endpoints`);
    if (!res.ok) return { costUsd: FALLBACK_COST_USD, note: `endpoints HTTP ${res.status}` };
    const data = await res.json();
    const endpoints = data.endpoints || [];
    let flat = null;
    let token = null;
    for (const ep of endpoints) {
      for (const p of ep.pricing || []) {
        if (p.billable === "output_image" && p.unit === "image" && typeof p.cost_usd === "number") {
          if (flat === null || p.cost_usd < flat) flat = p.cost_usd;
        }
        if (p.billable === "output_image" && p.unit === "token" && typeof p.cost_usd === "number") {
          token = p.cost_usd;
        }
      }
    }
    if (flat !== null) return { costUsd: flat, note: "flat per-image from endpoints API" };
    if (token !== null) {
      // ~300 image tokens at quality=low observed; pad conservatively to ~1250 tokens
      const estimate = Math.max(FALLBACK_COST_USD, token * 1250);
      return {
        costUsd: Number(estimate.toFixed(4)),
        note: `token-billed ($${token}/token); conservative $${estimate.toFixed(4)}/image at quality=low`,
      };
    }
    return { costUsd: FALLBACK_COST_USD, note: "no pricing; using conservative estimate" };
  } catch {
    return { costUsd: FALLBACK_COST_USD, note: "endpoints fetch failed; using conservative estimate" };
  }
}

function copyToPublic(rawPath, publicRel) {
  const dest = join(PUBLIC, publicRel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(rawPath, dest);
  return publicRel;
}

function updateManifestSources(generatedIds) {
  const manifestPath = join(PUBLIC, "assets/manifest.json");
  /** @type {Record<string, { source: string, path: string }>} */
  let manifest = {};
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  }
  for (const id of generatedIds) {
    const spec = ASSET_SPECS.find((s) => s.id === id);
    if (!spec) continue;
    manifest[id] = { source: "generated", path: `/${spec.publicPath}` };
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

function printReport(budget, skipped) {
  const paid = budget.requests.filter(
    (r) => r.status === "generated" || r.status === "failed_billed",
  );
  const generated = budget.requests
    .filter((r) => r.status === "generated")
    .map((r) => r.assetId);
  const failed = budget.requests
    .filter((r) => r.status.startsWith("failed"))
    .map((r) => r.assetId);
  const budgetSkip = budget.requests
    .filter((r) => r.status === "skipped_budget")
    .map((r) => r.assetId);
  const noKey = skipped.noKey || [];

  console.log("\n=== Session budget report ===");
  console.log(`Provider: ${budget.provider}`);
  console.log(`Model: ${budget.model}`);
  console.log(`Paid generation requests: ${paid.length}`);
  console.log(
    `Estimated spent: $${budget.estimatedSpentUsd.toFixed(4)} / $${SAFE_BUDGET_USD.toFixed(2)} safe budget`,
  );
  console.log(
    `Assets successfully generated: ${generated.length ? generated.join(", ") : "(none)"}`,
  );
  if (failed.length) console.log(`Failed: ${failed.join(", ")}`);
  if (budgetSkip.length) console.log(`Skipped (budget): ${budgetSkip.join(", ")}`);
  if (noKey.length) console.log(`Skipped (no/invalid key): ${noKey.join(", ")}`);
  const stillPlaceholder = ASSET_SPECS.filter((s) => !generated.includes(s.id)).map(
    (s) => s.id,
  );
  console.log(
    `Placeholder assets still required: ${stillPlaceholder.length ? stillPlaceholder.join(", ") : "(none)"}`,
  );
  console.log(`Budget file: ${BUDGET_PATH}`);
}

/** Client errors and incomplete generations are treated as unbilled. */
function isUnbilledStatus(status) {
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 422 || status === 502 || status === 499;
}

async function generateOne(apiKey, spec, costUsd) {
  const body = {
    model: MODEL,
    prompt: spec.prompt,
    n: 1,
    quality: "low",
    background: spec.background === "transparent" ? "transparent" : "opaque",
  };

  const res = await fetch(`${API_BASE}/images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    await res.text().catch(() => "");
    return {
      ok: false,
      billed: !isUnbilledStatus(res.status),
      error: `HTTP ${res.status}`,
    };
  }

  const json = await res.json();
  const image = json?.data?.[0];
  if (!image?.b64_json) {
    return { ok: false, billed: false, error: "missing image payload" };
  }

  const actualCost =
    typeof json?.usage?.cost === "number" ? json.usage.cost : costUsd;

  const rawPath = join(RAW, `${spec.id}.png`);
  writeFileSync(rawPath, Buffer.from(image.b64_json, "base64"));
  copyToPublic(rawPath, spec.publicPath);

  return { ok: true, billed: true, costUsd: actualCost, rawPath };
}

function parseOnlyIds() {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  const ids = arg
    .slice("--only=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(ids);
}

async function main() {
  ensureDirs();
  const env = loadEnv();
  const apiKey = env.OPENROUTER_API_KEY || "";
  const onlyIds = parseOnlyIds();
  const specs = onlyIds
    ? ASSET_SPECS.filter((s) => onlyIds.has(s.id))
    : ASSET_SPECS.filter((s) => !s.skipByDefault);

  if (onlyIds && specs.length === 0) {
    console.error("No matching assets for --only filter.");
    process.exitCode = 1;
    return;
  }

  /** @type {{ sessionStartedAt: string, provider: string, model: string, safeBudgetUsd: number, estimatedSpentUsd: number, costPerImageUsd: number, costNote: string, requests: Array<{assetId: string, estimatedCostUsd: number, status: string, error?: string}> }} */
  const budget = {
    sessionStartedAt: new Date().toISOString(),
    provider: PROVIDER,
    model: MODEL,
    safeBudgetUsd: SAFE_BUDGET_USD,
    estimatedSpentUsd: 0,
    costPerImageUsd: FALLBACK_COST_USD,
    costNote: "",
    requests: [],
  };

  // When regenerating a subset, keep existing generated assets; only fill missing placeholders.
  if (!onlyIds) {
    generatePlaceholders();
  }

  if (!apiKey || apiKey.length < 20) {
    for (const spec of specs) {
      budget.requests.push({
        assetId: spec.id,
        estimatedCostUsd: 0,
        status: "skipped_no_key",
      });
    }
    writeFileSync(BUDGET_PATH, JSON.stringify(budget, null, 2) + "\n");
    printReport(budget, { noKey: specs.map((s) => s.id) });
    console.log("No valid OPENROUTER_API_KEY; using procedural placeholders only.");
    return;
  }

  const pricing = await discoverCostPerImage();
  budget.costPerImageUsd = pricing.costUsd;
  budget.costNote = pricing.note;
  console.log(`Model ${MODEL}; estimated cost/image $${pricing.costUsd} (${pricing.note})`);
  if (onlyIds) console.log(`Only regenerating: ${[...onlyIds].join(", ")}`);

  /** @type {string[]} */
  const generatedIds = [];
  let stopBudget = false;

  for (const spec of specs) {
    if (stopBudget) {
      budget.requests.push({
        assetId: spec.id,
        estimatedCostUsd: 0,
        status: "skipped_budget",
      });
      continue;
    }

    const nextCost = budget.costPerImageUsd;
    if (budget.estimatedSpentUsd + nextCost > SAFE_BUDGET_USD) {
      stopBudget = true;
      budget.requests.push({
        assetId: spec.id,
        estimatedCostUsd: 0,
        status: "skipped_budget",
      });
      console.log(`Budget would exceed $${SAFE_BUDGET_USD}; stopping paid generation.`);
      continue;
    }

    console.log(`Generating ${spec.id}…`);
    let result;
    try {
      result = await generateOne(apiKey, spec, nextCost);
    } catch {
      // Network/parse failures: count conservatively
      result = { ok: false, billed: true, error: "request exception" };
    }

    if (result.ok) {
      const cost = result.costUsd ?? nextCost;
      budget.estimatedSpentUsd = Number((budget.estimatedSpentUsd + cost).toFixed(6));
      budget.requests.push({
        assetId: spec.id,
        estimatedCostUsd: cost,
        status: "generated",
      });
      generatedIds.push(spec.id);
      console.log(`  ok (~$${Number(cost).toFixed(4)})`);
    } else {
      if (result.billed) {
        budget.estimatedSpentUsd = Number(
          (budget.estimatedSpentUsd + nextCost).toFixed(6),
        );
        budget.requests.push({
          assetId: spec.id,
          estimatedCostUsd: nextCost,
          status: "failed_billed",
          error: result.error,
        });
      } else {
        budget.requests.push({
          assetId: spec.id,
          estimatedCostUsd: 0,
          status: "failed_unbilled",
          error: result.error,
        });
      }
      console.log(`  failed (${result.error}); continuing without retry`);
    }

    writeFileSync(BUDGET_PATH, JSON.stringify(budget, null, 2) + "\n");
  }

  /** @type {Record<string, string>} */
  const sources = {};
  // Preserve previously generated assets in the manifest when doing --only
  const manifestPath = join(PUBLIC, "assets/manifest.json");
  if (existsSync(manifestPath)) {
    const existing = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const [id, entry] of Object.entries(existing)) {
      if (entry?.source === "generated") sources[id] = "generated";
    }
  }
  for (const id of generatedIds) sources[id] = "generated";
  if (!onlyIds) generatePlaceholders(sources);
  updateManifestSources(Object.keys(sources));

  void GEM_IDS;

  if (generatedIds.length) {
    const post = spawnSync(process.execPath, [join(__dirname, "postprocess-assets.mjs")], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (post.status !== 0) {
      console.log("Post-process reported an error; continuing with raw assets.");
    }
  }

  writeFileSync(BUDGET_PATH, JSON.stringify(budget, null, 2) + "\n");
  printReport(budget, {});
}

main().catch((err) => {
  console.error(
    "Generation script failed:",
    err instanceof Error ? err.message : "unknown error",
  );
  process.exitCode = 1;
});
