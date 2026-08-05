var _a, _b, _c;
function getOrSet(map, key, value) {
  let result = map.get(key);
  if (result === void 0) {
    result = value;
    map.set(key, result);
  }
  return result;
}
function mapToString(map) {
  const entries = [];
  map.forEach((value, key) => {
    entries.push(`${key} => ${value}`);
  });
  return `Map(${map.size}) {${entries.join(", ")}}`;
}
function setToString(set) {
  const entries = [];
  set.forEach((value) => {
    entries.push(value);
  });
  return `Set(${set.size}) {${entries.join(", ")}}`;
}
class ResourceMapEntry {
  constructor(uri, value) {
    this.uri = uri;
    this.value = value;
  }
}
function isEntries(arg) {
  return Array.isArray(arg);
}
const _ResourceMap = class _ResourceMap {
  constructor(arg, toKey) {
    this[_a] = "ResourceMap";
    if (arg instanceof _ResourceMap) {
      this.map = new Map(arg.map);
      this.toKey = toKey ?? _ResourceMap.defaultToKey;
    } else if (isEntries(arg)) {
      this.map = /* @__PURE__ */ new Map();
      this.toKey = toKey ?? _ResourceMap.defaultToKey;
      for (const [resource, value] of arg) {
        this.set(resource, value);
      }
    } else {
      this.map = /* @__PURE__ */ new Map();
      this.toKey = arg ?? _ResourceMap.defaultToKey;
    }
  }
  set(resource, value) {
    this.map.set(this.toKey(resource), new ResourceMapEntry(resource, value));
    return this;
  }
  get(resource) {
    return this.map.get(this.toKey(resource))?.value;
  }
  has(resource) {
    return this.map.has(this.toKey(resource));
  }
  get size() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  delete(resource) {
    return this.map.delete(this.toKey(resource));
  }
  forEach(clb, thisArg) {
    if (typeof thisArg !== "undefined") {
      clb = clb.bind(thisArg);
    }
    for (const [_, entry] of this.map) {
      clb(entry.value, entry.uri, this);
    }
  }
  *values() {
    for (const entry of this.map.values()) {
      yield entry.value;
    }
  }
  *keys() {
    for (const entry of this.map.values()) {
      yield entry.uri;
    }
  }
  *entries() {
    for (const entry of this.map.values()) {
      yield [entry.uri, entry.value];
    }
  }
  *[(_a = Symbol.toStringTag, Symbol.iterator)]() {
    for (const [, entry] of this.map) {
      yield [entry.uri, entry.value];
    }
  }
};
_ResourceMap.defaultToKey = (resource) => resource.toString();
let ResourceMap = _ResourceMap;
class ResourceSet {
  constructor(entriesOrKey, toKey) {
    this[_b] = "ResourceSet";
    if (!entriesOrKey || typeof entriesOrKey === "function") {
      this._map = new ResourceMap(entriesOrKey);
    } else {
      this._map = new ResourceMap(toKey);
      entriesOrKey.forEach(this.add, this);
    }
  }
  get size() {
    return this._map.size;
  }
  add(value) {
    this._map.set(value, value);
    return this;
  }
  clear() {
    this._map.clear();
  }
  delete(value) {
    return this._map.delete(value);
  }
  forEach(callbackfn, thisArg) {
    this._map.forEach((_value, key) => callbackfn.call(thisArg, key, key, this));
  }
  has(value) {
    return this._map.has(value);
  }
  entries() {
    return this._map.entries();
  }
  keys() {
    return this._map.keys();
  }
  values() {
    return this._map.keys();
  }
  [(_b = Symbol.toStringTag, Symbol.iterator)]() {
    return this.keys();
  }
}
var Touch = /* @__PURE__ */ ((Touch2) => {
  Touch2[Touch2["None"] = 0] = "None";
  Touch2[Touch2["AsOld"] = 1] = "AsOld";
  Touch2[Touch2["AsNew"] = 2] = "AsNew";
  return Touch2;
})(Touch || {});
class LinkedMap {
  constructor() {
    this[_c] = "LinkedMap";
    this._map = /* @__PURE__ */ new Map();
    this._head = void 0;
    this._tail = void 0;
    this._size = 0;
    this._state = 0;
  }
  clear() {
    this._map.clear();
    this._head = void 0;
    this._tail = void 0;
    this._size = 0;
    this._state++;
  }
  isEmpty() {
    return !this._head && !this._tail;
  }
  get size() {
    return this._size;
  }
  get first() {
    return this._head?.value;
  }
  get last() {
    return this._tail?.value;
  }
  has(key) {
    return this._map.has(key);
  }
  get(key, touch = 0 /* None */) {
    const item = this._map.get(key);
    if (!item) {
      return void 0;
    }
    if (touch !== 0 /* None */) {
      this.touch(item, touch);
    }
    return item.value;
  }
  set(key, value, touch = 0 /* None */) {
    let item = this._map.get(key);
    if (item) {
      item.value = value;
      if (touch !== 0 /* None */) {
        this.touch(item, touch);
      }
    } else {
      item = { key, value, next: void 0, previous: void 0 };
      switch (touch) {
        case 0 /* None */:
          this.addItemLast(item);
          break;
        case 1 /* AsOld */:
          this.addItemFirst(item);
          break;
        case 2 /* AsNew */:
          this.addItemLast(item);
          break;
        default:
          this.addItemLast(item);
          break;
      }
      this._map.set(key, item);
      this._size++;
    }
    return this;
  }
  delete(key) {
    return !!this.remove(key);
  }
  remove(key) {
    const item = this._map.get(key);
    if (!item) {
      return void 0;
    }
    this._map.delete(key);
    this.removeItem(item);
    this._size--;
    return item.value;
  }
  shift() {
    if (!this._head && !this._tail) {
      return void 0;
    }
    if (!this._head || !this._tail) {
      throw new Error("Invalid list");
    }
    const item = this._head;
    this._map.delete(item.key);
    this.removeItem(item);
    this._size--;
    return item.value;
  }
  forEach(callbackfn, thisArg) {
    const state = this._state;
    let current = this._head;
    while (current) {
      if (thisArg) {
        callbackfn.bind(thisArg)(current.value, current.key, this);
      } else {
        callbackfn(current.value, current.key, this);
      }
      if (this._state !== state) {
        throw new Error(`LinkedMap got modified during iteration.`);
      }
      current = current.next;
    }
  }
  keys() {
    const map = this;
    const state = this._state;
    let current = this._head;
    const iterator = {
      [Symbol.iterator]() {
        return iterator;
      },
      next() {
        if (map._state !== state) {
          throw new Error(`LinkedMap got modified during iteration.`);
        }
        if (current) {
          const result = { value: current.key, done: false };
          current = current.next;
          return result;
        } else {
          return { value: void 0, done: true };
        }
      }
    };
    return iterator;
  }
  values() {
    const map = this;
    const state = this._state;
    let current = this._head;
    const iterator = {
      [Symbol.iterator]() {
        return iterator;
      },
      next() {
        if (map._state !== state) {
          throw new Error(`LinkedMap got modified during iteration.`);
        }
        if (current) {
          const result = { value: current.value, done: false };
          current = current.next;
          return result;
        } else {
          return { value: void 0, done: true };
        }
      }
    };
    return iterator;
  }
  entries() {
    const map = this;
    const state = this._state;
    let current = this._head;
    const iterator = {
      [Symbol.iterator]() {
        return iterator;
      },
      next() {
        if (map._state !== state) {
          throw new Error(`LinkedMap got modified during iteration.`);
        }
        if (current) {
          const result = { value: [current.key, current.value], done: false };
          current = current.next;
          return result;
        } else {
          return { value: void 0, done: true };
        }
      }
    };
    return iterator;
  }
  [(_c = Symbol.toStringTag, Symbol.iterator)]() {
    return this.entries();
  }
  trimOld(newSize) {
    if (newSize >= this.size) {
      return;
    }
    if (newSize === 0) {
      this.clear();
      return;
    }
    let current = this._head;
    let currentSize = this.size;
    while (current && currentSize > newSize) {
      this._map.delete(current.key);
      current = current.next;
      currentSize--;
    }
    this._head = current;
    this._size = currentSize;
    if (current) {
      current.previous = void 0;
    }
    this._state++;
  }
  trimNew(newSize) {
    if (newSize >= this.size) {
      return;
    }
    if (newSize === 0) {
      this.clear();
      return;
    }
    let current = this._tail;
    let currentSize = this.size;
    while (current && currentSize > newSize) {
      this._map.delete(current.key);
      current = current.previous;
      currentSize--;
    }
    this._tail = current;
    this._size = currentSize;
    if (current) {
      current.next = void 0;
    }
    this._state++;
  }
  addItemFirst(item) {
    if (!this._head && !this._tail) {
      this._tail = item;
    } else if (!this._head) {
      throw new Error("Invalid list");
    } else {
      item.next = this._head;
      this._head.previous = item;
    }
    this._head = item;
    this._state++;
  }
  addItemLast(item) {
    if (!this._head && !this._tail) {
      this._head = item;
    } else if (!this._tail) {
      throw new Error("Invalid list");
    } else {
      item.previous = this._tail;
      this._tail.next = item;
    }
    this._tail = item;
    this._state++;
  }
  removeItem(item) {
    if (item === this._head && item === this._tail) {
      this._head = void 0;
      this._tail = void 0;
    } else if (item === this._head) {
      if (!item.next) {
        throw new Error("Invalid list");
      }
      item.next.previous = void 0;
      this._head = item.next;
    } else if (item === this._tail) {
      if (!item.previous) {
        throw new Error("Invalid list");
      }
      item.previous.next = void 0;
      this._tail = item.previous;
    } else {
      const next = item.next;
      const previous = item.previous;
      if (!next || !previous) {
        throw new Error("Invalid list");
      }
      next.previous = previous;
      previous.next = next;
    }
    item.next = void 0;
    item.previous = void 0;
    this._state++;
  }
  touch(item, touch) {
    if (!this._head || !this._tail) {
      throw new Error("Invalid list");
    }
    if (touch !== 1 /* AsOld */ && touch !== 2 /* AsNew */) {
      return;
    }
    if (touch === 1 /* AsOld */) {
      if (item === this._head) {
        return;
      }
      const next = item.next;
      const previous = item.previous;
      if (item === this._tail) {
        previous.next = void 0;
        this._tail = previous;
      } else {
        next.previous = previous;
        previous.next = next;
      }
      item.previous = void 0;
      item.next = this._head;
      this._head.previous = item;
      this._head = item;
      this._state++;
    } else if (touch === 2 /* AsNew */) {
      if (item === this._tail) {
        return;
      }
      const next = item.next;
      const previous = item.previous;
      if (item === this._head) {
        next.previous = void 0;
        this._head = next;
      } else {
        next.previous = previous;
        previous.next = next;
      }
      item.next = void 0;
      item.previous = this._tail;
      this._tail.next = item;
      this._tail = item;
      this._state++;
    }
  }
  toJSON() {
    const data = [];
    this.forEach((value, key) => {
      data.push([key, value]);
    });
    return data;
  }
  fromJSON(data) {
    this.clear();
    for (const [key, value] of data) {
      this.set(key, value);
    }
  }
}
class Cache extends LinkedMap {
  constructor(limit, ratio = 1) {
    super();
    this._limit = limit;
    this._ratio = Math.min(Math.max(0, ratio), 1);
  }
  get limit() {
    return this._limit;
  }
  set limit(limit) {
    this._limit = limit;
    this.checkTrim();
  }
  get ratio() {
    return this._ratio;
  }
  set ratio(ratio) {
    this._ratio = Math.min(Math.max(0, ratio), 1);
    this.checkTrim();
  }
  get(key, touch = 2 /* AsNew */) {
    return super.get(key, touch);
  }
  peek(key) {
    return super.get(key, 0 /* None */);
  }
  set(key, value) {
    super.set(key, value, 2 /* AsNew */);
    return this;
  }
  checkTrim() {
    if (this.size > this._limit) {
      this.trim(Math.round(this._limit * this._ratio));
    }
  }
}
class LRUCache extends Cache {
  constructor(limit, ratio = 1) {
    super(limit, ratio);
  }
  trim(newSize) {
    this.trimOld(newSize);
  }
  set(key, value) {
    super.set(key, value);
    this.checkTrim();
    return this;
  }
}
class MRUCache extends Cache {
  constructor(limit, ratio = 1) {
    super(limit, ratio);
  }
  trim(newSize) {
    this.trimNew(newSize);
  }
  set(key, value) {
    if (this._limit <= this.size && !this.has(key)) {
      this.trim(Math.round(this._limit * this._ratio) - 1);
    }
    super.set(key, value);
    return this;
  }
}
class CounterSet {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(value) {
    this.map.set(value, (this.map.get(value) || 0) + 1);
    return this;
  }
  delete(value) {
    let counter = this.map.get(value) || 0;
    if (counter === 0) {
      return false;
    }
    counter--;
    if (counter === 0) {
      this.map.delete(value);
    } else {
      this.map.set(value, counter);
    }
    return true;
  }
  has(value) {
    return this.map.has(value);
  }
}
class BidirectionalMap {
  constructor(entries) {
    this._m1 = /* @__PURE__ */ new Map();
    this._m2 = /* @__PURE__ */ new Map();
    if (entries) {
      for (const [key, value] of entries) {
        this.set(key, value);
      }
    }
  }
  clear() {
    this._m1.clear();
    this._m2.clear();
  }
  set(key, value) {
    this._m1.set(key, value);
    this._m2.set(value, key);
  }
  get(key) {
    return this._m1.get(key);
  }
  getKey(value) {
    return this._m2.get(value);
  }
  delete(key) {
    const value = this._m1.get(key);
    if (value === void 0) {
      return false;
    }
    this._m1.delete(key);
    this._m2.delete(value);
    return true;
  }
  forEach(callbackfn, thisArg) {
    this._m1.forEach((value, key) => {
      callbackfn.call(thisArg, value, key, this);
    });
  }
  keys() {
    return this._m1.keys();
  }
  values() {
    return this._m1.values();
  }
}
class SetMap {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(key, value) {
    let values = this.map.get(key);
    if (!values) {
      values = /* @__PURE__ */ new Set();
      this.map.set(key, values);
    }
    values.add(value);
  }
  delete(key, value) {
    const values = this.map.get(key);
    if (!values) {
      return;
    }
    values.delete(value);
    if (values.size === 0) {
      this.map.delete(key);
    }
  }
  forEach(key, fn) {
    const values = this.map.get(key);
    if (!values) {
      return;
    }
    values.forEach(fn);
  }
  get(key) {
    const values = this.map.get(key);
    if (!values) {
      return /* @__PURE__ */ new Set();
    }
    return values;
  }
}
function mapsStrictEqualIgnoreOrder(a, b) {
  if (a === b) {
    return true;
  }
  if (a.size !== b.size) {
    return false;
  }
  for (const [key, value] of a) {
    if (!b.has(key) || b.get(key) !== value) {
      return false;
    }
  }
  for (const [key] of b) {
    if (!a.has(key)) {
      return false;
    }
  }
  return true;
}
class NKeyMap {
  constructor() {
    this._data = /* @__PURE__ */ new Map();
  }
  /**
   * Sets a value on the map. Note that unlike a standard `Map`, the first argument is the value.
   * This is because the spread operator is used for the keys and must be last..
   * @param value The value to set.
   * @param keys The keys for the value.
   */
  set(value, ...keys) {
    let currentMap = this._data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!currentMap.has(keys[i])) {
        currentMap.set(keys[i], /* @__PURE__ */ new Map());
      }
      currentMap = currentMap.get(keys[i]);
    }
    currentMap.set(keys[keys.length - 1], value);
  }
  get(...keys) {
    let currentMap = this._data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!currentMap.has(keys[i])) {
        return void 0;
      }
      currentMap = currentMap.get(keys[i]);
    }
    return currentMap.get(keys[keys.length - 1]);
  }
  clear() {
    this._data.clear();
  }
  *values() {
    function* iterate(map) {
      for (const value of map.values()) {
        if (value instanceof Map) {
          yield* iterate(value);
        } else {
          yield value;
        }
      }
    }
    yield* iterate(this._data);
  }
  /**
   * Get a textual representation of the map for debugging purposes.
   */
  toString() {
    const printMap = (map, depth) => {
      let result = "";
      for (const [key, value] of map) {
        result += `${"  ".repeat(depth)}${key}: `;
        if (value instanceof Map) {
          result += "\n" + printMap(value, depth + 1);
        } else {
          result += `${value}
`;
        }
      }
      return result;
    };
    return printMap(this._data, 0);
  }
}
export {
  BidirectionalMap,
  CounterSet,
  LRUCache,
  LinkedMap,
  MRUCache,
  NKeyMap,
  ResourceMap,
  ResourceSet,
  SetMap,
  Touch,
  getOrSet,
  mapToString,
  mapsStrictEqualIgnoreOrder,
  setToString
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9tYXAudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuL3VyaS5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRPclNldDxLLCBWPihtYXA6IE1hcDxLLCBWPiwga2V5OiBLLCB2YWx1ZTogVik6IFYge1xuXHRsZXQgcmVzdWx0ID0gbWFwLmdldChrZXkpO1xuXHRpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXN1bHQgPSB2YWx1ZTtcblx0XHRtYXAuc2V0KGtleSwgcmVzdWx0KTtcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXBUb1N0cmluZzxLLCBWPihtYXA6IE1hcDxLLCBWPik6IHN0cmluZyB7XG5cdGNvbnN0IGVudHJpZXM6IHN0cmluZ1tdID0gW107XG5cdG1hcC5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG5cdFx0ZW50cmllcy5wdXNoKGAke2tleX0gPT4gJHt2YWx1ZX1gKTtcblx0fSk7XG5cblx0cmV0dXJuIGBNYXAoJHttYXAuc2l6ZX0pIHske2VudHJpZXMuam9pbignLCAnKX19YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFRvU3RyaW5nPEs+KHNldDogU2V0PEs+KTogc3RyaW5nIHtcblx0Y29uc3QgZW50cmllczogS1tdID0gW107XG5cdHNldC5mb3JFYWNoKHZhbHVlID0+IHtcblx0XHRlbnRyaWVzLnB1c2godmFsdWUpO1xuXHR9KTtcblxuXHRyZXR1cm4gYFNldCgke3NldC5zaXplfSkgeyR7ZW50cmllcy5qb2luKCcsICcpfX1gO1xufVxuXG5pbnRlcmZhY2UgUmVzb3VyY2VNYXBLZXlGbiB7XG5cdChyZXNvdXJjZTogVVJJKTogc3RyaW5nO1xufVxuXG5jbGFzcyBSZXNvdXJjZU1hcEVudHJ5PFQ+IHtcblx0Y29uc3RydWN0b3IocmVhZG9ubHkgdXJpOiBVUkksIHJlYWRvbmx5IHZhbHVlOiBUKSB7IH1cbn1cblxuZnVuY3Rpb24gaXNFbnRyaWVzPFQ+KGFyZzogUmVzb3VyY2VNYXA8VD4gfCBSZXNvdXJjZU1hcEtleUZuIHwgcmVhZG9ubHkgKHJlYWRvbmx5IFtVUkksIFRdKVtdIHwgdW5kZWZpbmVkKTogYXJnIGlzIHJlYWRvbmx5IChyZWFkb25seSBbVVJJLCBUXSlbXSB7XG5cdHJldHVybiBBcnJheS5pc0FycmF5KGFyZyk7XG59XG5cbmV4cG9ydCBjbGFzcyBSZXNvdXJjZU1hcDxUPiBpbXBsZW1lbnRzIE1hcDxVUkksIFQ+IHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBkZWZhdWx0VG9LZXkgPSAocmVzb3VyY2U6IFVSSSkgPT4gcmVzb3VyY2UudG9TdHJpbmcoKTtcblxuXHRyZWFkb25seSBbU3ltYm9sLnRvU3RyaW5nVGFnXSA9ICdSZXNvdXJjZU1hcCc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBtYXA6IE1hcDxzdHJpbmcsIFJlc291cmNlTWFwRW50cnk8VD4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHRvS2V5OiBSZXNvdXJjZU1hcEtleUZuO1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0gdG9LZXkgQ3VzdG9tIHVyaSBpZGVudGl0eSBmdW5jdGlvbiwgZS5nIHVzZSBhbiBleGlzdGluZyBgSUV4dFVyaSNnZXRDb21wYXJpc29uYC11dGlsXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih0b0tleT86IFJlc291cmNlTWFwS2V5Rm4pO1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0gb3RoZXIgQW5vdGhlciByZXNvdXJjZSB3aGljaCB0aGlzIG1hcHMgaXMgY3JlYXRlZCBmcm9tXG5cdCAqIEBwYXJhbSB0b0tleSBDdXN0b20gdXJpIGlkZW50aXR5IGZ1bmN0aW9uLCBlLmcgdXNlIGFuIGV4aXN0aW5nIGBJRXh0VXJpI2dldENvbXBhcmlzb25gLXV0aWxcblx0ICovXG5cdGNvbnN0cnVjdG9yKG90aGVyPzogUmVzb3VyY2VNYXA8VD4sIHRvS2V5PzogUmVzb3VyY2VNYXBLZXlGbik7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSBvdGhlciBBbm90aGVyIHJlc291cmNlIHdoaWNoIHRoaXMgbWFwcyBpcyBjcmVhdGVkIGZyb21cblx0ICogQHBhcmFtIHRvS2V5IEN1c3RvbSB1cmkgaWRlbnRpdHkgZnVuY3Rpb24sIGUuZyB1c2UgYW4gZXhpc3RpbmcgYElFeHRVcmkjZ2V0Q29tcGFyaXNvbmAtdXRpbFxuXHQgKi9cblx0Y29uc3RydWN0b3IoZW50cmllcz86IHJlYWRvbmx5IChyZWFkb25seSBbVVJJLCBUXSlbXSwgdG9LZXk/OiBSZXNvdXJjZU1hcEtleUZuKTtcblxuXHRjb25zdHJ1Y3Rvcihhcmc/OiBSZXNvdXJjZU1hcDxUPiB8IFJlc291cmNlTWFwS2V5Rm4gfCByZWFkb25seSAocmVhZG9ubHkgW1VSSSwgVF0pW10sIHRvS2V5PzogUmVzb3VyY2VNYXBLZXlGbikge1xuXHRcdGlmIChhcmcgaW5zdGFuY2VvZiBSZXNvdXJjZU1hcCkge1xuXHRcdFx0dGhpcy5tYXAgPSBuZXcgTWFwKGFyZy5tYXApO1xuXHRcdFx0dGhpcy50b0tleSA9IHRvS2V5ID8/IFJlc291cmNlTWFwLmRlZmF1bHRUb0tleTtcblx0XHR9IGVsc2UgaWYgKGlzRW50cmllcyhhcmcpKSB7XG5cdFx0XHR0aGlzLm1hcCA9IG5ldyBNYXAoKTtcblx0XHRcdHRoaXMudG9LZXkgPSB0b0tleSA/PyBSZXNvdXJjZU1hcC5kZWZhdWx0VG9LZXk7XG5cblx0XHRcdGZvciAoY29uc3QgW3Jlc291cmNlLCB2YWx1ZV0gb2YgYXJnKSB7XG5cdFx0XHRcdHRoaXMuc2V0KHJlc291cmNlLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubWFwID0gbmV3IE1hcCgpO1xuXHRcdFx0dGhpcy50b0tleSA9IGFyZyA/PyBSZXNvdXJjZU1hcC5kZWZhdWx0VG9LZXk7XG5cdFx0fVxuXHR9XG5cblx0c2V0KHJlc291cmNlOiBVUkksIHZhbHVlOiBUKTogdGhpcyB7XG5cdFx0dGhpcy5tYXAuc2V0KHRoaXMudG9LZXkocmVzb3VyY2UpLCBuZXcgUmVzb3VyY2VNYXBFbnRyeShyZXNvdXJjZSwgdmFsdWUpKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGdldChyZXNvdXJjZTogVVJJKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMubWFwLmdldCh0aGlzLnRvS2V5KHJlc291cmNlKSk/LnZhbHVlO1xuXHR9XG5cblx0aGFzKHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tYXAuaGFzKHRoaXMudG9LZXkocmVzb3VyY2UpKTtcblx0fVxuXG5cdGdldCBzaXplKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubWFwLnNpemU7XG5cdH1cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLm1hcC5jbGVhcigpO1xuXHR9XG5cblx0ZGVsZXRlKHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tYXAuZGVsZXRlKHRoaXMudG9LZXkocmVzb3VyY2UpKTtcblx0fVxuXG5cdGZvckVhY2goY2xiOiAodmFsdWU6IFQsIGtleTogVVJJLCBtYXA6IE1hcDxVUkksIFQ+KSA9PiB2b2lkLCB0aGlzQXJnPzogYW55KTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzQXJnICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y2xiID0gY2xiLmJpbmQodGhpc0FyZyk7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgW18sIGVudHJ5XSBvZiB0aGlzLm1hcCkge1xuXHRcdFx0Y2xiKGVudHJ5LnZhbHVlLCBlbnRyeS51cmksIDxhbnk+dGhpcyk7XG5cdFx0fVxuXHR9XG5cblx0KnZhbHVlcygpOiBJdGVyYWJsZUl0ZXJhdG9yPFQ+IHtcblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubWFwLnZhbHVlcygpKSB7XG5cdFx0XHR5aWVsZCBlbnRyeS52YWx1ZTtcblx0XHR9XG5cdH1cblxuXHQqa2V5cygpOiBJdGVyYWJsZUl0ZXJhdG9yPFVSST4ge1xuXHRcdGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5tYXAudmFsdWVzKCkpIHtcblx0XHRcdHlpZWxkIGVudHJ5LnVyaTtcblx0XHR9XG5cdH1cblxuXHQqZW50cmllcygpOiBJdGVyYWJsZUl0ZXJhdG9yPFtVUkksIFRdPiB7XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLm1hcC52YWx1ZXMoKSkge1xuXHRcdFx0eWllbGQgW2VudHJ5LnVyaSwgZW50cnkudmFsdWVdO1xuXHRcdH1cblx0fVxuXG5cdCpbU3ltYm9sLml0ZXJhdG9yXSgpOiBJdGVyYWJsZUl0ZXJhdG9yPFtVUkksIFRdPiB7XG5cdFx0Zm9yIChjb25zdCBbLCBlbnRyeV0gb2YgdGhpcy5tYXApIHtcblx0XHRcdHlpZWxkIFtlbnRyeS51cmksIGVudHJ5LnZhbHVlXTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlc291cmNlU2V0IGltcGxlbWVudHMgU2V0PFVSST4ge1xuXG5cdHJlYWRvbmx5IFtTeW1ib2wudG9TdHJpbmdUYWddOiBzdHJpbmcgPSAnUmVzb3VyY2VTZXQnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX21hcDogUmVzb3VyY2VNYXA8VVJJPjtcblxuXHRjb25zdHJ1Y3Rvcih0b0tleT86IFJlc291cmNlTWFwS2V5Rm4pO1xuXHRjb25zdHJ1Y3RvcihlbnRyaWVzOiByZWFkb25seSBVUklbXSwgdG9LZXk/OiBSZXNvdXJjZU1hcEtleUZuKTtcblx0Y29uc3RydWN0b3IoZW50cmllc09yS2V5PzogcmVhZG9ubHkgVVJJW10gfCBSZXNvdXJjZU1hcEtleUZuLCB0b0tleT86IFJlc291cmNlTWFwS2V5Rm4pIHtcblx0XHRpZiAoIWVudHJpZXNPcktleSB8fCB0eXBlb2YgZW50cmllc09yS2V5ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aGlzLl9tYXAgPSBuZXcgUmVzb3VyY2VNYXAoZW50cmllc09yS2V5KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fbWFwID0gbmV3IFJlc291cmNlTWFwKHRvS2V5KTtcblx0XHRcdGVudHJpZXNPcktleS5mb3JFYWNoKHRoaXMuYWRkLCB0aGlzKTtcblx0XHR9XG5cdH1cblxuXG5cdGdldCBzaXplKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX21hcC5zaXplO1xuXHR9XG5cblx0YWRkKHZhbHVlOiBVUkkpOiB0aGlzIHtcblx0XHR0aGlzLl9tYXAuc2V0KHZhbHVlLCB2YWx1ZSk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLl9tYXAuY2xlYXIoKTtcblx0fVxuXG5cdGRlbGV0ZSh2YWx1ZTogVVJJKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX21hcC5kZWxldGUodmFsdWUpO1xuXHR9XG5cblx0Zm9yRWFjaChjYWxsYmFja2ZuOiAodmFsdWU6IFVSSSwgdmFsdWUyOiBVUkksIHNldDogU2V0PFVSST4pID0+IHZvaWQsIHRoaXNBcmc/OiBhbnkpOiB2b2lkIHtcblx0XHR0aGlzLl9tYXAuZm9yRWFjaCgoX3ZhbHVlLCBrZXkpID0+IGNhbGxiYWNrZm4uY2FsbCh0aGlzQXJnLCBrZXksIGtleSwgdGhpcykpO1xuXHR9XG5cblx0aGFzKHZhbHVlOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fbWFwLmhhcyh2YWx1ZSk7XG5cdH1cblxuXHRlbnRyaWVzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8W1VSSSwgVVJJXT4ge1xuXHRcdHJldHVybiB0aGlzLl9tYXAuZW50cmllcygpO1xuXHR9XG5cblx0a2V5cygpOiBJdGVyYWJsZUl0ZXJhdG9yPFVSST4ge1xuXHRcdHJldHVybiB0aGlzLl9tYXAua2V5cygpO1xuXHR9XG5cblx0dmFsdWVzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8VVJJPiB7XG5cdFx0cmV0dXJuIHRoaXMuX21hcC5rZXlzKCk7XG5cdH1cblxuXHRbU3ltYm9sLml0ZXJhdG9yXSgpOiBJdGVyYWJsZUl0ZXJhdG9yPFVSST4ge1xuXHRcdHJldHVybiB0aGlzLmtleXMoKTtcblx0fVxufVxuXG5cbmludGVyZmFjZSBJdGVtPEssIFY+IHtcblx0cHJldmlvdXM6IEl0ZW08SywgVj4gfCB1bmRlZmluZWQ7XG5cdG5leHQ6IEl0ZW08SywgVj4gfCB1bmRlZmluZWQ7XG5cdGtleTogSztcblx0dmFsdWU6IFY7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFRvdWNoIHtcblx0Tm9uZSA9IDAsXG5cdEFzT2xkID0gMSxcblx0QXNOZXcgPSAyXG59XG5cbmV4cG9ydCBjbGFzcyBMaW5rZWRNYXA8SywgVj4gaW1wbGVtZW50cyBNYXA8SywgVj4ge1xuXG5cdHJlYWRvbmx5IFtTeW1ib2wudG9TdHJpbmdUYWddID0gJ0xpbmtlZE1hcCc7XG5cblx0cHJpdmF0ZSBfbWFwOiBNYXA8SywgSXRlbTxLLCBWPj47XG5cdHByaXZhdGUgX2hlYWQ6IEl0ZW08SywgVj4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3RhaWw6IEl0ZW08SywgVj4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3NpemU6IG51bWJlcjtcblxuXHRwcml2YXRlIF9zdGF0ZTogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuX21hcCA9IG5ldyBNYXA8SywgSXRlbTxLLCBWPj4oKTtcblx0XHR0aGlzLl9oZWFkID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3RhaWwgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fc2l6ZSA9IDA7XG5cdFx0dGhpcy5fc3RhdGUgPSAwO1xuXHR9XG5cblx0Y2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fbWFwLmNsZWFyKCk7XG5cdFx0dGhpcy5faGVhZCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl90YWlsID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3NpemUgPSAwO1xuXHRcdHRoaXMuX3N0YXRlKys7XG5cdH1cblxuXHRpc0VtcHR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhdGhpcy5faGVhZCAmJiAhdGhpcy5fdGFpbDtcblx0fVxuXG5cdGdldCBzaXplKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3NpemU7XG5cdH1cblxuXHRnZXQgZmlyc3QoKTogViB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2hlYWQ/LnZhbHVlO1xuXHR9XG5cblx0Z2V0IGxhc3QoKTogViB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3RhaWw/LnZhbHVlO1xuXHR9XG5cblx0aGFzKGtleTogSyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9tYXAuaGFzKGtleSk7XG5cdH1cblxuXHRnZXQoa2V5OiBLLCB0b3VjaDogVG91Y2ggPSBUb3VjaC5Ob25lKTogViB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX21hcC5nZXQoa2V5KTtcblx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICh0b3VjaCAhPT0gVG91Y2guTm9uZSkge1xuXHRcdFx0dGhpcy50b3VjaChpdGVtLCB0b3VjaCk7XG5cdFx0fVxuXHRcdHJldHVybiBpdGVtLnZhbHVlO1xuXHR9XG5cblx0c2V0KGtleTogSywgdmFsdWU6IFYsIHRvdWNoOiBUb3VjaCA9IFRvdWNoLk5vbmUpOiB0aGlzIHtcblx0XHRsZXQgaXRlbSA9IHRoaXMuX21hcC5nZXQoa2V5KTtcblx0XHRpZiAoaXRlbSkge1xuXHRcdFx0aXRlbS52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0aWYgKHRvdWNoICE9PSBUb3VjaC5Ob25lKSB7XG5cdFx0XHRcdHRoaXMudG91Y2goaXRlbSwgdG91Y2gpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpdGVtID0geyBrZXksIHZhbHVlLCBuZXh0OiB1bmRlZmluZWQsIHByZXZpb3VzOiB1bmRlZmluZWQgfTtcblx0XHRcdHN3aXRjaCAodG91Y2gpIHtcblx0XHRcdFx0Y2FzZSBUb3VjaC5Ob25lOlxuXHRcdFx0XHRcdHRoaXMuYWRkSXRlbUxhc3QoaXRlbSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgVG91Y2guQXNPbGQ6XG5cdFx0XHRcdFx0dGhpcy5hZGRJdGVtRmlyc3QoaXRlbSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgVG91Y2guQXNOZXc6XG5cdFx0XHRcdFx0dGhpcy5hZGRJdGVtTGFzdChpdGVtKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHR0aGlzLmFkZEl0ZW1MYXN0KGl0ZW0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbWFwLnNldChrZXksIGl0ZW0pO1xuXHRcdFx0dGhpcy5fc2l6ZSsrO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGRlbGV0ZShrZXk6IEspOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLnJlbW92ZShrZXkpO1xuXHR9XG5cblx0cmVtb3ZlKGtleTogSyk6IFYgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGl0ZW0gPSB0aGlzLl9tYXAuZ2V0KGtleSk7XG5cdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLl9tYXAuZGVsZXRlKGtleSk7XG5cdFx0dGhpcy5yZW1vdmVJdGVtKGl0ZW0pO1xuXHRcdHRoaXMuX3NpemUtLTtcblx0XHRyZXR1cm4gaXRlbS52YWx1ZTtcblx0fVxuXG5cdHNoaWZ0KCk6IFYgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5faGVhZCAmJiAhdGhpcy5fdGFpbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLl9oZWFkIHx8ICF0aGlzLl90YWlsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGlzdCcpO1xuXHRcdH1cblx0XHRjb25zdCBpdGVtID0gdGhpcy5faGVhZDtcblx0XHR0aGlzLl9tYXAuZGVsZXRlKGl0ZW0ua2V5KTtcblx0XHR0aGlzLnJlbW92ZUl0ZW0oaXRlbSk7XG5cdFx0dGhpcy5fc2l6ZS0tO1xuXHRcdHJldHVybiBpdGVtLnZhbHVlO1xuXHR9XG5cblx0Zm9yRWFjaChjYWxsYmFja2ZuOiAodmFsdWU6IFYsIGtleTogSywgbWFwOiBMaW5rZWRNYXA8SywgVj4pID0+IHZvaWQsIHRoaXNBcmc/OiBhbnkpOiB2b2lkIHtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3N0YXRlO1xuXHRcdGxldCBjdXJyZW50ID0gdGhpcy5faGVhZDtcblx0XHR3aGlsZSAoY3VycmVudCkge1xuXHRcdFx0aWYgKHRoaXNBcmcpIHtcblx0XHRcdFx0Y2FsbGJhY2tmbi5iaW5kKHRoaXNBcmcpKGN1cnJlbnQudmFsdWUsIGN1cnJlbnQua2V5LCB0aGlzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNhbGxiYWNrZm4oY3VycmVudC52YWx1ZSwgY3VycmVudC5rZXksIHRoaXMpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX3N0YXRlICE9PSBzdGF0ZSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYExpbmtlZE1hcCBnb3QgbW9kaWZpZWQgZHVyaW5nIGl0ZXJhdGlvbi5gKTtcblx0XHRcdH1cblx0XHRcdGN1cnJlbnQgPSBjdXJyZW50Lm5leHQ7XG5cdFx0fVxuXHR9XG5cblx0a2V5cygpOiBJdGVyYWJsZUl0ZXJhdG9yPEs+IHtcblx0XHRjb25zdCBtYXAgPSB0aGlzO1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5fc3RhdGU7XG5cdFx0bGV0IGN1cnJlbnQgPSB0aGlzLl9oZWFkO1xuXHRcdGNvbnN0IGl0ZXJhdG9yOiBJdGVyYWJsZUl0ZXJhdG9yPEs+ID0ge1xuXHRcdFx0W1N5bWJvbC5pdGVyYXRvcl0oKSB7XG5cdFx0XHRcdHJldHVybiBpdGVyYXRvcjtcblx0XHRcdH0sXG5cdFx0XHRuZXh0KCk6IEl0ZXJhdG9yUmVzdWx0PEs+IHtcblx0XHRcdFx0aWYgKG1hcC5fc3RhdGUgIT09IHN0YXRlKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBMaW5rZWRNYXAgZ290IG1vZGlmaWVkIGR1cmluZyBpdGVyYXRpb24uYCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGN1cnJlbnQpIHtcblx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSB7IHZhbHVlOiBjdXJyZW50LmtleSwgZG9uZTogZmFsc2UgfTtcblx0XHRcdFx0XHRjdXJyZW50ID0gY3VycmVudC5uZXh0O1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gaXRlcmF0b3I7XG5cdH1cblxuXHR2YWx1ZXMoKTogSXRlcmFibGVJdGVyYXRvcjxWPiB7XG5cdFx0Y29uc3QgbWFwID0gdGhpcztcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3N0YXRlO1xuXHRcdGxldCBjdXJyZW50ID0gdGhpcy5faGVhZDtcblx0XHRjb25zdCBpdGVyYXRvcjogSXRlcmFibGVJdGVyYXRvcjxWPiA9IHtcblx0XHRcdFtTeW1ib2wuaXRlcmF0b3JdKCkge1xuXHRcdFx0XHRyZXR1cm4gaXRlcmF0b3I7XG5cdFx0XHR9LFxuXHRcdFx0bmV4dCgpOiBJdGVyYXRvclJlc3VsdDxWPiB7XG5cdFx0XHRcdGlmIChtYXAuX3N0YXRlICE9PSBzdGF0ZSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgTGlua2VkTWFwIGdvdCBtb2RpZmllZCBkdXJpbmcgaXRlcmF0aW9uLmApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChjdXJyZW50KSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0geyB2YWx1ZTogY3VycmVudC52YWx1ZSwgZG9uZTogZmFsc2UgfTtcblx0XHRcdFx0XHRjdXJyZW50ID0gY3VycmVudC5uZXh0O1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gaXRlcmF0b3I7XG5cdH1cblxuXHRlbnRyaWVzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8W0ssIFZdPiB7XG5cdFx0Y29uc3QgbWFwID0gdGhpcztcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3N0YXRlO1xuXHRcdGxldCBjdXJyZW50ID0gdGhpcy5faGVhZDtcblx0XHRjb25zdCBpdGVyYXRvcjogSXRlcmFibGVJdGVyYXRvcjxbSywgVl0+ID0ge1xuXHRcdFx0W1N5bWJvbC5pdGVyYXRvcl0oKSB7XG5cdFx0XHRcdHJldHVybiBpdGVyYXRvcjtcblx0XHRcdH0sXG5cdFx0XHRuZXh0KCk6IEl0ZXJhdG9yUmVzdWx0PFtLLCBWXT4ge1xuXHRcdFx0XHRpZiAobWFwLl9zdGF0ZSAhPT0gc3RhdGUpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYExpbmtlZE1hcCBnb3QgbW9kaWZpZWQgZHVyaW5nIGl0ZXJhdGlvbi5gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoY3VycmVudCkge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdDogSXRlcmF0b3JSZXN1bHQ8W0ssIFZdPiA9IHsgdmFsdWU6IFtjdXJyZW50LmtleSwgY3VycmVudC52YWx1ZV0sIGRvbmU6IGZhbHNlIH07XG5cdFx0XHRcdFx0Y3VycmVudCA9IGN1cnJlbnQubmV4dDtcblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB7IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWUgfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIGl0ZXJhdG9yO1xuXHR9XG5cblx0W1N5bWJvbC5pdGVyYXRvcl0oKTogSXRlcmFibGVJdGVyYXRvcjxbSywgVl0+IHtcblx0XHRyZXR1cm4gdGhpcy5lbnRyaWVzKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdHJpbU9sZChuZXdTaXplOiBudW1iZXIpIHtcblx0XHRpZiAobmV3U2l6ZSA+PSB0aGlzLnNpemUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKG5ld1NpemUgPT09IDApIHtcblx0XHRcdHRoaXMuY2xlYXIoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bGV0IGN1cnJlbnQgPSB0aGlzLl9oZWFkO1xuXHRcdGxldCBjdXJyZW50U2l6ZSA9IHRoaXMuc2l6ZTtcblx0XHR3aGlsZSAoY3VycmVudCAmJiBjdXJyZW50U2l6ZSA+IG5ld1NpemUpIHtcblx0XHRcdHRoaXMuX21hcC5kZWxldGUoY3VycmVudC5rZXkpO1xuXHRcdFx0Y3VycmVudCA9IGN1cnJlbnQubmV4dDtcblx0XHRcdGN1cnJlbnRTaXplLS07XG5cdFx0fVxuXHRcdHRoaXMuX2hlYWQgPSBjdXJyZW50O1xuXHRcdHRoaXMuX3NpemUgPSBjdXJyZW50U2l6ZTtcblx0XHRpZiAoY3VycmVudCkge1xuXHRcdFx0Y3VycmVudC5wcmV2aW91cyA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0dGhpcy5fc3RhdGUrKztcblx0fVxuXG5cdHByb3RlY3RlZCB0cmltTmV3KG5ld1NpemU6IG51bWJlcikge1xuXHRcdGlmIChuZXdTaXplID49IHRoaXMuc2l6ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAobmV3U2l6ZSA9PT0gMCkge1xuXHRcdFx0dGhpcy5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRsZXQgY3VycmVudCA9IHRoaXMuX3RhaWw7XG5cdFx0bGV0IGN1cnJlbnRTaXplID0gdGhpcy5zaXplO1xuXHRcdHdoaWxlIChjdXJyZW50ICYmIGN1cnJlbnRTaXplID4gbmV3U2l6ZSkge1xuXHRcdFx0dGhpcy5fbWFwLmRlbGV0ZShjdXJyZW50LmtleSk7XG5cdFx0XHRjdXJyZW50ID0gY3VycmVudC5wcmV2aW91cztcblx0XHRcdGN1cnJlbnRTaXplLS07XG5cdFx0fVxuXHRcdHRoaXMuX3RhaWwgPSBjdXJyZW50O1xuXHRcdHRoaXMuX3NpemUgPSBjdXJyZW50U2l6ZTtcblx0XHRpZiAoY3VycmVudCkge1xuXHRcdFx0Y3VycmVudC5uZXh0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLl9zdGF0ZSsrO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRJdGVtRmlyc3QoaXRlbTogSXRlbTxLLCBWPik6IHZvaWQge1xuXHRcdC8vIEZpcnN0IHRpbWUgSW5zZXJ0XG5cdFx0aWYgKCF0aGlzLl9oZWFkICYmICF0aGlzLl90YWlsKSB7XG5cdFx0XHR0aGlzLl90YWlsID0gaXRlbTtcblx0XHR9IGVsc2UgaWYgKCF0aGlzLl9oZWFkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGlzdCcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpdGVtLm5leHQgPSB0aGlzLl9oZWFkO1xuXHRcdFx0dGhpcy5faGVhZC5wcmV2aW91cyA9IGl0ZW07XG5cdFx0fVxuXHRcdHRoaXMuX2hlYWQgPSBpdGVtO1xuXHRcdHRoaXMuX3N0YXRlKys7XG5cdH1cblxuXHRwcml2YXRlIGFkZEl0ZW1MYXN0KGl0ZW06IEl0ZW08SywgVj4pOiB2b2lkIHtcblx0XHQvLyBGaXJzdCB0aW1lIEluc2VydFxuXHRcdGlmICghdGhpcy5faGVhZCAmJiAhdGhpcy5fdGFpbCkge1xuXHRcdFx0dGhpcy5faGVhZCA9IGl0ZW07XG5cdFx0fSBlbHNlIGlmICghdGhpcy5fdGFpbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpc3QnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aXRlbS5wcmV2aW91cyA9IHRoaXMuX3RhaWw7XG5cdFx0XHR0aGlzLl90YWlsLm5leHQgPSBpdGVtO1xuXHRcdH1cblx0XHR0aGlzLl90YWlsID0gaXRlbTtcblx0XHR0aGlzLl9zdGF0ZSsrO1xuXHR9XG5cblx0cHJpdmF0ZSByZW1vdmVJdGVtKGl0ZW06IEl0ZW08SywgVj4pOiB2b2lkIHtcblx0XHRpZiAoaXRlbSA9PT0gdGhpcy5faGVhZCAmJiBpdGVtID09PSB0aGlzLl90YWlsKSB7XG5cdFx0XHR0aGlzLl9oZWFkID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fdGFpbCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0ZWxzZSBpZiAoaXRlbSA9PT0gdGhpcy5faGVhZCkge1xuXHRcdFx0Ly8gVGhpcyBjYW4gb25seSBoYXBwZW4gaWYgc2l6ZSA9PT0gMSB3aGljaCBpcyBoYW5kbGVkXG5cdFx0XHQvLyBieSB0aGUgY2FzZSBhYm92ZS5cblx0XHRcdGlmICghaXRlbS5uZXh0KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsaXN0Jyk7XG5cdFx0XHR9XG5cdFx0XHRpdGVtLm5leHQucHJldmlvdXMgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLl9oZWFkID0gaXRlbS5uZXh0O1xuXHRcdH1cblx0XHRlbHNlIGlmIChpdGVtID09PSB0aGlzLl90YWlsKSB7XG5cdFx0XHQvLyBUaGlzIGNhbiBvbmx5IGhhcHBlbiBpZiBzaXplID09PSAxIHdoaWNoIGlzIGhhbmRsZWRcblx0XHRcdC8vIGJ5IHRoZSBjYXNlIGFib3ZlLlxuXHRcdFx0aWYgKCFpdGVtLnByZXZpb3VzKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsaXN0Jyk7XG5cdFx0XHR9XG5cdFx0XHRpdGVtLnByZXZpb3VzLm5leHQgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLl90YWlsID0gaXRlbS5wcmV2aW91cztcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRjb25zdCBuZXh0ID0gaXRlbS5uZXh0O1xuXHRcdFx0Y29uc3QgcHJldmlvdXMgPSBpdGVtLnByZXZpb3VzO1xuXHRcdFx0aWYgKCFuZXh0IHx8ICFwcmV2aW91cykge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGlzdCcpO1xuXHRcdFx0fVxuXHRcdFx0bmV4dC5wcmV2aW91cyA9IHByZXZpb3VzO1xuXHRcdFx0cHJldmlvdXMubmV4dCA9IG5leHQ7XG5cdFx0fVxuXHRcdGl0ZW0ubmV4dCA9IHVuZGVmaW5lZDtcblx0XHRpdGVtLnByZXZpb3VzID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3N0YXRlKys7XG5cdH1cblxuXHRwcml2YXRlIHRvdWNoKGl0ZW06IEl0ZW08SywgVj4sIHRvdWNoOiBUb3VjaCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5faGVhZCB8fCAhdGhpcy5fdGFpbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpc3QnKTtcblx0XHR9XG5cdFx0aWYgKCh0b3VjaCAhPT0gVG91Y2guQXNPbGQgJiYgdG91Y2ggIT09IFRvdWNoLkFzTmV3KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0b3VjaCA9PT0gVG91Y2guQXNPbGQpIHtcblx0XHRcdGlmIChpdGVtID09PSB0aGlzLl9oZWFkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmV4dCA9IGl0ZW0ubmV4dDtcblx0XHRcdGNvbnN0IHByZXZpb3VzID0gaXRlbS5wcmV2aW91cztcblxuXHRcdFx0Ly8gVW5saW5rIHRoZSBpdGVtXG5cdFx0XHRpZiAoaXRlbSA9PT0gdGhpcy5fdGFpbCkge1xuXHRcdFx0XHQvLyBwcmV2aW91cyBtdXN0IGJlIGRlZmluZWQgc2luY2UgaXRlbSB3YXMgbm90IGhlYWQgYnV0IGlzIHRhaWxcblx0XHRcdFx0Ly8gU28gdGhlcmUgYXJlIG1vcmUgdGhhbiBvbiBpdGVtIGluIHRoZSBtYXBcblx0XHRcdFx0cHJldmlvdXMhLm5leHQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX3RhaWwgPSBwcmV2aW91cztcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHQvLyBCb3RoIG5leHQgYW5kIHByZXZpb3VzIGFyZSBub3QgdW5kZWZpbmVkIHNpbmNlIGl0ZW0gd2FzIG5laXRoZXIgaGVhZCBub3IgdGFpbC5cblx0XHRcdFx0bmV4dCEucHJldmlvdXMgPSBwcmV2aW91cztcblx0XHRcdFx0cHJldmlvdXMhLm5leHQgPSBuZXh0O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJbnNlcnQgdGhlIG5vZGUgYXQgaGVhZFxuXHRcdFx0aXRlbS5wcmV2aW91cyA9IHVuZGVmaW5lZDtcblx0XHRcdGl0ZW0ubmV4dCA9IHRoaXMuX2hlYWQ7XG5cdFx0XHR0aGlzLl9oZWFkLnByZXZpb3VzID0gaXRlbTtcblx0XHRcdHRoaXMuX2hlYWQgPSBpdGVtO1xuXHRcdFx0dGhpcy5fc3RhdGUrKztcblx0XHR9IGVsc2UgaWYgKHRvdWNoID09PSBUb3VjaC5Bc05ldykge1xuXHRcdFx0aWYgKGl0ZW0gPT09IHRoaXMuX3RhaWwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBuZXh0ID0gaXRlbS5uZXh0O1xuXHRcdFx0Y29uc3QgcHJldmlvdXMgPSBpdGVtLnByZXZpb3VzO1xuXG5cdFx0XHQvLyBVbmxpbmsgdGhlIGl0ZW0uXG5cdFx0XHRpZiAoaXRlbSA9PT0gdGhpcy5faGVhZCkge1xuXHRcdFx0XHQvLyBuZXh0IG11c3QgYmUgZGVmaW5lZCBzaW5jZSBpdGVtIHdhcyBub3QgdGFpbCBidXQgaXMgaGVhZFxuXHRcdFx0XHQvLyBTbyB0aGVyZSBhcmUgbW9yZSB0aGFuIG9uIGl0ZW0gaW4gdGhlIG1hcFxuXHRcdFx0XHRuZXh0IS5wcmV2aW91cyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5faGVhZCA9IG5leHQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBCb3RoIG5leHQgYW5kIHByZXZpb3VzIGFyZSBub3QgdW5kZWZpbmVkIHNpbmNlIGl0ZW0gd2FzIG5laXRoZXIgaGVhZCBub3IgdGFpbC5cblx0XHRcdFx0bmV4dCEucHJldmlvdXMgPSBwcmV2aW91cztcblx0XHRcdFx0cHJldmlvdXMhLm5leHQgPSBuZXh0O1xuXHRcdFx0fVxuXHRcdFx0aXRlbS5uZXh0ID0gdW5kZWZpbmVkO1xuXHRcdFx0aXRlbS5wcmV2aW91cyA9IHRoaXMuX3RhaWw7XG5cdFx0XHR0aGlzLl90YWlsLm5leHQgPSBpdGVtO1xuXHRcdFx0dGhpcy5fdGFpbCA9IGl0ZW07XG5cdFx0XHR0aGlzLl9zdGF0ZSsrO1xuXHRcdH1cblx0fVxuXG5cdHRvSlNPTigpOiBbSywgVl1bXSB7XG5cdFx0Y29uc3QgZGF0YTogW0ssIFZdW10gPSBbXTtcblxuXHRcdHRoaXMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuXHRcdFx0ZGF0YS5wdXNoKFtrZXksIHZhbHVlXSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gZGF0YTtcblx0fVxuXG5cdGZyb21KU09OKGRhdGE6IFtLLCBWXVtdKTogdm9pZCB7XG5cdFx0dGhpcy5jbGVhcigpO1xuXG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgZGF0YSkge1xuXHRcdFx0dGhpcy5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0fVxuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIENhY2hlPEssIFY+IGV4dGVuZHMgTGlua2VkTWFwPEssIFY+IHtcblxuXHRwcm90ZWN0ZWQgX2xpbWl0OiBudW1iZXI7XG5cdHByb3RlY3RlZCBfcmF0aW86IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvcihsaW1pdDogbnVtYmVyLCByYXRpbzogbnVtYmVyID0gMSkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fbGltaXQgPSBsaW1pdDtcblx0XHR0aGlzLl9yYXRpbyA9IE1hdGgubWluKE1hdGgubWF4KDAsIHJhdGlvKSwgMSk7XG5cdH1cblxuXHRnZXQgbGltaXQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbGltaXQ7XG5cdH1cblxuXHRzZXQgbGltaXQobGltaXQ6IG51bWJlcikge1xuXHRcdHRoaXMuX2xpbWl0ID0gbGltaXQ7XG5cdFx0dGhpcy5jaGVja1RyaW0oKTtcblx0fVxuXG5cdGdldCByYXRpbygpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9yYXRpbztcblx0fVxuXG5cdHNldCByYXRpbyhyYXRpbzogbnVtYmVyKSB7XG5cdFx0dGhpcy5fcmF0aW8gPSBNYXRoLm1pbihNYXRoLm1heCgwLCByYXRpbyksIDEpO1xuXHRcdHRoaXMuY2hlY2tUcmltKCk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXQoa2V5OiBLLCB0b3VjaDogVG91Y2ggPSBUb3VjaC5Bc05ldyk6IFYgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBzdXBlci5nZXQoa2V5LCB0b3VjaCk7XG5cdH1cblxuXHRwZWVrKGtleTogSyk6IFYgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBzdXBlci5nZXQoa2V5LCBUb3VjaC5Ob25lKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldChrZXk6IEssIHZhbHVlOiBWKTogdGhpcyB7XG5cdFx0c3VwZXIuc2V0KGtleSwgdmFsdWUsIFRvdWNoLkFzTmV3KTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHByb3RlY3RlZCBjaGVja1RyaW0oKSB7XG5cdFx0aWYgKHRoaXMuc2l6ZSA+IHRoaXMuX2xpbWl0KSB7XG5cdFx0XHR0aGlzLnRyaW0oTWF0aC5yb3VuZCh0aGlzLl9saW1pdCAqIHRoaXMuX3JhdGlvKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IHRyaW0obmV3U2l6ZTogbnVtYmVyKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIExSVUNhY2hlPEssIFY+IGV4dGVuZHMgQ2FjaGU8SywgVj4ge1xuXG5cdGNvbnN0cnVjdG9yKGxpbWl0OiBudW1iZXIsIHJhdGlvOiBudW1iZXIgPSAxKSB7XG5cdFx0c3VwZXIobGltaXQsIHJhdGlvKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB0cmltKG5ld1NpemU6IG51bWJlcikge1xuXHRcdHRoaXMudHJpbU9sZChuZXdTaXplKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldChrZXk6IEssIHZhbHVlOiBWKTogdGhpcyB7XG5cdFx0c3VwZXIuc2V0KGtleSwgdmFsdWUpO1xuXHRcdHRoaXMuY2hlY2tUcmltKCk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1SVUNhY2hlPEssIFY+IGV4dGVuZHMgQ2FjaGU8SywgVj4ge1xuXG5cdGNvbnN0cnVjdG9yKGxpbWl0OiBudW1iZXIsIHJhdGlvOiBudW1iZXIgPSAxKSB7XG5cdFx0c3VwZXIobGltaXQsIHJhdGlvKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB0cmltKG5ld1NpemU6IG51bWJlcikge1xuXHRcdHRoaXMudHJpbU5ldyhuZXdTaXplKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldChrZXk6IEssIHZhbHVlOiBWKTogdGhpcyB7XG5cdFx0aWYgKHRoaXMuX2xpbWl0IDw9IHRoaXMuc2l6ZSAmJiAhdGhpcy5oYXMoa2V5KSkge1xuXHRcdFx0dGhpcy50cmltKE1hdGgucm91bmQodGhpcy5fbGltaXQgKiB0aGlzLl9yYXRpbykgLSAxKTtcblx0XHR9XG5cblx0XHRzdXBlci5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvdW50ZXJTZXQ8VD4ge1xuXG5cdHByaXZhdGUgbWFwID0gbmV3IE1hcDxULCBudW1iZXI+KCk7XG5cblx0YWRkKHZhbHVlOiBUKTogQ291bnRlclNldDxUPiB7XG5cdFx0dGhpcy5tYXAuc2V0KHZhbHVlLCAodGhpcy5tYXAuZ2V0KHZhbHVlKSB8fCAwKSArIDEpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0ZGVsZXRlKHZhbHVlOiBUKTogYm9vbGVhbiB7XG5cdFx0bGV0IGNvdW50ZXIgPSB0aGlzLm1hcC5nZXQodmFsdWUpIHx8IDA7XG5cblx0XHRpZiAoY291bnRlciA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvdW50ZXItLTtcblxuXHRcdGlmIChjb3VudGVyID09PSAwKSB7XG5cdFx0XHR0aGlzLm1hcC5kZWxldGUodmFsdWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm1hcC5zZXQodmFsdWUsIGNvdW50ZXIpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0aGFzKHZhbHVlOiBUKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubWFwLmhhcyh2YWx1ZSk7XG5cdH1cbn1cblxuLyoqXG4gKiBBIG1hcCB0aGF0IGFsbG93cyBhY2Nlc3MgYm90aCBieSBrZXlzIGFuZCB2YWx1ZXMuXG4gKiAqKk5PVEUqKjogdmFsdWVzIG5lZWQgdG8gYmUgdW5pcXVlLlxuICovXG5leHBvcnQgY2xhc3MgQmlkaXJlY3Rpb25hbE1hcDxLLCBWPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbTEgPSBuZXcgTWFwPEssIFY+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX20yID0gbmV3IE1hcDxWLCBLPigpO1xuXG5cdGNvbnN0cnVjdG9yKGVudHJpZXM/OiByZWFkb25seSAocmVhZG9ubHkgW0ssIFZdKVtdKSB7XG5cdFx0aWYgKGVudHJpZXMpIHtcblx0XHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIGVudHJpZXMpIHtcblx0XHRcdFx0dGhpcy5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Y2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fbTEuY2xlYXIoKTtcblx0XHR0aGlzLl9tMi5jbGVhcigpO1xuXHR9XG5cblx0c2V0KGtleTogSywgdmFsdWU6IFYpOiB2b2lkIHtcblx0XHR0aGlzLl9tMS5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0dGhpcy5fbTIuc2V0KHZhbHVlLCBrZXkpO1xuXHR9XG5cblx0Z2V0KGtleTogSyk6IFYgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9tMS5nZXQoa2V5KTtcblx0fVxuXG5cdGdldEtleSh2YWx1ZTogVik6IEsgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9tMi5nZXQodmFsdWUpO1xuXHR9XG5cblx0ZGVsZXRlKGtleTogSyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHZhbHVlID0gdGhpcy5fbTEuZ2V0KGtleSk7XG5cdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0dGhpcy5fbTEuZGVsZXRlKGtleSk7XG5cdFx0dGhpcy5fbTIuZGVsZXRlKHZhbHVlKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGZvckVhY2goY2FsbGJhY2tmbjogKHZhbHVlOiBWLCBrZXk6IEssIG1hcDogQmlkaXJlY3Rpb25hbE1hcDxLLCBWPikgPT4gdm9pZCwgdGhpc0FyZz86IGFueSk6IHZvaWQge1xuXHRcdHRoaXMuX20xLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcblx0XHRcdGNhbGxiYWNrZm4uY2FsbCh0aGlzQXJnLCB2YWx1ZSwga2V5LCB0aGlzKTtcblx0XHR9KTtcblx0fVxuXG5cdGtleXMoKTogSXRlcmFibGVJdGVyYXRvcjxLPiB7XG5cdFx0cmV0dXJuIHRoaXMuX20xLmtleXMoKTtcblx0fVxuXG5cdHZhbHVlcygpOiBJdGVyYWJsZUl0ZXJhdG9yPFY+IHtcblx0XHRyZXR1cm4gdGhpcy5fbTEudmFsdWVzKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNldE1hcDxLLCBWPiB7XG5cblx0cHJpdmF0ZSBtYXAgPSBuZXcgTWFwPEssIFNldDxWPj4oKTtcblxuXHRhZGQoa2V5OiBLLCB2YWx1ZTogVik6IHZvaWQge1xuXHRcdGxldCB2YWx1ZXMgPSB0aGlzLm1hcC5nZXQoa2V5KTtcblxuXHRcdGlmICghdmFsdWVzKSB7XG5cdFx0XHR2YWx1ZXMgPSBuZXcgU2V0PFY+KCk7XG5cdFx0XHR0aGlzLm1hcC5zZXQoa2V5LCB2YWx1ZXMpO1xuXHRcdH1cblxuXHRcdHZhbHVlcy5hZGQodmFsdWUpO1xuXHR9XG5cblx0ZGVsZXRlKGtleTogSywgdmFsdWU6IFYpOiB2b2lkIHtcblx0XHRjb25zdCB2YWx1ZXMgPSB0aGlzLm1hcC5nZXQoa2V5KTtcblxuXHRcdGlmICghdmFsdWVzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dmFsdWVzLmRlbGV0ZSh2YWx1ZSk7XG5cblx0XHRpZiAodmFsdWVzLnNpemUgPT09IDApIHtcblx0XHRcdHRoaXMubWFwLmRlbGV0ZShrZXkpO1xuXHRcdH1cblx0fVxuXG5cdGZvckVhY2goa2V5OiBLLCBmbjogKHZhbHVlOiBWKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0Y29uc3QgdmFsdWVzID0gdGhpcy5tYXAuZ2V0KGtleSk7XG5cblx0XHRpZiAoIXZhbHVlcykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHZhbHVlcy5mb3JFYWNoKGZuKTtcblx0fVxuXG5cdGdldChrZXk6IEspOiBSZWFkb25seVNldDxWPiB7XG5cdFx0Y29uc3QgdmFsdWVzID0gdGhpcy5tYXAuZ2V0KGtleSk7XG5cdFx0aWYgKCF2YWx1ZXMpIHtcblx0XHRcdHJldHVybiBuZXcgU2V0PFY+KCk7XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZXM7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hcHNTdHJpY3RFcXVhbElnbm9yZU9yZGVyKGE6IE1hcDx1bmtub3duLCB1bmtub3duPiwgYjogTWFwPHVua25vd24sIHVua25vd24+KTogYm9vbGVhbiB7XG5cdGlmIChhID09PSBiKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRpZiAoYS5zaXplICE9PSBiLnNpemUpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBhKSB7XG5cdFx0aWYgKCFiLmhhcyhrZXkpIHx8IGIuZ2V0KGtleSkgIT09IHZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0Zm9yIChjb25zdCBba2V5XSBvZiBiKSB7XG5cdFx0aWYgKCFhLmhhcyhrZXkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogQSBtYXAgdGhhdCBpcyBhZGRyZXNzYWJsZSB3aXRoIGFuIGFyYml0cmFyeSBudW1iZXIgb2Yga2V5cy4gVGhpcyBpcyB1c2VmdWwgaW4gaGlnaCBwZXJmb3JtYW5jZVxuICogc2NlbmFyaW9zIHdoZXJlIGNyZWF0aW5nIGEgY29tcG9zaXRlIGtleSB3aGVuZXZlciB0aGUgZGF0YSBpcyBhY2Nlc3NlZCBpcyB0b28gZXhwZW5zaXZlLiBGb3JcbiAqIGV4YW1wbGUgZm9yIGEgdmVyeSBob3QgZnVuY3Rpb24sIGNvbnN0cnVjdGluZyBhIHN0cmluZyBsaWtlIGBmaXJzdC1zZWNvbmQtdGhpcmRgIGZvciBldmVyeSBjYWxsXG4gKiB3aWxsIGNhdXNlIGEgc2lnbmlmaWNhbnQgaGl0IHRvIHBlcmZvcm1hbmNlLlxuICovXG5leHBvcnQgY2xhc3MgTktleU1hcDxUVmFsdWUsIFRLZXlzIGV4dGVuZHMgKHN0cmluZyB8IGJvb2xlYW4gfCBudW1iZXIpW10+IHtcblx0cHJpdmF0ZSBfZGF0YTogTWFwPGFueSwgYW55PiA9IG5ldyBNYXAoKTtcblxuXHQvKipcblx0ICogU2V0cyBhIHZhbHVlIG9uIHRoZSBtYXAuIE5vdGUgdGhhdCB1bmxpa2UgYSBzdGFuZGFyZCBgTWFwYCwgdGhlIGZpcnN0IGFyZ3VtZW50IGlzIHRoZSB2YWx1ZS5cblx0ICogVGhpcyBpcyBiZWNhdXNlIHRoZSBzcHJlYWQgb3BlcmF0b3IgaXMgdXNlZCBmb3IgdGhlIGtleXMgYW5kIG11c3QgYmUgbGFzdC4uXG5cdCAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2V0LlxuXHQgKiBAcGFyYW0ga2V5cyBUaGUga2V5cyBmb3IgdGhlIHZhbHVlLlxuXHQgKi9cblx0cHVibGljIHNldCh2YWx1ZTogVFZhbHVlLCAuLi5rZXlzOiBbLi4uVEtleXNdKTogdm9pZCB7XG5cdFx0bGV0IGN1cnJlbnRNYXAgPSB0aGlzLl9kYXRhO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGggLSAxOyBpKyspIHtcblx0XHRcdGlmICghY3VycmVudE1hcC5oYXMoa2V5c1tpXSkpIHtcblx0XHRcdFx0Y3VycmVudE1hcC5zZXQoa2V5c1tpXSwgbmV3IE1hcCgpKTtcblx0XHRcdH1cblx0XHRcdGN1cnJlbnRNYXAgPSBjdXJyZW50TWFwLmdldChrZXlzW2ldKTtcblx0XHR9XG5cdFx0Y3VycmVudE1hcC5zZXQoa2V5c1trZXlzLmxlbmd0aCAtIDFdLCB2YWx1ZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0KC4uLmtleXM6IFsuLi5US2V5c10pOiBUVmFsdWUgfCB1bmRlZmluZWQge1xuXHRcdGxldCBjdXJyZW50TWFwID0gdGhpcy5fZGF0YTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoIC0gMTsgaSsrKSB7XG5cdFx0XHRpZiAoIWN1cnJlbnRNYXAuaGFzKGtleXNbaV0pKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRjdXJyZW50TWFwID0gY3VycmVudE1hcC5nZXQoa2V5c1tpXSk7XG5cdFx0fVxuXHRcdHJldHVybiBjdXJyZW50TWFwLmdldChrZXlzW2tleXMubGVuZ3RoIC0gMV0pO1xuXHR9XG5cblx0cHVibGljIGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMuX2RhdGEuY2xlYXIoKTtcblx0fVxuXG5cdHB1YmxpYyAqdmFsdWVzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8VFZhbHVlPiB7XG5cdFx0ZnVuY3Rpb24qIGl0ZXJhdGUobWFwOiBNYXA8YW55LCBhbnk+KTogSXRlcmFibGVJdGVyYXRvcjxUVmFsdWU+IHtcblx0XHRcdGZvciAoY29uc3QgdmFsdWUgb2YgbWFwLnZhbHVlcygpKSB7XG5cdFx0XHRcdGlmICh2YWx1ZSBpbnN0YW5jZW9mIE1hcCkge1xuXHRcdFx0XHRcdHlpZWxkKiBpdGVyYXRlKHZhbHVlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR5aWVsZCB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR5aWVsZCogaXRlcmF0ZSh0aGlzLl9kYXRhKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgYSB0ZXh0dWFsIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBtYXAgZm9yIGRlYnVnZ2luZyBwdXJwb3Nlcy5cblx0ICovXG5cdHB1YmxpYyB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHByaW50TWFwID0gKG1hcDogTWFwPGFueSwgYW55PiwgZGVwdGg6IG51bWJlcik6IHN0cmluZyA9PiB7XG5cdFx0XHRsZXQgcmVzdWx0ID0gJyc7XG5cdFx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBtYXApIHtcblx0XHRcdFx0cmVzdWx0ICs9IGAkeycgICcucmVwZWF0KGRlcHRoKX0ke2tleX06IGA7XG5cdFx0XHRcdGlmICh2YWx1ZSBpbnN0YW5jZW9mIE1hcCkge1xuXHRcdFx0XHRcdHJlc3VsdCArPSAnXFxuJyArIHByaW50TWFwKHZhbHVlLCBkZXB0aCArIDEpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdCArPSBgJHt2YWx1ZX1cXG5gO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH07XG5cblx0XHRyZXR1cm4gcHJpbnRNYXAodGhpcy5fZGF0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
