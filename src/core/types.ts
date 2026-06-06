import type { Emit } from './emit'
import type { Lifecycle, Router, WebsocketHandler } from './handler'
import type { AnyCtx, Procedure } from './procedure'
import type { InferIn, StandardSchemaV1 } from './standard-schema'

// ── Router call types (for client.send) ──────────────────────────────────────

export type InferRouterTypes<R extends Router> = {
  // biome-ignore lint/suspicious/noExplicitAny: wildcard positions for type extraction
  [K in keyof R]: R[K] extends Procedure<any, infer S, any, infer Ret>
    ? {
        input: S extends StandardSchemaV1 ? InferIn<S> : unknown
        output: Awaited<Ret>
      }
    : never
}

// All emitted events across the router
type RouterEmits<R extends Router> = {
  // biome-ignore lint/suspicious/noExplicitAny: wildcard positions for type extraction
  [K in keyof R]: R[K] extends Procedure<any, any, infer Y, any> ? Y : never
}[keyof R]

// biome-ignore lint/suspicious/noExplicitAny: wildcard for Lifecycle param
type LifecycleEmits<L extends Lifecycle<any>> = {
  [K in keyof L]: L[K] extends (
    // biome-ignore lint/suspicious/noExplicitAny: wildcard for args
    args: any
  ) => // biome-ignore lint/suspicious/noExplicitAny: wildcard positions for type extraction
    | Generator<infer Y, any, any>
    // biome-ignore lint/suspicious/noExplicitAny: wildcard positions for type extraction
    | AsyncGenerator<infer Y, any, any>
    | void
    | Promise<void>
    ? Y
    : never
}[keyof L]

type AllEmits<R extends Router, L extends Lifecycle> =
  | RouterEmits<R>
  | LifecycleEmits<L>

// Event map (for client.on)
export type EventMap<R extends Router, L extends Lifecycle = Lifecycle> = {
  // biome-ignore lint/suspicious/noExplicitAny: wildcard positions for type extraction
  [E in AllEmits<R, L> as E extends Emit<infer C, any, any>
    ? C
    : // biome-ignore lint/suspicious/noExplicitAny: wildcard positions for type extraction
      never]: E extends Emit<any, infer D, any> ? D : never
}

//Convenience: extract from a handler instance
export type AnyWebsocketHandler = WebsocketHandler<Router, Lifecycle, AnyCtx>

export type InferHandler<H> =
  // biome-ignore lint/suspicious/noExplicitAny: <>
  H extends WebsocketHandler<infer R, infer L, any>
    ? { routes: InferRouterTypes<R>; events: EventMap<R, L> }
    : never

export type AllGenerator<Yield, Return, Next> =
  | Generator<Yield, Return, Next>
  | AsyncGenerator<Yield, Return, Next>
