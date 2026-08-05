import * as fs from "fs";
import { timeout } from "../../../common/async.js";
import { Event } from "../../../common/event.js";
import { mapToString, setToString } from "../../../common/map.js";
import { basename } from "../../../common/path.js";
import { Promises } from "../../../node/pfs.js";
const _SQLiteStorageDatabase = class _SQLiteStorageDatabase {
  constructor(path, options = /* @__PURE__ */ Object.create(null)) {
    this.path = path;
    this.name = basename(this.path);
    this.logger = new SQLiteStorageDatabaseLogger(options.logging);
    this.whenConnected = this.connect(this.path);
  }
  get onDidChangeItemsExternal() {
    return Event.None;
  }
  async getItems() {
    const connection = await this.whenConnected;
    const items = /* @__PURE__ */ new Map();
    const rows = await this.all(connection, "SELECT * FROM ItemTable");
    rows.forEach((row) => items.set(row.key, row.value));
    if (this.logger.isTracing) {
      this.logger.trace(`[storage ${this.name}] getItems(): ${items.size} rows`);
    }
    return items;
  }
  async updateItems(request) {
    const connection = await this.whenConnected;
    return this.doUpdateItems(connection, request);
  }
  doUpdateItems(connection, request) {
    if (this.logger.isTracing) {
      this.logger.trace(`[storage ${this.name}] updateItems(): insert(${request.insert ? mapToString(request.insert) : "0"}), delete(${request.delete ? setToString(request.delete) : "0"})`);
    }
    return this.transaction(connection, () => {
      const toInsert = request.insert;
      const toDelete = request.delete;
      if (toInsert && toInsert.size > 0) {
        const keysValuesChunks = [];
        keysValuesChunks.push([]);
        let currentChunkIndex = 0;
        toInsert.forEach((value, key) => {
          let keyValueChunk = keysValuesChunks[currentChunkIndex];
          if (keyValueChunk.length > _SQLiteStorageDatabase.MAX_HOST_PARAMETERS) {
            currentChunkIndex++;
            keyValueChunk = [];
            keysValuesChunks.push(keyValueChunk);
          }
          keyValueChunk.push(key, value);
        });
        keysValuesChunks.forEach((keysValuesChunk) => {
          this.prepare(connection, `INSERT INTO ItemTable VALUES ${new Array(keysValuesChunk.length / 2).fill("(?,?)").join(",")}`, (stmt) => stmt.run(keysValuesChunk), () => {
            const keys = [];
            let length = 0;
            toInsert.forEach((value, key) => {
              keys.push(key);
              length += value.length;
            });
            return `Keys: ${keys.join(", ")} Length: ${length}`;
          });
        });
      }
      if (toDelete && toDelete.size) {
        const keysChunks = [];
        keysChunks.push([]);
        let currentChunkIndex = 0;
        toDelete.forEach((key) => {
          let keyChunk = keysChunks[currentChunkIndex];
          if (keyChunk.length > _SQLiteStorageDatabase.MAX_HOST_PARAMETERS) {
            currentChunkIndex++;
            keyChunk = [];
            keysChunks.push(keyChunk);
          }
          keyChunk.push(key);
        });
        keysChunks.forEach((keysChunk) => {
          this.prepare(connection, `DELETE FROM ItemTable WHERE key IN (${new Array(keysChunk.length).fill("?").join(",")})`, (stmt) => stmt.run(keysChunk), () => {
            const keys = [];
            toDelete.forEach((key) => {
              keys.push(key);
            });
            return `Keys: ${keys.join(", ")}`;
          });
        });
      }
    });
  }
  async optimize() {
    this.logger.trace(`[storage ${this.name}] vacuum()`);
    const connection = await this.whenConnected;
    return this.exec(connection, "VACUUM");
  }
  async close(recovery) {
    this.logger.trace(`[storage ${this.name}] close()`);
    const connection = await this.whenConnected;
    return this.doClose(connection, recovery);
  }
  doClose(connection, recovery) {
    return new Promise((resolve, reject) => {
      connection.db.close((closeError) => {
        if (closeError) {
          this.handleSQLiteError(connection, `[storage ${this.name}] close(): ${closeError}`);
        }
        if (this.path === _SQLiteStorageDatabase.IN_MEMORY_PATH) {
          return resolve();
        }
        if (!connection.isErroneous && !connection.isInMemory) {
          return this.backup().then(resolve, (error) => {
            this.logger.error(`[storage ${this.name}] backup(): ${error}`);
            return resolve();
          });
        }
        if (typeof recovery === "function") {
          return fs.promises.unlink(this.path).then(() => {
            return this.doConnect(this.path).then((recoveryConnection) => {
              const closeRecoveryConnection = () => {
                return this.doClose(
                  recoveryConnection,
                  void 0
                  /* do not attempt to recover again */
                );
              };
              return this.doUpdateItems(recoveryConnection, { insert: recovery() }).then(() => closeRecoveryConnection(), (error) => {
                closeRecoveryConnection();
                return Promise.reject(error);
              });
            });
          }).then(resolve, reject);
        }
        return reject(closeError || new Error("Database has errors or is in-memory without recovery option"));
      });
    });
  }
  backup() {
    const backupPath = this.toBackupPath(this.path);
    return Promises.copy(this.path, backupPath, { preserveSymlinks: false });
  }
  toBackupPath(path) {
    return `${path}.backup`;
  }
  async checkIntegrity(full) {
    this.logger.trace(`[storage ${this.name}] checkIntegrity(full: ${full})`);
    const connection = await this.whenConnected;
    const row = await this.get(connection, full ? "PRAGMA integrity_check" : "PRAGMA quick_check");
    const integrity = full ? row["integrity_check"] : row["quick_check"];
    if (connection.isErroneous) {
      return `${integrity} (last error: ${connection.lastError})`;
    }
    if (connection.isInMemory) {
      return `${integrity} (in-memory!)`;
    }
    return integrity;
  }
  async connect(path, retryOnBusy = true) {
    this.logger.trace(`[storage ${this.name}] open(${path}, retryOnBusy: ${retryOnBusy})`);
    try {
      return await this.doConnect(path);
    } catch (error) {
      this.logger.error(`[storage ${this.name}] open(): Unable to open DB due to ${error}`);
      if (error.code === "SQLITE_BUSY" && retryOnBusy) {
        await timeout(_SQLiteStorageDatabase.BUSY_OPEN_TIMEOUT);
        return this.connect(
          path,
          false
          /* not another retry */
        );
      }
      try {
        await fs.promises.unlink(path);
        try {
          await Promises.rename(
            this.toBackupPath(path),
            path,
            false
            /* no retry */
          );
        } catch (error2) {
        }
        return await this.doConnect(path);
      } catch (error2) {
        this.logger.error(`[storage ${this.name}] open(): Unable to use backup due to ${error2}`);
        return this.doConnect(_SQLiteStorageDatabase.IN_MEMORY_PATH);
      }
    }
  }
  handleSQLiteError(connection, msg) {
    connection.isErroneous = true;
    connection.lastError = msg;
    this.logger.error(msg);
  }
  doConnect(path) {
    return new Promise((resolve, reject) => {
      import("@vscode/sqlite3").then((sqlite3) => {
        const ctor = this.logger.isTracing ? sqlite3.default.verbose().Database : sqlite3.default.Database;
        const connection = {
          db: new ctor(path, (error) => {
            if (error) {
              return connection.db && error.code !== "SQLITE_CANTOPEN" ? connection.db.close(() => reject(error)) : reject(error);
            }
            return this.exec(connection, [
              "PRAGMA user_version = 1;",
              "CREATE TABLE IF NOT EXISTS ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)"
            ].join("")).then(() => {
              return resolve(connection);
            }, (error2) => {
              return connection.db.close(() => reject(error2));
            });
          }),
          isInMemory: path === _SQLiteStorageDatabase.IN_MEMORY_PATH
        };
        connection.db.on("error", (error) => this.handleSQLiteError(connection, `[storage ${this.name}] Error (event): ${error}`));
        if (this.logger.isTracing) {
          connection.db.on("trace", (sql) => this.logger.trace(`[storage ${this.name}] Trace (event): ${sql}`));
        }
      }, reject);
    });
  }
  exec(connection, sql) {
    return new Promise((resolve, reject) => {
      connection.db.exec(sql, (error) => {
        if (error) {
          this.handleSQLiteError(connection, `[storage ${this.name}] exec(): ${error}`);
          return reject(error);
        }
        return resolve();
      });
    });
  }
  get(connection, sql) {
    return new Promise((resolve, reject) => {
      connection.db.get(sql, (error, row) => {
        if (error) {
          this.handleSQLiteError(connection, `[storage ${this.name}] get(): ${error}`);
          return reject(error);
        }
        return resolve(row);
      });
    });
  }
  all(connection, sql) {
    return new Promise((resolve, reject) => {
      connection.db.all(sql, (error, rows) => {
        if (error) {
          this.handleSQLiteError(connection, `[storage ${this.name}] all(): ${error}`);
          return reject(error);
        }
        return resolve(rows);
      });
    });
  }
  transaction(connection, transactions) {
    return new Promise((resolve, reject) => {
      connection.db.serialize(() => {
        connection.db.run("BEGIN TRANSACTION");
        transactions();
        connection.db.run("END TRANSACTION", (error) => {
          if (error) {
            this.handleSQLiteError(connection, `[storage ${this.name}] transaction(): ${error}`);
            return reject(error);
          }
          return resolve();
        });
      });
    });
  }
  prepare(connection, sql, runCallback, errorDetails) {
    const stmt = connection.db.prepare(sql);
    const statementErrorListener = (error) => {
      this.handleSQLiteError(connection, `[storage ${this.name}] prepare(): ${error} (${sql}). Details: ${errorDetails()}`);
    };
    stmt.on("error", statementErrorListener);
    runCallback(stmt);
    stmt.finalize((error) => {
      if (error) {
        statementErrorListener(error);
      }
      stmt.removeListener("error", statementErrorListener);
    });
  }
};
_SQLiteStorageDatabase.IN_MEMORY_PATH = ":memory:";
// since we are the only client, there can be no external changes
_SQLiteStorageDatabase.BUSY_OPEN_TIMEOUT = 2e3;
// timeout in ms to retry when opening DB fails with SQLITE_BUSY
_SQLiteStorageDatabase.MAX_HOST_PARAMETERS = 256;
let SQLiteStorageDatabase = _SQLiteStorageDatabase;
const _SQLiteStorageDatabaseLogger = class _SQLiteStorageDatabaseLogger {
  constructor(options) {
    if (options && typeof options.logTrace === "function" && process.env[_SQLiteStorageDatabaseLogger.VSCODE_TRACE_STORAGE]) {
      this.logTrace = options.logTrace;
    }
    if (options && typeof options.logError === "function") {
      this.logError = options.logError;
    }
  }
  get isTracing() {
    return !!this.logTrace;
  }
  trace(msg) {
    this.logTrace?.(msg);
  }
  error(error) {
    this.logError?.(error);
  }
};
// to reduce lots of output, require an environment variable to enable tracing
// this helps when running with --verbose normally where the storage tracing
// might hide useful output to look at
_SQLiteStorageDatabaseLogger.VSCODE_TRACE_STORAGE = "VSCODE_TRACE_STORAGE";
let SQLiteStorageDatabaseLogger = _SQLiteStorageDatabaseLogger;
export {
  SQLiteStorageDatabase
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3BhcnRzL3N0b3JhZ2Uvbm9kZS9zdG9yYWdlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBtYXBUb1N0cmluZywgc2V0VG9TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMgfSBmcm9tICcuLi8uLi8uLi9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZURhdGFiYXNlLCBJU3RvcmFnZUl0ZW1zQ2hhbmdlRXZlbnQsIElVcGRhdGVSZXF1ZXN0IH0gZnJvbSAnLi4vY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHR5cGUgeyBEYXRhYmFzZSwgU3RhdGVtZW50IH0gZnJvbSAnQHZzY29kZS9zcWxpdGUzJztcblxuaW50ZXJmYWNlIElEYXRhYmFzZUNvbm5lY3Rpb24ge1xuXHRyZWFkb25seSBkYjogRGF0YWJhc2U7XG5cdHJlYWRvbmx5IGlzSW5NZW1vcnk6IGJvb2xlYW47XG5cblx0aXNFcnJvbmVvdXM/OiBib29sZWFuO1xuXHRsYXN0RXJyb3I/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNRTGl0ZVN0b3JhZ2VEYXRhYmFzZU9wdGlvbnMge1xuXHRyZWFkb25seSBsb2dnaW5nPzogSVNRTGl0ZVN0b3JhZ2VEYXRhYmFzZUxvZ2dpbmdPcHRpb25zO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTUUxpdGVTdG9yYWdlRGF0YWJhc2VMb2dnaW5nT3B0aW9ucyB7XG5cdGxvZ0Vycm9yPzogKGVycm9yOiBzdHJpbmcgfCBFcnJvcikgPT4gdm9pZDtcblx0bG9nVHJhY2U/OiAobXNnOiBzdHJpbmcpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBTUUxpdGVTdG9yYWdlRGF0YWJhc2UgaW1wbGVtZW50cyBJU3RvcmFnZURhdGFiYXNlIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSU5fTUVNT1JZX1BBVEggPSAnOm1lbW9yeTonO1xuXG5cdGdldCBvbkRpZENoYW5nZUl0ZW1zRXh0ZXJuYWwoKTogRXZlbnQ8SVN0b3JhZ2VJdGVtc0NoYW5nZUV2ZW50PiB7IHJldHVybiBFdmVudC5Ob25lOyB9IC8vIHNpbmNlIHdlIGFyZSB0aGUgb25seSBjbGllbnQsIHRoZXJlIGNhbiBiZSBubyBleHRlcm5hbCBjaGFuZ2VzXG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQlVTWV9PUEVOX1RJTUVPVVQgPSAyMDAwOyAvLyB0aW1lb3V0IGluIG1zIHRvIHJldHJ5IHdoZW4gb3BlbmluZyBEQiBmYWlscyB3aXRoIFNRTElURV9CVVNZXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE1BWF9IT1NUX1BBUkFNRVRFUlMgPSAyNTY7IC8vIG1heGltdW0gbnVtYmVyIG9mIHBhcmFtZXRlcnMgd2l0aGluIGEgc3RhdGVtZW50XG5cblx0cHJpdmF0ZSByZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBsb2dnZXI6IFNRTGl0ZVN0b3JhZ2VEYXRhYmFzZUxvZ2dlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHdoZW5Db25uZWN0ZWQ6IFByb21pc2U8SURhdGFiYXNlQ29ubmVjdGlvbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwYXRoOiBzdHJpbmcsXG5cdFx0b3B0aW9uczogSVNRTGl0ZVN0b3JhZ2VEYXRhYmFzZU9wdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpXG5cdCkge1xuXHRcdHRoaXMubmFtZSA9IGJhc2VuYW1lKHRoaXMucGF0aCk7XG5cdFx0dGhpcy5sb2dnZXIgPSBuZXcgU1FMaXRlU3RvcmFnZURhdGFiYXNlTG9nZ2VyKG9wdGlvbnMubG9nZ2luZyk7XG5cdFx0dGhpcy53aGVuQ29ubmVjdGVkID0gdGhpcy5jb25uZWN0KHRoaXMucGF0aCk7XG5cdH1cblxuXHRhc3luYyBnZXRJdGVtcygpOiBQcm9taXNlPE1hcDxzdHJpbmcsIHN0cmluZz4+IHtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gYXdhaXQgdGhpcy53aGVuQ29ubmVjdGVkO1xuXG5cdFx0Y29uc3QgaXRlbXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG5cdFx0Y29uc3Qgcm93cyA9IGF3YWl0IHRoaXMuYWxsKGNvbm5lY3Rpb24sICdTRUxFQ1QgKiBGUk9NIEl0ZW1UYWJsZScpO1xuXHRcdHJvd3MuZm9yRWFjaChyb3cgPT4gaXRlbXMuc2V0KHJvdy5rZXksIHJvdy52YWx1ZSkpO1xuXG5cdFx0aWYgKHRoaXMubG9nZ2VyLmlzVHJhY2luZykge1xuXHRcdFx0dGhpcy5sb2dnZXIudHJhY2UoYFtzdG9yYWdlICR7dGhpcy5uYW1lfV0gZ2V0SXRlbXMoKTogJHtpdGVtcy5zaXplfSByb3dzYCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGl0ZW1zO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlSXRlbXMocmVxdWVzdDogSVVwZGF0ZVJlcXVlc3QpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gYXdhaXQgdGhpcy53aGVuQ29ubmVjdGVkO1xuXG5cdFx0cmV0dXJuIHRoaXMuZG9VcGRhdGVJdGVtcyhjb25uZWN0aW9uLCByZXF1ZXN0KTtcblx0fVxuXG5cdHByaXZhdGUgZG9VcGRhdGVJdGVtcyhjb25uZWN0aW9uOiBJRGF0YWJhc2VDb25uZWN0aW9uLCByZXF1ZXN0OiBJVXBkYXRlUmVxdWVzdCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmxvZ2dlci5pc1RyYWNpbmcpIHtcblx0XHRcdHRoaXMubG9nZ2VyLnRyYWNlKGBbc3RvcmFnZSAke3RoaXMubmFtZX1dIHVwZGF0ZUl0ZW1zKCk6IGluc2VydCgke3JlcXVlc3QuaW5zZXJ0ID8gbWFwVG9TdHJpbmcocmVxdWVzdC5pbnNlcnQpIDogJzAnfSksIGRlbGV0ZSgke3JlcXVlc3QuZGVsZXRlID8gc2V0VG9TdHJpbmcocmVxdWVzdC5kZWxldGUpIDogJzAnfSlgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy50cmFuc2FjdGlvbihjb25uZWN0aW9uLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0b0luc2VydCA9IHJlcXVlc3QuaW5zZXJ0O1xuXHRcdFx0Y29uc3QgdG9EZWxldGUgPSByZXF1ZXN0LmRlbGV0ZTtcblxuXHRcdFx0Ly8gSU5TRVJUXG5cdFx0XHRpZiAodG9JbnNlcnQgJiYgdG9JbnNlcnQuc2l6ZSA+IDApIHtcblx0XHRcdFx0Y29uc3Qga2V5c1ZhbHVlc0NodW5rczogKHN0cmluZ1tdKVtdID0gW107XG5cdFx0XHRcdGtleXNWYWx1ZXNDaHVua3MucHVzaChbXSk7IC8vIHNlZWQgd2l0aCBpbml0aWFsIGVtcHR5IGNodW5rXG5cblx0XHRcdFx0Ly8gU3BsaXQga2V5L3ZhbHVlcyBpbnRvIGNodW5rcyBvZiBTUUxpdGVTdG9yYWdlRGF0YWJhc2UuTUFYX0hPU1RfUEFSQU1FVEVSU1xuXHRcdFx0XHQvLyBzbyB0aGF0IHdlIGNhbiBlZmZpY2llbnRseSBydW4gdGhlIElOU0VSVCB3aXRoIGFzIG1hbnkgSE9TVCBwYXJhbWV0ZXJzIGFzIHBvc3NpYmxlXG5cdFx0XHRcdGxldCBjdXJyZW50Q2h1bmtJbmRleCA9IDA7XG5cdFx0XHRcdHRvSW5zZXJ0LmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcblx0XHRcdFx0XHRsZXQga2V5VmFsdWVDaHVuayA9IGtleXNWYWx1ZXNDaHVua3NbY3VycmVudENodW5rSW5kZXhdO1xuXG5cdFx0XHRcdFx0aWYgKGtleVZhbHVlQ2h1bmsubGVuZ3RoID4gU1FMaXRlU3RvcmFnZURhdGFiYXNlLk1BWF9IT1NUX1BBUkFNRVRFUlMpIHtcblx0XHRcdFx0XHRcdGN1cnJlbnRDaHVua0luZGV4Kys7XG5cdFx0XHRcdFx0XHRrZXlWYWx1ZUNodW5rID0gW107XG5cdFx0XHRcdFx0XHRrZXlzVmFsdWVzQ2h1bmtzLnB1c2goa2V5VmFsdWVDaHVuayk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0a2V5VmFsdWVDaHVuay5wdXNoKGtleSwgdmFsdWUpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRrZXlzVmFsdWVzQ2h1bmtzLmZvckVhY2goa2V5c1ZhbHVlc0NodW5rID0+IHtcblx0XHRcdFx0XHR0aGlzLnByZXBhcmUoY29ubmVjdGlvbiwgYElOU0VSVCBJTlRPIEl0ZW1UYWJsZSBWQUxVRVMgJHtuZXcgQXJyYXkoa2V5c1ZhbHVlc0NodW5rLmxlbmd0aCAvIDIpLmZpbGwoJyg/LD8pJykuam9pbignLCcpfWAsIHN0bXQgPT4gc3RtdC5ydW4oa2V5c1ZhbHVlc0NodW5rKSwgKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3Qga2V5czogc3RyaW5nW10gPSBbXTtcblx0XHRcdFx0XHRcdGxldCBsZW5ndGggPSAwO1xuXHRcdFx0XHRcdFx0dG9JbnNlcnQuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRrZXlzLnB1c2goa2V5KTtcblx0XHRcdFx0XHRcdFx0bGVuZ3RoICs9IHZhbHVlLmxlbmd0aDtcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRyZXR1cm4gYEtleXM6ICR7a2V5cy5qb2luKCcsICcpfSBMZW5ndGg6ICR7bGVuZ3RofWA7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBERUxFVEVcblx0XHRcdGlmICh0b0RlbGV0ZSAmJiB0b0RlbGV0ZS5zaXplKSB7XG5cdFx0XHRcdGNvbnN0IGtleXNDaHVua3M6IChzdHJpbmdbXSlbXSA9IFtdO1xuXHRcdFx0XHRrZXlzQ2h1bmtzLnB1c2goW10pOyAvLyBzZWVkIHdpdGggaW5pdGlhbCBlbXB0eSBjaHVua1xuXG5cdFx0XHRcdC8vIFNwbGl0IGtleXMgaW50byBjaHVua3Mgb2YgU1FMaXRlU3RvcmFnZURhdGFiYXNlLk1BWF9IT1NUX1BBUkFNRVRFUlNcblx0XHRcdFx0Ly8gc28gdGhhdCB3ZSBjYW4gZWZmaWNpZW50bHkgcnVuIHRoZSBERUxFVEUgd2l0aCBhcyBtYW55IEhPU1QgcGFyYW1ldGVyc1xuXHRcdFx0XHQvLyBhcyBwb3NzaWJsZVxuXHRcdFx0XHRsZXQgY3VycmVudENodW5rSW5kZXggPSAwO1xuXHRcdFx0XHR0b0RlbGV0ZS5mb3JFYWNoKGtleSA9PiB7XG5cdFx0XHRcdFx0bGV0IGtleUNodW5rID0ga2V5c0NodW5rc1tjdXJyZW50Q2h1bmtJbmRleF07XG5cblx0XHRcdFx0XHRpZiAoa2V5Q2h1bmsubGVuZ3RoID4gU1FMaXRlU3RvcmFnZURhdGFiYXNlLk1BWF9IT1NUX1BBUkFNRVRFUlMpIHtcblx0XHRcdFx0XHRcdGN1cnJlbnRDaHVua0luZGV4Kys7XG5cdFx0XHRcdFx0XHRrZXlDaHVuayA9IFtdO1xuXHRcdFx0XHRcdFx0a2V5c0NodW5rcy5wdXNoKGtleUNodW5rKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRrZXlDaHVuay5wdXNoKGtleSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGtleXNDaHVua3MuZm9yRWFjaChrZXlzQ2h1bmsgPT4ge1xuXHRcdFx0XHRcdHRoaXMucHJlcGFyZShjb25uZWN0aW9uLCBgREVMRVRFIEZST00gSXRlbVRhYmxlIFdIRVJFIGtleSBJTiAoJHtuZXcgQXJyYXkoa2V5c0NodW5rLmxlbmd0aCkuZmlsbCgnPycpLmpvaW4oJywnKX0pYCwgc3RtdCA9PiBzdG10LnJ1bihrZXlzQ2h1bmspLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBrZXlzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0XHRcdFx0dG9EZWxldGUuZm9yRWFjaChrZXkgPT4ge1xuXHRcdFx0XHRcdFx0XHRrZXlzLnB1c2goa2V5KTtcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRyZXR1cm4gYEtleXM6ICR7a2V5cy5qb2luKCcsICcpfWA7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgb3B0aW1pemUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5sb2dnZXIudHJhY2UoYFtzdG9yYWdlICR7dGhpcy5uYW1lfV0gdmFjdXVtKClgKTtcblxuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBhd2FpdCB0aGlzLndoZW5Db25uZWN0ZWQ7XG5cblx0XHRyZXR1cm4gdGhpcy5leGVjKGNvbm5lY3Rpb24sICdWQUNVVU0nKTtcblx0fVxuXG5cdGFzeW5jIGNsb3NlKHJlY292ZXJ5PzogKCkgPT4gTWFwPHN0cmluZywgc3RyaW5nPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nZ2VyLnRyYWNlKGBbc3RvcmFnZSAke3RoaXMubmFtZX1dIGNsb3NlKClgKTtcblxuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBhd2FpdCB0aGlzLndoZW5Db25uZWN0ZWQ7XG5cblx0XHRyZXR1cm4gdGhpcy5kb0Nsb3NlKGNvbm5lY3Rpb24sIHJlY292ZXJ5KTtcblx0fVxuXG5cdHByaXZhdGUgZG9DbG9zZShjb25uZWN0aW9uOiBJRGF0YWJhc2VDb25uZWN0aW9uLCByZWNvdmVyeT86ICgpID0+IE1hcDxzdHJpbmcsIHN0cmluZz4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Y29ubmVjdGlvbi5kYi5jbG9zZShjbG9zZUVycm9yID0+IHtcblx0XHRcdFx0aWYgKGNsb3NlRXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLmhhbmRsZVNRTGl0ZUVycm9yKGNvbm5lY3Rpb24sIGBbc3RvcmFnZSAke3RoaXMubmFtZX1dIGNsb3NlKCk6ICR7Y2xvc2VFcnJvcn1gKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJldHVybiBlYXJseSBpZiB0aGlzIHN0b3JhZ2Ugd2FzIGNyZWF0ZWQgb25seSBpbi1tZW1vcnlcblx0XHRcdFx0Ly8gZS5nLiB3aGVuIHJ1bm5pbmcgdGVzdHMgd2UgZG8gbm90IG5lZWQgdG8gYmFja3VwLlxuXHRcdFx0XHRpZiAodGhpcy5wYXRoID09PSBTUUxpdGVTdG9yYWdlRGF0YWJhc2UuSU5fTUVNT1JZX1BBVEgpIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVzb2x2ZSgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSWYgdGhlIERCIGNsb3NlZCBzdWNjZXNzZnVsbHkgYW5kIHdlIGFyZSBub3QgcnVubmluZyBpbi1tZW1vcnlcblx0XHRcdFx0Ly8gYW5kIHRoZSBEQiBkaWQgbm90IGdldCBlcnJvcnMgZHVyaW5nIHJ1bnRpbWUsIG1ha2UgYSBiYWNrdXBcblx0XHRcdFx0Ly8gb2YgdGhlIERCIHNvIHRoYXQgd2UgY2FuIHVzZSBpdCBhcyBmYWxsYmFjayBpbiBjYXNlIHRoZSBhY3R1YWxcblx0XHRcdFx0Ly8gREIgYmVjb21lcyBjb3JydXB0IGluIHRoZSBmdXR1cmUuXG5cdFx0XHRcdGlmICghY29ubmVjdGlvbi5pc0Vycm9uZW91cyAmJiAhY29ubmVjdGlvbi5pc0luTWVtb3J5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuYmFja3VwKCkudGhlbihyZXNvbHZlLCBlcnJvciA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ2dlci5lcnJvcihgW3N0b3JhZ2UgJHt0aGlzLm5hbWV9XSBiYWNrdXAoKTogJHtlcnJvcn1gKTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuIHJlc29sdmUoKTsgLy8gaWdub3JlIGZhaWxpbmcgYmFja3VwXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZWNvdmVyeTogaWYgd2UgZGV0ZWN0ZWQgZXJyb3JzIHdoaWxlIHVzaW5nIHRoZSBEQiBvciB3ZSBhcmUgdXNpbmdcblx0XHRcdFx0Ly8gYW4gaW5tZW1vcnkgREIgKGFzIGEgZmFsbGJhY2sgdG8gbm90IGJlaW5nIGFibGUgdG8gb3BlbiB0aGUgREIgaW5pdGlhbGx5KVxuXHRcdFx0XHQvLyBhbmQgd2UgaGF2ZSBhIHJlY292ZXJ5IGZ1bmN0aW9uIHByb3ZpZGVkLCB3ZSByZWNyZWF0ZSB0aGUgREIgd2l0aCB0aGlzXG5cdFx0XHRcdC8vIGRhdGEgdG8gcmVjb3ZlciBhbGwga25vd24gZGF0YSB3aXRob3V0IGxvc3MgaWYgcG9zc2libGUuXG5cdFx0XHRcdGlmICh0eXBlb2YgcmVjb3ZlcnkgPT09ICdmdW5jdGlvbicpIHtcblxuXHRcdFx0XHRcdC8vIERlbGV0ZSB0aGUgZXhpc3RpbmcgREIuIElmIHRoZSBwYXRoIGRvZXMgbm90IGV4aXN0IG9yIGZhaWxzIHRvXG5cdFx0XHRcdFx0Ly8gYmUgZGVsZXRlZCwgd2UgZG8gbm90IHRyeSB0byByZWNvdmVyIGFueW1vcmUgYmVjYXVzZSB3ZSBhc3N1bWVcblx0XHRcdFx0XHQvLyB0aGF0IHRoZSBwYXRoIGlzIG5vIGxvbmdlciB3cml0ZWFibGUgZm9yIHVzLlxuXHRcdFx0XHRcdHJldHVybiBmcy5wcm9taXNlcy51bmxpbmsodGhpcy5wYXRoKS50aGVuKCgpID0+IHtcblxuXHRcdFx0XHRcdFx0Ly8gUmUtb3BlbiB0aGUgREIgZnJlc2hcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLmRvQ29ubmVjdCh0aGlzLnBhdGgpLnRoZW4ocmVjb3ZlcnlDb25uZWN0aW9uID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY2xvc2VSZWNvdmVyeUNvbm5lY3Rpb24gPSAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuZG9DbG9zZShyZWNvdmVyeUNvbm5lY3Rpb24sIHVuZGVmaW5lZCAvKiBkbyBub3QgYXR0ZW1wdCB0byByZWNvdmVyIGFnYWluICovKTtcblx0XHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0XHQvLyBTdG9yZSBpdGVtc1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5kb1VwZGF0ZUl0ZW1zKHJlY292ZXJ5Q29ubmVjdGlvbiwgeyBpbnNlcnQ6IHJlY292ZXJ5KCkgfSkudGhlbigoKSA9PiBjbG9zZVJlY292ZXJ5Q29ubmVjdGlvbigpLCBlcnJvciA9PiB7XG5cblx0XHRcdFx0XHRcdFx0XHQvLyBJbiBjYXNlIG9mIGFuIGVycm9yIHVwZGF0aW5nIGl0ZW1zLCBzdGlsbCBlbnN1cmUgdG8gY2xvc2UgdGhlIGNvbm5lY3Rpb25cblx0XHRcdFx0XHRcdFx0XHQvLyB0byBwcmV2ZW50IFNRTElURV9CVVNZIGVycm9ycyB3aGVuIHRoZSBjb25uZWN0aW9uIGlzIHJlZXN0YWJsaXNoZWRcblx0XHRcdFx0XHRcdFx0XHRjbG9zZVJlY292ZXJ5Q29ubmVjdGlvbigpO1xuXG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBGaW5hbGx5IHdpdGhvdXQgcmVjb3Zlcnkgd2UganVzdCByZWplY3Rcblx0XHRcdFx0cmV0dXJuIHJlamVjdChjbG9zZUVycm9yIHx8IG5ldyBFcnJvcignRGF0YWJhc2UgaGFzIGVycm9ycyBvciBpcyBpbi1tZW1vcnkgd2l0aG91dCByZWNvdmVyeSBvcHRpb24nKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYmFja3VwKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGJhY2t1cFBhdGggPSB0aGlzLnRvQmFja3VwUGF0aCh0aGlzLnBhdGgpO1xuXG5cdFx0cmV0dXJuIFByb21pc2VzLmNvcHkodGhpcy5wYXRoLCBiYWNrdXBQYXRoLCB7IHByZXNlcnZlU3ltbGlua3M6IGZhbHNlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB0b0JhY2t1cFBhdGgocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7cGF0aH0uYmFja3VwYDtcblx0fVxuXG5cdGFzeW5jIGNoZWNrSW50ZWdyaXR5KGZ1bGw6IGJvb2xlYW4pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHRoaXMubG9nZ2VyLnRyYWNlKGBbc3RvcmFnZSAke3RoaXMubmFtZX1dIGNoZWNrSW50ZWdyaXR5KGZ1bGw6ICR7ZnVsbH0pYCk7XG5cblx0XHRjb25zdCBjb25uZWN0aW9uID0gYXdhaXQgdGhpcy53aGVuQ29ubmVjdGVkO1xuXHRcdGNvbnN0IHJvdyA9IGF3YWl0IHRoaXMuZ2V0KGNvbm5lY3Rpb24sIGZ1bGwgPyAnUFJBR01BIGludGVncml0eV9jaGVjaycgOiAnUFJBR01BIHF1aWNrX2NoZWNrJyk7XG5cblx0XHRjb25zdCBpbnRlZ3JpdHkgPSBmdWxsID8gKHJvdyBhcyBhbnkpWydpbnRlZ3JpdHlfY2hlY2snXSA6IChyb3cgYXMgYW55KVsncXVpY2tfY2hlY2snXTtcblxuXHRcdGlmIChjb25uZWN0aW9uLmlzRXJyb25lb3VzKSB7XG5cdFx0XHRyZXR1cm4gYCR7aW50ZWdyaXR5fSAobGFzdCBlcnJvcjogJHtjb25uZWN0aW9uLmxhc3RFcnJvcn0pYDtcblx0XHR9XG5cblx0XHRpZiAoY29ubmVjdGlvbi5pc0luTWVtb3J5KSB7XG5cdFx0XHRyZXR1cm4gYCR7aW50ZWdyaXR5fSAoaW4tbWVtb3J5ISlgO1xuXHRcdH1cblxuXHRcdHJldHVybiBpbnRlZ3JpdHk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbm5lY3QocGF0aDogc3RyaW5nLCByZXRyeU9uQnVzeTogYm9vbGVhbiA9IHRydWUpOiBQcm9taXNlPElEYXRhYmFzZUNvbm5lY3Rpb24+IHtcblx0XHR0aGlzLmxvZ2dlci50cmFjZShgW3N0b3JhZ2UgJHt0aGlzLm5hbWV9XSBvcGVuKCR7cGF0aH0sIHJldHJ5T25CdXN5OiAke3JldHJ5T25CdXN5fSlgKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5kb0Nvbm5lY3QocGF0aCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMubG9nZ2VyLmVycm9yKGBbc3RvcmFnZSAke3RoaXMubmFtZX1dIG9wZW4oKTogVW5hYmxlIHRvIG9wZW4gREIgZHVlIHRvICR7ZXJyb3J9YCk7XG5cblx0XHRcdC8vIFNRTElURV9CVVNZIHNob3VsZCBvbmx5IGFyaXNlIGlmIGFub3RoZXIgcHJvY2VzcyBpcyBsb2NraW5nIHRoZSBzYW1lIERCIHdlIHdhbnRcblx0XHRcdC8vIHRvIG9wZW4gYXQgdGhhdCB0aW1lLiBUaGlzIHR5cGljYWxseSBuZXZlciBoYXBwZW5zIGJlY2F1c2UgYSBEQiBjb25uZWN0aW9uIGlzXG5cdFx0XHQvLyBsaW1pdGVkIHBlciB3aW5kb3cuIEhvd2V2ZXIsIGluIHRoZSBldmVudCBvZiBhIHdpbmRvdyByZWxvYWQsIGl0IG1heSBiZSBwb3NzaWJsZVxuXHRcdFx0Ly8gdGhhdCB0aGUgcHJldmlvdXMgY29ubmVjdGlvbiB3YXMgbm90IHByb3Blcmx5IGNsb3NlZCB3aGlsZSB0aGUgbmV3IGNvbm5lY3Rpb24gaXNcblx0XHRcdC8vIGFscmVhZHkgZXN0YWJsaXNoZWQuXG5cdFx0XHQvL1xuXHRcdFx0Ly8gSW4gdGhpcyBjYXNlIHdlIHNpbXBseSB3YWl0IGZvciBzb21lIHRpbWUgYW5kIHJldHJ5IG9uY2UgdG8gZXN0YWJsaXNoIHRoZSBjb25uZWN0aW9uLlxuXHRcdFx0Ly9cblx0XHRcdGlmIChlcnJvci5jb2RlID09PSAnU1FMSVRFX0JVU1knICYmIHJldHJ5T25CdXN5KSB7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoU1FMaXRlU3RvcmFnZURhdGFiYXNlLkJVU1lfT1BFTl9USU1FT1VUKTtcblxuXHRcdFx0XHRyZXR1cm4gdGhpcy5jb25uZWN0KHBhdGgsIGZhbHNlIC8qIG5vdCBhbm90aGVyIHJldHJ5ICovKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gT3RoZXJ3aXNlLCBiZXN0IHdlIGNhbiBkbyBpcyB0byByZWNvdmVyIGZyb20gYSBiYWNrdXAgaWYgdGhhdCBleGlzdHMsIGFzIHN1Y2ggd2Vcblx0XHRcdC8vIG1vdmUgdGhlIERCIHRvIGEgZGlmZmVyZW50IGZpbGVuYW1lIGFuZCB0cnkgdG8gbG9hZCBmcm9tIGJhY2t1cC4gSWYgdGhhdCBmYWlscyxcblx0XHRcdC8vIGEgbmV3IGVtcHR5IERCIGlzIGJlaW5nIGNyZWF0ZWQgYXV0b21hdGljYWxseS5cblx0XHRcdC8vXG5cdFx0XHQvLyBUaGUgZmluYWwgZmFsbGJhY2sgaXMgdG8gdXNlIGFuIGluLW1lbW9yeSBEQiB3aGljaCBzaG91bGQgb25seSBoYXBwZW4gaWYgdGhlIHRhcmdldFxuXHRcdFx0Ly8gZm9sZGVyIGlzIHJlYWxseSBub3Qgd3JpdGVhYmxlIGZvciB1cy5cblx0XHRcdC8vXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBmcy5wcm9taXNlcy51bmxpbmsocGF0aCk7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgUHJvbWlzZXMucmVuYW1lKHRoaXMudG9CYWNrdXBQYXRoKHBhdGgpLCBwYXRoLCBmYWxzZSAvKiBubyByZXRyeSAqLyk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0Ly8gaWdub3JlXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5kb0Nvbm5lY3QocGF0aCk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5lcnJvcihgW3N0b3JhZ2UgJHt0aGlzLm5hbWV9XSBvcGVuKCk6IFVuYWJsZSB0byB1c2UgYmFja3VwIGR1ZSB0byAke2Vycm9yfWApO1xuXG5cdFx0XHRcdC8vIEluIGNhc2Ugb2YgYW55IGVycm9yIHRvIG9wZW4gdGhlIERCLCB1c2UgYW4gaW4tbWVtb3J5XG5cdFx0XHRcdC8vIERCIHNvIHRoYXQgd2UgYWx3YXlzIGhhdmUgYSB2YWxpZCBEQiB0byB0YWxrIHRvLlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5kb0Nvbm5lY3QoU1FMaXRlU3RvcmFnZURhdGFiYXNlLklOX01FTU9SWV9QQVRIKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZVNRTGl0ZUVycm9yKGNvbm5lY3Rpb246IElEYXRhYmFzZUNvbm5lY3Rpb24sIG1zZzogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29ubmVjdGlvbi5pc0Vycm9uZW91cyA9IHRydWU7XG5cdFx0Y29ubmVjdGlvbi5sYXN0RXJyb3IgPSBtc2c7XG5cblx0XHR0aGlzLmxvZ2dlci5lcnJvcihtc2cpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0Nvbm5lY3QocGF0aDogc3RyaW5nKTogUHJvbWlzZTxJRGF0YWJhc2VDb25uZWN0aW9uPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdGltcG9ydCgnQHZzY29kZS9zcWxpdGUzJykudGhlbihzcWxpdGUzID0+IHtcblx0XHRcdFx0Y29uc3QgY3RvciA9ICh0aGlzLmxvZ2dlci5pc1RyYWNpbmcgPyBzcWxpdGUzLmRlZmF1bHQudmVyYm9zZSgpLkRhdGFiYXNlIDogc3FsaXRlMy5kZWZhdWx0LkRhdGFiYXNlKTtcblx0XHRcdFx0Y29uc3QgY29ubmVjdGlvbjogSURhdGFiYXNlQ29ubmVjdGlvbiA9IHtcblx0XHRcdFx0XHRkYjogbmV3IGN0b3IocGF0aCwgKGVycm9yOiAoRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfSkgfCBudWxsKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIChjb25uZWN0aW9uLmRiICYmIGVycm9yLmNvZGUgIT09ICdTUUxJVEVfQ0FOVE9QRU4nIC8qIGh0dHBzOi8vZ2l0aHViLmNvbS9UcnlHaG9zdC9ub2RlLXNxbGl0ZTMvaXNzdWVzLzE2MTcgKi8pID8gY29ubmVjdGlvbi5kYi5jbG9zZSgoKSA9PiByZWplY3QoZXJyb3IpKSA6IHJlamVjdChlcnJvcik7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIFRoZSBmb2xsb3dpbmcgZXhlYygpIHN0YXRlbWVudCBzZXJ2ZXMgdHdvIHB1cnBvc2VzOlxuXHRcdFx0XHRcdFx0Ly8gLSBjcmVhdGUgdGhlIERCIGlmIGl0IGRvZXMgbm90IGV4aXN0IHlldFxuXHRcdFx0XHRcdFx0Ly8gLSB2YWxpZGF0ZSB0aGF0IHRoZSBEQiBpcyBub3QgY29ycnVwdCAodGhlIG9wZW4oKSBjYWxsIGRvZXMgbm90IHRocm93IG90aGVyd2lzZSlcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLmV4ZWMoY29ubmVjdGlvbiwgW1xuXHRcdFx0XHRcdFx0XHQnUFJBR01BIHVzZXJfdmVyc2lvbiA9IDE7Jyxcblx0XHRcdFx0XHRcdFx0J0NSRUFURSBUQUJMRSBJRiBOT1QgRVhJU1RTIEl0ZW1UYWJsZSAoa2V5IFRFWFQgVU5JUVVFIE9OIENPTkZMSUNUIFJFUExBQ0UsIHZhbHVlIEJMT0IpJ1xuXHRcdFx0XHRcdFx0XS5qb2luKCcnKSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiByZXNvbHZlKGNvbm5lY3Rpb24pO1xuXHRcdFx0XHRcdFx0fSwgZXJyb3IgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gY29ubmVjdGlvbi5kYi5jbG9zZSgoKSA9PiByZWplY3QoZXJyb3IpKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdGlzSW5NZW1vcnk6IHBhdGggPT09IFNRTGl0ZVN0b3JhZ2VEYXRhYmFzZS5JTl9NRU1PUllfUEFUSFxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdC8vIEVycm9yc1xuXHRcdFx0XHRjb25uZWN0aW9uLmRiLm9uKCdlcnJvcicsIGVycm9yID0+IHRoaXMuaGFuZGxlU1FMaXRlRXJyb3IoY29ubmVjdGlvbiwgYFtzdG9yYWdlICR7dGhpcy5uYW1lfV0gRXJyb3IgKGV2ZW50KTogJHtlcnJvcn1gKSk7XG5cblx0XHRcdFx0Ly8gVHJhY2luZ1xuXHRcdFx0XHRpZiAodGhpcy5sb2dnZXIuaXNUcmFjaW5nKSB7XG5cdFx0XHRcdFx0Y29ubmVjdGlvbi5kYi5vbigndHJhY2UnLCBzcWwgPT4gdGhpcy5sb2dnZXIudHJhY2UoYFtzdG9yYWdlICR7dGhpcy5uYW1lfV0gVHJhY2UgKGV2ZW50KTogJHtzcWx9YCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCByZWplY3QpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBleGVjKGNvbm5lY3Rpb246IElEYXRhYmFzZUNvbm5lY3Rpb24sIHNxbDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdGNvbm5lY3Rpb24uZGIuZXhlYyhzcWwsIGVycm9yID0+IHtcblx0XHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5oYW5kbGVTUUxpdGVFcnJvcihjb25uZWN0aW9uLCBgW3N0b3JhZ2UgJHt0aGlzLm5hbWV9XSBleGVjKCk6ICR7ZXJyb3J9YCk7XG5cblx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0KGVycm9yKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiByZXNvbHZlKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0KGNvbm5lY3Rpb246IElEYXRhYmFzZUNvbm5lY3Rpb24sIHNxbDogc3RyaW5nKTogUHJvbWlzZTxvYmplY3Q+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Y29ubmVjdGlvbi5kYi5nZXQoc3FsLCAoZXJyb3IsIHJvdykgPT4ge1xuXHRcdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLmhhbmRsZVNRTGl0ZUVycm9yKGNvbm5lY3Rpb24sIGBbc3RvcmFnZSAke3RoaXMubmFtZX1dIGdldCgpOiAke2Vycm9yfWApO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdChlcnJvcik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZShyb3cpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFsbChjb25uZWN0aW9uOiBJRGF0YWJhc2VDb25uZWN0aW9uLCBzcWw6IHN0cmluZyk6IFByb21pc2U8eyBrZXk6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9W10+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Y29ubmVjdGlvbi5kYi5hbGwoc3FsLCAoZXJyb3IsIHJvd3MpID0+IHtcblx0XHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5oYW5kbGVTUUxpdGVFcnJvcihjb25uZWN0aW9uLCBgW3N0b3JhZ2UgJHt0aGlzLm5hbWV9XSBhbGwoKTogJHtlcnJvcn1gKTtcblxuXHRcdFx0XHRcdHJldHVybiByZWplY3QoZXJyb3IpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHJlc29sdmUocm93cyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgdHJhbnNhY3Rpb24oY29ubmVjdGlvbjogSURhdGFiYXNlQ29ubmVjdGlvbiwgdHJhbnNhY3Rpb25zOiAoKSA9PiB2b2lkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdGNvbm5lY3Rpb24uZGIuc2VyaWFsaXplKCgpID0+IHtcblx0XHRcdFx0Y29ubmVjdGlvbi5kYi5ydW4oJ0JFR0lOIFRSQU5TQUNUSU9OJyk7XG5cblx0XHRcdFx0dHJhbnNhY3Rpb25zKCk7XG5cblx0XHRcdFx0Y29ubmVjdGlvbi5kYi5ydW4oJ0VORCBUUkFOU0FDVElPTicsIGVycm9yID0+IHtcblx0XHRcdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdHRoaXMuaGFuZGxlU1FMaXRlRXJyb3IoY29ubmVjdGlvbiwgYFtzdG9yYWdlICR7dGhpcy5uYW1lfV0gdHJhbnNhY3Rpb24oKTogJHtlcnJvcn1gKTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuIHJlamVjdChlcnJvcik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHJlc29sdmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcHJlcGFyZShjb25uZWN0aW9uOiBJRGF0YWJhc2VDb25uZWN0aW9uLCBzcWw6IHN0cmluZywgcnVuQ2FsbGJhY2s6IChzdG10OiBTdGF0ZW1lbnQpID0+IHZvaWQsIGVycm9yRGV0YWlsczogKCkgPT4gc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RtdCA9IGNvbm5lY3Rpb24uZGIucHJlcGFyZShzcWwpO1xuXG5cdFx0Y29uc3Qgc3RhdGVtZW50RXJyb3JMaXN0ZW5lciA9IChlcnJvcjogRXJyb3IpID0+IHtcblx0XHRcdHRoaXMuaGFuZGxlU1FMaXRlRXJyb3IoY29ubmVjdGlvbiwgYFtzdG9yYWdlICR7dGhpcy5uYW1lfV0gcHJlcGFyZSgpOiAke2Vycm9yfSAoJHtzcWx9KS4gRGV0YWlsczogJHtlcnJvckRldGFpbHMoKX1gKTtcblx0XHR9O1xuXG5cdFx0c3RtdC5vbignZXJyb3InLCBzdGF0ZW1lbnRFcnJvckxpc3RlbmVyKTtcblxuXHRcdHJ1bkNhbGxiYWNrKHN0bXQpO1xuXG5cdFx0c3RtdC5maW5hbGl6ZShlcnJvciA9PiB7XG5cdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0c3RhdGVtZW50RXJyb3JMaXN0ZW5lcihlcnJvcik7XG5cdFx0XHR9XG5cblx0XHRcdHN0bXQucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgc3RhdGVtZW50RXJyb3JMaXN0ZW5lcik7XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgU1FMaXRlU3RvcmFnZURhdGFiYXNlTG9nZ2VyIHtcblxuXHQvLyB0byByZWR1Y2UgbG90cyBvZiBvdXRwdXQsIHJlcXVpcmUgYW4gZW52aXJvbm1lbnQgdmFyaWFibGUgdG8gZW5hYmxlIHRyYWNpbmdcblx0Ly8gdGhpcyBoZWxwcyB3aGVuIHJ1bm5pbmcgd2l0aCAtLXZlcmJvc2Ugbm9ybWFsbHkgd2hlcmUgdGhlIHN0b3JhZ2UgdHJhY2luZ1xuXHQvLyBtaWdodCBoaWRlIHVzZWZ1bCBvdXRwdXQgdG8gbG9vayBhdFxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBWU0NPREVfVFJBQ0VfU1RPUkFHRSA9ICdWU0NPREVfVFJBQ0VfU1RPUkFHRSc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBsb2dUcmFjZTogKChtc2c6IHN0cmluZykgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgbG9nRXJyb3I6ICgoZXJyb3I6IHN0cmluZyB8IEVycm9yKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3RvcihvcHRpb25zPzogSVNRTGl0ZVN0b3JhZ2VEYXRhYmFzZUxvZ2dpbmdPcHRpb25zKSB7XG5cdFx0aWYgKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMubG9nVHJhY2UgPT09ICdmdW5jdGlvbicgJiYgcHJvY2Vzcy5lbnZbU1FMaXRlU3RvcmFnZURhdGFiYXNlTG9nZ2VyLlZTQ09ERV9UUkFDRV9TVE9SQUdFXSkge1xuXHRcdFx0dGhpcy5sb2dUcmFjZSA9IG9wdGlvbnMubG9nVHJhY2U7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMubG9nRXJyb3IgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHRoaXMubG9nRXJyb3IgPSBvcHRpb25zLmxvZ0Vycm9yO1xuXHRcdH1cblx0fVxuXG5cdGdldCBpc1RyYWNpbmcoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5sb2dUcmFjZTtcblx0fVxuXG5cdHRyYWNlKG1zZzogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dUcmFjZT8uKG1zZyk7XG5cdH1cblxuXHRlcnJvcihlcnJvcjogc3RyaW5nIHwgRXJyb3IpOiB2b2lkIHtcblx0XHR0aGlzLmxvZ0Vycm9yPy4oZXJyb3IpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFFBQVE7QUFDcEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGFBQWEsbUJBQW1CO0FBQ3pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCO0FBcUJsQixNQUFNLHlCQUFOLE1BQU0sdUJBQWtEO0FBQUEsRUFlOUQsWUFDa0IsTUFDakIsVUFBeUMsdUJBQU8sT0FBTyxJQUFJLEdBQzFEO0FBRmdCO0FBR2pCLFNBQUssT0FBTyxTQUFTLEtBQUssSUFBSTtBQUM5QixTQUFLLFNBQVMsSUFBSSw0QkFBNEIsUUFBUSxPQUFPO0FBQzdELFNBQUssZ0JBQWdCLEtBQUssUUFBUSxLQUFLLElBQUk7QUFBQSxFQUM1QztBQUFBLEVBbEJBLElBQUksMkJBQTREO0FBQUUsV0FBTyxNQUFNO0FBQUEsRUFBTTtBQUFBLEVBb0JyRixNQUFNLFdBQXlDO0FBQzlDLFVBQU0sYUFBYSxNQUFNLEtBQUs7QUFFOUIsVUFBTSxRQUFRLG9CQUFJLElBQW9CO0FBRXRDLFVBQU0sT0FBTyxNQUFNLEtBQUssSUFBSSxZQUFZLHlCQUF5QjtBQUNqRSxTQUFLLFFBQVEsU0FBTyxNQUFNLElBQUksSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDO0FBRWpELFFBQUksS0FBSyxPQUFPLFdBQVc7QUFDMUIsV0FBSyxPQUFPLE1BQU0sWUFBWSxL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
