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

const g = globalThis as {
  window?: unknown;
  OffscreenCanvas?: typeof OffscreenCanvas;
};
if (typeof g.window === 'undefined') {
  g.window = globalThis;
}

// `@tybys/wz`'s `Canvas` utility creates HTMLCanvasElements via
// `window.document.createElement('canvas')` to decode WzCanvasProperty PNG
// data. Workers don't have `document`. Shim it to return an OffscreenCanvas
// (which exposes the same 2D context API) and patch a `toBlob` method that
// delegates to `convertToBlob`, which is what `Canvas.getBufferAsync` calls
// internally.
const w = g.window as { document?: unknown };
if (typeof g.OffscreenCanvas === 'function' && typeof w.document === 'undefined') {
  type Cb = (blob: Blob | null) => void;
  interface CanvasShim extends OffscreenCanvas {
    toBlob?: (cb: Cb, type?: string) => void;
  }
  w.document = {
    createElement(tag: string): unknown {
      if (tag !== 'canvas') {
        throw new Error(`[mge] worker document.createElement('${tag}') not supported`);
      }
      const oc = new OffscreenCanvas(1, 1) as CanvasShim;
      if (typeof oc.toBlob !== 'function') {
        oc.toBlob = function (cb, type) {
          this.convertToBlob(type ? { type } : undefined).then(
            (b) => cb(b),
            () => cb(null),
          );
        };
      }
      return oc;
    },
  };
}

export {};
