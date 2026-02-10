import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    action: {
      default_title: "Crikket",
      default_popup: "popup.html",
    },
    permissions: [
      "activeTab",
      "scripting",
      "storage",
      "tabCapture",
      "tabs",
      "webRequest",
    ],
    host_permissions: ["<all_urls>"],
  },
})
