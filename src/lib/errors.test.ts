import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './errors'

describe('getErrorMessage', () => {
  it('reads messages from native errors', () => {
    expect(getErrorMessage(new Error('Native failure'), 'Fallback')).toBe('Native failure')
  })

  it('reads messages from Supabase-style error objects', () => {
    expect(getErrorMessage({ message: 'Supabase failure' }, 'Fallback')).toBe('Supabase failure')
  })

  it('falls back when no message is available', () => {
    expect(getErrorMessage({ code: 'PGRST000' }, 'Fallback')).toBe('Fallback')
  })
})
