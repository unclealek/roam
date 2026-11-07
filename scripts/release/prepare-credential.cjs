// Existing EAS submission key only. Never print or commit key material.
const fs = require("node:fs");
const base = "/opt/homebrew/lib/node_modules/eas-cli/build/";
(async () => {
  const Session = require(base + "user/SessionManager").default;
  const session = new Session(null);
  const client = require(
    base + "commandUtils/context/contextUtils/createGraphqlClient",
  ).createGraphqlClient({
    accessToken: session.getAccessToken(),
    sessionSecret: session.getSessionSecret(),
  });
  const query = require(
    base + "credentials/ios/api/graphql/queries/AppStoreConnectApiKeyQuery",
  ).AppStoreConnectApiKeyQuery;
  const keys = await query.getAllForAccountAsync(client, "alekille");
  const assigned = keys.find((key) => key.keyIdentifier === "WA4NP87H3G");
  if (!assigned) throw Error("Existing Roam submission key unavailable.");
  const key = await require(
    base + "graphql/queries/AppStoreConnectApiKeyQuery",
  ).AppStoreConnectApiKeyQuery.getByIdAsync(client, assigned.id);
  const directory = fs.mkdtempSync("/private/tmp/roam-release-private-");
  fs.chmodSync(directory, 0o700);
  fs.writeFileSync(
    directory + "/api-key.json",
    JSON.stringify({
      key_id: key.keyIdentifier,
      issuer_id: key.issuerIdentifier,
      key: key.keyP8,
      in_house: false,
    }),
    { mode: 0o600 },
  );
  fs.writeFileSync("/private/tmp/roam-release-credential-location", directory, {
    mode: 0o600,
  });
  console.log(
    "Existing submission credential prepared in protected temporary storage.",
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
