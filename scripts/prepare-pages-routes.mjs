import { copyFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const appSource = await readFile("src/main.jsx", "utf8");
const entryLinks = [...appSource.matchAll(/link:\s*"([^"]+)"/g)].map((match) => match[1]);

await copyFile("dist/index.html", "dist/404.html");

for (const entryLink of entryLinks) {
  const routeDirectory = join("dist", ...entryLink.split("/").filter(Boolean));

  await mkdir(routeDirectory, { recursive: true });
  await copyFile("dist/index.html", join(routeDirectory, "index.html"));
}
