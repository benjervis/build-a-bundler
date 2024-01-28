import * as path from "node:path";
import * as crypto from "node:crypto";

import { Module, ModuleGraph, ModuleId } from "./module-graph";

const getModuleGraph = async (entryIds: string[]) => {
  const moduleGraph = new ModuleGraph();

  for (const entryId of entryIds) {
    await moduleGraph.loadEntry(entryId);
  }

  return moduleGraph;
};

const createChunkId = (str: string) => {
  const chunkHash = crypto
    .createHash("sha256")
    .update(str)
    .digest("hex")
    .slice(12);

  return `chunk:${chunkHash}`;
};

type ChunkId = string;

interface Chunk {
  id: ChunkId;
  internals: Module[];
  externals: string[];
}

const generateChunks = (graph: ModuleGraph) => {
  const chunks = new Map<string, Chunk>();
  const moduleIdToChunk = new Map<ModuleId, ChunkId>();

  const getChunkIdForModuleId = (moduleId: ModuleId) => {
    if (moduleId.startsWith("chunk:")) {
      return moduleId;
    }

    const chunkId = moduleIdToChunk.get(moduleId);

    if (!chunkId) {
      throw new Error(`Module ${moduleId} does not exist`);
    }

    if (!chunkId.startsWith("chunk:")) {
      return getChunkIdForModuleId(chunkId);
    }

    return chunkId;
  };

  const moduleIds = new Set(graph.entryPoints);

  for (const moduleId of moduleIds) {
    const dependencies = graph.getDependenciesFor(moduleId);

    const internals: Module[] = [];
    const externals: string[] = [];

    for (const { module: dependency, isExternal } of dependencies) {
      moduleIds.add(dependency.id);

      if (dependency.isEntry || isExternal) {
        // This will be imported by the chunk, nothing more to do
        externals.push(dependency.id);
        continue;
      }

      if (dependency.dependents.length > 1) {
        // This is a new chunk
        const newChunkId = createChunkId(dependency.id);

        if (!chunks.has(newChunkId)) {
          chunks.set(newChunkId, {
            id: newChunkId,
            internals: [dependency],
            externals: [],
          });
        }

        moduleIdToChunk.set(dependency.id, newChunkId);
        externals.push(dependency.id);
        continue;
      }

      // Otherwise it can be fully contained within this chunk
      internals.push(dependency);
      moduleIdToChunk.set(dependency.id, moduleId);
    }

    const chunkId = createChunkId(moduleId);
    // If this is a known entrypoint, set up a chunk for it
    if (graph.entryPoints.has(moduleId)) {
      // If a chunk hasn't been allocated for this entry, create one
      if (!chunks.has(chunkId)) {
        chunks.set(chunkId, {
          id: chunkId,
          internals: [graph.getModule(moduleId)!, ...internals],
          externals,
        });
        moduleIdToChunk.set(moduleId, chunkId);
      }
    }

    const existingChunk = chunks.get(chunkId);

    // If we needed a chunk for this, there would be one by now
    if (!existingChunk) {
      continue;
    }

    const chunk = {
      id: existingChunk.id,
      internals: [...existingChunk.internals, ...internals],
      externals: [...existingChunk.externals, ...externals],
    };

    chunks.set(chunkId, chunk);
  }

  // Resolve all modules to their chunk Id
  for (const [moduleId, chunkId] of moduleIdToChunk) {
    moduleIdToChunk.set(moduleId, getChunkIdForModuleId(chunkId));
  }

  return chunks;
};

export const bundle = async () => {
  const entryPaths = ["src/index.js", "src/second-entry.js"];

  const cwd = process.cwd();

  const entries = entryPaths.map((entryPath) => path.join(cwd, entryPath));

  const moduleGraph = await getModuleGraph(entries);

  const chunks = generateChunks(moduleGraph);

  console.log("Chunks:", chunks);
};

bundle();
