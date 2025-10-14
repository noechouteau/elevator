import "./CoverContainer.scss"

import { useLayoutEffect, useMemo, useRef } from "react"

export const CoverContainer = ({
  defaultWidth,
  defaultHeight,
  children,
  className = ""
}) => {
  const container = useRef()
  const inner = useRef()
  let scale = useMemo(
    () => ({
      x: 1,
      y: 1,
      offsetX: 0,
      offsetY: 0
    }),
    []
  )

  useLayoutEffect(() => {
    const computeScale = () => {
      if (!container.current) return

      const c = container.current
      const containerWidth = c.offsetWidth
      const containerHeight = c.offsetHeight
      const containerAspect = containerWidth / containerHeight
      const defaultAspect = defaultWidth / defaultHeight

      let scaleX, scaleY, offsetX, offsetY

      const shouldScaleX = containerAspect > defaultAspect
      const shouldScaleY = !shouldScaleX

      if (shouldScaleX) {
        scaleX = containerWidth / defaultWidth
        scaleY = scaleX
        offsetX = 0
        offsetY = (containerHeight - defaultHeight * scaleY) / 2
      } else if (shouldScaleY) {
        scaleY = containerHeight / defaultHeight
        scaleX = scaleY
        offsetX = (containerWidth - defaultWidth * scaleX) / 2
        offsetY = 0
      }

      scale = {
        x: scaleX,
        y: scaleY,
        offsetX,
        offsetY
      }
    }

    const setProperties = () => {
      const style = inner.current.style

      style.setProperty("--defaultWidth", defaultWidth + "px")
      style.setProperty("--defaultHeight", defaultHeight + "px")
      style.setProperty("--scaleX", scale.x + "")
      style.setProperty("--scaleY", scale.y + "")
      style.setProperty("--offsetX", scale.offsetX + "px")
      style.setProperty("--offsetY", scale.offsetY + "px")
    }

    const handleResize = () => {
      computeScale()
      setProperties()
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [defaultWidth, defaultHeight])

  return (
    <div ref={container} className="cover-container">
      <div ref={inner} className="inner">
        {children}
      </div>
    </div>
  )
}
