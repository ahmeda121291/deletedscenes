import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://deletedscenes.blog";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/darkroom", "/api/"],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
