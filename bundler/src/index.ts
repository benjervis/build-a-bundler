import * as path from "path";

import { ModuleGraph } from "./module-graph";
// import { transform as sucraseTransform, type Transform } from "sucrase";

const getModuleGraph = async (entryIds: string[]) => {
  const moduleGraph = new ModuleGraph();

  for (const entryId of entryIds) {
    await moduleGraph.loadEntry(entryId);
  }

  return moduleGraph;
};

export const bundle = async () => {
  const entryPaths = ["src/index.js", "src/second-entry.js"];

  const cwd = process.cwd();

  const entries = entryPaths.map((entryPath) => path.join(cwd, entryPath));

  const moduleGraph = await getModuleGraph(entries);

  console.log("moduleGraph: ", moduleGraph);
};

bundle();
