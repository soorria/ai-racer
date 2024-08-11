import type { ComponentType } from "react"
import { createContext, use } from "react"

export function createTypedContext<
  TContext,
  // eslint-disable-next-line @typescript-eslint/ban-types
  TProps extends Record<string, unknown> = {},
>(
  useContextValue: (props: TProps) => TContext,
): [
  Provider: ComponentType<TProps & { children: React.ReactNode }>,
  useContext: () => TContext,
  useOptionalContext: () => TContext | null,
] {
  const Context = createContext<TContext | null>(null)

  function Provider(props: TProps & { children: React.ReactNode }) {
    return <Context.Provider value={useContextValue(props)} children={props.children} />
  }

  function useOptionalTypedContext() {
    const context = use(Context)
    return context
  }

  function useTypedContext() {
    const context = use(Context)
    if (!context) {
      throw new Error("Context not found")
    }
    return context
  }

  return [Provider, useTypedContext, useOptionalTypedContext]
}
