import Bun from "bun";

export const bundle = () => {
  const entryPath = "src/index.js";
  const cwd = process.cwd();

  const entry = Bun.resolveSync(entryPath, cwd);
  console.log("entry: ", entry);
};

bundle();
