import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["activeTab", "desktopCapture"],
    host_permissions: ["<all_urls>"],
  },
})
