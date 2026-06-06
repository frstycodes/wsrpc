export type Emit<
  Code extends string = string,
  Data = unknown,
  Target extends 'self' | 'all' = 'self' | 'all',
> = {
  readonly target: Target
  readonly code: Code
  readonly data: Data
}

export type ReplyFn = <C extends string, D>(
  code: C,
  data: D
) => Emit<C, D, 'self'>

export type ReplyAllFn = <C extends string, D>(
  code: C,
  data: D
) => Emit<C, D, 'all'>
