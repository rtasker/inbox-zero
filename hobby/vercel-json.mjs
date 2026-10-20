// Vercel Hobby fork: changes apps/web/vercel.json for the Hobby plan.
// - Removes "crons": Hobby allows only daily cron jobs. cron-job.org calls
//   the cron routes instead.
// - Removes "functions": the Vercel Queues triggers are not used.
// - Replaces the install command with hobby/install.mjs, and saves the
//   upstream install command in hobby/upstream-install-command.txt.
// The script makes no change if the file is already correct.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "apps/web/vercel.json");
const config = JSON.parse(readFileSync(file, "utf8"));

if (config.crons?.length) {
  console.log("[hobby] Upstream cron jobs (cron-job.org must call these):");
  for (const cron of config.crons) {
    console.log(`[hobby]   ${cron.schedule.padEnd(14)} ${cron.path}`);
  }
}

delete config.crons;
delete config.functions;

const installCommand = "node ../../hobby/install.mjs";
if (config.installCommand !== installCommand) {
  if (!config.installCommand) {
    throw new Error("apps/web/vercel.json has no installCommand.");
  }
  writeFileSync(
    path.join(root, "hobby/upstream-install-command.txt"),
    `${config.installCommand}\n`,
  );
  config.installCommand = installCommand;
}

// Vercel rejects longer commands when it creates the deployment.
for (const key of ["buildCommand", "installCommand", "ignoreCommand"]) {
  if (config[key] && config[key].length > 256) {
    throw new Error(`${key} in apps/web/vercel.json is over 256 characters.`);
  }
}

writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log("[hobby] apps/web/vercel.json is ready for the Hobby plan.");
