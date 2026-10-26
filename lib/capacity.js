import {MAX_BYTES, MAX_SHARED, STORAGE_BUDGET_BYTES} from './rules.js';
import {RETENTION_GRACE} from './retention.js';

// Two copies may coexist while chunks are assembled. Release that extra
// allocation only after part cleanup succeeds. All updates use the same CAS.
export const defaultCapacityLimits = {maxBytes: STORAGE_BUDGET_BYTES, maxClips: MAX_SHARED};
export function capacityBytes(capacity) {
  return (capacity?.ids || []).reduce((sum,id) => sum + (capacity.allocations?.[id] ?? 2 * MAX_BYTES), 0);
}
export function hasCapacity(capacity, bytes, limits = defaultCapacityLimits) {
  return (capacity?.ids?.length || 0) < limits.maxClips && capacityBytes(capacity) + bytes <= limits.maxBytes;
}
export function reserveCapacity(capacity, id, size, limits = defaultCapacityLimits) {
  if (capacity.ids.includes(id)) throw Object.assign(Error('This reservation is being prepared. Try publishing again.'), {status:409});
  if (!hasCapacity(capacity, 2 * size, limits)) throw Object.assign(Error('Shared storage is full. Download locally, delete an upload you own, or try again after expired uploads are reclaimed.'), {status:429});
  capacity.ids.push(id);
  (capacity.allocations ||= {})[id] = 2 * size;
  (capacity.deadlines ||= {})[id] = Date.now() + 600000 + RETENTION_GRACE;
}
export function releaseCapacity(capacity, id) {
  capacity.ids = capacity.ids.filter(value => value !== id);
  if (capacity.allocations) delete capacity.allocations[id];
  if (capacity.deadlines) delete capacity.deadlines[id];
  if (capacity.orphanSince) delete capacity.orphanSince[id];
}
export function finalizeCapacity(capacity, id, size, expiresAt) {
  if (capacity.ids.includes(id)) {
    (capacity.allocations ||= {})[id] = size;
    (capacity.deadlines ||= {})[id] = expiresAt + RETENTION_GRACE;
  }
}
export function capacitySummary(capacity, limits = defaultCapacityLimits) {
  const reservedBytes=capacityBytes(capacity);
  return {maxStorageBytes:limits.maxBytes,reservedBytes,availableBytes:Math.max(0,limits.maxBytes-reservedBytes),reservedRecordings:capacity?.ids?.length||0};
}
