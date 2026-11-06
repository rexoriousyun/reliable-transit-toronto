import { ingestDelays, ingestCodes, type Mode } from "./delays.js";
import { ingestGtfs } from "./gtfs.js";
import { buildSegments } from "./segments.js";
import { attributeSubwayIncidents, attributeSurfaceIncidents } from "../domain/attribute.js";
import { buildSurfaceSegments } from "./surface-segments.js";
import { buildGeometry } from "./geometry.js";
import { ingestAlerts } from "./alerts.js";
import { ingestAddresses } from "./addresses.js";
import { disconnect } from "../db/client.js";

const MODES: Mode[] = ["subway", "bus", "streetcar"];

async function main(): Promise<void> {
  console.log("Address points...");
  const addr = await ingestAddresses();
  console.log(
    `  ${addr.written.toLocaleString()}/${addr.read.toLocaleString()} addresses` +
    ` (${addr.skipped.toLocaleString()} without a number, street or point)`,
  );

  console.log("\nGTFS static...");
  const gtfs = await ingestGtfs();
  console.log(`  ${gtfs.stops.toLocaleString()} stops, ${gtfs.routes} routes`);

  for (const mode of MODES) {
    const codes = await ingestCodes(mode);
    const { read, written } = await ingestDelays(mode);
    console.log(
      `${mode}: ${written.toLocaleString()}/${read.toLocaleString()} incidents, ${codes} codes`,
    );
  }

  console.log("\nSegments (M3)...");
  const seg = await buildSegments();
  console.log(`  ${seg.segments} segments across ${seg.patterns} route/direction patterns`);

  const attr = await attributeSubwayIncidents();
  const rate = ((attr.attributed / attr.considered) * 100).toFixed(1);
  console.log(`  attributed ${attr.attributed.toLocaleString()}/${attr.considered.toLocaleString()} subway incidents (${rate}%)`);
  console.log(`    non-revenue (excluded by D-06): ${attr.nonRevenue.toLocaleString()}`);
  console.log(`    no direction recorded:          ${attr.unknownDirection.toLocaleString()}`);
  console.log(`    station name unresolved:        ${attr.unresolvedStation.toLocaleString()}`);
  console.log(`    no matching segment:            ${attr.noMatchingSegment.toLocaleString()}`);

  const surf = await buildSurfaceSegments();
  console.log(`\n  ${surf.segments.toLocaleString()} surface segments across ${surf.routes} routes`);
  const sattr = await attributeSurfaceIncidents();
  const srate = ((sattr.attributed / sattr.considered) * 100).toFixed(1);
  console.log(`  attributed ${sattr.attributed.toLocaleString()}/${sattr.considered.toLocaleString()} surface incidents (${srate}%)`);
  console.log(`    excluded (loop/garage):         ${sattr.nonRevenue.toLocaleString()}`);
  console.log(`    location unresolved:            ${sattr.unresolvedStation.toLocaleString()}`);
  console.log(`    no direction recorded:          ${sattr.unknownDirection.toLocaleString()}`);
  console.log(`    no matching segment:            ${sattr.noMatchingSegment.toLocaleString()}`);

  const alerts = await ingestAlerts();
  console.log(`\n  alerts: ${alerts.total} live, ${alerts.elevator} elevator/escalator`);

  const geo = await buildGeometry();
  const pct = ((geo.drawn / geo.total) * 100).toFixed(1);
  console.log(`
  geometry: ${geo.drawn.toLocaleString()}/${geo.total.toLocaleString()} segments drawn on streets (${pct}%)`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(disconnect);
