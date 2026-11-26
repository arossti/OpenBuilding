// andy-rnd's three Reference specs, run against objectivepro.html (see ../README.md).
const { defineConfig, devices } = require("@playwright/test");
module.exports = defineConfig({
  testDir: ".",
  testMatch: "*.spec.cjs",
  timeout: 120000,
  workers: 2,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:8831" },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
});
