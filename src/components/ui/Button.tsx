import React from 'react'

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'default' | 'destructive' | 'ghost'
}

export default function Button({ children, className, size = 'md', variant = 'default', ...rest }: Props) {
  const sizeCls = size === 'sm' ? 'px-2 py-1 text-sm' : size === 'lg' ? 'px-4 py-2 text-base' : 'px-3 py-1.5 text-sm'
  const variantCls =
    variant === 'primary'
      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
      : variant === 'secondary'
        ? 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200'
        : variant === 'destructive'
          ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700'
          : variant === 'ghost'
            ? 'border-transparent hover:bg-neutral-100'
            : 'border-neutral-300 hover:bg-neutral-50'
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center rounded border disabled:opacity-60 ${sizeCls} ${variantCls} ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
