import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: import.meta.env.ADMIN_ORIGIN || "http://localhost:4321",
  output: "server",
  adapter: vercel(),
  trailingSlash: "always",
});
