import type { Emit, ReplyAllFn, ReplyFn } from './emit'
import type { InferOut, StandardSchemaV1 } from './standard-schema'

// ── Context ───────────────────────────────────────────────────────────────────

export type AnyCtx = Record<string, unknown>

export type HandlerCtx<Ctx extends AnyCtx> = Ctx & {
  reply: ReplyFn
  replyAll: ReplyAllFn
}

// ── Procedure ─────────────────────────────────────────────────────────────────

export type Procedure<
  Ctx extends AnyCtx,
  Schema extends StandardSchemaV1,
  Y extends Emit,
  R,
> = {
  _schema: Schema | null
  _handler: (
    c: HandlerCtx<Ctx> & {
      input: InferOut<Schema>
    }
  ) => Generator<Y, R, never> | AsyncGenerator<Y, R, never>
}

export type AnyProcedure = {
  _schema: StandardSchemaV1 | null
  _handler: (
    // biome-ignore lint/suspicious/noExplicitAny: erased ctx type
    c: HandlerCtx<any> & { input: unknown }
    // biome-ignore lint/suspicious/noExplicitAny: erased generator types
  ) => Generator<any, any, any> | AsyncGenerator<any, any, any>
}

// ── Builder ───────────────────────────────────────────────────────────────────

class ProcedureBuilder<
  Ctx extends AnyCtx,
  Schema extends StandardSchemaV1 | null = null,
> {
  private readonly _schema: Schema | null

  constructor(schema: Schema | null = null) {
    this._schema = schema
  }

  input<S extends StandardSchemaV1>(schema: S): ProcedureBuilder<Ctx, S> {
    return new ProcedureBuilder<Ctx, S>(schema)
  }

  handler<Y extends Emit, R>(
    fn: (
      c: HandlerCtx<Ctx> & {
        input: Schema extends StandardSchemaV1 ? InferOut<Schema> : unknown
      }
    ) => Generator<Y, R, never> | AsyncGenerator<Y, R, never>
  ): Procedure<
    Ctx,
    Schema extends StandardSchemaV1 ? Schema : StandardSchemaV1,
    Y,
    R
  > {
    return { _schema: this._schema, _handler: fn } as unknown as Procedure<
      Ctx,
      Schema extends StandardSchemaV1 ? Schema : StandardSchemaV1,
      Y,
      R
    >
  }
}

export function createProcedure<Ctx extends AnyCtx>() {
  return new ProcedureBuilder<Ctx>()
}
