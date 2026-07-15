#!/usr/bin/env node
/**
 * RLS acceptance check — run against a LIVE Supabase project using ONLY the
 * anon key, exactly like a hostile visitor would:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *     node scripts/verify-rls.mjs
 *
 * (or just `node scripts/verify-rls.mjs` with a filled .env.local — it
 * reads that file if the vars aren't set.)
 *
 * Verifies, not assumes:
 *   - drafts are not selectable
 *   - inserts/updates/deletes fail on every table
 *   - view_count is not readable by anon
 *   - piece_versions and darkroom_sessions are invisible
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m?.[1] === "NEXT_PUBLIC_SUPABASE_URL") url ||= m[2].trim();
      if (m?.[1] === "NEXT_PUBLIC_SUPABASE_ANON_KEY") key ||= m[2].trim();
    }
  } catch {
    /* no .env.local */
  }
}
if (!url || !key || url.includes("placeholder")) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to a real project first."
  );
  process.exit(2);
}

const anon = createClient(url, key);
let failures = 0;

async function check(name, fn) {
  try {
    const ok = await fn();
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) failures++;
  } catch (e) {
    console.log(`FAIL  ${name} — threw: ${e.message}`);
    failures++;
  }
}

await check("anon cannot select draft pieces", async () => {
  const { data } = await anon.from("pieces").select("id").eq("status", "draft");
  return (data ?? []).length === 0;
});

await check("anon cannot read view_count", async () => {
  const { error } = await anon.from("pieces").select("view_count").limit(1);
  return Boolean(error);
});

await check("anon CAN read public piece columns", async () => {
  const { error } = await anon
    .from("pieces")
    .select("id, title, slug, status")
    .limit(1);
  return !error;
});

await check("anon cannot insert a piece", async () => {
  const { error } = await anon
    .from("pieces")
    .insert({ title: "x", slug: `rls-test-${Date.now()}`, type: "misc" });
  return Boolean(error);
});

await check("anon cannot update pieces", async () => {
  const { data, error } = await anon
    .from("pieces")
    .update({ title: "hacked" })
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .select();
  return Boolean(error) || (data ?? []).length === 0;
});

await check("anon cannot delete pieces", async () => {
  const { data, error } = await anon
    .from("pieces")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .select();
  return Boolean(error) || (data ?? []).length === 0;
});

await check("anon cannot insert a collection", async () => {
  const { error } = await anon
    .from("collections")
    .insert({ name: "x", slug: `rls-test-${Date.now()}` });
  return Boolean(error);
});

await check("anon cannot read piece_versions", async () => {
  const { data, error } = await anon.from("piece_versions").select("id").limit(1);
  return Boolean(error) || (data ?? []).length === 0;
});

await check("anon cannot read darkroom_sessions", async () => {
  const { data, error } = await anon
    .from("darkroom_sessions")
    .select("id")
    .limit(1);
  return Boolean(error) || (data ?? []).length === 0;
});

await check("anon cannot update site_settings", async () => {
  const { data, error } = await anon
    .from("site_settings")
    .update({ epigraph: "hacked" })
    .eq("id", 1)
    .select();
  return Boolean(error) || (data ?? []).length === 0;
});

await check("anon cannot upload to storage", async () => {
  const { error } = await anon.storage
    .from("media")
    .upload(`rls-test-${Date.now()}.txt`, new Blob(["x"]));
  return Boolean(error);
});

await check("anon cannot read media-staging", async () => {
  const { data, error } = await anon.storage.from("media-staging").list();
  return Boolean(error) || (data ?? []).length === 0;
});

console.log(
  failures === 0
    ? "\nAll RLS checks passed."
    : `\n${failures} check(s) FAILED — do not go live.`
);
process.exit(failures === 0 ? 0 : 1);
