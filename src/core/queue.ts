import PQueue from 'p-queue'

// Single-flight requests. Keeps traffic human-like and prevents bursts.
export const requestQueue = new PQueue({
  concurrency: 1,
  intervalCap: 1,
  interval: 800 // <= ~1.25 req/sec max, but scheduler will be minutes anyway.
})
