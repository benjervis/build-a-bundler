import type { Module, ModuleGraph, ModuleId } from '../module-graph';

import { type ChunkId, Chunk } from './chunk';

export class ChunkGraph {
  private _moduleGraph: ModuleGraph;
  private _moduleIdToChunk = new Map<ModuleId, ChunkId>();

  public chunks = new Map<ChunkId, Chunk>();

  constructor(moduleGraph: ModuleGraph) {
    this._moduleGraph = moduleGraph;
  }

  public output() {
    console.log(`${this.chunks.size} chunks in total`);
    for (const chunk of this.chunks.values()) {
      console.log('\n');
      console.log(chunk.toString());
    }
  }

  public generateChunks() {
    // Start with the known entrypoints from the module graph
    const moduleIds = new Set(this._moduleGraph.entryPoints);

    for (const moduleId of moduleIds) {
      const deps = this.assignModuleToChunk(moduleId);
      for (const dep of deps) {
        // Queue up modules for chunking as they are discovered
        moduleIds.add(dep);
      }
    }

    // Resolve all modules to their chunk Id
    for (const [moduleId, chunkId] of this._moduleIdToChunk) {
      this._moduleIdToChunk.set(moduleId, this.ensureChunkId(chunkId));
    }

    for (const chunk of this.chunks.values()) {
      chunk.updateExternals((ext) => this.ensureChunkId(ext));
    }

    return { chunks: this.chunks, moduleIdToChunk: this._moduleIdToChunk };
  }

  private assignModuleToChunk(moduleId: ModuleId) {
    // For every dependency of the module
    const dependencies = this._moduleGraph.getDependenciesFor(moduleId);

    const internals: Module[] = [];
    const externals: string[] = [];

    const chunkId = Chunk.createId(moduleId);
    // If this is a known entrypoint, set up a chunk for it
    if (
      this._moduleGraph.entryPoints.has(moduleId) &&
      !this.chunks.has(chunkId)
    ) {
      const module = this._moduleGraph.getModule(moduleId);
      if (!module) {
        throw new Error(`Unable to locate entrypoint ${moduleId}`);
      }

      const newChunk = new Chunk(module);

      this.chunks.set(chunkId, newChunk);
      this.registerModuleIdToChunk(moduleId, chunkId);
    }

    for (const { module: dependency, isExternal } of dependencies) {
      // Register packages as external
      if (typeof dependency === 'string') {
        externals.push(dependency);
        continue;
      }

      // Entrypoints and external deps will be imported by the chunk, nothing more to do
      if (
        dependency.isEntry ||
        isExternal ||
        // If this dependency has already been allocated to a chunk, it's external to this one
        this._moduleIdToChunk.has(dependency.id)
      ) {
        externals.push(dependency.id);
        continue;
      }

      // A dependency that is imported in multiple places needs its own chunk
      if (dependency.dependents.length > 1) {
        const newChunk = new Chunk(dependency);

        if (!this.chunks.has(newChunk.id)) {
          this.chunks.set(newChunk.id, newChunk);
        }

        this.registerModuleIdToChunk(dependency.id, newChunk.id);
        externals.push(dependency.id);
        continue;
      }

      // Otherwise it can be fully contained within this chunk
      internals.push(dependency);
      this.registerModuleIdToChunk(dependency.id, this.ensureChunkId(moduleId));
    }

    const updatedChunkId = this.ensureChunkId(moduleId);
    // If we needed a chunk for this, there would be one by now
    this.chunks
      .get(updatedChunkId)
      ?.addInternalsAndExternals({ internals, externals });

    // Return the dependency Ids so they can be queued
    return dependencies.flatMap(({ module }) =>
      // External modules, with only a string identifier, do not need to be queued
      typeof module === 'string' ? [] : module.id,
    );
  }

  private registerModuleIdToChunk(moduleId: ModuleId, chunkId: ChunkId) {
    if (!this._moduleIdToChunk.has(moduleId)) {
      this._moduleIdToChunk.set(moduleId, chunkId);
    }
  }

  private ensureChunkId(moduleId: ModuleId): string {
    if (Chunk.isChunkId(moduleId)) {
      return moduleId;
    }

    const chunkId = this._moduleIdToChunk.get(moduleId);

    // This is probably a package specifier
    if (!chunkId) {
      return moduleId;
    }

    if (!Chunk.isChunkId(chunkId)) {
      return this.ensureChunkId(chunkId);
    }

    return chunkId;
  }
}
