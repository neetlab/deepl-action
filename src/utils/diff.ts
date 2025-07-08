export type Accessor = string[];

const isObject = (value: any): value is Record<string, any> => {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export type DeepDiff = {
  added: Accessor[];
  removed: Accessor[];
}

const createDeepDiff = (prev: Record<string, any>, next: Record<string, any>, path: string[] = []): DeepDiff => {
  const diff: DeepDiff = { added: [], removed: [] };
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);

  for (const key of nextKeys) {
    if (!prevKeys.includes(key)) {
      diff.added.push([...path, key]);
    }

    if (isObject(prev[key]) && isObject(next[key])) {
      const nestedDiff = createDeepDiff(prev[key], next[key], [...path, key]);
      diff.added.push(...nestedDiff.added);
      diff.removed.push(...nestedDiff.removed);
    }
  }

  for (const key of prevKeys) {
    if (!nextKeys.includes(key)) {
      diff.removed.push([...path, key]);
    }
  }

  return diff;
}

export const diff = createDeepDiff;
