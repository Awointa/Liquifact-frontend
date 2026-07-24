import { env } from "../lib/config/env";

const baseUrl = env.siteUrl;
const routes = ["/", "/invoices", "/invest"];

export default function sitemap() {
  return routes.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));
}
