import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/SiteNav";
import { Markdown } from "@/components/Markdown";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "about" };

export default async function AboutPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_settings")
    .select("about_md")
    .eq("id", 1)
    .maybeSingle();

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[680px] px-5 pb-24 pt-14">
        <h1 className="font-serif text-4xl tracking-tight">about</h1>
        <div className="mt-8">
          <Markdown>{data?.about_md ?? "nothing's on."}</Markdown>
        </div>
      </main>
    </>
  );
}
