"use client"
import React from 'react'
import ErrorFallback from './ErrorFallback'

type State = { hasError: boolean; error?: unknown }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error }
  }
  componentDidCatch(): void {}
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />
    }
    return this.props.children as React.ReactElement
  }
}
