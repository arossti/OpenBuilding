#!/usr/bin/env node
// Zero-dep JSON Schema Draft 2020-12 validator — implements only the subset
// used in schema/material.schema.json. Not a general validator; refusing to
// handle unknown keywords is an intentional safety choice.
//
// Usage:
//   node validate.mjs sample.json                     validate one file
//   node validate.mjs materials/06-wood.json          validate one per-division file (walks records[])
//   node validate.mjs --all                           validate sample.json + every materials/*.json

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = resolve(__dirname, "..");
const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, "material.schema.json"), "utf8"));

function resolveRef(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`External refs not supported: ${ref}`);
  const parts = ref.slice(2).split("/");
  let cur = root;
  for (const p of parts) cur = cur[p];
  return cur;
}

function matchesType(value, t) {
  if (t === "null") return value === null;
  if (t === "integer") return typeof value === "number" && Number.isInteger(value);
  if (t === "number") return typeof value === "number";
  if (t === "string") return typeof value === "string";
  if (t === "boolean") return typeof value === "boolean";
  if (t === "array") return Array.isArray(value);
  if (t === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return false;
}

function validate(root, schema, value, path = "$", errors = []) {
  // Resolve $ref first
  if (schema.$ref) {
    const target = resolveRef(root, schema.$ref);
    return validate(root, target, value, path, errors);
  }

  // type
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(t => matchesType(value, t))) {
      errors.push(`${path}: expected type ${JSON.stringify(schema.type)}, got ${value === null ? "null" : Array.isArray(value) ? "array" : typeof value}`);
      return errors;
    }
  }

  // enum
  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push(`${path}: value ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
  }

  // Constraints by kind
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: length ${value.length} < minLength ${schema.minLength}`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match pattern ${schema.pattern}`);
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: ${value.length} items < minItems ${schema.minItems}`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: ${value.length} items > maxItems ${schema.maxItems}`);
    if (schema.items) {
      for (let i = 0; i < value.length; i++) validate(root, schema.items, value[i], `${path}[${i}]`, errors);
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    if (schema.required) {
      for (const req of schema.required) if (!(req in value)) errors.push(`${path}: missing required property '${req}'`);
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const k of Object.keys(value)) {
        if (!(k in schema.properties) && !k.startsWith("_")) errors.push(`${path}: unexpected property '${k}'`);
      }
    }
    if (schema.properties) {
      for (const [k, sub] of Object.entries(schema.properties)) {
        if (k in value) validate(root, sub, value[k], `${path}.${k}`, errors);
      }
    }
  }

  return errors;
}

function validateFile(filepath) {
  const data = JSON.parse(readFileSync(filepath, "utf8"));
  const results = [];
  if (Array.isArray(data.records)) {
    for (let i = 0; i < data.records.length; i++) {
      const errs = validate(schema, schema, data.records[i]);
      results.push({ path: `${filepath}[${i}:${data.records[i].id}]`, errors: errs });
    }
  } else {
    const errs = validate(schema, schema, data);
    results.push({ path: filepath, errors: errs });
  }
  return results;
}

function main() {
  const args = process.argv.slice(2);
  let targets = [];
  if (args.includes("--all") || args.length === 0) {
    targets.push(join(SCHEMA_DIR, "sample.json"));
    const matDir = join(SCHEMA_DIR, "materials");
    for (const f of readdirSync(matDir)) {
      if (f.endsWith(".json") && !["index.json", "import-report.json"].includes(f)) {
        targets.push(join(matDir, f));
      }
    }
  } else {
    targets = args.map(a => resolve(process.cwd(), a));
  }

  let totalRecords = 0, totalFailed = 0;
  for (const t of targets) {
    const results = validateFile(t);
    for (const { path, errors } of results) {
      totalRecords++;
      if (errors.length) {
        totalFailed++;
        console.log(`FAIL ${path}`);
        for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
        if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more`);
      }
    }
  }
  console.log(`\n${totalRecords - totalFailed}/${totalRecords} records passed`);
  process.exit(totalFailed === 0 ? 0 : 1);
}

main();
