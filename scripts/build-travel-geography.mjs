// Public reference inputs only. See public/geo/README.md for sources and licenses.
import fs from "node:fs/promises";
const [townsPath, countriesPath, statesPath, lakesPath] = process.argv.slice(2);
if (!townsPath || !countriesPath || !statesPath || !lakesPath)
  throw Error("Provide cities500.txt, countries.geojson, states.geojson and lakes.geojson");
const existing = new Set(JSON.parse(await fs.readFile("public/geo/cities.json", "utf8")).map(r => String(r[0])));
const towns = (await fs.readFile(townsPath, "utf8")).trim().split("\n")
  .map(line => line.split("\t"))
  .filter(r => r[6] === "P" && r[7] !== "PPLX" && r[8] === "US" && !existing.has(r[0]))
  .map(r => [r[0], r[1], +r[4], +r[5], r[8], r[10]]);
const round = a => Array.isArray(a) ? a.map(round) : +a.toFixed(3);
async function features(path, properties) {
  return JSON.parse(await fs.readFile(path, "utf8")).features.map(f => ({
    type: "Feature", properties: properties(f.properties),
    geometry: {type: f.geometry.type, coordinates: round(f.geometry.coordinates)},
  }));
}
const atlas = {
  countries: await features(countriesPath, p => ({name: p.NAME, code: p.ISO_A2})),
  states: await features(statesPath, p => ({name: p.name, code: p.iso_3166_2, lat: p.latitude, lng: p.longitude})),
  lakes: await features(lakesPath, p => ({name: p.name})),
};
await fs.writeFile("public/geo/towns-us.json", JSON.stringify(towns));
await fs.writeFile("public/geo/atlas.json", JSON.stringify(atlas));
console.log(`Built ${towns.length} additional towns and local atlas boundaries.`);
