// Side-effect module that runs before any `@tybys/wz` import inside a Web
// Worker.
//
// `@tybys/wz` probes for `window` to decide whether it is in a browser. In a
// Worker there is no `window`, only `self`. Two failures follow:
//
//   1. At module load, the library's `os` polyfill calls `window.navigator
//      .userAgent` and throws `window is not defined`.
//   2. The library's `init()` only loads its `wz.wasm` crypto module when
//      `typeof window !== 'undefined'`, so WZ decryption silently has no
//      implementation in a Worker.
//
// Aliasing `window` to the Worker's global scope fixes both. `WorkerGlobal-
// Scope.navigator` exists and exposes `userAgent`, so the library's
// platform-detection path resolves.

const g = globalThis as { window?: unknown };
if (typeof g.window === 'undefined') {
  g.window = globalThis;
}
export {};
