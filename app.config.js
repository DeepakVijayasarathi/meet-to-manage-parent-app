const fs = require("node:fs");
const path = require("node:path");

// Firebase client config (google-services.json) is per Firebase project and not committed. EAS builds supply it
// through the GOOGLE_SERVICES_JSON file secret; local builds can drop the file next to this config. Without it the
// build still succeeds, but Android push registration is skipped and only local class reminders work.
module.exports = ({ config }) => {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  const local = path.join(__dirname, "google-services.json");
  const googleServicesFile = fromEnv ?? (fs.existsSync(local) ? "./google-services.json" : undefined);
  if (!googleServicesFile) return config;
  return { ...config, android: { ...config.android, googleServicesFile } };
};
