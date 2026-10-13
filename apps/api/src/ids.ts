import { randomBytes } from "node:crypto";

const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newUlid(now = Date.now()): string {
  let value =
    (BigInt(now) << 80n) | BigInt(`0x${randomBytes(10).toString("hex")}`);
  let encoded = "";
  for (let index = 0; index < 26; index += 1) {
    encoded = crockford[Number(value & 31n)] + encoded;
    value >>= 5n;
  }
  return encoded;
}
