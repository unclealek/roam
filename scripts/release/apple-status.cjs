const fs = require("node:fs");
const { Buffer } = require("node:buffer");
const crypto = require("node:crypto");
(async () => {
  const directory = fs
    .readFileSync("/private/tmp/roam-release-credential-location", "utf8")
    .trim();
  const key = JSON.parse(fs.readFileSync(directory + "/api-key.json", "utf8"));
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    encode({ alg: "ES256", kid: key.key_id, typ: "JWT" }) +
    "." +
    encode({
      iss: key.issuer_id,
      iat: now,
      exp: now + 600,
      aud: "appstoreconnect-v1",
    });
  const jwt =
    unsigned +
    "." +
    crypto
      .sign("sha256", Buffer.from(unsigned), {
        key: key.key,
        dsaEncoding: "ieee-p1363",
      })
      .toString("base64url");
  const response = await fetch(
    "https://api.appstoreconnect.apple.com/v1/builds?filter[app]=6827296384&sort=-uploadedDate&limit=8&include=buildBetaDetail,preReleaseVersion",
    { headers: { Authorization: "Bearer " + jwt } },
  );
  const result = await response.json();
  if (!response.ok) throw Error("Apple lookup failed: " + response.status);
  const builds = result.data.map((build) => ({
    id: build.id,
    build: build.attributes.version,
    processing: build.attributes.processingState,
    uploaded: build.attributes.uploadedDate,
    beta: result.included?.find(
      (item) => item.id === build.relationships?.buildBetaDetail?.data?.id,
    )?.attributes,
  }));
  fs.writeFileSync(
    "/private/tmp/roam-apple-builds.json",
    JSON.stringify(builds, null, 2),
  );
  console.log(JSON.stringify(builds, null, 2));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
