import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

const PERSIST_KEYS = new Set([
  "jobs",
  "homepage-bundle",
  "trending_exams",
  "all-exam-updates",
  "exam-updates-for-job",
  "exam-updates-for-exam",
  "exam-update-by-id",
  "exams",
  "similar-jobs",
  "job",
]);

export const PERSIST_BUSTER = "v1";

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => idbGet(key).then((v) => (v == null ? null : (v as string))),
    setItem: (key, value) => idbSet(key, value),
    removeItem: (key) => idbDel(key),
  },
  key: "jobstrackr-query-cache",
  throttleTime: 1000,
});

export const shouldDehydrateQuery = (queryKey: readonly unknown[]): boolean => {
  const root = queryKey[0];
  return typeof root === "string" && PERSIST_KEYS.has(root);
};
