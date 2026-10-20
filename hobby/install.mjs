// Vercel Hobby fork: the install command in apps/web/vercel.json. It changes
// the checkout so that it fits the Hobby plan, then runs the upstream install
// command. The changes are not committed, so the source files stay identical
// to upstream and syncing the fork does not conflict on them.
//
// The changes must come before the install: if package.json changes after
// it, pnpm installs again before each package build, and those parallel
// installs fail.
import { spawnSync } from "node:child_process";
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "apps/web");

function log(message) {
  console.log(`[hobby] ${message}`);
}

function fail(message) {
  console.error(`[hobby] ERROR: ${message}`);
  console.error("[hobby] Run hobby/reapply.sh (see hobby/README.md).");
  process.exit(1);
}

// Vercel reads vercel.json before the build starts, so this script can only
// check it. hobby/vercel-json.mjs is the script that changes it.
const vercelJson = JSON.parse(
  readFileSync(path.join(web, "vercel.json"), "utf8"),
);
for (const key of ["crons", "functions"]) {
  if (key in vercelJson) fail(`apps/web/vercel.json has "${key}".`);
}

// Hobby allows at most 12 functions per deployment. Vercel makes a separate
// function for each different maxDuration value, so remove them all. Every
// route then uses the project default (300 seconds with Fluid compute).
const maxDurationExport = /^export const maxDuration\s*=[^;]*;[^\n]*\n?/gm;
const anyMaxDurationExport =
  /export\s+(const|let|var)\s+maxDuration\b|export\s*\{[^}]*\bmaxDuration\b/;

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) return [];
    if (/\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) return [];
    return [fullPath];
  });
}

let removed = 0;
for (const file of sourceFiles(path.join(web, "app"))) {
  const source = readFileSync(file, "utf8");
  const updated = source.replace(maxDurationExport, () => {
    removed++;
    return "";
  });
  if (anyMaxDurationExport.test(updated)) {
    fail(`Unknown maxDuration export in ${path.relative(root, file)}.`);
  }
  if (updated !== source) writeFileSync(file, updated);
}
log(`Removed ${removed} maxDuration exports.`);

// vercel.json has no queue triggers, so nothing would consume Vercel Queues
// messages. Turn off Vercel Queues dispatch; QUEUE_BACKEND selects the backend.
const queueFile = path.join(web, "utils/queue/vercel.ts");
const queueSource = readFileSync(queueFile, "utf8");
const queueFunction =
  /(export function isVercelQueueDispatchEnabled\(\)[^{]*\{)[^}]*(\})/;
if (!queueFunction.test(queueSource)) {
  fail("isVercelQueueDispatchEnabled() is not in utils/queue/vercel.ts.");
}
writeFileSync(
  queueFile,
  queueSource.replace(queueFunction, "$1\n  return false;\n$2"),
);
log("Turned off Vercel Queues dispatch.");

// The Hobby build machine has 8 GB of memory. Upstream gives Node 16 GB.
const packageFile = path.join(web, "package.json");
const packageSource = readFileSync(packageFile, "utf8");
const memoryFlag = /max_old_space_size=\d+/g;
if (packageSource.includes("max_old_space_size=")) {
  writeFileSync(
    packageFile,
    packageSource.replace(memoryFlag, "max_old_space_size=6144"),
  );
  log("Set the Node build memory to 6 GB.");
} else {
  log("No max_old_space_size flag found. Build memory is not changed.");
}

// Google OAuth needs a privacy policy page. It lives in hobby/ so that only
// this folder and vercel.json differ from upstream.
copyFileSync(
  path.join(root, "hobby/privacy.html"),
  path.join(web, "public/privacy.html"),
);
log("Added public/privacy.html.");

// The first mail sync copies the whole mailbox from Gmail. Google Cloud
// projects made after 1 May 2026 get a much lower Gmail quota, so a large
// mailbox takes days, and send fails while the sync uses all of the quota.
// Sync only recent mail. Search still finds older mail on the server.
const firstSyncDays = 90;
const sourceFile = path.join(web, "utils/mail-api/source.ts");
let sourceCode = readFileSync(sourceFile, "utf8");
const syncLimitChanges = [
  [
    /afterMs: afterMs \?\? 0,/g,
    `afterMs: afterMs ?? Date.now() - ${firstSyncDays} * 86_400_000,`,
  ],
  [
    /(pageToken: token\.pageToken,)(\s*)(includeDrafts: true,)/g,
    "$1$2after: token.afterMs ? new Date(token.afterMs) : undefined,$2$3",
  ],
];
for (const [pattern, replacement] of syncLimitChanges) {
  if (sourceCode.match(pattern)?.length !== 1) {
    fail(`${pattern} is not in utils/mail-api/source.ts exactly once.`);
  }
  sourceCode = sourceCode.replace(pattern, replacement);
}
writeFileSync(sourceFile, sourceCode);
log(`Limited the first mail sync to the last ${firstSyncDays} days.`);

// hobby/vercel-json.mjs saves the upstream install command in this file.
const installCommand = readFileSync(
  path.join(root, "hobby/upstream-install-command.txt"),
  "utf8",
).trim();
log("Running the upstream install command.");
const result = spawnSync("bash", ["-c", installCommand], {
  cwd: web,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
