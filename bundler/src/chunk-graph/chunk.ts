import crypto from 'node:crypto';

import type { Module } from '../module-graph';

export type ChunkId = string;

const chunkPrefix = 'chunk_';

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

  public get id() {
    return this._id;
  }

  public get internals() {
    return this._internals;
  }

  public get externals() {
    return this._externals;
  }

  public static isChunkId(str: string) {
    return str.indexOf(chunkPrefix) === 0;
  }

  public static createId(str: string) {
    const chunkHash = crypto
      .createHash('sha256')
      .update(str)
      .digest('hex')
      .slice(0, 6);

    return `${chunkPrefix}${chunkHash}`;
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
      ext: SetType<typeof this._externals>,
    ) => SetType<typeof this._externals>,
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
      : 'none'
  }
  Externals: ${this._externals.size > 0 ? Array.from(this._externals) : 'none'}
`.trim();
  }
}
