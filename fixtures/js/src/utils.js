import { extraFn } from './util-extras.js';

export function concat(a, b) {
  console.log(extraFn());
  return [a, b].join(' ');
}
