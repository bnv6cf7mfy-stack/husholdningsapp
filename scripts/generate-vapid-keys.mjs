import { generateKeyPairSync } from "node:crypto";

function toBase64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

// VAPID uses an uncompressed P-256 public key (65 bytes): 0x04 + X(32) + Y(32)
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });

const publicKeyRaw = Buffer.concat([
  Buffer.from([0x04]),
  fromBase64Url(jwk.x),
  fromBase64Url(jwk.y),
]);

const privateKeyRaw = fromBase64Url(jwk.d);

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${toBase64Url(publicKeyRaw)}`);
console.log(`VAPID_PRIVATE_KEY=${toBase64Url(privateKeyRaw)}`);
console.log("VAPID_SUBJECT=mailto:your-email@example.com");
