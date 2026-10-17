/**
 * Node-only test stub for `expo-constants`.
 *
 * `lib/config.ts` reads the API base URL from `process.env` first and only falls
 * back to `Constants.expoConfig.extra`. The real package transitively pulls in
 * React Native (Flow syntax), which the Node test runner cannot parse, so the
 * unit tests alias it to this stub.
 */
export default {
  expoConfig: null,
};
