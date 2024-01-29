import * as path from 'node:path';

import { ModuleGraph } from './module-graph';
import { ChunkGraph } from './chunk-graph';

const getModuleGraph = async (entryIds: string[]) => {
  const moduleGraph = new ModuleGraph();

  for (const entryId of entryIds) {
    await moduleGraph.loadEntry(entryId);
  }

  return moduleGraph;
};

export const bundle = async () => {
  const entryPaths = ['src/index.js', 'src/second-entry.js'];

  const cwd = process.cwd();

  const entries = entryPaths.map((entryPath) => path.join(cwd, entryPath));

  const moduleGraph = await getModuleGraph(entries);

  const chunkGraph = new ChunkGraph(moduleGraph);
  chunkGraph.generateChunks();

  const chunks = chunkGraph.output();

  console.log(chunks);
};

bundle();
