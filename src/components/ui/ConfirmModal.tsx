"use client"
import React from 'react'

type Props = {
  open: boolean
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }: Props) {
  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" style={overlayStyle}>
      <div style={modalStyle}>
        <h3 id="confirm-title" style={{ marginTop: 0 }}>{title}</h3>
        {message && <p>{message}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel}>{cancelText}</button>
          <button onClick={onConfirm} style={{ background: '#c00', color: '#fff' }}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
}

const modalStyle: React.CSSProperties = {
  background: '#fff',
  padding: 16,
  width: 360,
  borderRadius: 6,
  boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
}

