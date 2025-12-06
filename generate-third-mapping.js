#!/usr/bin/env node
/**
 * Generates third-mapping.json from the 48-team R32 third-place mapping table.
 *
 * Expected input format (per line):
 *  - A row number
 *  - The 8 groups whose third-place teams advance
 *  - The 8 assignments in this exact order:
 *      1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L
 *
 * We parse defensively:
 *  - Extract the last 8 tokens like "3E"
 *  - Derive the set of 8 group letters primarily from standalone A-L tokens
 *  - Fallback to letters from the 3X tokens if needed
 *
 * Output schema:
 * {
 *   "EFGHIJKL": { "1A":"3E", "1B":"3J", ... "1L":"3K" },
 *   ...
 * }
 */

const fs = require("fs");
const path = require("path");

const INPUT = path.resolve(process.cwd(), "third-mapping-table.txt");
const OUTPUT = path.resolve(process.cwd(), "third-mapping.json");

const SLOTS = ["1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L"];

function uniqueInOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Find all third tokens (e.g., 3E)
  const thirdMatches = trimmed.match(/\b3[A-L]\b/g);
  if (!thirdMatches || thirdMatches.length < 8) return null;

  const thirds = thirdMatches.slice(-8); // last 8 are the assignments we need

  // Try to find standalone group letters A-L (not part of 3X)
  // Negative lookbehind for digit helps avoid capturing the letter in 3E.
  let groupMatches = [];
  try {
    groupMatches = [...trimmed.matchAll(/(?<!\d)\b([A-L])\b/g)].map(m => m[1]);
  } catch {
    // If lookbehind not supported (older Node), fallback:
    // capture standalone letters and then filter ones preceded by '3'
    const rough = [...trimmed.matchAll(/\b([A-L])\b/g)].map(m => m[1]);
    groupMatches = rough;
  }

  let groups = uniqueInOrder(groupMatches);

  // Heuristic: the advanced third groups should be exactly 8
  if (groups.length !== 8) {
    // Fallback: infer from thirds (letters after "3")
    groups = uniqueInOrder(thirds.map(t => t[1]));
  }

  if (groups.length !== 8) {
    throw new Error(`Could not reliably parse groups from line: ${line}`);
  }

  const key = groups.slice().sort().join("");

  const assignment = {};
  for (let i = 0; i < SLOTS.length; i++) {
    assignment[SLOTS[i]] = thirds[i];
  }

  return { key, assignment };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing ${INPUT}`);
    console.error("Create third-mapping-table.txt and paste your full table into it.");
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, "utf8");
  const lines = raw.split(/\r?\n/);

  const mapping = {};
  let parsedCount = 0;

  for (const line of lines) {
    const result = parseLine(line);
    if (!result) continue;
    mapping[result.key] = result.assignment;
    parsedCount++;
  }

  // For 12 groups choosing 8 third-placed qualifiers:
  // C(12,8) = 495 expected combinations.
  // Your table appears to list all 495 cases.
  const expected = 495;

  fs.writeFileSync(OUTPUT, JSON.stringify(mapping, null, 2), "utf8");

  console.log(`Wrote ${OUTPUT}`);
  console.log(`Parsed rows: ${parsedCount}`);
  console.log(`Unique keys: ${Object.keys(mapping).length}`);

  if (Object.keys(mapping).length !== expected) {
    console.warn(
      `Warning: expected ${expected} combinations, got ${Object.keys(mapping).length}.`
    );
    console.warn(
      "This can happen if the table text formatting changed. " +
      "Make sure you pasted the full 1–495 block cleanly."
    );
  }
}

main();
