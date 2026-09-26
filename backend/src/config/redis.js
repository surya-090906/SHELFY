const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// In-memory cache fallback store
class MemoryStore {
  constructor() {
    this.store = new Map();
    this.subscribers = new Map();
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, mode, duration) {
    let expiry = null;
    if (mode === 'EX' && duration) {
      expiry = Date.now() + parseInt(duration, 10) * 1000;
    }
    this.store.set(key, { value: String(value), expiry });
    return 'OK';
  }

  async del(...keys) {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async keys(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const now = Date.now();
    const result = [];
    for (const [key, item] of this.store.entries()) {
      if (item.expiry && item.expiry < now) {
        this.store.delete(key);
        continue;
      }
      if (regex.test(key)) {
        result.push(key);
      }
    }
    return result;
  }

  async flushall() {
    this.store.clear();
    return 'OK';
  }

  async publish(channel, message) {
    const handlers = this.subscribers.get(channel) || [];
    for (const h of handlers) {
      try {
        h(message);
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    }
    return handlers.length;
  }

  subscribe(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    this.subscribers.get(channel).push(callback);
  }
}

let redisClient = null;
let isConnected = false;
const memoryFallback = new MemoryStore();

try {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 3) {
        return null; // Stop retrying and stay on memory fallback
      }
      return 1000;
    },
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  client.on('connect', () => {
    isConnected = true;
    console.log('✅ Connected to Redis at', REDIS_URL);
  });

  client.on('error', (err) => {
    if (isConnected) {
      console.warn('⚠️ Redis error:', err.message);
    }
    isConnected = false;
  });

  // Try initial connect in background
  client.connect().catch((err) => {
    console.log('ℹ️ Redis not available locally, utilizing robust in-memory cache/pub-sub engine.');
    isConnected = false;
  });

  redisClient = client;
} catch (e) {
  console.log('ℹ️ Redis client init failed, using in-memory fallback.');
}

const redisWrapper = {
  async get(key) {
    if (isConnected && redisClient) {
      try {
        return await redisClient.get(key);
      } catch (e) {
        return await memoryFallback.get(key);
      }
    }
    return await memoryFallback.get(key);
  },

  async set(key, value, mode, duration) {
    if (isConnected && redisClient) {
      try {
        if (mode && duration) {
          return await redisClient.set(key, value, mode, duration);
        }
        return await redisClient.set(key, value);
      } catch (e) {
        return await memoryFallback.set(key, value, mode, duration);
      }
    }
    return await memoryFallback.set(key, value, mode, duration);
  },

  async del(...keys) {
    if (!keys || keys.length === 0) return 0;
    if (isConnected && redisClient) {
      try {
        return await redisClient.del(...keys);
      } catch (e) {
        return await memoryFallback.del(...keys);
      }
    }
    return await memoryFallback.del(...keys);
  },

  async keys(pattern) {
    if (isConnected && redisClient) {
      try {
        return await redisClient.keys(pattern);
      } catch (e) {
        return await memoryFallback.keys(pattern);
      }
    }
    return await memoryFallback.keys(pattern);
  },

  async delPattern(pattern) {
    try {
      const keys = await this.keys(pattern);
      if (keys && keys.length > 0) {
        await this.del(...keys);
      }
    } catch (e) {
      console.error('Error clearing keys matching pattern:', pattern, e);
    }
  },

  async publish(channel, message) {
    if (isConnected && redisClient) {
      try {
        return await redisClient.publish(channel, typeof message === 'string' ? message : JSON.stringify(message));
      } catch (e) {
        return await memoryFallback.publish(channel, typeof message === 'string' ? message : JSON.stringify(message));
      }
    }
    return await memoryFallback.publish(channel, typeof message === 'string' ? message : JSON.stringify(message));
  }
};

const prefix=()=>`tenant:${require('./tenant').current().tenant_id}:`;
module.exports = {
 get:(key)=>redisWrapper.get(prefix()+key),
 set:(key,...args)=>redisWrapper.set(prefix()+key,...args),
 del:(...keys)=>redisWrapper.del(...keys.map(k=>prefix()+k)),
 keys:async(pattern)=>(await redisWrapper.keys(prefix()+pattern)).map(k=>k.slice(prefix().length)),
 delPattern:async(pattern)=>{const keys=await redisWrapper.keys(prefix()+pattern);if(keys.length)await redisWrapper.del(...keys);},
 publish:(channel,message)=>redisWrapper.publish(prefix()+channel,message),
};
