/**
 * Simple TTL cache backed by a Map.
 * Entries expire after `ttl` milliseconds.
 * Max entries enforced by evicting oldest on insert.
 */
export class Cache {
  #store = new Map();
  #ttl;
  #maxSize;

  /**
   * @param {object} opts
   * @param {number} opts.ttl - Time-to-live in milliseconds (default: 7 days)
   * @param {number} opts.maxSize - Maximum entries (default: 1000)
   */
  constructor({ ttl = 7 * 24 * 60 * 60 * 1000, maxSize = 1000 } = {}) {
    this.#ttl = ttl;
    this.#maxSize = maxSize;
  }

  get(key) {
    const entry = this.#store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.#store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    if (this.#store.size >= this.#maxSize && !this.#store.has(key)) {
      const oldest = this.#store.keys().next().value;
      this.#store.delete(oldest);
    }
    this.#store.set(key, { value, expires: Date.now() + this.#ttl });
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    return this.#store.delete(key);
  }

  clear() {
    this.#store.clear();
  }

  get size() {
    return this.#store.size;
  }
}

export const propertyCache = new Cache({ ttl: 24 * 60 * 60 * 1000, maxSize: 500 });
export const districtCache = new Cache({ ttl: 7 * 24 * 60 * 60 * 1000, maxSize: 200 });
