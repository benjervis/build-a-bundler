import { expect, it } from 'vitest';
import { transform } from '@babel/core';
import { merge } from '.';

const parentCode = `
  import { secondVar } from "./second.js";

  const firstVar = 'first';
  const thirdVar = firstVar + secondVar;
`.trim();

const dependencyCode = `
  export const secondVar = 'second';
`.trim();

it('should merge two simple files', () => {
  const result = transform(parentCode, {
    plugins: [merge, { path: './second.js', code: dependencyCode }],
  });

  expect(result).toBeTruthy();

  expect(result?.code).toMatchInlineSnapshot(`
    const secondVar = 'second';
    const firstVar = 'first';
    const thirdVar = firstVar + secondVar;
  `);
});
