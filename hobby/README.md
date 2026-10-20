# Vercel Hobby fork

This fork runs Inbox Zero on the Vercel Hobby plan. Only two things are
different from upstream:

- this folder (`hobby/`)
- `apps/web/vercel.json`: no `crons`, no `functions`, and the install command
  is `node ../../hobby/install.mjs`

## Files

- `install.mjs`: the Vercel install command. It removes the `maxDuration`
  exports (Hobby allows 12 functions), turns off Vercel Queues dispatch,
  lowers the build memory, and copies `privacy.html` into `apps/web/public`.
  Then it runs the upstream install command. It does not commit these
  changes. The changes must come before the install: if `package.json`
  changes after it, pnpm installs again before each package build, and those
  parallel installs fail.
- `upstream-install-command.txt`: the upstream install command.
- `vercel-json.mjs`: makes the `apps/web/vercel.json` changes, saves
  `upstream-install-command.txt`, and lists the upstream cron jobs that it
  removes. Vercel rejects commands over 256 characters, so it checks that.
- `reapply.sh`: puts the Hobby changes back on top of `origin/main`, pushes,
  and updates the `hobby` branch.
- `backup.sh`: saves this folder to the `hobby` branch. `reapply.sh` reads
  that branch. Run it again after you change a file in this folder.
- `privacy.html`: the privacy policy page for Google OAuth.

## Update from upstream

1. On the fork's GitHub page, click **Sync fork**.
2. If you see **Update branch**, click it. Vercel deploys the new version.
3. If GitHub reports a conflict, click **Discard commits**. Then run this in
   a Codespace:

   ```
   git fetch origin hobby && bash <(git show origin/hobby:hobby/reapply.sh)
   ```

4. If the Vercel build fails with `[hobby] ERROR`, run the same command.

If a deployment fails, the previous version stays live.

## Scheduled jobs

cron-job.org calls the cron routes. `reapply.sh` lists the upstream cron
jobs. If the list has a new route, add a job for it on cron-job.org.
