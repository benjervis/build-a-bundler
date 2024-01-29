import type * as Babel from '@babel/core';

interface PluginState {
  opts: { path: string; code: string };
}

export const merge = (input: typeof Babel): Babel.PluginObj<PluginState> => ({
  visitor: {
    ExportDeclaration(path, state) {},
  },
});
