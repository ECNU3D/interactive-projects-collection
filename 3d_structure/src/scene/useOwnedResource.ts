import { useLayoutEffect, useState } from 'react'

/**
 * Creates resources only inside an effect setup, so React StrictMode's replay
 * owns a distinct value each time. Every setup releases exactly its own value.
 */
export function useOwnedResource<T>(
  factory: () => T,
  disposer: (resource: T) => void,
) {
  const [resource, setResource] = useState<T | null>(null)

  useLayoutEffect(() => {
    const owned = factory()
    let released = false
    setResource(owned)

    return () => {
      if (released) return
      released = true
      setResource((current) => (current === owned ? null : current))
      disposer(owned)
    }
  }, [disposer, factory])

  return resource
}
