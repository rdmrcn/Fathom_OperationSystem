import mssql from "mssql";

/**
 * A composable, parameterised T-SQL fragment. Interpolated values become
 * `@pN` parameters; nested fragments are spliced in verbatim so queries can be
 * built from safe pieces without ever concatenating user input.
 */
export class SqlFragment {
  constructor(
    readonly strings: readonly string[],
    readonly values: readonly unknown[],
  ) {}

  /** Flattens nested fragments into one text/params pair. */
  compile(startIndex = 0): { text: string; params: unknown[] } {
    let text = "";
    const params: unknown[] = [];
    let index = startIndex;
    for (let i = 0; i < this.strings.length; i++) {
      text += this.strings[i];
      if (i >= this.values.length) continue;
      const value = this.values[i];
      if (value instanceof SqlFragment) {
        const nested = value.compile(index);
        text += nested.text;
        params.push(...nested.params);
        index += nested.params.length;
      } else if (value instanceof RawSql) {
        text += value.text;
      } else {
        text += `@p${index}`;
        params.push(value);
        index += 1;
      }
    }
    return { text, params };
  }
}

/** Trusted SQL text (identifiers, keywords) that must never contain user input. */
export class RawSql {
  constructor(readonly text: string) {}
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlFragment {
  return new SqlFragment(strings, values);
}

export function raw(text: string): RawSql {
  return new RawSql(text);
}

/** Joins fragments with a separator, e.g. `join(conditions, " AND ")`. */
export function join(fragments: SqlFragment[], separator = ", "): SqlFragment {
  if (fragments.length === 0) return sql``;
  const strings: string[] = [""];
  const values: unknown[] = [];
  fragments.forEach((fragment, i) => {
    values.push(fragment);
    strings.push(i === fragments.length - 1 ? "" : separator);
  });
  return new SqlFragment(strings, values);
}

export const empty = sql``;

/** Picks an mssql type for a JS value so parameters are typed correctly. */
export function inferType(value: unknown): mssql.ISqlType | (() => mssql.ISqlType) {
  if (value === null || value === undefined) return mssql.NVarChar(mssql.MAX);
  switch (typeof value) {
    case "number":
      if (Number.isInteger(value)) return Math.abs(value) < 2_147_483_647 ? mssql.Int : mssql.BigInt;
      return mssql.Float;
    case "boolean":
      return mssql.Bit;
    case "bigint":
      return mssql.BigInt;
    case "string":
      return mssql.NVarChar(mssql.MAX);
    default:
      if (value instanceof Date) return mssql.DateTime2;
      if (Buffer.isBuffer(value)) return mssql.VarBinary(mssql.MAX);
      return mssql.NVarChar(mssql.MAX);
  }
}

export function bindParams(request: mssql.Request, params: unknown[]): void {
  params.forEach((value, i) => {
    request.input(`p${i}`, inferType(value), value === undefined ? null : value);
  });
}
