import assert from "assert";
import { mockService } from "./utils/mock.js";
import { PromptsConfig } from "../../common/config.js";
import { randomInt } from "../../../../base/common/numbers.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
const createMock = (value) => {
  return mockService({
    getValue(key) {
      assert(
        typeof key === "string",
        `Expected string configuration key, got '${typeof key}'.`
      );
      assert(
        [PromptsConfig.KEY, PromptsConfig.LOCATIONS_KEY].includes(key),
        `Unsupported configuration key '${key}'.`
      );
      return value;
    }
  });
};
suite("PromptsConfig", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("\u2022 getLocationsValue", () => {
    test("\u2022 undefined", () => {
      const configService = createMock(void 0);
      assert.strictEqual(
        PromptsConfig.getLocationsValue(configService),
        void 0,
        "Must read correct value."
      );
    });
    test("\u2022 null", () => {
      const configService = createMock(null);
      assert.strictEqual(
        PromptsConfig.getLocationsValue(configService),
        void 0,
        "Must read correct value."
      );
    });
    suite("\u2022 object", () => {
      test("\u2022 empty", () => {
        assert.deepStrictEqual(
          PromptsConfig.getLocationsValue(createMock({})),
          {},
          "Must read correct value."
        );
      });
      test("\u2022 only valid strings", () => {
        assert.deepStrictEqual(
          PromptsConfig.getLocationsValue(createMock({
            "/root/.bashrc": true,
            "../../folder/.hidden-folder/config.xml": true,
            "/srv/www/Public_html/.htaccess": true,
            "../../another.folder/.WEIRD_FILE.log": true,
            "./folder.name/file.name": true,
            "/media/external/backup.tar.gz": true,
            "/Media/external/.secret.backup": true,
            "../relative/path.to.file": true,
            "./folderName.with.dots/more.dots.extension": true,
            "some/folder.with.dots/another.file": true,
            "/var/logs/app.01.05.error": true,
            "./.tempfile": true
          })),
          {
            "/root/.bashrc": true,
            "../../folder/.hidden-folder/config.xml": true,
            "/srv/www/Public_html/.htaccess": true,
            "../../another.folder/.WEIRD_FILE.log": true,
            "./folder.name/file.name": true,
            "/media/external/backup.tar.gz": true,
            "/Media/external/.secret.backup": true,
            "../relative/path.to.file": true,
            "./folderName.with.dots/more.dots.extension": true,
            "some/folder.with.dots/another.file": true,
            "/var/logs/app.01.05.error": true,
            "./.tempfile": true
          },
          "Must read correct value."
        );
      });
      test("\u2022 filters out non valid entries", () => {
        assert.deepStrictEqual(
          PromptsConfig.getLocationsValue(createMock({
            "/etc/hosts.backup": "	\n	",
            "./run.tests.sh": "\v",
            "../assets/img/logo.v2.png": true,
            "/mnt/storage/video.archive/episode.01.mkv": false,
            "../.local/bin/script.sh": true,
            "/usr/local/share/.fonts/CustomFont.otf": "",
            "../../development/branch.name/some.test": true,
            "/Home/user/.ssh/config": true,
            "./hidden.dir/.subhidden": "\f",
            "/tmp/.temp.folder/cache.db": true,
            "/opt/software/v3.2.1/build.log": "  ",
            "": true,
            "./scripts/.old.build.sh": true,
            "/var/data/datafile.2025-02-05.json": "\n",
            "\n\n": true,
            "	": true,
            "\v": true,
            "\f": true,
            "\r\n": true,
            "\f\f": true,
            "../lib/some_library.v1.0.1.so": "\r\n",
            "/dev/shm/.shared_resource": randomInt(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
          })),
          {
            "../assets/img/logo.v2.png": true,
            "/mnt/storage/video.archive/episode.01.mkv": false,
            "../.local/bin/script.sh": true,
            "../../development/branch.name/some.test": true,
            "/Home/user/.ssh/config": true,
            "/tmp/.temp.folder/cache.db": true,
            "./scripts/.old.build.sh": true
          },
          "Must read correct value."
        );
      });
      test("\u2022 only invalid or false values", () => {
        assert.deepStrictEqual(
          PromptsConfig.getLocationsValue(createMock({
            "/etc/hosts.backup": "	\n	",
            "./run.tests.sh": "\v",
            "../assets/IMG/logo.v2.png": "",
            "/mnt/storage/video.archive/episode.01.mkv": false,
            "/usr/local/share/.fonts/CustomFont.otf": "",
            "./hidden.dir/.subhidden": "\f",
            "/opt/Software/v3.2.1/build.log": "  ",
            "/var/data/datafile.2025-02-05.json": "\n",
            "../lib/some_library.v1.0.1.so": "\r\n",
            "/dev/shm/.shared_resource": randomInt(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
          })),
          {
            "/mnt/storage/video.archive/episode.01.mkv": false
          },
          "Must read correct value."
        );
      });
    });
  });
  suite("\u2022 sourceLocations", () => {
    test("\u2022 undefined", () => {
      const configService = createMock(void 0);
      assert.deepStrictEqual(
        PromptsConfig.promptSourceFolders(configService),
        [],
        "Must read correct value."
      );
    });
    test("\u2022 null", () => {
      const configService = createMock(null);
      assert.deepStrictEqual(
        PromptsConfig.promptSourceFolders(configService),
        [],
        "Must read correct value."
      );
    });
    suite("object", () => {
      test("empty", () => {
        assert.deepStrictEqual(
          PromptsConfig.promptSourceFolders(createMock({})),
          [".github/prompts"],
          "Must read correct value."
        );
      });
      test("only valid strings", () => {
        assert.deepStrictEqual(
          PromptsConfig.promptSourceFolders(createMock({
            "/root/.bashrc": true,
            "../../folder/.hidden-folder/config.xml": true,
            "/srv/www/Public_html/.htaccess": true,
            "../../another.folder/.WEIRD_FILE.log": true,
            "./folder.name/file.name": true,
            "/media/external/backup.tar.gz": true,
            "/Media/external/.secret.backup": true,
            "../relative/path.to.file": true,
            "./folderName.with.dots/more.dots.extension": true,
            "some/folder.with.dots/another.file": true,
            "/var/logs/app.01.05.error": true,
            ".GitHub/prompts": true,
            "./.tempfile": true
          })),
          [
            ".github/prompts",
            "/root/.bashrc",
            "../../folder/.hidden-folder/config.xml",
            "/srv/www/Public_html/.htaccess",
            "../../another.folder/.WEIRD_FILE.log",
            "./folder.name/file.name",
            "/media/external/backup.tar.gz",
            "/Media/external/.secret.backup",
            "../relative/path.to.file",
            "./folderName.with.dots/more.dots.extension",
            "some/folder.with.dots/another.file",
            "/var/logs/app.01.05.error",
            ".GitHub/prompts",
            "./.tempfile"
          ],
          "Must read correct value."
        );
      });
      test("filters out non valid entries", () => {
        assert.deepStrictEqual(
          PromptsConfig.promptSourceFolders(createMock({
            "/etc/hosts.backup": "	\n	",
            "./run.tests.sh": "\v",
            "../assets/img/logo.v2.png": true,
            "/mnt/storage/video.archive/episode.01.mkv": false,
            "../.local/bin/script.sh": true,
            "/usr/local/share/.fonts/CustomFont.otf": "",
            "../../development/branch.name/some.test": true,
            ".giThub/prompts": true,
            "/Home/user/.ssh/config": true,
            "./hidden.dir/.subhidden": "\f",
            "/tmp/.temp.folder/cache.db": true,
            ".github/prompts": true,
            "/opt/software/v3.2.1/build.log": "  ",
            "": true,
            "./scripts/.old.build.sh": true,
            "/var/data/datafile.2025-02-05.json": "\n",
            "\n\n": true,
            "	": true,
            "\v": true,
            "\f": true,
            "\r\n": true,
            "\f\f": true,
            "../lib/some_library.v1.0.1.so": "\r\n",
            "/dev/shm/.shared_resource": randomInt(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
          })),
          [
            ".github/prompts",
            "../assets/img/logo.v2.png",
            "../.local/bin/script.sh",
            "../../development/branch.name/some.test",
            ".giThub/prompts",
            "/Home/user/.ssh/config",
            "/tmp/.temp.folder/cache.db",
            "./scripts/.old.build.sh"
          ],
          "Must read correct value."
        );
      });
      test("only invalid or false values", () => {
        assert.deepStrictEqual(
          PromptsConfig.promptSourceFolders(createMock({
            "/etc/hosts.backup": "	\n	",
            "./run.tests.sh": "\v",
            "../assets/IMG/logo.v2.png": "",
            "/mnt/storage/video.archive/episode.01.mkv": false,
            "/usr/local/share/.fonts/CustomFont.otf": "",
            "./hidden.dir/.subhidden": "\f",
            "/opt/Software/v3.2.1/build.log": "  ",
            "/var/data/datafile.2025-02-05.json": "\n",
            "../lib/some_library.v1.0.1.so": "\r\n",
            "/dev/shm/.shared_resource": randomInt(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
          })),
          [
            ".github/prompts"
          ],
          "Must read correct value."
        );
      });
      test("filters out disabled default location", () => {
        assert.deepStrictEqual(
          PromptsConfig.promptSourceFolders(createMock({
            "/etc/hosts.backup": "	\n	",
            "./run.tests.sh": "\v",
            ".github/prompts": false,
            "../assets/img/logo.v2.png": true,
            "/mnt/storage/video.archive/episode.01.mkv": false,
            "../.local/bin/script.sh": true,
            "/usr/local/share/.fonts/CustomFont.otf": "",
            "../../development/branch.name/some.test": true,
            ".giThub/prompts": true,
            "/Home/user/.ssh/config": true,
            "./hidden.dir/.subhidden": "\f",
            "/tmp/.temp.folder/cache.db": true,
            "/opt/software/v3.2.1/build.log": "  ",
            "": true,
            "./scripts/.old.build.sh": true,
            "/var/data/datafile.2025-02-05.json": "\n",
            "\n\n": true,
            "	": true,
            "\v": true,
            "\f": true,
            "\r\n": true,
            "\f\f": true,
            "../lib/some_library.v1.0.1.so": "\r\n",
            "/dev/shm/.shared_resource": randomInt(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
          })),
          [
            "../assets/img/logo.v2.png",
            "../.local/bin/script.sh",
            "../../development/branch.name/some.test",
            ".giThub/prompts",
            "/Home/user/.ssh/config",
            "/tmp/.temp.folder/cache.db",
            "./scripts/.old.build.sh"
          ],
          "Must read correct value."
        );
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9wcm9tcHRzL3Rlc3QvY29tbW9uL2NvbmZpZy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgbW9ja1NlcnZpY2UgfSBmcm9tICcuL3V0aWxzL21vY2suanMnO1xuaW1wb3J0IHsgUHJvbXB0c0NvbmZpZyB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25maWcuanMnO1xuaW1wb3J0IHsgcmFuZG9tSW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbnVtYmVycy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzLCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcblxuLyoqXG4gKiBNb2NrZWQgaW5zdGFuY2Ugb2Yge0BsaW5rIElDb25maWd1cmF0aW9uU2VydmljZX0uXG4gKi9cbmNvbnN0IGNyZWF0ZU1vY2sgPSA8VD4odmFsdWU6IFQpOiBJQ29uZmlndXJhdGlvblNlcnZpY2UgPT4ge1xuXHRyZXR1cm4gbW9ja1NlcnZpY2U8SUNvbmZpZ3VyYXRpb25TZXJ2aWNlPih7XG5cdFx0Z2V0VmFsdWUoa2V5Pzogc3RyaW5nIHwgSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMpIHtcblx0XHRcdGFzc2VydChcblx0XHRcdFx0dHlwZW9mIGtleSA9PT0gJ3N0cmluZycsXG5cdFx0XHRcdGBFeHBlY3RlZCBzdHJpbmcgY29uZmlndXJhdGlvbiBrZXksIGdvdCAnJHt0eXBlb2Yga2V5fScuYCxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0W1Byb21wdHNDb25maWcuS0VZLCBQcm9tcHRzQ29uZmlnLkxPQ0FUSU9OU19LRVldLmluY2x1ZGVzKGtleSksXG5cdFx0XHRcdGBVbnN1cHBvcnRlZCBjb25maWd1cmF0aW9uIGtleSAnJHtrZXl9Jy5gLFxuXHRcdFx0KTtcblxuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH0sXG5cdH0pO1xufTtcblxuc3VpdGUoJ1Byb21wdHNDb25maWcnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdcdTIwMjIgZ2V0TG9jYXRpb25zVmFsdWUnLCAoKSA9PiB7XG5cdFx0dGVzdCgnXHUyMDIyIHVuZGVmaW5lZCcsICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbmZpZ1NlcnZpY2UgPSBjcmVhdGVNb2NrKHVuZGVmaW5lZCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0UHJvbXB0c0NvbmZpZy5nZXRMb2NhdGlvbnNWYWx1ZShjb25maWdTZXJ2aWNlKSxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHQnTXVzdCByZWFkIGNvcnJlY3QgdmFsdWUuJyxcblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdcdTIwMjIgbnVsbCcsICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbmZpZ1NlcnZpY2UgPSBjcmVhdGVNb2NrKG51bGwpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRcdFByb21wdHNDb25maWcuZ2V0TG9jYXRpb25zVmFsdWUoY29uZmlnU2VydmljZSksXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0J011c3QgcmVhZCBjb3JyZWN0IHZhbHVlLicsXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0c3VpdGUoJ1x1MjAyMiBvYmplY3QnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdcdTIwMjIgZW1wdHknLCAoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0UHJvbXB0c0NvbmZpZy5nZXRMb2NhdGlvbnNWYWx1ZShjcmVhdGVNb2NrKHt9KSksXG5cdFx0XHRcdFx0e30sXG5cdFx0XHRcdFx0J011c3QgcmVhZCBjb3JyZWN0IHZhbHVlLicsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnXHUyMDIyIG9ubHkgdmFsaWQgc3RyaW5ncycsICgpID0+IHtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRQcm9tcHRzQ29uZmlnLmdldExvY2F0aW9uc1ZhbHVlKGNyZWF0ZU1vY2soe1xuXHRcdFx0XHRcdFx0Jy9yb290Ly5iYXNocmMnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4uLy4uL2ZvbGRlci8uaGlkZGVuLWZvbGRlci9jb25maWcueG1sJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvc3J2L3d3dy9QdWJsaWNfaHRtbC8uaHRhY2Nlc3MnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4uLy4uL2Fub3RoZXIuZm9sZGVyLy5XRUlSRF9GSUxFLmxvZyc6IHRydWUsXG5cdFx0XHRcdFx0XHQnLi9mb2xkZXIubmFtZS9maWxlLm5hbWUnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy9tZWRpYS9leHRlcm5hbC9iYWNrdXAudGFyLmd6JzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvTWVkaWEvZXh0ZXJuYWwvLnNlY3JldC5iYWNrdXAnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4uL3JlbGF0aXZlL3BhdGgudG8uZmlsZSc6IHRydWUsXG5cdFx0XHRcdFx0XHQnLi9mb2xkZXJOYW1lLndpdGguZG90cy9tb3JlLmRvdHMuZXh0ZW5zaW9uJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCdzb21lL2ZvbGRlci53aXRoLmRvdHMvYW5vdGhlci5maWxlJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvdmFyL2xvZ3MvYXBwLjAxLjA1LmVycm9yJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuLy50ZW1wZmlsZSc6IHRydWUsXG5cdFx0XHRcdFx0fSkpLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdCcvcm9vdC8uYmFzaHJjJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuLi8uLi9mb2xkZXIvLmhpZGRlbi1mb2xkZXIvY29uZmlnLnhtbCc6IHRydWUsXG5cdFx0XHRcdFx0XHQnL3Nydi93d3cvUHVibGljX2h0bWwvLmh0YWNjZXNzJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuLi8uLi9hbm90aGVyLmZvbGRlci8uV0VJUkRfRklMRS5sb2cnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4vZm9sZGVyLm5hbWUvZmlsZS5uYW1lJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvbWVkaWEvZXh0ZXJuYWwvYmFja3VwLnRhci5neic6IHRydWUsXG5cdFx0XHRcdFx0XHQnL01lZGlhL2V4dGVybmFsLy5zZWNyZXQuYmFja3VwJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuLi9yZWxhdGl2ZS9wYXRoLnRvLmZpbGUnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4vZm9sZGVyTmFtZS53aXRoLmRvdHMvbW9yZS5kb3RzLmV4dGVuc2lvbic6IHRydWUsXG5cdFx0XHRcdFx0XHQnc29tZS9mb2xkZXIud2l0aC5kb3RzL2Fub3RoZXIuZmlsZSc6IHRydWUsXG5cdFx0XHRcdFx0XHQnL3Zhci9sb2dzL2FwcC4wMS4wNS5lcnJvcic6IHRydWUsXG5cdFx0XHRcdFx0XHQnLi8udGVtcGZpbGUnOiB0cnVlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0J011c3QgcmVhZCBjb3JyZWN0IHZhbHVlLicsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnXHUyMDIyIGZpbHRlcnMgb3V0IG5vbiB2YWxpZCBlbnRyaWVzJywgKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFByb21wdHNDb25maWcuZ2V0TG9jYXRpb25zVmFsdWUoY3JlYXRlTW9jayh7XG5cdFx0XHRcdFx0XHQnL2V0Yy9ob3N0cy5iYWNrdXAnOiAnXFx0XFxuXFx0Jyxcblx0XHRcdFx0XHRcdCcuL3J1bi50ZXN0cy5zaCc6ICdcXHYnLFxuXHRcdFx0XHRcdFx0Jy4uL2Fzc2V0cy9pbWcvbG9nby52Mi5wbmcnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy9tbnQvc3RvcmFnZS92aWRlby5hcmNoaXZlL2VwaXNvZGUuMDEubWt2JzogZmFsc2UsXG5cdFx0XHRcdFx0XHQnLi4vLmxvY2FsL2Jpbi9zY3JpcHQuc2gnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy91c3IvbG9jYWwvc2hhcmUvLmZvbnRzL0N1c3RvbUZvbnQub3RmJzogJycsXG5cdFx0XHRcdFx0XHQnLi4vLi4vZGV2ZWxvcG1lbnQvYnJhbmNoLm5hbWUvc29tZS50ZXN0JzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvSG9tZS91c2VyLy5zc2gvY29uZmlnJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuL2hpZGRlbi5kaXIvLnN1YmhpZGRlbic6ICdcXGYnLFxuXHRcdFx0XHRcdFx0Jy90bXAvLnRlbXAuZm9sZGVyL2NhY2hlLmRiJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvb3B0L3NvZnR3YXJlL3YzLjIuMS9idWlsZC5sb2cnOiAnICAnLFxuXHRcdFx0XHRcdFx0Jyc6IHRydWUsXG5cdFx0XHRcdFx0XHQnLi9zY3JpcHRzLy5vbGQuYnVpbGQuc2gnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy92YXIvZGF0YS9kYXRhZmlsZS4yMDI1LTAyLTA1Lmpzb24nOiAnXFxuJyxcblx0XHRcdFx0XHRcdCdcXG5cXG4nOiB0cnVlLFxuXHRcdFx0XHRcdFx0J1xcdCc6IHRydWUsXG5cdFx0XHRcdFx0XHQnXFx2JzogdHJ1ZSxcblx0XHRcdFx0XHRcdCdcXGYnOiB0cnVlLFxuXHRcdFx0XHRcdFx0J1xcclxcbic6IHRydWUsXG5cdFx0XHRcdFx0XHQnXFxmXFxmJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuLi9saWIvc29tZV9saWJyYXJ5LnYxLjAuMS5zbyc6ICdcXHJcXG4nLFxuXHRcdFx0XHRcdFx0Jy9kZXYvc2htLy5zaGFyZWRfcmVzb3VyY2UnOiByYW5kb21JbnQoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIE51bWJlci5NSU5fU0FGRV9JTlRFR0VSKSxcblx0XHRcdFx0XHR9KSksXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0Jy4uL2Fzc2V0cy9pbWcvbG9nby52Mi5wbmcnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy9tbnQvc3RvcmFnZS92aWRlby5hcmNoaXZlL2VwaXNvZGUuMDEubWt2JzogZmFsc2UsXG5cdFx0XHRcdFx0XHQnLi4vLmxvY2FsL2Jpbi9zY3JpcHQuc2gnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4uLy4uL2RldmVsb3BtZW50L2JyYW5jaC5uYW1lL3NvbWUudGVzdCc6IHRydWUsXG5cdFx0XHRcdFx0XHQnL0hvbWUvdXNlci8uc3NoL2NvbmZpZyc6IHRydWUsXG5cdFx0XHRcdFx0XHQnL3RtcC8udGVtcC5mb2xkZXIvY2FjaGUuZGInOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4vc2NyaXB0cy8ub2xkLmJ1aWxkLnNoJzogdHJ1ZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdCdNdXN0IHJlYWQgY29ycmVjdCB2YWx1ZS4nLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ1x1MjAyMiBvbmx5IGludmFsaWQgb3IgZmFsc2UgdmFsdWVzJywgKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFByb21wdHNDb25maWcuZ2V0TG9jYXRpb25zVmFsdWUoY3JlYXRlTW9jayh7XG5cdFx0XHRcdFx0XHQnL2V0Yy9ob3N0cy5iYWNrdXAnOiAnXFx0XFxuXFx0Jyxcblx0XHRcdFx0XHRcdCcuL3J1bi50ZXN0cy5zaCc6ICdcXHYnLFxuXHRcdFx0XHRcdFx0Jy4uL2Fzc2V0cy9JTUcvbG9nby52Mi5wbmcnOiAnJyxcblx0XHRcdFx0XHRcdCcvbW50L3N0b3JhZ2UvdmlkZW8uYXJjaGl2ZS9lcGlzb2RlLjAxLm1rdic6IGZhbHNlLFxuXHRcdFx0XHRcdFx0Jy91c3IvbG9jYWwvc2hhcmUvLmZvbnRzL0N1c3RvbUZvbnQub3RmJzogJycsXG5cdFx0XHRcdFx0XHQnLi9oaWRkZW4uZGlyLy5zdWJoaWRkZW4nOiAnXFxmJyxcblx0XHRcdFx0XHRcdCcvb3B0L1NvZnR3YXJlL3YzLjIuMS9idWlsZC5sb2cnOiAnICAnLFxuXHRcdFx0XHRcdFx0Jy92YXIvZGF0YS9kYXRhZmlsZS4yMDI1LTAyLTA1Lmpzb24nOiAnXFxuJyxcblx0XHRcdFx0XHRcdCcuLi9saWIvc29tZV9saWJyYXJ5LnYxLjAuMS5zbyc6ICdcXHJcXG4nLFxuXHRcdFx0XHRcdFx0Jy9kZXYvc2htLy5zaGFyZWRfcmVzb3VyY2UnOiByYW5kb21JbnQoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIE51bWJlci5NSU5fU0FGRV9JTlRFR0VSKSxcblx0XHRcdFx0XHR9KSksXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0Jy9tbnQvc3RvcmFnZS92aWRlby5hcmNoaXZlL2VwaXNvZGUuMDEubWt2JzogZmFsc2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQnTXVzdCByZWFkIGNvcnJlY3QgdmFsdWUuJyxcblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnXHUyMDIyIHNvdXJjZUxvY2F0aW9ucycsICgpID0+IHtcblx0XHR0ZXN0KCdcdTIwMjIgdW5kZWZpbmVkJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29uZmlnU2VydmljZSA9IGNyZWF0ZU1vY2sodW5kZWZpbmVkKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0UHJvbXB0c0NvbmZpZy5wcm9tcHRTb3VyY2VGb2xkZXJzKGNvbmZpZ1NlcnZpY2UpLFxuXHRcdFx0XHRbXSxcblx0XHRcdFx0J011c3QgcmVhZCBjb3JyZWN0IHZhbHVlLicsXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnXHUyMDIyIG51bGwnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBjb25maWdTZXJ2aWNlID0gY3JlYXRlTW9jayhudWxsKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0UHJvbXB0c0NvbmZpZy5wcm9tcHRTb3VyY2VGb2xkZXJzKGNvbmZpZ1NlcnZpY2UpLFxuXHRcdFx0XHRbXSxcblx0XHRcdFx0J011c3QgcmVhZCBjb3JyZWN0IHZhbHVlLicsXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0c3VpdGUoJ29iamVjdCcsICgpID0+IHtcblx0XHRcdHRlc3QoJ2VtcHR5JywgKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFByb21wdHNDb25maWcucHJvbXB0U291cmNlRm9sZGVycyhjcmVhdGVNb2NrKHt9KSksXG5cdFx0XHRcdFx0WycuZ2l0aHViL3Byb21wdHMnXSxcblx0XHRcdFx0XHQnTXVzdCByZWFkIGNvcnJlY3QgdmFsdWUuJyxcblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdvbmx5IHZhbGlkIHN0cmluZ3MnLCAoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0UHJvbXB0c0NvbmZpZy5wcm9tcHRTb3VyY2VGb2xkZXJzKGNyZWF0ZU1vY2soe1xuXHRcdFx0XHRcdFx0Jy9yb290Ly5iYXNocmMnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4uLy4uL2ZvbGRlci8uaGlkZGVuLWZvbGRlci9jb25maWcueG1sJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvc3J2L3d3dy9QdWJsaWNfaHRtbC8uaHRhY2Nlc3MnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4uLy4uL2Fub3RoZXIuZm9sZGVyLy5XRUlSRF9GSUxFLmxvZyc6IHRydWUsXG5cdFx0XHRcdFx0XHQnLi9mb2xkZXIubmFtZS9maWxlLm5hbWUnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy9tZWRpYS9leHRlcm5hbC9iYWNrdXAudGFyLmd6JzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvTWVkaWEvZXh0ZXJuYWwvLnNlY3JldC5iYWNrdXAnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4uL3JlbGF0aXZlL3BhdGgudG8uZmlsZSc6IHRydWUsXG5cdFx0XHRcdFx0XHQnLi9mb2xkZXJOYW1lLndpdGguZG90cy9tb3JlLmRvdHMuZXh0ZW5zaW9uJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCdzb21lL2ZvbGRlci53aXRoLmRvdHMvYW5vdGhlci5maWxlJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvdmFyL2xvZ3MvYXBwLjAxLjA1LmVycm9yJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuR2l0SHViL3Byb21wdHMnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4vLnRlbXBmaWxlJzogdHJ1ZSxcblx0XHRcdFx0XHR9KSksXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0Jy5naXRodWIvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHQnL3Jvb3QvLmJhc2hyYycsXG5cdFx0XHRcdFx0XHQnLi4vLi4vZm9sZGVyLy5oaWRkZW4tZm9sZGVyL2NvbmZpZy54bWwnLFxuXHRcdFx0XHRcdFx0Jy9zcnYvd3d3L1B1YmxpY19odG1sLy5odGFjY2VzcycsXG5cdFx0XHRcdFx0XHQnLi4vLi4vYW5vdGhlci5mb2xkZXIvLldFSVJEX0ZJTEUubG9nJyxcblx0XHRcdFx0XHRcdCcuL2ZvbGRlci5uYW1lL2ZpbGUubmFtZScsXG5cdFx0XHRcdFx0XHQnL21lZGlhL2V4dGVybmFsL2JhY2t1cC50YXIuZ3onLFxuXHRcdFx0XHRcdFx0Jy9NZWRpYS9leHRlcm5hbC8uc2VjcmV0LmJhY2t1cCcsXG5cdFx0XHRcdFx0XHQnLi4vcmVsYXRpdmUvcGF0aC50by5maWxlJyxcblx0XHRcdFx0XHRcdCcuL2ZvbGRlck5hbWUud2l0aC5kb3RzL21vcmUuZG90cy5leHRlbnNpb24nLFxuXHRcdFx0XHRcdFx0J3NvbWUvZm9sZGVyLndpdGguZG90cy9hbm90aGVyLmZpbGUnLFxuXHRcdFx0XHRcdFx0Jy92YXIvbG9ncy9hcHAuMDEuMDUuZXJyb3InLFxuXHRcdFx0XHRcdFx0Jy5HaXRIdWIvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHQnLi8udGVtcGZpbGUnLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0J011c3QgcmVhZCBjb3JyZWN0IHZhbHVlLicsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnZmlsdGVycyBvdXQgbm9uIHZhbGlkIGVudHJpZXMnLCAoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0UHJvbXB0c0NvbmZpZy5wcm9tcHRTb3VyY2VGb2xkZXJzKGNyZWF0ZU1vY2soe1xuXHRcdFx0XHRcdFx0Jy9ldGMvaG9zdHMuYmFja3VwJzogJ1xcdFxcblxcdCcsXG5cdFx0XHRcdFx0XHQnLi9ydW4udGVzdHMuc2gnOiAnXFx2Jyxcblx0XHRcdFx0XHRcdCcuLi9hc3NldHMvaW1nL2xvZ28udjIucG5nJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvbW50L3N0b3JhZ2UvdmlkZW8uYXJjaGl2ZS9lcGlzb2RlLjAxLm1rdic6IGZhbHNlLFxuXHRcdFx0XHRcdFx0Jy4uLy5sb2NhbC9iaW4vc2NyaXB0LnNoJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvdXNyL2xvY2FsL3NoYXJlLy5mb250cy9DdXN0b21Gb250Lm90Zic6ICcnLFxuXHRcdFx0XHRcdFx0Jy4uLy4uL2RldmVsb3BtZW50L2JyYW5jaC5uYW1lL3NvbWUudGVzdCc6IHRydWUsXG5cdFx0XHRcdFx0XHQnLmdpVGh1Yi9wcm9tcHRzJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvSG9tZS91c2VyLy5zc2gvY29uZmlnJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuL2hpZGRlbi5kaXIvLnN1YmhpZGRlbic6ICdcXGYnLFxuXHRcdFx0XHRcdFx0Jy90bXAvLnRlbXAuZm9sZGVyL2NhY2hlLmRiJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuZ2l0aHViL3Byb21wdHMnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy9vcHQvc29mdHdhcmUvdjMuMi4xL2J1aWxkLmxvZyc6ICcgICcsXG5cdFx0XHRcdFx0XHQnJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuL3NjcmlwdHMvLm9sZC5idWlsZC5zaCc6IHRydWUsXG5cdFx0XHRcdFx0XHQnL3Zhci9kYXRhL2RhdGFmaWxlLjIwMjUtMDItMDUuanNvbic6ICdcXG4nLFxuXHRcdFx0XHRcdFx0J1xcblxcbic6IHRydWUsXG5cdFx0XHRcdFx0XHQnXFx0JzogdHJ1ZSxcblx0XHRcdFx0XHRcdCdcXHYnOiB0cnVlLFxuXHRcdFx0XHRcdFx0J1xcZic6IHRydWUsXG5cdFx0XHRcdFx0XHQnXFxyXFxuJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCdcXGZcXGYnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy4uL2xpYi9zb21lX2xpYnJhcnkudjEuMC4xLnNvJzogJ1xcclxcbicsXG5cdFx0XHRcdFx0XHQnL2Rldi9zaG0vLnNoYXJlZF9yZXNvdXJjZSc6IHJhbmRvbUludChOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgTnVtYmVyLk1JTl9TQUZFX0lOVEVHRVIpLFxuXHRcdFx0XHRcdH0pKSxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHQnLmdpdGh1Yi9wcm9tcHRzJyxcblx0XHRcdFx0XHRcdCcuLi9hc3NldHMvaW1nL2xvZ28udjIucG5nJyxcblx0XHRcdFx0XHRcdCcuLi8ubG9jYWwvYmluL3NjcmlwdC5zaCcsXG5cdFx0XHRcdFx0XHQnLi4vLi4vZGV2ZWxvcG1lbnQvYnJhbmNoLm5hbWUvc29tZS50ZXN0Jyxcblx0XHRcdFx0XHRcdCcuZ2lUaHViL3Byb21wdHMnLFxuXHRcdFx0XHRcdFx0Jy9Ib21lL3VzZXIvLnNzaC9jb25maWcnLFxuXHRcdFx0XHRcdFx0Jy90bXAvLnRlbXAuZm9sZGVyL2NhY2hlLmRiJyxcblx0XHRcdFx0XHRcdCcuL3NjcmlwdHMvLm9sZC5idWlsZC5zaCcsXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHQnTXVzdCByZWFkIGNvcnJlY3QgdmFsdWUuJyxcblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdvbmx5IGludmFsaWQgb3IgZmFsc2UgdmFsdWVzJywgKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFByb21wdHNDb25maWcucHJvbXB0U291cmNlRm9sZGVycyhjcmVhdGVNb2NrKHtcblx0XHRcdFx0XHRcdCcvZXRjL2hvc3RzLmJhY2t1cCc6ICdcXHRcXG5cXHQnLFxuXHRcdFx0XHRcdFx0Jy4vcnVuLnRlc3RzLnNoJzogJ1xcdicsXG5cdFx0XHRcdFx0XHQnLi4vYXNzZXRzL0lNRy9sb2dvLnYyLnBuZyc6ICcnLFxuXHRcdFx0XHRcdFx0Jy9tbnQvc3RvcmFnZS92aWRlby5hcmNoaXZlL2VwaXNvZGUuMDEubWt2JzogZmFsc2UsXG5cdFx0XHRcdFx0XHQnL3Vzci9sb2NhbC9zaGFyZS8uZm9udHMvQ3VzdG9tRm9udC5vdGYnOiAnJyxcblx0XHRcdFx0XHRcdCcuL2hpZGRlbi5kaXIvLnN1YmhpZGRlbic6ICdcXGYnLFxuXHRcdFx0XHRcdFx0Jy9vcHQvU29mdHdhcmUvdjMuMi4xL2J1aWxkLmxvZyc6ICcgICcsXG5cdFx0XHRcdFx0XHQnL3Zhci9kYXRhL2RhdGFmaWxlLjIwMjUtMDItMDUuanNvbic6ICdcXG4nLFxuXHRcdFx0XHRcdFx0Jy4uL2xpYi9zb21lX2xpYnJhcnkudjEuMC4xLnNvJzogJ1xcclxcbicsXG5cdFx0XHRcdFx0XHQnL2Rldi9zaG0vLnNoYXJlZF9yZXNvdXJjZSc6IHJhbmRvbUludChOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgTnVtYmVyLk1JTl9TQUZFX0lOVEVHRVIpLFxuXHRcdFx0XHRcdH0pKSxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHQnLmdpdGh1Yi9wcm9tcHRzJyxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdCdNdXN0IHJlYWQgY29ycmVjdCB2YWx1ZS4nLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2ZpbHRlcnMgb3V0IGRpc2FibGVkIGRlZmF1bHQgbG9jYXRpb24nLCAoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0UHJvbXB0c0NvbmZpZy5wcm9tcHRTb3VyY2VGb2xkZXJzKGNyZWF0ZU1vY2soe1xuXHRcdFx0XHRcdFx0Jy9ldGMvaG9zdHMuYmFja3VwJzogJ1xcdFxcblxcdCcsXG5cdFx0XHRcdFx0XHQnLi9ydW4udGVzdHMuc2gnOiAnXFx2Jyxcblx0XHRcdFx0XHRcdCcuZ2l0aHViL3Byb21wdHMnOiBmYWxzZSxcblx0XHRcdFx0XHRcdCcuLi9hc3NldHMvaW1nL2xvZ28udjIucG5nJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvbW50L3N0b3JhZ2UvdmlkZW8uYXJjaGl2ZS9lcGlzb2RlLjAxLm1rdic6IGZhbHNlLFxuXHRcdFx0XHRcdFx0Jy4uLy5sb2NhbC9iaW4vc2NyaXB0LnNoJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvdXNyL2xvY2FsL3NoYXJlLy5mb250cy9DdXN0b21Gb250Lm90Zic6ICcnLFxuXHRcdFx0XHRcdFx0Jy4uLy4uL2RldmVsb3BtZW50L2JyYW5jaC5uYW1lL3NvbWUudGVzdCc6IHRydWUsXG5cdFx0XHRcdFx0XHQnLmdpVGh1Yi9wcm9tcHRzJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvSG9tZS91c2VyLy5zc2gvY29uZmlnJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuL2hpZGRlbi5kaXIvLnN1YmhpZGRlbic6ICdcXGYnLFxuXHRcdFx0XHRcdFx0Jy90bXAvLnRlbXAuZm9sZGVyL2NhY2hlLmRiJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcvb3B0L3NvZnR3YXJlL3YzLjIuMS9idWlsZC5sb2cnOiAnICAnLFxuXHRcdFx0XHRcdFx0Jyc6IHRydWUsXG5cdFx0XHRcdFx0XHQnLi9zY3JpcHRzLy5vbGQuYnVpbGQuc2gnOiB0cnVlLFxuXHRcdFx0XHRcdFx0Jy92YXIvZGF0YS9kYXRhZmlsZS4yMDI1LTAyLTA1Lmpzb24nOiAnXFxuJyxcblx0XHRcdFx0XHRcdCdcXG5cXG4nOiB0cnVlLFxuXHRcdFx0XHRcdFx0J1xcdCc6IHRydWUsXG5cdFx0XHRcdFx0XHQnXFx2JzogdHJ1ZSxcblx0XHRcdFx0XHRcdCdcXGYnOiB0cnVlLFxuXHRcdFx0XHRcdFx0J1xcclxcbic6IHRydWUsXG5cdFx0XHRcdFx0XHQnXFxmXFxmJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCcuLi9saWIvc29tZV9saWJyYXJ5LnYxLjAuMS5zbyc6ICdcXHJcXG4nLFxuXHRcdFx0XHRcdFx0Jy9kZXYvc2htLy5zaGFyZWRfcmVzb3VyY2UnOiByYW5kb21JbnQoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIE51bWJlci5NSU5fU0FGRV9JTlRFR0VSKSxcblx0XHRcdFx0XHR9KSksXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0Jy4uL2Fzc2V0cy9pbWcvbG9nby52Mi5wbmcnLFxuXHRcdFx0XHRcdFx0Jy4uLy5sb2NhbC9iaW4vc2NyaXB0LnNoJyxcblx0XHRcdFx0XHRcdCcuLi8uLi9kZXZlbG9wbWVudC9icmFuY2gubmFtZS9zb21lLnRlc3QnLFxuXHRcdFx0XHRcdFx0Jy5naVRodWIvcHJvbXB0cycsXG5cdFx0XHRcdFx0XHQnL0hvbWUvdXNlci8uc3NoL2NvbmZpZycsXG5cdFx0XHRcdFx0XHQnL3RtcC8udGVtcC5mb2xkZXIvY2FjaGUuZGInLFxuXHRcdFx0XHRcdFx0Jy4vc2NyaXB0cy8ub2xkLmJ1aWxkLnNoJyxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdCdNdXN0IHJlYWQgY29ycmVjdCB2YWx1ZS4nLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUywrQ0FBK0M7QUFNeEQsTUFBTSxhQUFhLENBQUksVUFBb0M7QUFDMUQsU0FBTyxZQUFtQztBQUFBLElBQ3pDLFNBQVMsS0FBd0M7QUFDaEQ7QUFBQSxRQUNDLE9BQU8sUUFBUTtBQUFBLFFBQ2YsMkNBQTJDLE9BQU8sR0FBRztBQUFBLE1BQ3REO0FBRUE7QUFBQSxRQUNDLENBQUMsY0FBYyxLQUFLLGNBQWMsYUFBYSxFQUFFLFNBQVMsR0FBRztBQUFBLFFBQzdELGtDQUFrQyxHQUFHO0FBQUEsTUFDdEM7QUFFQSxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0QsQ0FBQztBQUNGO0FBRUEsTUFBTSxpQkFBaUIsTUFBTTtBQUM1QiwwQ0FBd0M7QUFFeEMsUUFBTSw0QkFBdUIsTUFBTTtBQUNsQyxTQUFLLG9CQUFlLE1BQU07QUFDekIsWUFBTSxnQkFBZ0IsV0FBVyxNQUFTO0FBRTFDLGFBQU87QUFBQSxRQUNOLGNBQWMsa0JBQWtCLGFBQWE7QUFBQSxRQUM3QztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBRUQsU0FBSyxlQUFVLE1BQU07QUFDcEIsWUFBTSxnQkFBZ0IsV0FBVyxJQUFJO0FBRXJDLGFBQU87QUFBQSxRQUNOLGNBQWMsa0JBQWtCLGFBQWE7QUFBQSxRQUM3QztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBRUQsVUFBTSxpQkFBWSxNQUFNO0FBQ3ZC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
