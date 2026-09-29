import { readFileSync } from "node:fs";

/** A PNG's width and height, read from its IHDR chunk. */
export function PNG_SIZE(path: URL): [number, number] {
  const b = readFileSync(path);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
