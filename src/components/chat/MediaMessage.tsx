import React from 'react'

type Props = {
  messageId: string
  initialUrl: string
  mediaType: 'image' | 'video' | 'file'
  fileName?: string | null
  className?: string
}

export default function MediaMessage({ initialUrl, mediaType, fileName, className }: Props) {
  if (!initialUrl) return null
  if (mediaType === 'image') {
    return <img src={initialUrl} alt={fileName ?? ''} className={className} />
  }
  if (mediaType === 'video') {
    return (
      <video controls className={className}>
        <source src={initialUrl} />
      </video>
    )
  }
  return (
    <a href={initialUrl} target="_blank" rel="noreferrer" className={className}>
      {fileName ?? 'Download file'}
    </a>
  )
}
