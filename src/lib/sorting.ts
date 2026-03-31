export type SortDirection = 'asc' | 'desc'

export interface SortConfig<T extends string> {
  key: T
  direction: SortDirection
}

export function compareValues(left: unknown, right: unknown) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  if (typeof left === 'string' && typeof right === 'string') {
    const leftDate = Date.parse(left)
    const rightDate = Date.parse(right)
    if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
      return leftDate - rightDate
    }

    return left.localeCompare(right)
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right)
  }

  return String(left ?? '').localeCompare(String(right ?? ''))
}

export function sortItems<T>(
  items: T[],
  config: SortConfig<string> | null,
  accessors?: Partial<Record<string, (item: T) => unknown>>
) {
  if (!config) {
    return items
  }

  return [...items].sort((left, right) => {
    const accessor = accessors?.[config.key]
    const leftValue = accessor ? accessor(left) : Reflect.get(left as object, config.key)
    const rightValue = accessor ? accessor(right) : Reflect.get(right as object, config.key)
    const comparison = compareValues(leftValue, rightValue)

    return config.direction === 'asc' ? comparison : -comparison
  })
}
