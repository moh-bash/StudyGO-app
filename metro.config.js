const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = withNativewind(getDefaultConfig(__dirname));

// Web setup for expo-sqlite (https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/#web-setup).
// The web worker (`expo-sqlite/web/worker.ts`) imports the wa-sqlite WebAssembly
// binary, so Metro must resolve `.wasm` as an asset.
config.resolver.assetExts.push("wasm");

// wa-sqlite needs `SharedArrayBuffer`, which the browser only exposes to
// cross-origin-isolated documents. These headers apply to the dev server; a
// deployed build must serve the same headers.
const previousEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, ...rest) => {
  const next = previousEnhanceMiddleware
    ? previousEnhanceMiddleware(middleware, ...rest)
    : middleware;

  return (req, res, nextHandler) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return next(req, res, nextHandler);
  };
};

module.exports = config;
