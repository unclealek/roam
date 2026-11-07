import type { ConfigContext, ExpoConfig } from "expo/config";
/** EAS file environment variable; Firebase configuration is supplied per build. */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Roam",
  slug: config.slug ?? "roam-social-games",
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
});
