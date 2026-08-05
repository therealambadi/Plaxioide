var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { localize } from "../../../../nls.js";
import Severity from "../../../../base/common/severity.js";
import { URI } from "../../../../base/common/uri.js";
import { IIntegrityService } from "../common/integrity.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { INotificationService, NotificationPriority } from "../../../../platform/notification/common/notification.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { FileAccess } from "../../../../base/common/network.js";
import { IChecksumService } from "../../../../platform/checksum/common/checksumService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
const _IntegrityStorage = class _IntegrityStorage {
  constructor(storageService) {
    this.storageService = storageService;
    this.value = this._read();
  }
  _read() {
    const jsonValue = this.storageService.get(_IntegrityStorage.KEY, StorageScope.APPLICATION);
    if (!jsonValue) {
      return null;
    }
    try {
      return JSON.parse(jsonValue);
    } catch (err) {
      return null;
    }
  }
  get() {
    return this.value;
  }
  set(data) {
    this.value = data;
    this.storageService.store(_IntegrityStorage.KEY, JSON.stringify(this.value), StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
};
_IntegrityStorage.KEY = "integrityService";
let IntegrityStorage = _IntegrityStorage;
let IntegrityService = class {
  constructor(notificationService, storageService, lifecycleService, openerService, productService, checksumService, logService) {
    this.notificationService = notificationService;
    this.lifecycleService = lifecycleService;
    this.openerService = openerService;
    this.productService = productService;
    this.checksumService = checksumService;
    this.logService = logService;
    this.storage = new IntegrityStorage(storageService);
    this.isPurePromise = this._isPure();
    this._compute();
  }
  isPure() {
    return this.isPurePromise;
  }
  async _compute() {
    const { isPure } = await this.isPure();
    if (isPure) {
      return;
    }
    this.logService.warn(`

----------------------------------------------
***	Installation has been modified on disk ***
----------------------------------------------

`);
    const storedData = this.storage.get();
    if (storedData?.dontShowPrompt && storedData.commit === this.productService.commit) {
      return;
    }
    this._showNotification();
  }
  async _isPure() {
    const expectedChecksums = this.productService.checksums || {};
    await this.lifecycleService.when(LifecyclePhase.Eventually);
    const allResults = await Promise.all(Object.keys(expectedChecksums).map((filename) => this._resolve(filename, expectedChecksums[filename])));
    let isPure = true;
    for (let i = 0, len = allResults.length; i < len; i++) {
      if (!allResults[i].isPure) {
        isPure = false;
        break;
      }
    }
    return {
      isPure,
      proof: allResults
    };
  }
  async _resolve(filename, expected) {
    const fileUri = FileAccess.asFileUri(filename);
    try {
      const checksum = await this.checksumService.checksum(fileUri);
      return IntegrityService._createChecksumPair(fileUri, checksum, expected);
    } catch (error) {
      return IntegrityService._createChecksumPair(fileUri, "", expected);
    }
  }
  static _createChecksumPair(uri, actual, expected) {
    return {
      uri,
      actual,
      expected,
      isPure: actual === expected
    };
  }
  _showNotification() {
    const checksumFailMoreInfoUrl = this.productService.checksumFailMoreInfoUrl;
    const message = localize("integrity.prompt", "Your {0} installation appears to be corrupt. Please reinstall.", this.productService.nameShort);
    if (checksumFailMoreInfoUrl) {
      this.notificationService.prompt(
        Severity.Warning,
        message,
        [
          {
            label: localize("integrity.moreInformation", "More Information"),
            run: () => this.openerService.open(URI.parse(checksumFailMoreInfoUrl))
          },
          {
            label: localize("integrity.dontShowAgain", "Don't Show Again"),
            isSecondary: true,
            run: () => this.storage.set({ dontShowPrompt: true, commit: this.productService.commit })
          }
        ],
        {
          sticky: true,
          priority: NotificationPriority.URGENT
        }
      );
    } else {
      this.notificationService.notify({
        severity: Severity.Warning,
        message,
        sticky: true,
        priority: NotificationPriority.URGENT
      });
    }
  }
};
IntegrityService = __decorateClass([
  __decorateParam(0, INotificationService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IChecksumService),
  __decorateParam(6, ILogService)
], IntegrityService);
registerSingleton(IIntegrityService, IntegrityService, InstantiationType.Delayed);
export {
  IntegrityService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvaW50ZWdyaXR5L2VsZWN0cm9uLXNhbmRib3gvaW50ZWdyaXR5U2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQ2hlY2tzdW1QYWlyLCBJSW50ZWdyaXR5U2VydmljZSwgSW50ZWdyaXR5VGVzdFJlc3VsdCB9IGZyb20gJy4uL2NvbW1vbi9pbnRlZ3JpdHkuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIE5vdGlmaWNhdGlvblByaW9yaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzLCBBcHBSZXNvdXJjZVBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElDaGVja3N1bVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jaGVja3N1bS9jb21tb24vY2hlY2tzdW1TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuXG5pbnRlcmZhY2UgSVN0b3JhZ2VEYXRhIHtcblx0cmVhZG9ubHkgZG9udFNob3dQcm9tcHQ6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGNvbW1pdDogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5jbGFzcyBJbnRlZ3JpdHlTdG9yYWdlIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBLRVkgPSAnaW50ZWdyaXR5U2VydmljZSc7XG5cblx0cHJpdmF0ZSB2YWx1ZTogSVN0b3JhZ2VEYXRhIHwgbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UpIHtcblx0XHR0aGlzLnZhbHVlID0gdGhpcy5fcmVhZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVhZCgpOiBJU3RvcmFnZURhdGEgfCBudWxsIHtcblx0XHRjb25zdCBqc29uVmFsdWUgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChJbnRlZ3JpdHlTdG9yYWdlLktFWSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRpZiAoIWpzb25WYWx1ZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBKU09OLnBhcnNlKGpzb25WYWx1ZSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRnZXQoKTogSVN0b3JhZ2VEYXRhIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMudmFsdWU7XG5cdH1cblxuXHRzZXQoZGF0YTogSVN0b3JhZ2VEYXRhIHwgbnVsbCk6IHZvaWQge1xuXHRcdHRoaXMudmFsdWUgPSBkYXRhO1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoSW50ZWdyaXR5U3RvcmFnZS5LRVksIEpTT04uc3RyaW5naWZ5KHRoaXMudmFsdWUpLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEludGVncml0eVNlcnZpY2UgaW1wbGVtZW50cyBJSW50ZWdyaXR5U2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBzdG9yYWdlOiBJbnRlZ3JpdHlTdG9yYWdlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaXNQdXJlUHJvbWlzZTogUHJvbWlzZTxJbnRlZ3JpdHlUZXN0UmVzdWx0Pjtcblx0aXNQdXJlKCk6IFByb21pc2U8SW50ZWdyaXR5VGVzdFJlc3VsdD4geyByZXR1cm4gdGhpcy5pc1B1cmVQcm9taXNlOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQ2hlY2tzdW1TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hlY2tzdW1TZXJ2aWNlOiBJQ2hlY2tzdW1TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuc3RvcmFnZSA9IG5ldyBJbnRlZ3JpdHlTdG9yYWdlKHN0b3JhZ2VTZXJ2aWNlKTtcblx0XHR0aGlzLmlzUHVyZVByb21pc2UgPSB0aGlzLl9pc1B1cmUoKTtcblxuXHRcdHRoaXMuX2NvbXB1dGUoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NvbXB1dGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgeyBpc1B1cmUgfSA9IGF3YWl0IHRoaXMuaXNQdXJlKCk7XG5cdFx0aWYgKGlzUHVyZSkge1xuXHRcdFx0cmV0dXJuOyAvLyBhbGwgaXMgZ29vZFxuXHRcdH1cblxuXHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBcblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuKioqXHRJbnN0YWxsYXRpb24gaGFzIGJlZW4gbW9kaWZpZWQgb24gZGlzayAqKipcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuYCk7XG5cblx0XHRjb25zdCBzdG9yZWREYXRhID0gdGhpcy5zdG9yYWdlLmdldCgpO1xuXHRcdGlmIChzdG9yZWREYXRhPy5kb250U2hvd1Byb21wdCAmJiBzdG9yZWREYXRhLmNvbW1pdCA9PT0gdGhpcy5wcm9kdWN0U2VydmljZS5jb21taXQpIHtcblx0XHRcdHJldHVybjsgLy8gRG8gbm90IHByb21wdFxuXHRcdH1cblxuXHRcdHRoaXMuX3Nob3dOb3RpZmljYXRpb24oKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2lzUHVyZSgpOiBQcm9taXNlPEludGVncml0eVRlc3RSZXN1bHQ+IHtcblx0XHRjb25zdCBleHBlY3RlZENoZWNrc3VtcyA9IHRoaXMucHJvZHVjdFNlcnZpY2UuY2hlY2tzdW1zIHx8IHt9O1xuXG5cdFx0YXdhaXQgdGhpcy5saWZlY3ljbGVTZXJ2aWNlLndoZW4oTGlmZWN5Y2xlUGhhc2UuRXZlbnR1YWxseSk7XG5cblx0XHRjb25zdCBhbGxSZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmtleXMoZXhwZWN0ZWRDaGVja3N1bXMpLm1hcChmaWxlbmFtZSA9PiB0aGlzLl9yZXNvbHZlKDxBcHBSZXNvdXJjZVBhdGg+ZmlsZW5hbWUsIGV4cGVjdGVkQ2hlY2tzdW1zW2ZpbGVuYW1lXSkpKTtcblxuXHRcdGxldCBpc1B1cmUgPSB0cnVlO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBhbGxSZXN1bHRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRpZiAoIWFsbFJlc3VsdHNbaV0uaXNQdXJlKSB7XG5cdFx0XHRcdGlzUHVyZSA9IGZhbHNlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aXNQdXJlLFxuXHRcdFx0cHJvb2Y6IGFsbFJlc3VsdHNcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVzb2x2ZShmaWxlbmFtZTogQXBwUmVzb3VyY2VQYXRoLCBleHBlY3RlZDogc3RyaW5nKTogUHJvbWlzZTxDaGVja3N1bVBhaXI+IHtcblx0XHRjb25zdCBmaWxlVXJpID0gRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoZmlsZW5hbWUpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNoZWNrc3VtID0gYXdhaXQgdGhpcy5jaGVja3N1bVNlcnZpY2UuY2hlY2tzdW0oZmlsZVVyaSk7XG5cblx0XHRcdHJldHVybiBJbnRlZ3JpdHlTZXJ2aWNlLl9jcmVhdGVDaGVja3N1bVBhaXIoZmlsZVVyaSwgY2hlY2tzdW0sIGV4cGVjdGVkKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0cmV0dXJuIEludGVncml0eVNlcnZpY2UuX2NyZWF0ZUNoZWNrc3VtUGFpcihmaWxlVXJpLCAnJywgZXhwZWN0ZWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9jcmVhdGVDaGVja3N1bVBhaXIodXJpOiBVUkksIGFjdHVhbDogc3RyaW5nLCBleHBlY3RlZDogc3RyaW5nKTogQ2hlY2tzdW1QYWlyIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dXJpOiB1cmksXG5cdFx0XHRhY3R1YWw6IGFjdHVhbCxcblx0XHRcdGV4cGVjdGVkOiBleHBlY3RlZCxcblx0XHRcdGlzUHVyZTogKGFjdHVhbCA9PT0gZXhwZWN0ZWQpXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX3Nob3dOb3RpZmljYXRpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgY2hlY2tzdW1GYWlsTW9yZUluZm9VcmwgPSB0aGlzLnByb2R1Y3RTZXJ2aWNlLmNoZWNrc3VtRmFpbE1vcmVJbmZvVXJsO1xuXHRcdGNvbnN0IG1lc3NhZ2UgPSBsb2NhbGl6ZSgnaW50ZWdyaXR5LnByb21wdCcsIFwiWW91ciB7MH0gaW5zdGFsbGF0aW9uIGFwcGVhcnMgdG8gYmUgY29ycnVwdC4gUGxlYXNlIHJlaW5zdGFsbC5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lU2hvcnQpO1xuXHRcdGlmIChjaGVja3N1bUZhaWxNb3JlSW5mb1VybCkge1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChcblx0XHRcdFx0U2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdFx0bWVzc2FnZSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnaW50ZWdyaXR5Lm1vcmVJbmZvcm1hdGlvbicsIFwiTW9yZSBJbmZvcm1hdGlvblwiKSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oVVJJLnBhcnNlKGNoZWNrc3VtRmFpbE1vcmVJbmZvVXJsKSlcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnaW50ZWdyaXR5LmRvbnRTaG93QWdhaW4nLCBcIkRvbid0IFNob3cgQWdhaW5cIiksXG5cdFx0XHRcdFx0XHRpc1NlY29uZGFyeTogdHJ1ZSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5zdG9yYWdlLnNldCh7IGRvbnRTaG93UHJvbXB0OiB0cnVlLCBjb21taXQ6IHRoaXMucHJvZHVjdFNlcnZpY2UuY29tbWl0IH0pXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0c3RpY2t5OiB0cnVlLFxuXHRcdFx0XHRcdHByaW9yaXR5OiBOb3RpZmljYXRpb25Qcmlvcml0eS5VUkdFTlRcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRtZXNzYWdlLFxuXHRcdFx0XHRzdGlja3k6IHRydWUsXG5cdFx0XHRcdHByaW9yaXR5OiBOb3RpZmljYXRpb25Qcmlvcml0eS5VUkdFTlRcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJSW50ZWdyaXR5U2VydmljZSwgSW50ZWdyaXR5U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLE9BQU8sY0FBYztBQUNyQixTQUFTLFdBQVc7QUFDcEIsU0FBdUIseUJBQThDO0FBQ3JFLFNBQVMsbUJBQW1CLHNCQUFzQjtBQUNsRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHNCQUFzQiw0QkFBNEI7QUFDM0QsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsa0JBQW1DO0FBQzVDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsbUJBQW1CO0FBTzVCLE1BQU0sb0JBQU4sTUFBTSxrQkFBaUI7QUFBQSxFQU10QixZQUE2QixnQkFBaUM7QUFBakM7QUFDNUIsU0FBSyxRQUFRLEtBQUssTUFBTTtBQUFBLEVBQ3pCO0FBQUEsRUFFUSxRQUE2QjtBQUNwQyxVQUFNLFlBQVksS0FBSyxlQUFlLElBQUksa0JBQWlCLEtBQUssYUFBYSxXQUFXO0FBQ3hGLFFBQUksQ0FBQyxXQUFXO0FBQ2YsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJO0FBQ0gsYUFBTyxLQUFLLE1BQU0sU0FBUztBQUFBLElBQzVCLFNBQVMsS0FBSztBQUNiLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBMkI7QUFDMUIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBSSxNQUFpQztBQUNwQyxT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
