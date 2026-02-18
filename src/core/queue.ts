// Simple queue for Cloudflare Workers (p-queue has compatibility issues)
// Single-flight requests to keep traffic human-like

class SimpleQueue {
  private concurrency: number
  private running: number = 0
  private queue: Array<() => void> = []

  constructor(options: { concurrency: number }) {
    this.concurrency = options.concurrency
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = async () => {
        this.running++
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.running--
          this.processQueue()
        }
      }

      if (this.running < this.concurrency) {
        run()
      } else {
        this.queue.push(run)
      }
    })
  }

  private processQueue() {
    if (this.queue.length > 0 && this.running < this.concurrency) {
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

// Single-flight requests. Keeps traffic human-like and prevents bursts.
export const requestQueue = new SimpleQueue({
  concurrency: 1
})
