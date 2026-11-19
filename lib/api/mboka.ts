"use client";

// Typed access to the Mboka backend, generated from its OpenAPI spec.
//
//   const page = await mboka.get("/v1/transactions", { query: { limit: 20 } });
//   const tx   = await mboka.get("/v1/transactions/{transaction_id}", { path: { transaction_id: id } });
//   const q    = await mboka.post("/v1/orders/quote", { body, headers: { "Idempotency-Key": key } });
//
// Paths, params, bodies and the unwrapped `data` type all come from
// lib/api/generated/mboka.ts (`npm run api:gen`). Transport is unchanged: it
// delegates to `apiEnvelope` in lib/apiClient.ts, so every call still goes
// same-origin through the /api/mboka BFF proxy (httpOnly cookies, refresh on
// 401, request signing, allowlist) and gets the same envelope unwrapping and
// SessionExpiredError / ApiRequestError semantics.
//
// When an endpoint has no `response_model` on the backend, its data type is
// `unknown` — normalize it in lib/services (fail closed) instead of casting,
// and ask for a response_model upstream.

import { apiEnvelope, type RequestOptions } from "@/lib/apiClient";
import type { paths } from "./generated/mboka";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Operation<P extends keyof paths, M extends Method> = NonNullable<paths[P][M]>;

/** Paths that support method M. */
export type MbokaPath<M extends Method> = {
  [P in keyof paths]: [Operation<P, M>] extends [never] ? never : P;
}[keyof paths];

type JsonContent<R> = R extends { content: { "application/json": infer J } } ? J : never;
type SuccessBody<O> = O extends { responses: infer R }
  ? JsonContent<R[200 & keyof R]> | JsonContent<R[201 & keyof R]>
  : never;

/** The unwrapped `data` of a successful Mboka envelope for this endpoint. */
export type MbokaData<P extends keyof paths, M extends Method> =
  SuccessBody<Operation<P, M>> extends { data?: infer D } ? Exclude<D, undefined> : unknown;

type Params<O> = O extends { parameters: infer X } ? X : never;
type Defined<T> = [T] extends [undefined] ? never : Exclude<T, undefined>;
type PathParams<O> = Defined<Params<O> extends { path?: infer X } ? X : undefined>;
type QueryParams<O> = Defined<Params<O> extends { query?: infer X } ? X : undefined>;
// openapi-typescript marks body-less operations `requestBody?: never`; guard
// on never first, or `infer` would yield `unknown` and demand a body.
type JsonBody<O> = O extends { requestBody?: infer RB }
  ? [NonNullable<RB>] extends [never]
    ? never
    : NonNullable<RB> extends { content: { "application/json": infer B } }
      ? B
      : never
  : never;

/** Per-call options; each key is only accepted when the endpoint defines it. */
export type MbokaOptions<P extends keyof paths, M extends Method> = RequestOptions &
  ([PathParams<Operation<P, M>>] extends [never] ? { path?: never } : { path: PathParams<Operation<P, M>> }) &
  ([QueryParams<Operation<P, M>>] extends [never] ? { query?: never } : { query?: QueryParams<Operation<P, M>> }) &
  ([JsonBody<Operation<P, M>>] extends [never] ? { body?: never } : { body: JsonBody<Operation<P, M>> });

type Args<P extends keyof paths, M extends Method> =
  // Make the options argument optional only when nothing in it is required.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- `{} extends T` is the "all keys optional" test
  {} extends MbokaOptions<P, M> ? [options?: MbokaOptions<P, M>] : [options: MbokaOptions<P, M>];

/** Fill `{param}` placeholders and append the query string. Exported for tests. */
export function buildMbokaUrl(
  template: string,
  path?: Record<string, unknown>,
  query?: Record<string, unknown>,
): string {
  const url = template.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = path?.[name];
    if (value === undefined || value === null || value === "") {
      throw new Error(`mboka: missing path param "${name}" for ${template}`);
    }
    return encodeURIComponent(String(value));
  });
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

function call<M extends Method>(method: M) {
  return <P extends MbokaPath<M>>(path: P, ...[options]: Args<P, M>): Promise<MbokaData<P, M>> => {
    const opts = (options ?? {}) as {
      path?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: unknown;
      headers?: Record<string, string>;
    };
    return apiEnvelope<MbokaData<P, M>>(
      method.toUpperCase(),
      buildMbokaUrl(path as string, opts.path, opts.query),
      opts.body,
      opts.headers ? { headers: opts.headers } : undefined,
    );
  };
}

export const mboka = {
  get: call("get"),
  post: call("post"),
  put: call("put"),
  patch: call("patch"),
  delete: call("delete"),
};

/** Named schema types, e.g. `MbokaSchema<"TransactionOut">`. */
export type MbokaSchema<N extends keyof import("./generated/mboka").components["schemas"]> =
  import("./generated/mboka").components["schemas"][N];
