import { deepClone, equals } from "../../../base/common/objects.js";
import * as semver from "../../../base/common/semver/semver.js";
import { assertIsDefined } from "../../../base/common/types.js";
function merge(localExtensions, remoteExtensions, lastSyncExtensions, skippedExtensions, ignoredExtensions, lastSyncBuiltinExtensions) {
  const added = [];
  const removed = [];
  const updated = [];
  if (!remoteExtensions) {
    const remote2 = localExtensions.filter(({ identifier }) => ignoredExtensions.every((id) => id.toLowerCase() !== identifier.id.toLowerCase()));
    return {
      local: {
        added,
        removed,
        updated
      },
      remote: remote2.length > 0 ? {
        added: remote2,
        updated: [],
        removed: [],
        all: remote2
      } : null
    };
  }
  localExtensions = localExtensions.map(massageIncomingExtension);
  remoteExtensions = remoteExtensions.map(massageIncomingExtension);
  lastSyncExtensions = lastSyncExtensions ? lastSyncExtensions.map(massageIncomingExtension) : null;
  const uuids = /* @__PURE__ */ new Map();
  const addUUID = (identifier) => {
    if (identifier.uuid) {
      uuids.set(identifier.id.toLowerCase(), identifier.uuid);
    }
  };
  localExtensions.forEach(({ identifier }) => addUUID(identifier));
  remoteExtensions.forEach(({ identifier }) => addUUID(identifier));
  lastSyncExtensions?.forEach(({ identifier }) => addUUID(identifier));
  skippedExtensions?.forEach(({ identifier }) => addUUID(identifier));
  lastSyncBuiltinExtensions?.forEach((identifier) => addUUID(identifier));
  const getKey = (extension) => {
    const uuid = extension.identifier.uuid || uuids.get(extension.identifier.id.toLowerCase());
    return uuid ? `uuid:${uuid}` : `id:${extension.identifier.id.toLowerCase()}`;
  };
  const addExtensionToMap = (map, extension) => {
    map.set(getKey(extension), extension);
    return map;
  };
  const localExtensionsMap = localExtensions.reduce(addExtensionToMap, /* @__PURE__ */ new Map());
  const remoteExtensionsMap = remoteExtensions.reduce(addExtensionToMap, /* @__PURE__ */ new Map());
  const newRemoteExtensionsMap = remoteExtensions.reduce((map, extension) => addExtensionToMap(map, deepClone(extension)), /* @__PURE__ */ new Map());
  const lastSyncExtensionsMap = lastSyncExtensions ? lastSyncExtensions.reduce(addExtensionToMap, /* @__PURE__ */ new Map()) : null;
  const skippedExtensionsMap = skippedExtensions.reduce(addExtensionToMap, /* @__PURE__ */ new Map());
  const ignoredExtensionsSet = ignoredExtensions.reduce((set, id) => {
    const uuid = uuids.get(id.toLowerCase());
    return set.add(uuid ? `uuid:${uuid}` : `id:${id.toLowerCase()}`);
  }, /* @__PURE__ */ new Set());
  const lastSyncBuiltinExtensionsSet = lastSyncBuiltinExtensions ? lastSyncBuiltinExtensions.reduce((set, { id, uuid }) => {
    uuid = uuid ?? uuids.get(id.toLowerCase());
    return set.add(uuid ? `uuid:${uuid}` : `id:${id.toLowerCase()}`);
  }, /* @__PURE__ */ new Set()) : null;
  const localToRemote = compare(localExtensionsMap, remoteExtensionsMap, ignoredExtensionsSet, false);
  if (localToRemote.added.size > 0 || localToRemote.removed.size > 0 || localToRemote.updated.size > 0) {
    const baseToLocal = compare(lastSyncExtensionsMap, localExtensionsMap, ignoredExtensionsSet, false);
    const baseToRemote = compare(lastSyncExtensionsMap, remoteExtensionsMap, ignoredExtensionsSet, true);
    const merge2 = (key, localExtension, remoteExtension, preferred) => {
      let pinned, version, preRelease;
      if (localExtension.installed) {
        pinned = preferred.pinned;
        preRelease = preferred.preRelease;
        if (pinned) {
          version = preferred.version;
        }
      } else {
        pinned = remoteExtension.pinned;
        preRelease = remoteExtension.preRelease;
        if (pinned) {
          version = remoteExtension.version;
        }
      }
      if (pinned === void 0) {
        pinned = localExtension.pinned;
        if (pinned) {
          version = localExtension.version;
        }
      }
      if (preRelease === void 0) {
        preRelease = localExtension.preRelease;
      }
      return {
        ...preferred,
        installed: localExtension.installed || remoteExtension.installed,
        pinned,
        preRelease,
        version: version ?? (remoteExtension.version && (!localExtension.installed || semver.gt(remoteExtension.version, localExtension.version)) ? remoteExtension.version : localExtension.version),
        state: mergeExtensionState(localExtension, remoteExtension, lastSyncExtensionsMap?.get(key))
      };
    };
    for (const key of baseToRemote.removed.values()) {
      const localExtension = localExtensionsMap.get(key);
      if (!localExtension) {
        continue;
      }
      const baseExtension = assertIsDefined(lastSyncExtensionsMap?.get(key));
      const wasAnInstalledExtensionDuringLastSync = lastSyncBuiltinExtensionsSet && !lastSyncBuiltinExtensionsSet.has(key) && baseExtension.installed;
      if (localExtension.installed && wasAnInstalledExtensionDuringLastSync) {
        removed.push(localExtension.identifier);
      } else {
        newRemoteExtensionsMap.set(key, localExtension);
      }
    }
    for (const key of baseToRemote.added.values()) {
      const remoteExtension = assertIsDefined(remoteExtensionsMap.get(key));
      const localExtension = localExtensionsMap.get(key);
      if (localExtension) {
        if (localToRemote.updated.has(key)) {
          const mergedExtension = merge2(key, localExtension, remoteExtension, remoteExtension);
          if (!areSame(localExtension, remoteExtension, false, false)) {
            updated.push(massageOutgoingExtension(mergedExtension, key));
          }
          newRemoteExtensionsMap.set(key, mergedExtension);
        }
      } else {
        if (remoteExtension.installed) {
          added.push(massageOutgoingExtension(remoteExtension, key));
        }
      }
    }
    for (const key of baseToRemote.updated.values()) {
      const remoteExtension = assertIsDefined(remoteExtensionsMap.get(key));
      const baseExtension = assertIsDefined(lastSyncExtensionsMap?.get(key));
      const localExtension = localExtensionsMap.get(key);
      if (localExtension) {
        const wasAnInstalledExtensionDuringLastSync = lastSyncBuiltinExtensionsSet && !lastSyncBuiltinExtensionsSet.has(key) && baseExtension.installed;
        if (wasAnInstalledExtensionDuringLastSync && localExtension.installed && !remoteExtension.installed) {
          removed.push(localExtension.identifier);
        } else {
          const mergedExtension = merge2(key, localExtension, remoteExtension, remoteExtension);
          updated.push(massageOutgoingExtension(mergedExtension, key));
          newRemoteExtensionsMap.set(key, mergedExtension);
        }
      } else if (remoteExtension.installed) {
        added.push(massageOutgoingExtension(remoteExtension, key));
      }
    }
    for (const key of baseToLocal.added.values()) {
      if (baseToRemote.added.has(key)) {
        continue;
      }
      newRemoteExtensionsMap.set(key, assertIsDefined(localExtensionsMap.get(key)));
    }
    for (const key of baseToLocal.updated.values()) {
      if (baseToRemote.removed.has(key)) {
        continue;
      }
      if (baseToRemote.updated.has(key)) {
        continue;
      }
      const localExtension = assertIsDefined(localExtensionsMap.get(key));
      const remoteExtension = assertIsDefined(remoteExtensionsMap.get(key));
      newRemoteExtensionsMap.set(key, merge2(key, localExtension, remoteExtension, localExtension));
    }
    for (const key of baseToLocal.removed.values()) {
      if (baseToRemote.updated.has(key)) {
        continue;
      }
      if (baseToRemote.removed.has(key)) {
        continue;
      }
      if (skippedExtensionsMap.has(key)) {
        continue;
      }
      if (!assertIsDefined(remoteExtensionsMap.get(key)).installed) {
        continue;
      }
      if (!lastSyncBuiltinExtensionsSet) {
        continue;
      }
      if (lastSyncBuiltinExtensionsSet.has(key) || !assertIsDefined(lastSyncExtensionsMap?.get(key)).installed) {
        continue;
      }
      newRemoteExtensionsMap.delete(key);
    }
  }
  const remote = [];
  const remoteChanges = compare(remoteExtensionsMap, newRemoteExtensionsMap, /* @__PURE__ */ new Set(), true);
  const hasRemoteChanges = remoteChanges.added.size > 0 || remoteChanges.updated.size > 0 || remoteChanges.removed.size > 0;
  if (hasRemoteChanges) {
    newRemoteExtensionsMap.forEach((value, key) => remote.push(massageOutgoingExtension(value, key)));
  }
  return {
    local: { added, removed, updated },
    remote: hasRemoteChanges ? {
      added: [...remoteChanges.added].map((id) => newRemoteExtensionsMap.get(id)),
      updated: [...remoteChanges.updated].map((id) => newRemoteExtensionsMap.get(id)),
      removed: [...remoteChanges.removed].map((id) => remoteExtensionsMap.get(id)),
      all: remote
    } : null
  };
}
function compare(from, to, ignoredExtensions, checkVersionProperty) {
  const fromKeys = from ? [...from.keys()].filter((key) => !ignoredExtensions.has(key)) : [];
  const toKeys = [...to.keys()].filter((key) => !ignoredExtensions.has(key));
  const added = toKeys.filter((key) => !fromKeys.includes(key)).reduce((r, key) => {
    r.add(key);
    return r;
  }, /* @__PURE__ */ new Set());
  const removed = fromKeys.filter((key) => !toKeys.includes(key)).reduce((r, key) => {
    r.add(key);
    return r;
  }, /* @__PURE__ */ new Set());
  const updated = /* @__PURE__ */ new Set();
  for (const key of fromKeys) {
    if (removed.has(key)) {
      continue;
    }
    const fromExtension = from.get(key);
    const toExtension = to.get(key);
    if (!toExtension || !areSame(fromExtension, toExtension, checkVersionProperty, true)) {
      updated.add(key);
    }
  }
  return { added, removed, updated };
}
function areSame(fromExtension, toExtension, checkVersionProperty, checkInstalledProperty) {
  if (fromExtension.disabled !== toExtension.disabled) {
    return false;
  }
  if (!!fromExtension.isApplicationScoped !== !!toExtension.isApplicationScoped) {
    return false;
  }
  if (checkInstalledProperty && fromExtension.installed !== toExtension.installed) {
    return false;
  }
  if (fromExtension.installed && toExtension.installed) {
    if (fromExtension.preRelease !== toExtension.preRelease) {
      return false;
    }
    if (fromExtension.pinned !== toExtension.pinned) {
      return false;
    }
    if (toExtension.pinned && fromExtension.version !== toExtension.version) {
      return false;
    }
  }
  if (!isSameExtensionState(fromExtension.state, toExtension.state)) {
    return false;
  }
  if (checkVersionProperty && fromExtension.version !== toExtension.version) {
    return false;
  }
  return true;
}
function mergeExtensionState(localExtension, remoteExtension, lastSyncExtension) {
  const localState = localExtension.state;
  const remoteState = remoteExtension.state;
  const baseState = lastSyncExtension?.state;
  if (!remoteExtension.version) {
    return localState;
  }
  if (localState && semver.gt(localExtension.version, remoteExtension.version)) {
    return localState;
  }
  if (remoteState && semver.gt(remoteExtension.version, localExtension.version)) {
    return remoteState;
  }
  if (!localState) {
    return remoteState;
  }
  if (!remoteState) {
    return localState;
  }
  const mergedState = deepClone(localState);
  const baseToRemote = baseState ? compareExtensionState(baseState, remoteState) : { added: Object.keys(remoteState).reduce((r, k) => {
    r.add(k);
    return r;
  }, /* @__PURE__ */ new Set()), removed: /* @__PURE__ */ new Set(), updated: /* @__PURE__ */ new Set() };
  const baseToLocal = baseState ? compareExtensionState(baseState, localState) : { added: Object.keys(localState).reduce((r, k) => {
    r.add(k);
    return r;
  }, /* @__PURE__ */ new Set()), removed: /* @__PURE__ */ new Set(), updated: /* @__PURE__ */ new Set() };
  for (const key of [...baseToRemote.added.values(), ...baseToRemote.updated.values()]) {
    mergedState[key] = remoteState[key];
  }
  for (const key of baseToRemote.removed.values()) {
    if (!baseToLocal.updated.has(key)) {
      delete mergedState[key];
    }
  }
  return mergedState;
}
function compareExtensionState(from, to) {
  const fromKeys = Object.keys(from);
  const toKeys = Object.keys(to);
  const added = toKeys.filter((key) => !fromKeys.includes(key)).reduce((r, key) => {
    r.add(key);
    return r;
  }, /* @__PURE__ */ new Set());
  const removed = fromKeys.filter((key) => !toKeys.includes(key)).reduce((r, key) => {
    r.add(key);
    return r;
  }, /* @__PURE__ */ new Set());
  const updated = /* @__PURE__ */ new Set();
  for (const key of fromKeys) {
    if (removed.has(key)) {
      continue;
    }
    const value1 = from[key];
    const value2 = to[key];
    if (!equals(value1, value2)) {
      updated.add(key);
    }
  }
  return { added, removed, updated };
}
function isSameExtensionState(a = {}, b = {}) {
  const { added, removed, updated } = compareExtensionState(a, b);
  return added.size === 0 && removed.size === 0 && updated.size === 0;
}
function massageIncomingExtension(extension) {
  return { ...extension, ...{ disabled: !!extension.disabled, installed: !!extension.installed } };
}
function massageOutgoingExtension(extension, key) {
  const massagedExtension = {
    ...extension,
    identifier: {
      id: extension.identifier.id,
      uuid: key.startsWith("uuid:") ? key.substring("uuid:".length) : void 0
    },
    /* set following always so that to differentiate with older clients */
    preRelease: !!extension.preRelease,
    pinned: !!extension.pinned
  };
  if (!extension.disabled) {
    delete massagedExtension.disabled;
  }
  if (!extension.installed) {
    delete massagedExtension.installed;
  }
  if (!extension.state) {
    delete massagedExtension.state;
  }
  if (!extension.isApplicationScoped) {
    delete massagedExtension.isApplicationScoped;
  }
  return massagedExtension;
}
export {
  merge
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL2V4dGVuc2lvbnNNZXJnZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElTdHJpbmdEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgZGVlcENsb25lLCBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCAqIGFzIHNlbXZlciBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zZW12ZXIvc2VtdmVyLmpzJztcbmltcG9ydCB7IGFzc2VydElzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJTG9jYWxTeW5jRXh0ZW5zaW9uLCBJUmVtb3RlU3luY0V4dGVuc2lvbiwgSVN5bmNFeHRlbnNpb24gfSBmcm9tICcuL3VzZXJEYXRhU3luYy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1lcmdlUmVzdWx0IHtcblx0cmVhZG9ubHkgbG9jYWw6IHsgYWRkZWQ6IElTeW5jRXh0ZW5zaW9uW107IHJlbW92ZWQ6IElFeHRlbnNpb25JZGVudGlmaWVyW107IHVwZGF0ZWQ6IElTeW5jRXh0ZW5zaW9uW10gfTtcblx0cmVhZG9ubHkgcmVtb3RlOiB7IGFkZGVkOiBJU3luY0V4dGVuc2lvbltdOyByZW1vdmVkOiBJU3luY0V4dGVuc2lvbltdOyB1cGRhdGVkOiBJU3luY0V4dGVuc2lvbltdOyBhbGw6IElTeW5jRXh0ZW5zaW9uW10gfSB8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZShsb2NhbEV4dGVuc2lvbnM6IElMb2NhbFN5bmNFeHRlbnNpb25bXSwgcmVtb3RlRXh0ZW5zaW9uczogSVJlbW90ZVN5bmNFeHRlbnNpb25bXSB8IG51bGwsIGxhc3RTeW5jRXh0ZW5zaW9uczogSVJlbW90ZVN5bmNFeHRlbnNpb25bXSB8IG51bGwsIHNraXBwZWRFeHRlbnNpb25zOiBJU3luY0V4dGVuc2lvbltdLCBpZ25vcmVkRXh0ZW5zaW9uczogc3RyaW5nW10sIGxhc3RTeW5jQnVpbHRpbkV4dGVuc2lvbnM6IElFeHRlbnNpb25JZGVudGlmaWVyW10gfCBudWxsKTogSU1lcmdlUmVzdWx0IHtcblx0Y29uc3QgYWRkZWQ6IElTeW5jRXh0ZW5zaW9uW10gPSBbXTtcblx0Y29uc3QgcmVtb3ZlZDogSUV4dGVuc2lvbklkZW50aWZpZXJbXSA9IFtdO1xuXHRjb25zdCB1cGRhdGVkOiBJU3luY0V4dGVuc2lvbltdID0gW107XG5cblx0aWYgKCFyZW1vdGVFeHRlbnNpb25zKSB7XG5cdFx0Y29uc3QgcmVtb3RlID0gbG9jYWxFeHRlbnNpb25zLmZpbHRlcigoeyBpZGVudGlmaWVyIH0pID0+IGlnbm9yZWRFeHRlbnNpb25zLmV2ZXJ5KGlkID0+IGlkLnRvTG93ZXJDYXNlKCkgIT09IGlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSkpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRsb2NhbDoge1xuXHRcdFx0XHRhZGRlZCxcblx0XHRcdFx0cmVtb3ZlZCxcblx0XHRcdFx0dXBkYXRlZCxcblx0XHRcdH0sXG5cdFx0XHRyZW1vdGU6IHJlbW90ZS5sZW5ndGggPiAwID8ge1xuXHRcdFx0XHRhZGRlZDogcmVtb3RlLFxuXHRcdFx0XHR1cGRhdGVkOiBbXSxcblx0XHRcdFx0cmVtb3ZlZDogW10sXG5cdFx0XHRcdGFsbDogcmVtb3RlXG5cdFx0XHR9IDogbnVsbFxuXHRcdH07XG5cdH1cblxuXHRsb2NhbEV4dGVuc2lvbnMgPSBsb2NhbEV4dGVuc2lvbnMubWFwKG1hc3NhZ2VJbmNvbWluZ0V4dGVuc2lvbikgYXMgSUxvY2FsU3luY0V4dGVuc2lvbltdO1xuXHRyZW1vdGVFeHRlbnNpb25zID0gcmVtb3RlRXh0ZW5zaW9ucy5tYXAobWFzc2FnZUluY29taW5nRXh0ZW5zaW9uKTtcblx0bGFzdFN5bmNFeHRlbnNpb25zID0gbGFzdFN5bmNFeHRlbnNpb25zID8gbGFzdFN5bmNFeHRlbnNpb25zLm1hcChtYXNzYWdlSW5jb21pbmdFeHRlbnNpb24pIDogbnVsbDtcblxuXHRjb25zdCB1dWlkczogTWFwPHN0cmluZywgc3RyaW5nPiA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdGNvbnN0IGFkZFVVSUQgPSAoaWRlbnRpZmllcjogSUV4dGVuc2lvbklkZW50aWZpZXIpID0+IHsgaWYgKGlkZW50aWZpZXIudXVpZCkgeyB1dWlkcy5zZXQoaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpLCBpZGVudGlmaWVyLnV1aWQpOyB9IH07XG5cdGxvY2FsRXh0ZW5zaW9ucy5mb3JFYWNoKCh7IGlkZW50aWZpZXIgfSkgPT4gYWRkVVVJRChpZGVudGlmaWVyKSk7XG5cdHJlbW90ZUV4dGVuc2lvbnMuZm9yRWFjaCgoeyBpZGVudGlmaWVyIH0pID0+IGFkZFVVSUQoaWRlbnRpZmllcikpO1xuXHRsYXN0U3luY0V4dGVuc2lvbnM/LmZvckVhY2goKHsgaWRlbnRpZmllciB9KSA9PiBhZGRVVUlEKGlkZW50aWZpZXIpKTtcblx0c2tpcHBlZEV4dGVuc2lvbnM/LmZvckVhY2goKHsgaWRlbnRpZmllciB9KSA9PiBhZGRVVUlEKGlkZW50aWZpZXIpKTtcblx0bGFzdFN5bmNCdWlsdGluRXh0ZW5zaW9ucz8uZm9yRWFjaChpZGVudGlmaWVyID0+IGFkZFVVSUQoaWRlbnRpZmllcikpO1xuXG5cdGNvbnN0IGdldEtleSA9IChleHRlbnNpb246IElTeW5jRXh0ZW5zaW9uKTogc3RyaW5nID0+IHtcblx0XHRjb25zdCB1dWlkID0gZXh0ZW5zaW9uLmlkZW50aWZpZXIudXVpZCB8fCB1dWlkcy5nZXQoZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSk7XG5cdFx0cmV0dXJuIHV1aWQgPyBgdXVpZDoke3V1aWR9YCA6IGBpZDoke2V4dGVuc2lvbi5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCl9YDtcblx0fTtcblx0Y29uc3QgYWRkRXh0ZW5zaW9uVG9NYXAgPSAobWFwOiBNYXA8c3RyaW5nLCBJU3luY0V4dGVuc2lvbj4sIGV4dGVuc2lvbjogSVN5bmNFeHRlbnNpb24pID0+IHtcblx0XHRtYXAuc2V0KGdldEtleShleHRlbnNpb24pLCBleHRlbnNpb24pO1xuXHRcdHJldHVybiBtYXA7XG5cdH07XG5cdGNvbnN0IGxvY2FsRXh0ZW5zaW9uc01hcDogTWFwPHN0cmluZywgSVN5bmNFeHRlbnNpb24+ID0gbG9jYWxFeHRlbnNpb25zLnJlZHVjZShhZGRFeHRlbnNpb25Ub01hcCwgbmV3IE1hcDxzdHJpbmcsIElTeW5jRXh0ZW5zaW9uPigpKTtcblx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9uc01hcCA9IHJlbW90ZUV4dGVuc2lvbnMucmVkdWNlKGFkZEV4dGVuc2lvblRvTWFwLCBuZXcgTWFwPHN0cmluZywgSVN5bmNFeHRlbnNpb24+KCkpO1xuXHRjb25zdCBuZXdSZW1vdGVFeHRlbnNpb25zTWFwID0gcmVtb3RlRXh0ZW5zaW9ucy5yZWR1Y2UoKG1hcDogTWFwPHN0cmluZywgSVN5bmNFeHRlbnNpb24+LCBleHRlbnNpb246IElTeW5jRXh0ZW5zaW9uKSA9PiBhZGRFeHRlbnNpb25Ub01hcChtYXAsIGRlZXBDbG9uZShleHRlbnNpb24pKSwgbmV3IE1hcDxzdHJpbmcsIElTeW5jRXh0ZW5zaW9uPigpKTtcblx0Y29uc3QgbGFzdFN5bmNFeHRlbnNpb25zTWFwID0gbGFzdFN5bmNFeHRlbnNpb25zID8gbGFzdFN5bmNFeHRlbnNpb25zLnJlZHVjZShhZGRFeHRlbnNpb25Ub01hcCwgbmV3IE1hcDxzdHJpbmcsIElTeW5jRXh0ZW5zaW9uPigpKSA6IG51bGw7XG5cdGNvbnN0IHNraXBwZWRFeHRlbnNpb25zTWFwID0gc2tpcHBlZEV4dGVuc2lvbnMucmVkdWNlKGFkZEV4dGVuc2lvblRvTWFwLCBuZXcgTWFwPHN0cmluZywgSVN5bmNFeHRlbnNpb24+KCkpO1xuXHRjb25zdCBpZ25vcmVkRXh0ZW5zaW9uc1NldCA9IGlnbm9yZWRFeHRlbnNpb25zLnJlZHVjZSgoc2V0LCBpZCkgPT4ge1xuXHRcdGNvbnN0IHV1aWQgPSB1dWlkcy5nZXQoaWQudG9Mb3dlckNhc2UoKSk7XG5cdFx0cmV0dXJuIHNldC5hZGQodXVpZCA/IGB1dWlkOiR7dXVpZH1gIDogYGlkOiR7aWQudG9Mb3dlckNhc2UoKX1gKTtcblx0fSwgbmV3IFNldDxzdHJpbmc+KCkpO1xuXHRjb25zdCBsYXN0U3luY0J1aWx0aW5FeHRlbnNpb25zU2V0ID0gbGFzdFN5bmNCdWlsdGluRXh0ZW5zaW9ucyA/IGxhc3RTeW5jQnVpbHRpbkV4dGVuc2lvbnMucmVkdWNlKChzZXQsIHsgaWQsIHV1aWQgfSkgPT4ge1xuXHRcdHV1aWQgPSB1dWlkID8/IHV1aWRzLmdldChpZC50b0xvd2VyQ2FzZSgpKTtcblx0XHRyZXR1cm4gc2V0LmFkZCh1dWlkID8gYHV1aWQ6JHt1dWlkfWAgOiBgaWQ6JHtpZC50b0xvd2VyQ2FzZSgpfWApO1xuXHR9LCBuZXcgU2V0PHN0cmluZz4oKSkgOiBudWxsO1xuXG5cdGNvbnN0IGxvY2FsVG9SZW1vdGUgPSBjb21wYXJlKGxvY2FsRXh0ZW5zaW9uc01hcCwgcmVtb3RlRXh0ZW5zaW9uc01hcCwgaWdub3JlZEV4dGVuc2lvbnNTZXQsIGZhbHNlKTtcblx0aWYgKGxvY2FsVG9SZW1vdGUuYWRkZWQuc2l6ZSA+IDAgfHwgbG9jYWxUb1JlbW90ZS5yZW1vdmVkLnNpemUgPiAwIHx8IGxvY2FsVG9SZW1vdGUudXBkYXRlZC5zaXplID4gMCkge1xuXG5cdFx0Y29uc3QgYmFzZVRvTG9jYWwgPSBjb21wYXJlKGxhc3RTeW5jRXh0ZW5zaW9uc01hcCwgbG9jYWxFeHRlbnNpb25zTWFwLCBpZ25vcmVkRXh0ZW5zaW9uc1NldCwgZmFsc2UpO1xuXHRcdGNvbnN0IGJhc2VUb1JlbW90ZSA9IGNvbXBhcmUobGFzdFN5bmNFeHRlbnNpb25zTWFwLCByZW1vdGVFeHRlbnNpb25zTWFwLCBpZ25vcmVkRXh0ZW5zaW9uc1NldCwgdHJ1ZSk7XG5cblx0XHRjb25zdCBtZXJnZSA9IChrZXk6IHN0cmluZywgbG9jYWxFeHRlbnNpb246IElTeW5jRXh0ZW5zaW9uLCByZW1vdGVFeHRlbnNpb246IElTeW5jRXh0ZW5zaW9uLCBwcmVmZXJyZWQ6IElTeW5jRXh0ZW5zaW9uKTogSVN5bmNFeHRlbnNpb24gPT4ge1xuXHRcdFx0bGV0IHBpbm5lZDogYm9vbGVhbiB8IHVuZGVmaW5lZCwgdmVyc2lvbjogc3RyaW5nIHwgdW5kZWZpbmVkLCBwcmVSZWxlYXNlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGxvY2FsRXh0ZW5zaW9uLmluc3RhbGxlZCkge1xuXHRcdFx0XHRwaW5uZWQgPSBwcmVmZXJyZWQucGlubmVkO1xuXHRcdFx0XHRwcmVSZWxlYXNlID0gcHJlZmVycmVkLnByZVJlbGVhc2U7XG5cdFx0XHRcdGlmIChwaW5uZWQpIHtcblx0XHRcdFx0XHR2ZXJzaW9uID0gcHJlZmVycmVkLnZlcnNpb247XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBpbm5lZCA9IHJlbW90ZUV4dGVuc2lvbi5waW5uZWQ7XG5cdFx0XHRcdHByZVJlbGVhc2UgPSByZW1vdGVFeHRlbnNpb24ucHJlUmVsZWFzZTtcblx0XHRcdFx0aWYgKHBpbm5lZCkge1xuXHRcdFx0XHRcdHZlcnNpb24gPSByZW1vdGVFeHRlbnNpb24udmVyc2lvbjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHBpbm5lZCA9PT0gdW5kZWZpbmVkIC8qIGZyb20gb2xkZXIgY2xpZW50Ki8pIHtcblx0XHRcdFx0cGlubmVkID0gbG9jYWxFeHRlbnNpb24ucGlubmVkO1xuXHRcdFx0XHRpZiAocGlubmVkKSB7XG5cdFx0XHRcdFx0dmVyc2lvbiA9IGxvY2FsRXh0ZW5zaW9uLnZlcnNpb247XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChwcmVSZWxlYXNlID09PSB1bmRlZmluZWQgLyogZnJvbSBvbGRlciBjbGllbnQqLykge1xuXHRcdFx0XHRwcmVSZWxlYXNlID0gbG9jYWxFeHRlbnNpb24ucHJlUmVsZWFzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdC4uLnByZWZlcnJlZCxcblx0XHRcdFx0aW5zdGFsbGVkOiBsb2NhbEV4dGVuc2lvbi5pbnN0YWxsZWQgfHwgcmVtb3RlRXh0ZW5zaW9uLmluc3RhbGxlZCxcblx0XHRcdFx0cGlubmVkLFxuXHRcdFx0XHRwcmVSZWxlYXNlLFxuXHRcdFx0XHR2ZXJzaW9uOiB2ZXJzaW9uID8/IChyZW1vdGVFeHRlbnNpb24udmVyc2lvbiAmJiAoIWxvY2FsRXh0ZW5zaW9uLmluc3RhbGxlZCB8fCBzZW12ZXIuZ3QocmVtb3RlRXh0ZW5zaW9uLnZlcnNpb24sIGxvY2FsRXh0ZW5zaW9uLnZlcnNpb24pKSA/IHJlbW90ZUV4dGVuc2lvbi52ZXJzaW9uIDogbG9jYWxFeHRlbnNpb24udmVyc2lvbiksXG5cdFx0XHRcdHN0YXRlOiBtZXJnZUV4dGVuc2lvblN0YXRlKGxvY2FsRXh0ZW5zaW9uLCByZW1vdGVFeHRlbnNpb24sIGxhc3RTeW5jRXh0ZW5zaW9uc01hcD8uZ2V0KGtleSkpLFxuXHRcdFx0fTtcblx0XHR9O1xuXG5cdFx0Ly8gUmVtb3RlbHkgcmVtb3ZlZCBleHRlbnNpb24gPT4gZXhpc3QgaW4gYmFzZSBhbmQgZG9lcyBub3QgaW4gcmVtb3RlXG5cdFx0Zm9yIChjb25zdCBrZXkgb2YgYmFzZVRvUmVtb3RlLnJlbW92ZWQudmFsdWVzKCkpIHtcblx0XHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9uID0gbG9jYWxFeHRlbnNpb25zTWFwLmdldChrZXkpO1xuXHRcdFx0aWYgKCFsb2NhbEV4dGVuc2lvbikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYmFzZUV4dGVuc2lvbiA9IGFzc2VydElzRGVmaW5lZChsYXN0U3luY0V4dGVuc2lvbnNNYXA/LmdldChrZXkpKTtcblx0XHRcdGNvbnN0IHdhc0FuSW5zdGFsbGVkRXh0ZW5zaW9uRHVyaW5nTGFzdFN5bmMgPSBsYXN0U3luY0J1aWx0aW5FeHRlbnNpb25zU2V0ICYmICFsYXN0U3luY0J1aWx0aW5FeHRlbnNpb25zU2V0LmhhcyhrZXkpICYmIGJhc2VFeHRlbnNpb24uaW5zdGFsbGVkO1xuXHRcdFx0aWYgKGxvY2FsRXh0ZW5zaW9uLmluc3RhbGxlZCAmJiB3YXNBbkluc3RhbGxlZEV4dGVuc2lvbkR1cmluZ0xhc3RTeW5jIC8qIEl0IGlzIGFuIGluc3RhbGxlZCBleHRlbnNpb24gbm93IGFuZCBkdXJpbmcgbGFzdCBzeW5jICovKSB7XG5cdFx0XHRcdC8vIEluc3RhbGxlZCBleHRlbnNpb24gaXMgcmVtb3ZlZCBmcm9tIHJlbW90ZS4gUmVtb3ZlIGl0IGZyb20gbG9jYWwuXG5cdFx0XHRcdHJlbW92ZWQucHVzaChsb2NhbEV4dGVuc2lvbi5pZGVudGlmaWVyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIEFkZCB0byByZW1vdGU6IEl0IGlzIGEgYnVpbHRpbiBleHRlbmlzaW9uIG9yIGdvdCBpbnN0YWxsZWQgYWZ0ZXIgbGFzdCBzeW5jXG5cdFx0XHRcdG5ld1JlbW90ZUV4dGVuc2lvbnNNYXAuc2V0KGtleSwgbG9jYWxFeHRlbnNpb24pO1xuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3RlbHkgYWRkZWQgZXh0ZW5zaW9uID0+IGRvZXMgbm90IGV4aXN0IGluIGJhc2UgYW5kIGV4aXN0IGluIHJlbW90ZVxuXHRcdGZvciAoY29uc3Qga2V5IG9mIGJhc2VUb1JlbW90ZS5hZGRlZC52YWx1ZXMoKSkge1xuXHRcdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9uID0gYXNzZXJ0SXNEZWZpbmVkKHJlbW90ZUV4dGVuc2lvbnNNYXAuZ2V0KGtleSkpO1xuXHRcdFx0Y29uc3QgbG9jYWxFeHRlbnNpb24gPSBsb2NhbEV4dGVuc2lvbnNNYXAuZ2V0KGtleSk7XG5cblx0XHRcdC8vIEFsc28gZXhpc3QgaW4gbG9jYWxcblx0XHRcdGlmIChsb2NhbEV4dGVuc2lvbikge1xuXHRcdFx0XHQvLyBJcyBkaWZmZXJlbnQgZnJvbSBsb2NhbCB0byByZW1vdGVcblx0XHRcdFx0aWYgKGxvY2FsVG9SZW1vdGUudXBkYXRlZC5oYXMoa2V5KSkge1xuXHRcdFx0XHRcdGNvbnN0IG1lcmdlZEV4dGVuc2lvbiA9IG1lcmdlKGtleSwgbG9jYWxFeHRlbnNpb24sIHJlbW90ZUV4dGVuc2lvbiwgcmVtb3RlRXh0ZW5zaW9uKTtcblx0XHRcdFx0XHQvLyBVcGRhdGUgbG9jYWxseSBvbmx5IHdoZW4gdGhlIGV4dGVuc2lvbiBoYXMgY2hhbmdlcyBpbiBwcm9wZXJ0aWVzIG90aGVyIHRoYW4gaW5zdGFsbGVkIHBvcGVydHlcblx0XHRcdFx0XHRpZiAoIWFyZVNhbWUobG9jYWxFeHRlbnNpb24sIHJlbW90ZUV4dGVuc2lvbiwgZmFsc2UsIGZhbHNlKSkge1xuXHRcdFx0XHRcdFx0dXBkYXRlZC5wdXNoKG1hc3NhZ2VPdXRnb2luZ0V4dGVuc2lvbihtZXJnZWRFeHRlbnNpb24sIGtleSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRuZXdSZW1vdGVFeHRlbnNpb25zTWFwLnNldChrZXksIG1lcmdlZEV4dGVuc2lvbik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIEFkZCBvbmx5IGlmIHRoZSBleHRlbnNpb24gaXMgYW4gaW5zdGFsbGVkIGV4dGVuc2lvblxuXHRcdFx0XHRpZiAocmVtb3RlRXh0ZW5zaW9uLmluc3RhbGxlZCkge1xuXHRcdFx0XHRcdGFkZGVkLnB1c2gobWFzc2FnZU91dGdvaW5nRXh0ZW5zaW9uKHJlbW90ZUV4dGVuc2lvbiwga2V5KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSZW1vdGVseSB1cGRhdGVkIGV4dGVuc2lvbiA9PiBleGlzdCBpbiBiYXNlIGFuZCByZW1vdGVcblx0XHRmb3IgKGNvbnN0IGtleSBvZiBiYXNlVG9SZW1vdGUudXBkYXRlZC52YWx1ZXMoKSkge1xuXHRcdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9uID0gYXNzZXJ0SXNEZWZpbmVkKHJlbW90ZUV4dGVuc2lvbnNNYXAuZ2V0KGtleSkpO1xuXHRcdFx0Y29uc3QgYmFzZUV4dGVuc2lvbiA9IGFzc2VydElzRGVmaW5lZChsYXN0U3luY0V4dGVuc2lvbnNNYXA/LmdldChrZXkpKTtcblx0XHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9uID0gbG9jYWxFeHRlbnNpb25zTWFwLmdldChrZXkpO1xuXG5cdFx0XHQvLyBBbHNvIGV4aXN0IGluIGxvY2FsXG5cdFx0XHRpZiAobG9jYWxFeHRlbnNpb24pIHtcblx0XHRcdFx0Y29uc3Qgd2FzQW5JbnN0YWxsZWRFeHRlbnNpb25EdXJpbmdMYXN0U3luYyA9IGxhc3RTeW5jQnVpbHRpbkV4dGVuc2lvbnNTZXQgJiYgIWxhc3RTeW5jQnVpbHRpbkV4dGVuc2lvbnNTZXQuaGFzKGtleSkgJiYgYmFzZUV4dGVuc2lvbi5pbnN0YWxsZWQ7XG5cdFx0XHRcdGlmICh3YXNBbkluc3RhbGxlZEV4dGVuc2lvbkR1cmluZ0xhc3RTeW5jICYmIGxvY2FsRXh0ZW5zaW9uLmluc3RhbGxlZCAmJiAhcmVtb3RlRXh0ZW5zaW9uLmluc3RhbGxlZCkge1xuXHRcdFx0XHRcdC8vIFJlbW92ZSBpdCBsb2NhbGx5IGlmIGl0IGlzIGluc3RhbGxlZCBsb2NhbGx5IGFuZCBub3QgcmVtb3RlbHlcblx0XHRcdFx0XHRyZW1vdmVkLnB1c2gobG9jYWxFeHRlbnNpb24uaWRlbnRpZmllcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gVXBkYXRlIGluIGxvY2FsIGFsd2F5c1xuXHRcdFx0XHRcdGNvbnN0IG1lcmdlZEV4dGVuc2lvbiA9IG1lcmdlKGtleSwgbG9jYWxFeHRlbnNpb24sIHJlbW90ZUV4dGVuc2lvbiwgcmVtb3RlRXh0ZW5zaW9uKTtcblx0XHRcdFx0XHR1cGRhdGVkLnB1c2gobWFzc2FnZU91dGdvaW5nRXh0ZW5zaW9uKG1lcmdlZEV4dGVuc2lvbiwga2V5KSk7XG5cdFx0XHRcdFx0bmV3UmVtb3RlRXh0ZW5zaW9uc01hcC5zZXQoa2V5LCBtZXJnZWRFeHRlbnNpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBBZGQgaXQgbG9jYWxseSBpZiBkb2VzIG5vdCBleGlzdCBsb2NhbGx5IGFuZCBpbnN0YWxsZWQgcmVtb3RlbHlcblx0XHRcdGVsc2UgaWYgKHJlbW90ZUV4dGVuc2lvbi5pbnN0YWxsZWQpIHtcblx0XHRcdFx0YWRkZWQucHVzaChtYXNzYWdlT3V0Z29pbmdFeHRlbnNpb24ocmVtb3RlRXh0ZW5zaW9uLCBrZXkpKTtcblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdC8vIExvY2FsbHkgYWRkZWQgZXh0ZW5zaW9uID0+IGRvZXMgbm90IGV4aXN0IGluIGJhc2UgYW5kIGV4aXN0IGluIGxvY2FsXG5cdFx0Zm9yIChjb25zdCBrZXkgb2YgYmFzZVRvTG9jYWwuYWRkZWQudmFsdWVzKCkpIHtcblx0XHRcdC8vIElmIGFkZGVkIGluIHJlbW90ZSAoYWxyZWFkeSBoYW5kbGVkKVxuXHRcdFx0aWYgKGJhc2VUb1JlbW90ZS5hZGRlZC5oYXMoa2V5KSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdG5ld1JlbW90ZUV4dGVuc2lvbnNNYXAuc2V0KGtleSwgYXNzZXJ0SXNEZWZpbmVkKGxvY2FsRXh0ZW5zaW9uc01hcC5nZXQoa2V5KSkpO1xuXHRcdH1cblxuXHRcdC8vIExvY2FsbHkgdXBkYXRlZCBleHRlbnNpb24gPT4gZXhpc3QgaW4gYmFzZSBhbmQgbG9jYWxcblx0XHRmb3IgKGNvbnN0IGtleSBvZiBiYXNlVG9Mb2NhbC51cGRhdGVkLnZhbHVlcygpKSB7XG5cdFx0XHQvLyBJZiByZW1vdmVkIGluIHJlbW90ZSAoYWxyZWFkeSBoYW5kbGVkKVxuXHRcdFx0aWYgKGJhc2VUb1JlbW90ZS5yZW1vdmVkLmhhcyhrZXkpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Ly8gSWYgdXBkYXRlZCBpbiByZW1vdGUgKGFscmVhZHkgaGFuZGxlZClcblx0XHRcdGlmIChiYXNlVG9SZW1vdGUudXBkYXRlZC5oYXMoa2V5KSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9uID0gYXNzZXJ0SXNEZWZpbmVkKGxvY2FsRXh0ZW5zaW9uc01hcC5nZXQoa2V5KSk7XG5cdFx0XHRjb25zdCByZW1vdGVFeHRlbnNpb24gPSBhc3NlcnRJc0RlZmluZWQocmVtb3RlRXh0ZW5zaW9uc01hcC5nZXQoa2V5KSk7XG5cdFx0XHQvLyBVcGRhdGUgcmVtb3RlbHlcblx0XHRcdG5ld1JlbW90ZUV4dGVuc2lvbnNNYXAuc2V0KGtleSwgbWVyZ2Uoa2V5LCBsb2NhbEV4dGVuc2lvbiwgcmVtb3RlRXh0ZW5zaW9uLCBsb2NhbEV4dGVuc2lvbikpO1xuXHRcdH1cblxuXHRcdC8vIExvY2FsbHkgcmVtb3ZlZCBleHRlbnNpb25zID0+IGV4aXN0IGluIGJhc2UgYW5kIGRvZXMgbm90IGV4aXN0IGluIGxvY2FsXG5cdFx0Zm9yIChjb25zdCBrZXkgb2YgYmFzZVRvTG9jYWwucmVtb3ZlZC52YWx1ZXMoKSkge1xuXHRcdFx0Ly8gSWYgdXBkYXRlZCBpbiByZW1vdGUgKGFscmVhZHkgaGFuZGxlZClcblx0XHRcdGlmIChiYXNlVG9SZW1vdGUudXBkYXRlZC5oYXMoa2V5KSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdC8vIElmIHJlbW92ZWQgaW4gcmVtb3RlIChhbHJlYWR5IGhhbmRsZWQpXG5cdFx0XHRpZiAoYmFzZVRvUmVtb3RlLnJlbW92ZWQuaGFzKGtleSkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHQvLyBTa2lwcGVkXG5cdFx0XHRpZiAoc2tpcHBlZEV4dGVuc2lvbnNNYXAuaGFzKGtleSkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHQvLyBTa2lwIGlmIGl0IGlzIGEgYnVpbHRpbiBleHRlbnNpb25cblx0XHRcdGlmICghYXNzZXJ0SXNEZWZpbmVkKHJlbW90ZUV4dGVuc2lvbnNNYXAuZ2V0KGtleSkpLmluc3RhbGxlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdC8vIFNraXAgaWYgbGFzdCBzeW5jIGJ1aWx0aW4gZXh0ZW5zaW9ucyBzZXQgaXMgbm90IGF2YWlsYWJsZVxuXHRcdFx0aWYgKCFsYXN0U3luY0J1aWx0aW5FeHRlbnNpb25zU2V0KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Ly8gU2tpcCBpZiBpdCB3YXMgYSBidWlsdGluIGV4dGVuc2lvbiBkdXJpbmcgbGFzdCBzeW5jXG5cdFx0XHRpZiAobGFzdFN5bmNCdWlsdGluRXh0ZW5zaW9uc1NldC5oYXMoa2V5KSB8fCAhYXNzZXJ0SXNEZWZpbmVkKGxhc3RTeW5jRXh0ZW5zaW9uc01hcD8uZ2V0KGtleSkpLmluc3RhbGxlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdG5ld1JlbW90ZUV4dGVuc2lvbnNNYXAuZGVsZXRlKGtleSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgcmVtb3RlOiBJU3luY0V4dGVuc2lvbltdID0gW107XG5cdGNvbnN0IHJlbW90ZUNoYW5nZXMgPSBjb21wYXJlKHJlbW90ZUV4dGVuc2lvbnNNYXAsIG5ld1JlbW90ZUV4dGVuc2lvbnNNYXAsIG5ldyBTZXQ8c3RyaW5nPigpLCB0cnVlKTtcblx0Y29uc3QgaGFzUmVtb3RlQ2hhbmdlcyA9IHJlbW90ZUNoYW5nZXMuYWRkZWQuc2l6ZSA+IDAgfHwgcmVtb3RlQ2hhbmdlcy51cGRhdGVkLnNpemUgPiAwIHx8IHJlbW90ZUNoYW5nZXMucmVtb3ZlZC5zaXplID4gMDtcblx0aWYgKGhhc1JlbW90ZUNoYW5nZXMpIHtcblx0XHRuZXdSZW1vdGVFeHRlbnNpb25zTWFwLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHJlbW90ZS5wdXNoKG1hc3NhZ2VPdXRnb2luZ0V4dGVuc2lvbih2YWx1ZSwga2V5KSkpO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRsb2NhbDogeyBhZGRlZCwgcmVtb3ZlZCwgdXBkYXRlZCB9LFxuXHRcdHJlbW90ZTogaGFzUmVtb3RlQ2hhbmdlcyA/IHtcblx0XHRcdGFkZGVkOiBbLi4ucmVtb3RlQ2hhbmdlcy5hZGRlZF0ubWFwKGlkID0+IG5ld1JlbW90ZUV4dGVuc2lvbnNNYXAuZ2V0KGlkKSEpLFxuXHRcdFx0dXBkYXRlZDogWy4uLnJlbW90ZUNoYW5nZXMudXBkYXRlZF0ubWFwKGlkID0+IG5ld1JlbW90ZUV4dGVuc2lvbnNNYXAuZ2V0KGlkKSEpLFxuXHRcdFx0cmVtb3ZlZDogWy4uLnJlbW90ZUNoYW5nZXMucmVtb3ZlZF0ubWFwKGlkID0+IHJlbW90ZUV4dGVuc2lvbnNNYXAuZ2V0KGlkKSEpLFxuXHRcdFx0YWxsOiByZW1vdGVcblx0XHR9IDogbnVsbFxuXHR9O1xufVxuXG5mdW5jdGlvbiBjb21wYXJlKGZyb206IE1hcDxzdHJpbmcsIElTeW5jRXh0ZW5zaW9uPiB8IG51bGwsIHRvOiBNYXA8c3RyaW5nLCBJU3luY0V4dGVuc2lvbj4sIGlnbm9yZWRFeHRlbnNpb25zOiBTZXQ8c3RyaW5nPiwgY2hlY2tWZXJzaW9uUHJvcGVydHk6IGJvb2xlYW4pOiB7IGFkZGVkOiBTZXQ8c3RyaW5nPjsgcmVtb3ZlZDogU2V0PHN0cmluZz47IHVwZGF0ZWQ6IFNldDxzdHJpbmc+IH0ge1xuXHRjb25zdCBmcm9tS2V5cyA9IGZyb20gPyBbLi4uZnJvbS5rZXlzKCldLmZpbHRlcihrZXkgPT4gIWlnbm9yZWRFeHRlbnNpb25zLmhhcyhrZXkpKSA6IFtdO1xuXHRjb25zdCB0b0tleXMgPSBbLi4udG8ua2V5cygpXS5maWx0ZXIoa2V5ID0+ICFpZ25vcmVkRXh0ZW5zaW9ucy5oYXMoa2V5KSk7XG5cdGNvbnN0IGFkZGVkID0gdG9LZXlzLmZpbHRlcihrZXkgPT4gIWZyb21LZXlzLmluY2x1ZGVzKGtleSkpLnJlZHVjZSgociwga2V5KSA9PiB7IHIuYWRkKGtleSk7IHJldHVybiByOyB9LCBuZXcgU2V0PHN0cmluZz4oKSk7XG5cdGNvbnN0IHJlbW92ZWQgPSBmcm9tS2V5cy5maWx0ZXIoa2V5ID0+ICF0b0tleXMuaW5jbHVkZXMoa2V5KSkucmVkdWNlKChyLCBrZXkpID0+IHsgci5hZGQoa2V5KTsgcmV0dXJuIHI7IH0sIG5ldyBTZXQ8c3RyaW5nPigpKTtcblx0Y29uc3QgdXBkYXRlZDogU2V0PHN0cmluZz4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuXHRmb3IgKGNvbnN0IGtleSBvZiBmcm9tS2V5cykge1xuXHRcdGlmIChyZW1vdmVkLmhhcyhrZXkpKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cdFx0Y29uc3QgZnJvbUV4dGVuc2lvbiA9IGZyb20hLmdldChrZXkpITtcblx0XHRjb25zdCB0b0V4dGVuc2lvbiA9IHRvLmdldChrZXkpO1xuXHRcdGlmICghdG9FeHRlbnNpb24gfHwgIWFyZVNhbWUoZnJvbUV4dGVuc2lvbiwgdG9FeHRlbnNpb24sIGNoZWNrVmVyc2lvblByb3BlcnR5LCB0cnVlKSkge1xuXHRcdFx0dXBkYXRlZC5hZGQoa2V5KTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4geyBhZGRlZCwgcmVtb3ZlZCwgdXBkYXRlZCB9O1xufVxuXG5mdW5jdGlvbiBhcmVTYW1lKGZyb21FeHRlbnNpb246IElTeW5jRXh0ZW5zaW9uLCB0b0V4dGVuc2lvbjogSVN5bmNFeHRlbnNpb24sIGNoZWNrVmVyc2lvblByb3BlcnR5OiBib29sZWFuLCBjaGVja0luc3RhbGxlZFByb3BlcnR5OiBib29sZWFuKTogYm9vbGVhbiB7XG5cdGlmIChmcm9tRXh0ZW5zaW9uLmRpc2FibGVkICE9PSB0b0V4dGVuc2lvbi5kaXNhYmxlZCkge1xuXHRcdC8qIGV4dGVuc2lvbiBlbmFibGVtZW50IGNoYW5nZWQgKi9cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAoISFmcm9tRXh0ZW5zaW9uLmlzQXBwbGljYXRpb25TY29wZWQgIT09ICEhdG9FeHRlbnNpb24uaXNBcHBsaWNhdGlvblNjb3BlZCkge1xuXHRcdC8qIGV4dGVuc2lvbiBhcHBsaWNhdGlvbiBzY29wZSBoYXMgY2hhbmdlZCAqL1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGlmIChjaGVja0luc3RhbGxlZFByb3BlcnR5ICYmIGZyb21FeHRlbnNpb24uaW5zdGFsbGVkICE9PSB0b0V4dGVuc2lvbi5pbnN0YWxsZWQpIHtcblx0XHQvKiBleHRlbnNpb24gaW5zdGFsbGVkIHByb3BlcnR5IGNoYW5nZWQgKi9cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAoZnJvbUV4dGVuc2lvbi5pbnN0YWxsZWQgJiYgdG9FeHRlbnNpb24uaW5zdGFsbGVkKSB7XG5cblx0XHRpZiAoZnJvbUV4dGVuc2lvbi5wcmVSZWxlYXNlICE9PSB0b0V4dGVuc2lvbi5wcmVSZWxlYXNlKSB7XG5cdFx0XHQvKiBpbnN0YWxsZWQgZXh0ZW5zaW9uJ3MgcHJlLXJlbGVhc2UgdmVyc2lvbiBjaGFuZ2VkICovXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKGZyb21FeHRlbnNpb24ucGlubmVkICE9PSB0b0V4dGVuc2lvbi5waW5uZWQpIHtcblx0XHRcdC8qIGluc3RhbGxlZCBleHRlbnNpb24ncyBwaW5uaW5nIGNoYW5nZWQgKi9cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodG9FeHRlbnNpb24ucGlubmVkICYmIGZyb21FeHRlbnNpb24udmVyc2lvbiAhPT0gdG9FeHRlbnNpb24udmVyc2lvbikge1xuXHRcdFx0LyogaW5zdGFsbGVkIGV4dGVuc2lvbidzIHBpbm5lZCB2ZXJzaW9uIGNoYW5nZWQgKi9cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRpZiAoIWlzU2FtZUV4dGVuc2lvblN0YXRlKGZyb21FeHRlbnNpb24uc3RhdGUsIHRvRXh0ZW5zaW9uLnN0YXRlKSkge1xuXHRcdC8qIGV4dGVuc2lvbiBzdGF0ZSBjaGFuZ2VkICovXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKChjaGVja1ZlcnNpb25Qcm9wZXJ0eSAmJiBmcm9tRXh0ZW5zaW9uLnZlcnNpb24gIT09IHRvRXh0ZW5zaW9uLnZlcnNpb24pKSB7XG5cdFx0LyogZXh0ZW5zaW9uIHZlcnNpb24gY2hhbmdlZCAqL1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBtZXJnZUV4dGVuc2lvblN0YXRlKGxvY2FsRXh0ZW5zaW9uOiBJU3luY0V4dGVuc2lvbiwgcmVtb3RlRXh0ZW5zaW9uOiBJU3luY0V4dGVuc2lvbiwgbGFzdFN5bmNFeHRlbnNpb246IElTeW5jRXh0ZW5zaW9uIHwgdW5kZWZpbmVkKTogSVN0cmluZ0RpY3Rpb25hcnk8YW55PiB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGxvY2FsU3RhdGUgPSBsb2NhbEV4dGVuc2lvbi5zdGF0ZTtcblx0Y29uc3QgcmVtb3RlU3RhdGUgPSByZW1vdGVFeHRlbnNpb24uc3RhdGU7XG5cdGNvbnN0IGJhc2VTdGF0ZSA9IGxhc3RTeW5jRXh0ZW5zaW9uPy5zdGF0ZTtcblxuXHQvLyBJZiByZW1vdGUgZXh0ZW5zaW9uIGhhcyBubyB2ZXJzaW9uLCB1c2UgbG9jYWwgc3RhdGVcblx0aWYgKCFyZW1vdGVFeHRlbnNpb24udmVyc2lvbikge1xuXHRcdHJldHVybiBsb2NhbFN0YXRlO1xuXHR9XG5cblx0Ly8gSWYgbG9jYWwgc3RhdGUgZXhpc3RzIGFuZCBsb2NhbCBleHRlbnNpb24gaXMgbGF0ZXN0IHRoZW4gdXNlIGxvY2FsIHN0YXRlXG5cdGlmIChsb2NhbFN0YXRlICYmIHNlbXZlci5ndChsb2NhbEV4dGVuc2lvbi52ZXJzaW9uLCByZW1vdGVFeHRlbnNpb24udmVyc2lvbikpIHtcblx0XHRyZXR1cm4gbG9jYWxTdGF0ZTtcblx0fVxuXHQvLyBJZiByZW1vdGUgc3RhdGUgZXhpc3RzIGFuZCByZW1vdGUgZXh0ZW5zaW9uIGlzIGxhdGVzdCwgdXNlIHJlbW90ZSBzdGF0ZVxuXHRpZiAocmVtb3RlU3RhdGUgJiYgc2VtdmVyLmd0KHJlbW90ZUV4dGVuc2lvbi52ZXJzaW9uLCBsb2NhbEV4dGVuc2lvbi52ZXJzaW9uKSkge1xuXHRcdHJldHVybiByZW1vdGVTdGF0ZTtcblx0fVxuXG5cblx0LyogUmVtb3RlIGFuZCBsb2NhbCBhcmUgb24gc2FtZSB2ZXJzaW9uICovXG5cblx0Ly8gSWYgbG9jYWwgc3RhdGUgaXMgbm90IHlldCBzZXQsIHVzZSByZW1vdGUgc3RhdGVcblx0aWYgKCFsb2NhbFN0YXRlKSB7XG5cdFx0cmV0dXJuIHJlbW90ZVN0YXRlO1xuXHR9XG5cdC8vIElmIHJlbW90ZSBzdGF0ZSBpcyBub3QgeWV0IHNldCwgdXNlIGxvY2FsIHN0YXRlXG5cdGlmICghcmVtb3RlU3RhdGUpIHtcblx0XHRyZXR1cm4gbG9jYWxTdGF0ZTtcblx0fVxuXG5cdGNvbnN0IG1lcmdlZFN0YXRlOiBJU3RyaW5nRGljdGlvbmFyeTxhbnk+ID0gZGVlcENsb25lKGxvY2FsU3RhdGUpO1xuXHRjb25zdCBiYXNlVG9SZW1vdGUgPSBiYXNlU3RhdGUgPyBjb21wYXJlRXh0ZW5zaW9uU3RhdGUoYmFzZVN0YXRlLCByZW1vdGVTdGF0ZSkgOiB7IGFkZGVkOiBPYmplY3Qua2V5cyhyZW1vdGVTdGF0ZSkucmVkdWNlKChyLCBrKSA9PiB7IHIuYWRkKGspOyByZXR1cm4gcjsgfSwgbmV3IFNldDxzdHJpbmc+KCkpLCByZW1vdmVkOiBuZXcgU2V0PHN0cmluZz4oKSwgdXBkYXRlZDogbmV3IFNldDxzdHJpbmc+KCkgfTtcblx0Y29uc3QgYmFzZVRvTG9jYWwgPSBiYXNlU3RhdGUgPyBjb21wYXJlRXh0ZW5zaW9uU3RhdGUoYmFzZVN0YXRlLCBsb2NhbFN0YXRlKSA6IHsgYWRkZWQ6IE9iamVjdC5rZXlzKGxvY2FsU3RhdGUpLnJlZHVjZSgociwgaykgPT4geyByLmFkZChrKTsgcmV0dXJuIHI7IH0sIG5ldyBTZXQ8c3RyaW5nPigpKSwgcmVtb3ZlZDogbmV3IFNldDxzdHJpbmc+KCksIHVwZGF0ZWQ6IG5ldyBTZXQ8c3RyaW5nPigpIH07XG5cdC8vIEFkZGVkL1VwZGF0ZWQgaW4gcmVtb3RlXG5cdGZvciAoY29uc3Qga2V5IG9mIFsuLi5iYXNlVG9SZW1vdGUuYWRkZWQudmFsdWVzKCksIC4uLmJhc2VUb1JlbW90ZS51cGRhdGVkLnZhbHVlcygpXSkge1xuXHRcdG1lcmdlZFN0YXRlW2tleV0gPSByZW1vdGVTdGF0ZVtrZXldO1xuXHR9XG5cdC8vIFJlbW92ZWQgaW4gcmVtb3RlXG5cdGZvciAoY29uc3Qga2V5IG9mIGJhc2VUb1JlbW90ZS5yZW1vdmVkLnZhbHVlcygpKSB7XG5cdFx0Ly8gTm90IHVwZGF0ZWQgaW4gbG9jYWxcblx0XHRpZiAoIWJhc2VUb0xvY2FsLnVwZGF0ZWQuaGFzKGtleSkpIHtcblx0XHRcdGRlbGV0ZSBtZXJnZWRTdGF0ZVtrZXldO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gbWVyZ2VkU3RhdGU7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVFeHRlbnNpb25TdGF0ZShmcm9tOiBJU3RyaW5nRGljdGlvbmFyeTxhbnk+LCB0bzogSVN0cmluZ0RpY3Rpb25hcnk8YW55Pik6IHsgYWRkZWQ6IFNldDxzdHJpbmc+OyByZW1vdmVkOiBTZXQ8c3RyaW5nPjsgdXBkYXRlZDogU2V0PHN0cmluZz4gfSB7XG5cdGNvbnN0IGZyb21LZXlzID0gT2JqZWN0LmtleXMoZnJvbSk7XG5cdGNvbnN0IHRvS2V5cyA9IE9iamVjdC5rZXlzKHRvKTtcblx0Y29uc3QgYWRkZWQgPSB0b0tleXMuZmlsdGVyKGtleSA9PiAhZnJvbUtleXMuaW5jbHVkZXMoa2V5KSkucmVkdWNlKChyLCBrZXkpID0+IHsgci5hZGQoa2V5KTsgcmV0dXJuIHI7IH0sIG5ldyBTZXQ8c3RyaW5nPigpKTtcblx0Y29uc3QgcmVtb3ZlZCA9IGZyb21LZXlzLmZpbHRlcihrZXkgPT4gIXRvS2V5cy5pbmNsdWRlcyhrZXkpKS5yZWR1Y2UoKHIsIGtleSkgPT4geyByLmFkZChrZXkpOyByZXR1cm4gcjsgfSwgbmV3IFNldDxzdHJpbmc+KCkpO1xuXHRjb25zdCB1cGRhdGVkOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdGZvciAoY29uc3Qga2V5IG9mIGZyb21LZXlzKSB7XG5cdFx0aWYgKHJlbW92ZWQuaGFzKGtleSkpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblx0XHRjb25zdCB2YWx1ZTEgPSBmcm9tW2tleV07XG5cdFx0Y29uc3QgdmFsdWUyID0gdG9ba2V5XTtcblx0XHRpZiAoIWVxdWFscyh2YWx1ZTEsIHZhbHVlMikpIHtcblx0XHRcdHVwZGF0ZWQuYWRkKGtleSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHsgYWRkZWQsIHJlbW92ZWQsIHVwZGF0ZWQgfTtcbn1cblxuZnVuY3Rpb24gaXNTYW1lRXh0ZW5zaW9uU3RhdGUoYTogSVN0cmluZ0RpY3Rpb25hcnk8YW55PiA9IHt9LCBiOiBJU3RyaW5nRGljdGlvbmFyeTxhbnk+ID0ge30pOiBib29sZWFuIHtcblx0Y29uc3QgeyBhZGRlZCwgcmVtb3ZlZCwgdXBkYXRlZCB9ID0gY29tcGFyZUV4dGVuc2lvblN0YXRlKGEsIGIpO1xuXHRyZXR1cm4gYWRkZWQuc2l6ZSA9PT0gMCAmJiByZW1vdmVkLnNpemUgPT09IDAgJiYgdXBkYXRlZC5zaXplID09PSAwO1xufVxuXG4vLyBtYXNzYWdlIGluY29taW5nIGV4dGVuc2lvbiAtIGFkZCBvcHRpb25hbCBwcm9wZXJ0aWVzXG5mdW5jdGlvbiBtYXNzYWdlSW5jb21pbmdFeHRlbnNpb24oZXh0ZW5zaW9uOiBJU3luY0V4dGVuc2lvbik6IElTeW5jRXh0ZW5zaW9uIHtcblx0cmV0dXJuIHsgLi4uZXh0ZW5zaW9uLCAuLi57IGRpc2FibGVkOiAhIWV4dGVuc2lvbi5kaXNhYmxlZCwgaW5zdGFsbGVkOiAhIWV4dGVuc2lvbi5pbnN0YWxsZWQgfSB9O1xufVxuXG4vLyBtYXNzYWdlIG91dGdvaW5nIGV4dGVuc2lvbiAtIHJlbW92ZSBvcHRpb25hbCBwcm9wZXJ0aWVzXG5mdW5jdGlvbiBtYXNzYWdlT3V0Z29pbmdFeHRlbnNpb24oZXh0ZW5zaW9uOiBJU3luY0V4dGVuc2lvbiwga2V5OiBzdHJpbmcpOiBJU3luY0V4dGVuc2lvbiB7XG5cdGNvbnN0IG1hc3NhZ2VkRXh0ZW5zaW9uOiBJU3luY0V4dGVuc2lvbiA9IHtcblx0XHQuLi5leHRlbnNpb24sXG5cdFx0aWRlbnRpZmllcjoge1xuXHRcdFx0aWQ6IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLFxuXHRcdFx0dXVpZDoga2V5LnN0YXJ0c1dpdGgoJ3V1aWQ6JykgPyBrZXkuc3Vic3RyaW5nKCd1dWlkOicubGVuZ3RoKSA6IHVuZGVmaW5lZFxuXHRcdH0sXG5cdFx0Lyogc2V0IGZvbGxvd2luZyBhbHdheXMgc28gdGhhdCB0byBkaWZmZXJlbnRpYXRlIHdpdGggb2xkZXIgY2xpZW50cyAqL1xuXHRcdHByZVJlbGVhc2U6ICEhZXh0ZW5zaW9uLnByZVJlbGVhc2UsXG5cdFx0cGlubmVkOiAhIWV4dGVuc2lvbi5waW5uZWQsXG5cdH07XG5cdGlmICghZXh0ZW5zaW9uLmRpc2FibGVkKSB7XG5cdFx0ZGVsZXRlIG1hc3NhZ2VkRXh0ZW5zaW9uLmRpc2FibGVkO1xuXHR9XG5cdGlmICghZXh0ZW5zaW9uLmluc3RhbGxlZCkge1xuXHRcdGRlbGV0ZSBtYXNzYWdlZEV4dGVuc2lvbi5pbnN0YWxsZWQ7XG5cdH1cblx0aWYgKCFleHRlbnNpb24uc3RhdGUpIHtcblx0XHRkZWxldGUgbWFzc2FnZWRFeHRlbnNpb24uc3RhdGU7XG5cdH1cblx0aWYgKCFleHRlbnNpb24uaXNBcHBsaWNhdGlvblNjb3BlZCkge1xuXHRcdGRlbGV0ZSBtYXNzYWdlZEV4dGVuc2lvbi5pc0FwcGxpY2F0aW9uU2NvcGVkO1xuXHR9XG5cdHJldHVybiBtYXNzYWdlZEV4dGVuc2lvbjtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsV0FBVyxjQUFjO0FBQ2xDLFlBQVksWUFBWTtBQUN4QixTQUFTLHVCQUF1QjtBQVN6QixTQUFTLE1BQU0saUJBQXdDLGtCQUFpRCxvQkFBbUQsbUJBQXFDLG1CQUE2QiwyQkFBd0U7QUFDM1MsUUFBTSxRQUEwQixDQUFDO0FBQ2pDLFFBQU0sVUFBa0MsQ0FBQztBQUN6QyxRQUFNLFVBQTRCLENBQUM7QUFFbkMsTUFBSSxDQUFDLGtCQUFrQjtBQUN0QixVQUFNQSxVQUFTLGdCQUFnQixPQUFPLENBQUMsRUFBRSxXQUFXLE1BQU0sa0JBQWtCLE1BQU0sUUFBTSxHQUFHLFlBQVksTUFBTSxXQUFXLEdBQUcsWUFBWSxDQUFDLENBQUM7QUFDekksV0FBTztBQUFBLE1BQ04sT0FBTztBQUFBLFFBQ047QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLFFBQVFBLFFBQU8sU0FBUyxJQUFJO0FBQUEsUUFDM0IsT0FBT0E7QUFBQSxRQUNQLFNBQVMsQ0FBQztBQUFBLFFBQ1YsU0FBUyxDQUFDO0FBQUEsUUFDVixLQUFLQTtBQUFBLE1BQ04sSUFBSTtBQUFBLElBQ0w7QUFBQSxFQUNEO0FBRUEsb0JBQWtCLGdCQUFnQixJQUFJLHdCQUF3QjtBQUM5RCxxQkFBbUIsaUJBQWlCLElBQUksd0JBQXdCO0FBQ2hFLHVCQUFxQixxQkFBcUIsbUJBQW1CLElBQUks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
