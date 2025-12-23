type Part = string | number | null | undefined;

interface Options {
  delimiter: '/' | '-';
  leading?: boolean;
  trailing?: boolean;
}

export function createJoiner({
  delimiter,
  leading = false,
  trailing = false,
}: Readonly<Options>) {
  return (...parts: Part[]): string => {
    const result: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];

      if (p == null) continue;

      let s = String(p);
      s = s.trim();

      if (s.length === 0) continue;

      while (s.startsWith(delimiter)) s = s.slice(delimiter.length);
      while (s.endsWith(delimiter)) s = s.slice(0, -delimiter.length);

      if (s.length === 0) continue;

      result.push(s);
    }

    return `${leading ? delimiter : ''}${result.join(delimiter)}${
      trailing ? delimiter : ''
    }`;
  };
}

export const toSsmParameterName = createJoiner({
  delimiter: '/',
  leading: true,
});

export const toCfnExportName = createJoiner({ delimiter: '-' });
