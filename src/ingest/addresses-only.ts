/**
 * Re-ingest just the address points.
 *
 * Separate entry because the full `npm run ingest` re-downloads 200 MB of delay
 * data and rebuilds every segment, and address points change on their own
 * schedule.
 */
import { ingestAddresses } from "./addresses.js";
import { disconnect } from "../db/client.js";

const r = await ingestAddresses();
console.log(
  `${r.written.toLocaleString()}/${r.read.toLocaleString()} addresses` +
  ` (${r.skipped.toLocaleString()} skipped)`,
);
await disconnect();
