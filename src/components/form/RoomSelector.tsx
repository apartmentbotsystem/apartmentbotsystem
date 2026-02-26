import React from 'react'

type Option = { value: string; label: string }

type Props = {
  value?: string
  onChange?: (value: string) => void
  rooms?: Option[] | string[]
  name?: string
  className?: string
  placeholder?: string
  searchable?: boolean
  required?: boolean
}

export default function RoomSelector({ value, onChange, rooms, name, className, placeholder, required }: Props) {
  const opts: Option[] = Array.isArray(rooms)
    ? (typeof rooms[0] === 'string'
        ? (rooms as string[]).map((s) => ({ value: s, label: s }))
        : (rooms as Option[])
      )
    : []
  return (
    <select
      name={name}
      className={`border rounded px-2 py-1 ${className ?? ''}`}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      required={required}
    >
      <option value="">{placeholder ?? 'Select a room'}</option>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
