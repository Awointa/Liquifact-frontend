import { env } from "../lib/config/env";

const baseUrl = env.siteUrl;

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
