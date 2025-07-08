
export const getIn = (obj: unknown, path: (string | number)[]): unknown => {
  if (!obj || !path || path.length === 0) {
    return undefined;
  }

  let current: any = obj;

  for (const key of path) {
    if (current && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
}


export const setIn = (obj: any, path: (string | number)[], value: any): any => {
  if (!obj || !path || path.length === 0) {
    return obj;
  }

  let current: any = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }

  current[path[path.length - 1]] = value;

  return obj;
}
