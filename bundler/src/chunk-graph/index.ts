import { Module } from "../module-graph";

type ChunkId = string;

export class Chunk {
  private id: ChunkId;
  private internals: Module[];
  private externals: Module[];

  constructor(id: ChunkId, internals: Module[], externals: Module[]) {
    this.id = id;
    this.internals = internals;
    this.externals = externals;
  }

  public getId() {
    return this.id;
  }

  public addToChunk(module: Module) {
    this.internals.push(module);
    if (module.dependencies) {
    }
  }
}

export class ChunkGraph {
  private chunks: Map<ChunkId, Chunk> = new Map();
}
