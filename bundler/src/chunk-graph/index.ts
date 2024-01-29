import { Module, ModuleGraph, ModuleId } from "../module-graph";
import crypto from "node:crypto";

type ChunkId = string;

const chunkPrefix = "chunk_";

type SetType<T> = T extends Set<infer U> ? U : never;

export class Chunk {
  private _id: ChunkId;
  private _internals: Set<Module>;
  private _externals: Set<string>;

  constructor(module: Module);
  constructor(id: ChunkId, internals: Set<Module>, externals: Set<string>);
  constructor(...args: [Module] | [ChunkId, Set<Module>, Set<string>]) {
    if (args.length === 1) {
      const [module] = args;
      this._id = Chunk.createId(module.id);
      this._internals = new Set([module]);
      this._externals = new Set();
      return;
    }

    const [id, internals, externals] = args;
    this._id = id;
    this._internals = internals;
    this._externals = externals;
  }

  public static isChunkId(str: string) {
    return str.indexOf(chunkPrefix) === 0;
  }

  public static createId(str: string) {
    const chunkHash = crypto
      .createHash("sha256")
      .update(str)
      .digest("hex")
      .slice(0, 6);

    return `${chunkPrefix}${chunkHash}`;
  }

  public get id() {
    return this._id;
  }

  public addInternalsAndExternals({
    internals,
    externals,
  }: {
    internals?: Module[];
    externals?: string[];
  }) {
    for (const int of internals ?? []) {
      this._internals.add(int);
    }

    for (const ext of externals ?? []) {
      this._externals.add(ext);
    }

    // Return itself for nice chaining
    return this;
  }

  public updateExternals(
    fn: (
      ext: SetType<typeof this._externals>
    ) => SetType<typeof this._externals>
  ) {
    const externals = Array.from(this._externals.values());
    this._externals.clear();

    for (const ext of externals) {
      this._externals.add(fn(ext));
    }
  }

  public toString() {
    return `
  Chunk: ${this.id}
  Internals: ${
    this._internals.size > 0
      ? Array.from(this._internals).map((i) => i.id)
      : "none"
  }
  Externals: ${this._externals.size > 0 ? Array.from(this._externals) : "none"}
`.trim();
  }
}

export class ChunkGraph {
  private moduleGraph: ModuleGraph;
  private chunks: Map<ChunkId, Chunk> = new Map();
  private moduleIdToChunk = new Map<ModuleId, ChunkId>();

  constructor(moduleGraph: ModuleGraph) {
    this.moduleGraph = moduleGraph;
  }

  public output() {
    console.log(`${this.chunks.size} chunks in total`);
    for (const chunk of this.chunks.values()) {
      console.log("\n");
      console.log(chunk.toString());
    }
  }

  public generateChunks() {
    // Start with the known entrypoints from the module graph
    const moduleIds = new Set(this.moduleGraph.entryPoints);

    for (const moduleId of moduleIds) {
      const deps = this.assignModuleToChunk(moduleId);
      for (const dep of deps) {
        // Queue up modules for chunking as they are discovered
        moduleIds.add(dep);
      }
    }

    // Resolve all modules to their chunk Id
    for (const [moduleId, chunkId] of this.moduleIdToChunk) {
      this.moduleIdToChunk.set(moduleId, this.ensureChunkId(chunkId));
    }

    for (const chunk of this.chunks.values()) {
      chunk.updateExternals((ext) => this.ensureChunkId(ext));
    }

    return { chunks: this.chunks, moduleIdToChunk: this.moduleIdToChunk };
  }

  private assignModuleToChunk(moduleId: ModuleId) {
    // For every dependency of the module
    const dependencies = this.moduleGraph.getDependenciesFor(moduleId);

    const internals: Module[] = [];
    const externals: string[] = [];

    const chunkId = Chunk.createId(moduleId);
    // If this is a known entrypoint, set up a chunk for it
    if (
      this.moduleGraph.entryPoints.has(moduleId) &&
      !this.chunks.has(chunkId)
    ) {
      const module = this.moduleGraph.getModule(moduleId);
      if (!module) {
        throw new Error(`Unable to locate entrypoint ${moduleId}`);
      }

      const newChunk = new Chunk(module);

      this.chunks.set(chunkId, newChunk);
      this.registerModuleIdToChunk(moduleId, chunkId);
    }

    for (const { module: dependency, isExternal } of dependencies) {
      // Register packages as external
      if (typeof dependency === "string") {
        externals.push(dependency);
        continue;
      }

      // Entrypoints and external deps will be imported by the chunk, nothing more to do
      if (
        dependency.isEntry ||
        isExternal ||
        // If this dependency has already been allocated to a chunk, it's external to this one
        this.moduleIdToChunk.has(dependency.id)
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
      typeof module === "string" ? [] : module.id
    );
  }

  private registerModuleIdToChunk(moduleId: ModuleId, chunkId: ChunkId) {
    if (!this.moduleIdToChunk.has(moduleId)) {
      this.moduleIdToChunk.set(moduleId, chunkId);
    }
  }

  private ensureChunkId(moduleId: ModuleId): string {
    if (Chunk.isChunkId(moduleId)) {
      return moduleId;
    }

    const chunkId = this.moduleIdToChunk.get(moduleId);

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
