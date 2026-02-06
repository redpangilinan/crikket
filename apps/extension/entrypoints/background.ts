export default defineBackground(() => {
  console.log("Crikket background script loaded", { id: browser.runtime.id })
})
