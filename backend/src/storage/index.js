import { config } from "../config.js";
import { jsonStore } from "./jsonStore.js";

let store;

export async function initStorage() {
  if (config.mongodbUri) {
    try {
      const { mongoStore } = await import("./mongoStore.js");
      await mongoStore.init();
      store = mongoStore;
      return;
    } catch (err) {
      console.error(
        "[storage] Failed to connect to MongoDB, falling back to local JSON storage:",
        err.message
      );
    }
  }
  await jsonStore.init();
  store = jsonStore;
}

export function getStore() {
  if (!store) throw new Error("Storage not initialized - call initStorage() first");
  return store;
}
