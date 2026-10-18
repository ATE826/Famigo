import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const git = (args, cwd) =>
  execFileSync("git", ["-c", "core.autocrlf=false", "-c", "core.safecrlf=false", ...args], { cwd, stdio: "inherit" });

const remote = execFileSync("git", ["remote", "get-url", "origin"]).toString().trim();
const dir = mkdtempSync(join(tmpdir(), "famigo-deploy-"));

try {
  cpSync("dist", dir, { recursive: true });
  writeFileSync(join(dir, ".nojekyll"), "");
  git(["init", "-q", "-b", "gh-pages"], dir);
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "Deploy"], dir);
  git(["push", "-f", remote, "gh-pages"], dir);
  console.log("Published to gh-pages");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
