// In-memory AsyncStorage mock for Jest tests.
// Implements get/set/remove/clear with a plain Map so tests can
// reason about exact storage state without touching the real device.

let store = new Map();

const AsyncStorage = {
  getItem: jest.fn(async (key) => store.get(key) ?? null),
  setItem: jest.fn(async (key, value) => { store.set(key, value); }),
  removeItem: jest.fn(async (key) => { store.delete(key); }),
  clear: jest.fn(async () => { store.clear(); }),
  getAllKeys: jest.fn(async () => [...store.keys()]),
  multiGet: jest.fn(async (keys) => keys.map((k) => [k, store.get(k) ?? null])),
  multiSet: jest.fn(async (pairs) => { pairs.forEach(([k, v]) => store.set(k, v)); }),
  multiRemove: jest.fn(async (keys) => { keys.forEach((k) => store.delete(k)); }),

  // Helper used in tests to reset state between test cases
  __reset: () => { store = new Map(); },
  __getStore: () => store,
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
