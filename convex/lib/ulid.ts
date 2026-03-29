import { factory } from "ulid";

const ulid = factory(() => {
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0xff;
});

export function generateUlid(): string {
  return ulid();
}
