// MDXProvider component map — what authors can write in `.mdx` files without
// imports. One source of truth for "author-callable widgets"; mirrors the
// public API of `./index.ts`. Add a new author-callable widget by exporting
// it here (and from `./index.ts`).

import {
  Checklist,
  DataTable,
  FreeTextResponse,
  KeyEquation,
  Quiz,
  ResetButton,
  RevealWhen,
  RubricResponse,
  VariableTable,
} from '.';

export const mdxComponents = {
  Checklist,
  DataTable,
  FreeTextResponse,
  KeyEquation,
  Quiz,
  ResetButton,
  RevealWhen,
  RubricResponse,
  VariableTable,
};
