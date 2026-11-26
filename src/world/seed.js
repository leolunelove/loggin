// Reloading retains a world's seed. Only starting a new camp rolls another one.
export function randomSeed(){const a=new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0]||1;}
export const WORLD={seed:0};
