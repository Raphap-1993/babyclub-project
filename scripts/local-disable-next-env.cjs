const path = require("path");

if (process.env.BABYCLUB_DISABLE_APP_DOTENV !== "1") {
  return;
}

const nextServerConfig = require.resolve("next/dist/server/config", {
  paths: [process.cwd(), __dirname],
});

const nextEnvPath = require.resolve("@next/env", {
  paths: [nextServerConfig],
});

const nextEnv = require(nextEnvPath);

nextEnv.loadEnvConfig = function loadEnvConfigNoop() {
  return {
    combinedEnv: process.env,
    parsedEnv: {},
    loadedEnvFiles: [],
  };
};

nextEnv.resetEnv = function resetEnvNoop() {
  return process.env;
};

if (!process.env.__BABYCLUB_NEXT_ENV_PATCHED) {
  process.env.__BABYCLUB_NEXT_ENV_PATCHED = "1";
  const patchLabel = path.relative(process.cwd(), __filename) || __filename;
  console.log(`[local-stack] Next env auto-load disabled via ${patchLabel}`);
}
