import { extraFn } from "./util-extras.js";

function concat(a, b) {
  console.log(extraFn());
  return [a, b].join(" ");
}
