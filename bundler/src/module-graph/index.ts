import fs from "fs/promises";
import parseImports from "parse-imports";

type ModuleID = string;

interface Module {
  id: ModuleID;
  isEntry: boolean;
  code: string;
  dependencies: ModuleID[];
  dependents: ModuleID[];
}

type ImportItem = [string, string | null];

export class ModuleGraph {
  private graph: Map<ModuleID, Module>;
  private readonly _entryPoints: Set<ModuleID>;

  constructor() {
    this.graph = new Map();
    this._entryPoints = new Set();
  }

  public get entryPoints() {
    return this._entryPoints;
  }

  getModule(id: string) {
    return this.graph.get(id);
  }

  addModule(id: string, module: Module) {
    this.graph.set(id, module);
  }

  addDependentToModule(id: string, dependent: string) {
    const mod = this.graph.get(id);

    if (!mod) {
      throw new Error(`Module ${id} does not exist`);
    }

    mod.dependents.push(dependent);
    this.graph.set(id, mod);
  }

  async parseModule(id: string, source: string | null, isEntry: boolean) {
    const dependencies: string[] = [];
    const imports: [string, string][] = [];

    if (isEntry) {
      this._entryPoints.add(id);
    }

    const rawCode = await fs.readFile(id, "utf-8");
    const moduleImports = await parseImports(rawCode, { resolveFrom: id });

    for (const dep of moduleImports) {
      const depId = dep.moduleSpecifier.resolved;

      if (!depId) {
        throw new Error(
          `Failed to resolve module ${dep.moduleSpecifier.value}`
        );
      }

      if (dep.isDynamicImport) {
        this.entryPoints.add(depId);
      }

      dependencies.push(depId);
      imports.push([depId, id]);
    }

    this.addModule(id, {
      id,
      isEntry,
      code: rawCode,
      dependencies,
      // Only the entry won't have a source
      dependents: source ? [source] : [],
    });

    return imports;
  }

  async loadEntry(entryId: string) {
    const imports: ImportItem[] = [[entryId, null]];

    for (const [id, source] of imports) {
      const existingModule = this.getModule(id);

      if (existingModule) {
        if (source) {
          this.addDependentToModule(id, source);
        }
        continue;
      }

      const newImports = await this.parseModule(id, source, entryId === id);

      imports.push(...newImports);
    }
  }
}
