import { COUNTRY, NAME } from './constants.js';

export function myFunction() {
  return 'this is my function';
}

export function secondaryFunction() {
  return {
    name: NAME,
    id: 123,
  };
}

export async function anotherFunction() {
  const { concat } = await import('./utils.js');
  return concat(NAME, COUNTRY);
}
