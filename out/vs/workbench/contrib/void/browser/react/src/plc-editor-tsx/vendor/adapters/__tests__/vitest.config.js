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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L3ZlbmRvci9hZGFwdGVycy9fX3Rlc3RzX18vdml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZXN0L2NvbmZpZyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnLi4veG1sVXRpbHMuanMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4veG1sVXRpbHMudHMnKSxcbiAgICAgICcuLi9kYXRhVHlwZU1hcC5qcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9kYXRhVHlwZU1hcC50cycpLFxuICAgICAgJy4uL3ZhcmlhYmxlVHlwZVJlc29sdmVyLmpzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3ZhcmlhYmxlVHlwZVJlc29sdmVyLnRzJyksXG4gICAgICAnLi4vcGluU2lnbmF0dXJlcy5qcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9waW5TaWduYXR1cmVzLnRzJyksXG4gICAgICAnLi4vdHlwZXMuanMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vdHlwZXMudHMnKSxcbiAgICAgICcuLi8uLi9sb2dpY1N0b3JlLmpzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uLy4uL2xvZ2ljU3RvcmUudHMnKSxcbiAgICB9LFxuICB9LFxuICB0ZXN0OiB7XG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICByZXBvcnRlcnM6IFsndmVyYm9zZSddLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFBQSxTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFVBQVU7QUFFakIsSUFBTyx3QkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsa0JBQWtCLEtBQUssUUFBUSxXQUFXLG1CQUFtQjtBQUFBLE1BQzdELHFCQUFxQixLQUFLLFFBQVEsV0FBVyxzQkFBc0I7QUFBQSxNQUNuRSw4QkFBOEIsS0FBSyxRQUFRLFdBQVcsK0JBQStCO0FBQUEsTUFDckYsdUJBQXVCLEtBQUssUUFBUSxXQUFXLHdCQUF3QjtBQUFBLE1BQ3ZFLGVBQWUsS0FBSyxRQUFRLFdBQVcsZ0JBQWdCO0FBQUEsTUFDdkQsdUJBQXVCLEtBQUssUUFBUSxXQUFXLHdCQUF3QjtBQUFBLElBQ3pFO0FBQUEsRUFDRjtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osU0FBUztBQUFBLElBQ1QsV0FBVyxDQUFDLFNBQVM7QUFBQSxFQUN2QjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
