// Syntax-check every browser and server module (run by `npm run check` and the Netlify build).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(m?js)$/.test(entry.name)) files.push(path);
  }
};
for (const dir of ["public", "netlify"]) walk(dir);
const failed = files.filter((f) => spawnSync(process.execPath, ["--check", f], { stdio: "inherit" }).status !== 0);
if (failed.length) {
  console.error(`Syntax errors in ${failed.length} file(s).`);
  process.exit(1);
}
console.log(`Checked ${files.length} files.`);
