import { diff } from './diff';
import { describe, it, expect } from 'vitest';

describe("diff", () => {
  it("should detect added and removed keys", () => {
    const prev = { a: 1, b: { c: 2 } };
    const next = { a: 1, b: { c: 2, d: 3 }, e: 4 };

    const result = diff(prev, next);
    expect(result.added).toEqual([['b', 'd'], ['e']]);
    expect(result.removed).toEqual([]);
  });

  it("ケース1", () => {
    const ja = {
      "title": "こんにちは",
      "description": "これはテストのために日本語で書かれたファイルです"
    }

    const en = {};

    const result = diff(en, ja);
    expect(result.added).toEqual([['title'], ['description']]);
  });
});

