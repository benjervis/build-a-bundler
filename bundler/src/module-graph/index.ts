import fs from "fs/promises";
import parseImports from "parse-imports";
import path from "node:path";

export type ModuleId = string;

interface Dependency {
  id: ModuleId;
  isExternal: boolean;
}

export interface Module {
  id: ModuleId;
  isEntry: boolean;
  // isExternal: boolean;
  code: string;
  dependencies: Dependency[];
  dependents: ModuleId[];
}

type ImportItem = [string, string | null];

export class ModuleGraph {
  private graph: Map<ModuleId, Module>;
  private readonly _entryPoints: Set<ModuleId>;

  constructor() {
    this.graph = new Map();
    this._entryPoints = new Set();
  }

  public get entryPoints() {
    return this._entryPoints;
  }

  getDependenciesFor(
    id: ModuleId
  ): Array<{ module: Module; isExternal: boolean }> {
    const module = this.graph.get(id);

    if (!module) {
      throw new Error(`Module ${id} does not exist`);
    }

    const modules: Array<{ module: Module; isExternal: boolean }> = [];

    for (const { id: dependencyId, isExternal } of module.dependencies) {
      const dependency = this.getModule(dependencyId);
      if (dependency) {
        modules.push({ module: dependency, isExternal });
      }
    }

    return modules;
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

  async parseModuleIntoImports(
    id: string,
    source: string | null,
    isEntry: boolean
  ) {
    const dependencies: Dependency[] = [];
    const imports: ImportItem[] = [];

    const relativeId = path.relative("", id);

    if (isEntry) {
      this._entryPoints.add(relativeId);
    }

    const rawCode = await fs.readFile(relativeId, "utf-8");
    const moduleImports = await parseImports(rawCode, { resolveFrom: id });

    for (const dep of moduleImports) {
      const resolvedDepId = dep.moduleSpecifier.resolved;

      if (!resolvedDepId) {
        throw new Error(
          `Failed to resolve module ${dep.moduleSpecifier.value}`
        );
      }

      const depId = path.relative("", resolvedDepId);

      if (dep.isDynamicImport) {
        this.entryPoints.add(depId);
      }

      const isExternal =
        dep.isDynamicImport || dep.moduleSpecifier.type === "package";

      dependencies.push({ id: depId, isExternal });

      // If this is an external dependency, we don't need to continue exploring it
      if (!isExternal) {
        imports.push([depId, relativeId]);
      }
    }

    this.addModule(relativeId, {
      id: relativeId,
      isEntry,
      code: rawCode,
      dependencies,
      // Only an entry won't have a source
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

      const newImports = await this.parseModuleIntoImports(
        id,
        source,
        entryId === id
      );

      imports.push(...newImports);
    }
  }
}
