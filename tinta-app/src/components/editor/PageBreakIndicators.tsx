'use client'

import { useEffect, useState, type RefObject } from 'react'

const PAGE_CONTENT_HEIGHT = 864  // 1056 - 96 * 2 (top + bottom padding)

interface PageBreakIndicatorsProps {
  editorRef: RefObject<HTMLDivElement>
}

export function PageBreakIndicators({ editorRef }: PageBreakIndicatorsProps) {
  const [pageBreaks, setPageBreaks] = useState<number[]>([])

  useEffect(() => {
    const updateBreaks = () => {
      if (!editorRef.current) return
      const totalHeight = editorRef.current.scrollHeight
      const breaks: number[] = []
      let page = 1
      while (page * PAGE_CONTENT_HEIGHT < totalHeight) {
        breaks.push(page * PAGE_CONTENT_HEIGHT)
        page++
      }
      setPageBreaks(breaks)
    }

    updateBreaks()

    const observer = new ResizeObserver(updateBreaks)
    if (editorRef.current) observer.observe(editorRef.current)
    return () => observer.disconnect()
  }, [editorRef])

  return (
    <>
      {pageBreaks.map((breakY, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 pointer-events-none z-10"
          style={{ top: `${breakY + 96}px` }}  // +96 for top padding
        >
          {/* Separator line */}
          <div className="w-full h-[2px] bg-[#e8e8e8]" />
          {/* Page number label */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-[#e8e8e8] px-3 py-0.5 text-[9px] text-[#B9B6AD] rounded-full">
            Page {i + 2}
          </div>
        </div>
      ))}
    </>
  )
}
