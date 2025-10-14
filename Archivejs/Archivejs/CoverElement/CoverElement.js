import "./CoverElement.scss"

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react"

export const CoverElement = forwardRef(
  ({ x, y, children, className = "", ...props }, forwardedRef) => {
    const container = useRef()
    useImperativeHandle(forwardedRef, () => container.current)

    useLayoutEffect(() => {
      const setProperties = () => {
        const style = container.current.style

        style.setProperty("--x", x + "px")
        style.setProperty("--y", y + "px")
      }

      setProperties()
    }, [x, y])

    return (
      <div ref={container} className={"cover-element " + className} {...props}>
        {children}
      </div>
    )
  }
)