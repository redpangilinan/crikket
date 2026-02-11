import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    action: {
      default_title: "Crikket",
      default_popup: "popup.html",
    },
    commands: {
      "start-video-recording": {
        description: "Start video recording",
        suggested_key: {
          default: "Alt+Shift+R",
          mac: "Alt+Shift+R",
        },
      },
      "start-screenshot-capture": {
        description: "Start screenshot capture",
        suggested_key: {
          default: "Alt+Shift+C",
          mac: "Alt+Shift+C",
        },
      },
      "stop-video-recording": {
        description: "Stop video recording",
        suggested_key: {
          default: "Alt+Shift+S",
          mac: "Alt+Shift+S",
        },
      },
    },
    permissions: ["activeTab", "scripting", "storage", "tabCapture", "tabs"],
    host_permissions: ["<all_urls>"],
  },
})
