import { defineConfig } from "vitest/config";
import path from "path";
var vitest_config_default = defineConfig({
  resolve: {
    alias: {
      "../xmlUtils.js": path.resolve(__dirname, "../../xmlUtils.ts"),
      "../dataTypeMap.js": path.resolve(__dirname, "../../dataTypeMap.ts"),
      "../variableTypeResolver.js": path.resolve(__dirname, "../../variableTypeResolver.ts"),
      "../pinSignatures.js": path.resolve(__dirname, "../../pinSignatures.ts"),
      "../types.js": path.resolve(__dirname, "../../types.ts"),
      "../../logicStore.js": path.resolve(__dirname, "../../../logicStore.ts")
    }
  },
  test: {
    globals: true,
    reporters: ["verbose"]
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC92ZW5kb3IvYWRhcHRlcnMvX190ZXN0c19fL3ZpdGVzdC5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGVzdC9jb25maWcnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJy4uL3htbFV0aWxzLmpzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3htbFV0aWxzLnRzJyksXG4gICAgICAnLi4vZGF0YVR5cGVNYXAuanMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vZGF0YVR5cGVNYXAudHMnKSxcbiAgICAgICcuLi92YXJpYWJsZVR5cGVSZXNvbHZlci5qcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi92YXJpYWJsZVR5cGVSZXNvbHZlci50cycpLFxuICAgICAgJy4uL3BpblNpZ25hdHVyZXMuanMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vcGluU2lnbmF0dXJlcy50cycpLFxuICAgICAgJy4uL3R5cGVzLmpzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3R5cGVzLnRzJyksXG4gICAgICAnLi4vLi4vbG9naWNTdG9yZS5qcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi8uLi9sb2dpY1N0b3JlLnRzJyksXG4gICAgfSxcbiAgfSxcbiAgdGVzdDoge1xuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgcmVwb3J0ZXJzOiBbJ3ZlcmJvc2UnXSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBQUEsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxVQUFVO0FBRWpCLElBQU8sd0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLGtCQUFrQixLQUFLLFFBQVEsV0FBVyxtQkFBbUI7QUFBQSxNQUM3RCxxQkFBcUIsS0FBSyxRQUFRLFdBQVcsc0JBQXNCO0FBQUEsTUFDbkUsOEJBQThCLEtBQUssUUFBUSxXQUFXLCtCQUErQjtBQUFBLE1BQ3JGLHVCQUF1QixLQUFLLFFBQVEsV0FBVyx3QkFBd0I7QUFBQSxNQUN2RSxlQUFlLEtBQUssUUFBUSxXQUFXLGdCQUFnQjtBQUFBLE1BQ3ZELHVCQUF1QixLQUFLLFFBQVEsV0FBVyx3QkFBd0I7QUFBQSxJQUN6RTtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLFNBQVM7QUFBQSxJQUNULFdBQVcsQ0FBQyxTQUFTO0FBQUEsRUFDdkI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
