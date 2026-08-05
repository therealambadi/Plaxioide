import { toErrorMessage } from "../common/errorMessage.js";
import { ErrorNoTelemetry, getErrorMessage } from "../common/errors.js";
import { mark } from "../common/performance.js";
class MissingStoresError extends Error {
  constructor(db) {
    super("Missing stores");
    this.db = db;
  }
}
class DBClosedError extends Error {
  constructor(dbName) {
    super(`IndexedDB database '${dbName}' is closed.`);
    this.code = "DBClosed";
  }
}
class IndexedDB {
  constructor(database, name) {
    this.name = name;
    this.database = null;
    this.pendingTransactions = [];
    this.database = database;
  }
  static async create(name, version, stores) {
    const database = await IndexedDB.openDatabase(name, version, stores);
    return new IndexedDB(database, name);
  }
  static async openDatabase(name, version, stores) {
    mark(`code/willOpenDatabase/${name}`);
    try {
      return await IndexedDB.doOpenDatabase(name, version, stores);
    } catch (err) {
      if (err instanceof MissingStoresError) {
        console.info(`Attempting to recreate the IndexedDB once.`, name);
        try {
          await IndexedDB.deleteDatabase(err.db);
        } catch (error) {
          console.error(`Error while deleting the IndexedDB`, getErrorMessage(error));
          throw error;
        }
        return await IndexedDB.doOpenDatabase(name, version, stores);
      }
      throw err;
    } finally {
      mark(`code/didOpenDatabase/${name}`);
    }
  }
  static doOpenDatabase(name, version, stores) {
    return new Promise((c, e) => {
      const request = indexedDB.open(name, version);
      request.onerror = () => e(request.error);
      request.onsuccess = () => {
        const db = request.result;
        for (const store of stores) {
          if (!db.objectStoreNames.contains(store)) {
            console.error(`Error while opening IndexedDB. Could not find '${store}'' object store`);
            e(new MissingStoresError(db));
            return;
          }
        }
        c(db);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of stores) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store);
          }
        }
      };
    });
  }
  static deleteDatabase(database) {
    return new Promise((c, e) => {
      database.close();
      const deleteRequest = indexedDB.deleteDatabase(database.name);
      deleteRequest.onerror = (err) => e(deleteRequest.error);
      deleteRequest.onsuccess = () => c();
    });
  }
  hasPendingTransactions() {
    return this.pendingTransactions.length > 0;
  }
  close() {
    if (this.pendingTransactions.length) {
      this.pendingTransactions.splice(0, this.pendingTransactions.length).forEach((transaction) => transaction.abort());
    }
    this.database?.close();
    this.database = null;
  }
  async runInTransaction(store, transactionMode, dbRequestFn) {
    if (!this.database) {
      throw new DBClosedError(this.name);
    }
    const transaction = this.database.transaction(store, transactionMode);
    this.pendingTransactions.push(transaction);
    return new Promise((c, e) => {
      transaction.oncomplete = () => {
        if (Array.isArray(request)) {
          c(request.map((r) => r.result));
        } else {
          c(request.result);
        }
      };
      transaction.onerror = () => e(transaction.error ? ErrorNoTelemetry.fromError(transaction.error) : new ErrorNoTelemetry("unknown error"));
      transaction.onabort = () => e(transaction.error ? ErrorNoTelemetry.fromError(transaction.error) : new ErrorNoTelemetry("unknown error"));
      const request = dbRequestFn(transaction.objectStore(store));
    }).finally(() => this.pendingTransactions.splice(this.pendingTransactions.indexOf(transaction), 1));
  }
  async getKeyValues(store, isValid) {
    if (!this.database) {
      throw new DBClosedError(this.name);
    }
    const transaction = this.database.transaction(store, "readonly");
    this.pendingTransactions.push(transaction);
    return new Promise((resolve) => {
      const items = /* @__PURE__ */ new Map();
      const objectStore = transaction.objectStore(store);
      const cursor = objectStore.openCursor();
      if (!cursor) {
        return resolve(items);
      }
      cursor.onsuccess = () => {
        if (cursor.result) {
          if (isValid(cursor.result.value)) {
            items.set(cursor.result.key.toString(), cursor.result.value);
          }
          cursor.result.continue();
        } else {
          resolve(items);
        }
      };
      const onError = (error) => {
        console.error(`IndexedDB getKeyValues(): ${toErrorMessage(error, true)}`);
        resolve(items);
      };
      cursor.onerror = () => onError(cursor.error);
      transaction.onerror = () => onError(transaction.error);
    }).finally(() => this.pendingTransactions.splice(this.pendingTransactions.indexOf(transaction), 1));
  }
}
export {
  DBClosedError,
  IndexedDB
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvaW5kZXhlZERCLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IEVycm9yTm9UZWxlbWV0cnksIGdldEVycm9yTWVzc2FnZSB9IGZyb20gJy4uL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgbWFyayB9IGZyb20gJy4uL2NvbW1vbi9wZXJmb3JtYW5jZS5qcyc7XG5cbmNsYXNzIE1pc3NpbmdTdG9yZXNFcnJvciBleHRlbmRzIEVycm9yIHtcblx0Y29uc3RydWN0b3IocmVhZG9ubHkgZGI6IElEQkRhdGFiYXNlKSB7XG5cdFx0c3VwZXIoJ01pc3Npbmcgc3RvcmVzJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERCQ2xvc2VkRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cdHJlYWRvbmx5IGNvZGUgPSAnREJDbG9zZWQnO1xuXHRjb25zdHJ1Y3RvcihkYk5hbWU6IHN0cmluZykge1xuXHRcdHN1cGVyKGBJbmRleGVkREIgZGF0YWJhc2UgJyR7ZGJOYW1lfScgaXMgY2xvc2VkLmApO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbmRleGVkREIge1xuXG5cdHN0YXRpYyBhc3luYyBjcmVhdGUobmFtZTogc3RyaW5nLCB2ZXJzaW9uOiBudW1iZXIgfCB1bmRlZmluZWQsIHN0b3Jlczogc3RyaW5nW10pOiBQcm9taXNlPEluZGV4ZWREQj4ge1xuXHRcdGNvbnN0IGRhdGFiYXNlID0gYXdhaXQgSW5kZXhlZERCLm9wZW5EYXRhYmFzZShuYW1lLCB2ZXJzaW9uLCBzdG9yZXMpO1xuXHRcdHJldHVybiBuZXcgSW5kZXhlZERCKGRhdGFiYXNlLCBuYW1lKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIGFzeW5jIG9wZW5EYXRhYmFzZShuYW1lOiBzdHJpbmcsIHZlcnNpb246IG51bWJlciB8IHVuZGVmaW5lZCwgc3RvcmVzOiBzdHJpbmdbXSk6IFByb21pc2U8SURCRGF0YWJhc2U+IHtcblx0XHRtYXJrKGBjb2RlL3dpbGxPcGVuRGF0YWJhc2UvJHtuYW1lfWApO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgSW5kZXhlZERCLmRvT3BlbkRhdGFiYXNlKG5hbWUsIHZlcnNpb24sIHN0b3Jlcyk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRpZiAoZXJyIGluc3RhbmNlb2YgTWlzc2luZ1N0b3Jlc0Vycm9yKSB7XG5cdFx0XHRcdGNvbnNvbGUuaW5mbyhgQXR0ZW1wdGluZyB0byByZWNyZWF0ZSB0aGUgSW5kZXhlZERCIG9uY2UuYCwgbmFtZSk7XG5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHQvLyBUcnkgdG8gZGVsZXRlIHRoZSBkYlxuXHRcdFx0XHRcdGF3YWl0IEluZGV4ZWREQi5kZWxldGVEYXRhYmFzZShlcnIuZGIpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoYEVycm9yIHdoaWxlIGRlbGV0aW5nIHRoZSBJbmRleGVkREJgLCBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpKTtcblx0XHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBhd2FpdCBJbmRleGVkREIuZG9PcGVuRGF0YWJhc2UobmFtZSwgdmVyc2lvbiwgc3RvcmVzKTtcblx0XHRcdH1cblxuXHRcdFx0dGhyb3cgZXJyO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRtYXJrKGBjb2RlL2RpZE9wZW5EYXRhYmFzZS8ke25hbWV9YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgZG9PcGVuRGF0YWJhc2UobmFtZTogc3RyaW5nLCB2ZXJzaW9uOiBudW1iZXIgfCB1bmRlZmluZWQsIHN0b3Jlczogc3RyaW5nW10pOiBQcm9taXNlPElEQkRhdGFiYXNlPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChjLCBlKSA9PiB7XG5cdFx0XHRjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLm9wZW4obmFtZSwgdmVyc2lvbik7XG5cdFx0XHRyZXF1ZXN0Lm9uZXJyb3IgPSAoKSA9PiBlKHJlcXVlc3QuZXJyb3IpO1xuXHRcdFx0cmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGRiID0gcmVxdWVzdC5yZXN1bHQ7XG5cdFx0XHRcdGZvciAoY29uc3Qgc3RvcmUgb2Ygc3RvcmVzKSB7XG5cdFx0XHRcdFx0aWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKHN0b3JlKSkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihgRXJyb3Igd2hpbGUgb3BlbmluZyBJbmRleGVkREIuIENvdWxkIG5vdCBmaW5kICcke3N0b3JlfScnIG9iamVjdCBzdG9yZWApO1xuXHRcdFx0XHRcdFx0ZShuZXcgTWlzc2luZ1N0b3Jlc0Vycm9yKGRiKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGMoZGIpO1xuXHRcdFx0fTtcblx0XHRcdHJlcXVlc3Qub251cGdyYWRlbmVlZGVkID0gKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBkYiA9IHJlcXVlc3QucmVzdWx0O1xuXHRcdFx0XHRmb3IgKGNvbnN0IHN0b3JlIG9mIHN0b3Jlcykge1xuXHRcdFx0XHRcdGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhzdG9yZSkpIHtcblx0XHRcdFx0XHRcdGRiLmNyZWF0ZU9iamVjdFN0b3JlKHN0b3JlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBkZWxldGVEYXRhYmFzZShkYXRhYmFzZTogSURCRGF0YWJhc2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKGMsIGUpID0+IHtcblx0XHRcdC8vIENsb3NlIGFueSBvcGVuZWQgY29ubmVjdGlvbnNcblx0XHRcdGRhdGFiYXNlLmNsb3NlKCk7XG5cblx0XHRcdC8vIERlbGV0ZSB0aGUgZGJcblx0XHRcdGNvbnN0IGRlbGV0ZVJlcXVlc3QgPSBpbmRleGVkREIuZGVsZXRlRGF0YWJhc2UoZGF0YWJhc2UubmFtZSk7XG5cdFx0XHRkZWxldGVSZXF1ZXN0Lm9uZXJyb3IgPSAoZXJyKSA9PiBlKGRlbGV0ZVJlcXVlc3QuZXJyb3IpO1xuXHRcdFx0ZGVsZXRlUmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiBjKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGRhdGFiYXNlOiBJREJEYXRhYmFzZSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHJlYWRvbmx5IHBlbmRpbmdUcmFuc2FjdGlvbnM6IElEQlRyYW5zYWN0aW9uW10gPSBbXTtcblxuXHRjb25zdHJ1Y3RvcihkYXRhYmFzZTogSURCRGF0YWJhc2UsIHByaXZhdGUgcmVhZG9ubHkgbmFtZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5kYXRhYmFzZSA9IGRhdGFiYXNlO1xuXHR9XG5cblx0aGFzUGVuZGluZ1RyYW5zYWN0aW9ucygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5wZW5kaW5nVHJhbnNhY3Rpb25zLmxlbmd0aCA+IDA7XG5cdH1cblxuXHRjbG9zZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5wZW5kaW5nVHJhbnNhY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5wZW5kaW5nVHJhbnNhY3Rpb25zLnNwbGljZSgwLCB0aGlzLnBlbmRpbmdUcmFuc2FjdGlvbnMubGVuZ3RoKS5mb3JFYWNoKHRyYW5zYWN0aW9uID0+IHRyYW5zYWN0aW9uLmFib3J0KCkpO1xuXHRcdH1cblx0XHR0aGlzLmRhdGFiYXNlPy5jbG9zZSgpO1xuXHRcdHRoaXMuZGF0YWJhc2UgPSBudWxsO1xuXHR9XG5cblx0cnVuSW5UcmFuc2FjdGlvbjxUPihzdG9yZTogc3RyaW5nLCB0cmFuc2FjdGlvbk1vZGU6IElEQlRyYW5zYWN0aW9uTW9kZSwgZGJSZXF1ZXN0Rm46IChzdG9yZTogSURCT2JqZWN0U3RvcmUpID0+IElEQlJlcXVlc3Q8VD5bXSk6IFByb21pc2U8VFtdPjtcblx0cnVuSW5UcmFuc2FjdGlvbjxUPihzdG9yZTogc3RyaW5nLCB0cmFuc2FjdGlvbk1vZGU6IElEQlRyYW5zYWN0aW9uTW9kZSwgZGJSZXF1ZXN0Rm46IChzdG9yZTogSURCT2JqZWN0U3RvcmUpID0+IElEQlJlcXVlc3Q8VD4pOiBQcm9taXNlPFQ+O1xuXHRhc3luYyBydW5JblRyYW5zYWN0aW9uPFQ+KHN0b3JlOiBzdHJpbmcsIHRyYW5zYWN0aW9uTW9kZTogSURCVHJhbnNhY3Rpb25Nb2RlLCBkYlJlcXVlc3RGbjogKHN0b3JlOiBJREJPYmplY3RTdG9yZSkgPT4gSURCUmVxdWVzdDxUPiB8IElEQlJlcXVlc3Q8VD5bXSk6IFByb21pc2U8VCB8IFRbXT4ge1xuXHRcdGlmICghdGhpcy5kYXRhYmFzZSkge1xuXHRcdFx0dGhyb3cgbmV3IERCQ2xvc2VkRXJyb3IodGhpcy5uYW1lKTtcblx0XHR9XG5cdFx0Y29uc3QgdHJhbnNhY3Rpb24gPSB0aGlzLmRhdGFiYXNlLnRyYW5zYWN0aW9uKHN0b3JlLCB0cmFuc2FjdGlvbk1vZGUpO1xuXHRcdHRoaXMucGVuZGluZ1RyYW5zYWN0aW9ucy5wdXNoKHRyYW5zYWN0aW9uKTtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8VCB8IFRbXT4oKGMsIGUpID0+IHtcblx0XHRcdHRyYW5zYWN0aW9uLm9uY29tcGxldGUgPSAoKSA9PiB7XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHJlcXVlc3QpKSB7XG5cdFx0XHRcdFx0YyhyZXF1ZXN0Lm1hcChyID0+IHIucmVzdWx0KSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YyhyZXF1ZXN0LnJlc3VsdCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHR0cmFuc2FjdGlvbi5vbmVycm9yID0gKCkgPT4gZSh0cmFuc2FjdGlvbi5lcnJvciA/IEVycm9yTm9UZWxlbWV0cnkuZnJvbUVycm9yKHRyYW5zYWN0aW9uLmVycm9yKSA6IG5ldyBFcnJvck5vVGVsZW1ldHJ5KCd1bmtub3duIGVycm9yJykpO1xuXHRcdFx0dHJhbnNhY3Rpb24ub25hYm9ydCA9ICgpID0+IGUodHJhbnNhY3Rpb24uZXJyb3IgPyBFcnJvck5vVGVsZW1ldHJ5LmZyb21FcnJvcih0cmFuc2FjdGlvbi5lcnJvcikgOiBuZXcgRXJyb3JOb1RlbGVtZXRyeSgndW5rbm93biBlcnJvcicpKTtcblx0XHRcdGNvbnN0IHJlcXVlc3QgPSBkYlJlcXVlc3RGbih0cmFuc2FjdGlvbi5vYmplY3RTdG9yZShzdG9yZSkpO1xuXHRcdH0pLmZpbmFsbHkoKCkgPT4gdGhpcy5wZW5kaW5nVHJhbnNhY3Rpb25zLnNwbGljZSh0aGlzLnBlbmRpbmdUcmFuc2FjdGlvbnMuaW5kZXhPZih0cmFuc2FjdGlvbiksIDEpKTtcblx0fVxuXG5cdGFzeW5jIGdldEtleVZhbHVlczxWPihzdG9yZTogc3RyaW5nLCBpc1ZhbGlkOiAodmFsdWU6IHVua25vd24pID0+IHZhbHVlIGlzIFYpOiBQcm9taXNlPE1hcDxzdHJpbmcsIFY+PiB7XG5cdFx0aWYgKCF0aGlzLmRhdGFiYXNlKSB7XG5cdFx0XHR0aHJvdyBuZXcgREJDbG9zZWRFcnJvcih0aGlzLm5hbWUpO1xuXHRcdH1cblx0XHRjb25zdCB0cmFuc2FjdGlvbiA9IHRoaXMuZGF0YWJhc2UudHJhbnNhY3Rpb24oc3RvcmUsICdyZWFkb25seScpO1xuXHRcdHRoaXMucGVuZGluZ1RyYW5zYWN0aW9ucy5wdXNoKHRyYW5zYWN0aW9uKTtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8TWFwPHN0cmluZywgVj4+KHJlc29sdmUgPT4ge1xuXHRcdFx0Y29uc3QgaXRlbXMgPSBuZXcgTWFwPHN0cmluZywgVj4oKTtcblxuXHRcdFx0Y29uc3Qgb2JqZWN0U3RvcmUgPSB0cmFuc2FjdGlvbi5vYmplY3RTdG9yZShzdG9yZSk7XG5cblx0XHRcdC8vIE9wZW4gYSBJbmRleGVkREIgQ3Vyc29yIHRvIGl0ZXJhdGUgb3ZlciBrZXkvdmFsdWVzXG5cdFx0XHRjb25zdCBjdXJzb3IgPSBvYmplY3RTdG9yZS5vcGVuQ3Vyc29yKCk7XG5cdFx0XHRpZiAoIWN1cnNvcikge1xuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZShpdGVtcyk7IC8vIHRoaXMgbWVhbnMgdGhlIGBJdGVtVGFibGVgIHdhcyBlbXB0eVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJdGVyYXRlIG92ZXIgcm93cyBvZiBgSXRlbVRhYmxlYCB1bnRpbCB0aGUgZW5kXG5cdFx0XHRjdXJzb3Iub25zdWNjZXNzID0gKCkgPT4ge1xuXHRcdFx0XHRpZiAoY3Vyc29yLnJlc3VsdCkge1xuXG5cdFx0XHRcdFx0Ly8gS2VlcCBjdXJzb3Iga2V5L3ZhbHVlIGluIG91ciBtYXBcblx0XHRcdFx0XHRpZiAoaXNWYWxpZChjdXJzb3IucmVzdWx0LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0aXRlbXMuc2V0KGN1cnNvci5yZXN1bHQua2V5LnRvU3RyaW5nKCksIGN1cnNvci5yZXN1bHQudmFsdWUpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIEFkdmFuY2UgY3Vyc29yIHRvIG5leHQgcm93XG5cdFx0XHRcdFx0Y3Vyc29yLnJlc3VsdC5jb250aW51ZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc29sdmUoaXRlbXMpOyAvLyByZWFjaGVkIGVuZCBvZiB0YWJsZVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHQvLyBFcnJvciBoYW5kbGVyc1xuXHRcdFx0Y29uc3Qgb25FcnJvciA9IChlcnJvcjogRXJyb3IgfCBudWxsKSA9PiB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoYEluZGV4ZWREQiBnZXRLZXlWYWx1ZXMoKTogJHt0b0Vycm9yTWVzc2FnZShlcnJvciwgdHJ1ZSl9YCk7XG5cblx0XHRcdFx0cmVzb2x2ZShpdGVtcyk7XG5cdFx0XHR9O1xuXHRcdFx0Y3Vyc29yLm9uZXJyb3IgPSAoKSA9PiBvbkVycm9yKGN1cnNvci5lcnJvcik7XG5cdFx0XHR0cmFuc2FjdGlvbi5vbmVycm9yID0gKCkgPT4gb25FcnJvcih0cmFuc2FjdGlvbi5lcnJvcik7XG5cdFx0fSkuZmluYWxseSgoKSA9PiB0aGlzLnBlbmRpbmdUcmFuc2FjdGlvbnMuc3BsaWNlKHRoaXMucGVuZGluZ1RyYW5zYWN0aW9ucy5pbmRleE9mKHRyYW5zYWN0aW9uKSwgMSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGtCQUFrQix1QkFBdUI7QUFDbEQsU0FBUyxZQUFZO0FBRXJCLE1BQU0sMkJBQTJCLE1BQU07QUFBQSxFQUN0QyxZQUFxQixJQUFpQjtBQUNyQyxVQUFNLGdCQUFnQjtBQURGO0FBQUEsRUFFckI7QUFDRDtBQUVPLE1BQU0sc0JBQXNCLE1BQU07QUFBQSxFQUV4QyxZQUFZLFFBQWdCO0FBQzNCLFVBQU0sdUJBQXVCLE1BQU0sY0FBYztBQUZsRCxTQUFTLE9BQU87QUFBQSxFQUdoQjtBQUNEO0FBRU8sTUFBTSxVQUFVO0FBQUEsRUF5RXRCLFlBQVksVUFBd0MsTUFBYztBQUFkO0FBSHBELFNBQVEsV0FBK0I7QUFD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
