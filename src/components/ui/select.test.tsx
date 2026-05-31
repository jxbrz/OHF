import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

Element.prototype.scrollIntoView = vi.fn()

describe('Select', () => {
  it('renders popup content above dialogs', () => {
    render(
      <Select defaultOpen defaultValue="alice">
        <SelectTrigger aria-label="Member">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="alice">Alice Holder</SelectItem>
        </SelectContent>
      </Select>
    )

    expect(screen.getByRole('option', { name: 'Alice Holder' }).closest('[data-slot="select-content"]')).toHaveClass(
      'z-[100]'
    )
  })
})
