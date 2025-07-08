import { expect, test } from "vitest";
import { getIn } from "./get_in";

test("getIn should return undefined for empty path", () => {
  const obj = { a: { b: { c: 1 } } };
  const result = getIn(obj, []);
  expect(result).toBeUndefined();
});

test("getIn should return undefined for non-existent path", () => {
  const obj = { a: { b: { c: 1 } } };
  const result = getIn(obj, ["a", "b", "d"]);
  expect(result).toBeUndefined();
});

test("getIn should return the correct value for existing path", () => {
  const obj = { a: { b: { c: 1 } } };
  const result = getIn(obj, ["a", "b", "c"]);
  expect(result).toBe(1);
});
