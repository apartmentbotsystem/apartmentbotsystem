"use client"
import React from 'react'

type Props = {
  type?: "button" | "submit" | "reset"
  loading: boolean
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
  className?: string
  title?: string
}

export default function LoadingButton({ type = 'button', loading, disabled, onClick, children, className, title }: Props) {
  const isDisabled = disabled || loading
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
      title={title}
      className={className}
      style={{
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        paddingRight: loading ? 28 : undefined
      }}
    >
      {children}
      {loading && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            width: 14,
            height: 14,
            marginTop: -7,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </button>
  )
}

