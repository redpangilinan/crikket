/**
 * Runs every test file in its own `bun test` process.
 *
 * Bun's `mock.module` replaces modules globally for the whole process, so
 * running all suites together lets one file's mocks leak into another.
 * Isolating each file keeps suites independent.
 */
import { Glob, spawnSync } from "bun"

const TEST_GLOB = "{apps,packages,sdks}/*/test/**/*.test.{ts,tsx}"

const files = Array.from(
  new Glob(TEST_GLOB).scanSync({ cwd: process.cwd() })
).sort()

if (files.length === 0) {
  console.log("No test files found.")
  process.exit(0)
}

const failedFiles: string[] = []

for (const file of files) {
  const proc = spawnSync(["bun", "test", `./${file}`], {
    stdout: "inherit",
    stderr: "inherit",
  })

  if (proc.exitCode !== 0) {
    failedFiles.push(file)
  }
}

console.log(
  `\n${files.length - failedFiles.length}/${files.length} test files passed.`
)

if (failedFiles.length > 0) {
  console.error("Failed test files:")
  for (const file of failedFiles) {
    console.error(`  - ${file}`)
  }
  process.exit(1)
}
