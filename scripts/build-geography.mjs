// Run with the GeoNames cities15000 dump and Natural Earth 1:50m land GeoJSON.
// Sources and licenses: public/geo/README.md. Inputs never contain user data.
import fs from "node:fs/promises";
const [citiesPath, landPath] = process.argv.slice(2);
if (!citiesPath || !landPath)
  throw Error("Provide cities15000.txt and ne_50m_land.geojson");
const cities = (await fs.readFile(citiesPath, "utf8"))
  .trim()
  .split("\n")
  .map((line) => line.split("\t"))
  .filter((row) => row[6] === "P" && row[7] !== "PPLX")
  .map((r) => [r[0], r[1], +r[4], +r[5], r[8], r[10]]);
const land = JSON.parse(await fs.readFile(landPath, "utf8"));
const rings = land.features.flatMap((f) =>
  f.geometry.type === "Polygon"
    ? [f.geometry.coordinates[0]]
    : f.geometry.coordinates.map((p) => p[0]),
);
await fs.mkdir("public/geo", { recursive: true });
await fs.writeFile("public/geo/cities.json", JSON.stringify(cities));
await fs.writeFile(
  "public/geo/land.json",
  JSON.stringify(rings.map((r) => r.map((p) => p.map((n) => +n.toFixed(3))))),
);
console.log(
  `Built ${cities.length} city reference points and ${rings.length} land outlines.`,
);
