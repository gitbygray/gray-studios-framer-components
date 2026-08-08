import { addPropertyControls, ControlType } from "framer"
import { useState, useEffect, useRef } from "react"

// Minimum horizontal travel (px) before a touch counts as a swipe
const SWIPE_THRESHOLD = 50

export default function WorkGrid(props) {
    const {
        items,
        columns,
        gap,
        imageRadius,
        sidePadding,
        bottomPadding,
        hoverOpacity,
        modalHeight,
        screenPadding,
        showCloseButton,
    } = props
    const [activeIndex, setActiveIndex] = useState(null)
    const [hoverIndex, setHoverIndex] = useState(null)
    const [ratio, setRatio] = useState(null)
    const [viewport, setViewport] = useState(null)
    const [closeHover, setCloseHover] = useState(false)
    const touchStart = useRef(null)
    const swiped = useRef(false)
    const activeItem = activeIndex !== null ? items[activeIndex] : null

    // Measure the real device viewport instead of relying on vh units,
    // which resolve against the browser window rather than the Framer frame
    useEffect(() => {
        if (typeof window === "undefined") return
        const measure = () =>
            setViewport({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        measure()
        window.addEventListener("resize", measure)
        window.addEventListener("orientationchange", measure)
        return () => {
            window.removeEventListener("resize", measure)
            window.removeEventListener("orientationchange", measure)
        }
    }, [])

    const openImage = (i) => {
        setRatio(null)
        setActiveIndex(i)
    }

    const closeImage = () => {
        setRatio(null)
        setCloseHover(false)
        setActiveIndex(null)
    }

    // Step to the next/previous item, wrapping at both ends
    const step = (direction) => {
        if (activeIndex === null || items.length < 2) return
        setRatio(null)
        setActiveIndex((activeIndex + direction + items.length) % items.length)
    }

    // Arrow keys to navigate, Escape to close
    useEffect(() => {
        if (activeIndex === null || typeof window === "undefined") return
        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                closeImage()
            } else if (e.key === "ArrowRight") {
                e.preventDefault()
                step(1)
            } else if (e.key === "ArrowLeft") {
                e.preventDefault()
                step(-1)
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [activeIndex, items.length])

    // Warm the neighbours so stepping doesn't wait on a fresh download
    useEffect(() => {
        if (activeIndex === null || typeof window === "undefined") return
        const neighbours = [
            items[(activeIndex + 1) % items.length],
            items[(activeIndex - 1 + items.length) % items.length],
        ]
        neighbours.forEach((item) => {
            if (item && item.image) {
                const preload = new Image()
                preload.src = item.image
            }
        })
    }, [activeIndex, items])

    // Target size: modalHeight% of the device height, never closer than
    // screenPadding to any edge of the screen
    const maxImageHeight = viewport
        ? Math.max(
              Math.min(
                  viewport.height * (modalHeight / 100),
                  viewport.height - screenPadding * 2
              ),
              0
          )
        : 0
    const maxImageWidth = viewport
        ? Math.max(viewport.width - screenPadding * 2, 0)
        : 0

    let imageHeight = maxImageHeight
    let imageWidth = ratio ? imageHeight * ratio : null
    if (ratio && imageWidth > maxImageWidth) {
        imageWidth = maxImageWidth
        imageHeight = imageWidth / ratio
    }

    return (
        <div style={{ position: "relative" }}>
            <div
                style={{
                    columnCount: columns,
                    columnGap: gap,
                    width: "100%",
                    paddingLeft: sidePadding,
                    paddingRight: sidePadding,
                    paddingBottom: bottomPadding,
                    boxSizing: "border-box",
                }}
            >
                {items.map((item, i) => (
                    <div
                        key={i}
                        onClick={() => openImage(i)}
                        onMouseEnter={() => setHoverIndex(i)}
                        onMouseLeave={() => setHoverIndex(null)}
                        style={{
                            cursor: "pointer",
                            display: "block",
                            breakInside: "avoid",
                            marginBottom: gap,
                        }}
                    >
                        {item.image && (
                            <img
                                src={item.image}
                                alt={item.alt || ""}
                                draggable={false}
                                style={{
                                    width: "100%",
                                    display: "block",
                                    borderRadius: imageRadius,
                                    opacity:
                                        hoverIndex === i ? hoverOpacity : 1,
                                    transition: "opacity 0.2s ease",
                                }}
                            />
                        )}
                    </div>
                ))}
            </div>

            {activeItem && viewport && (
                <div
                    onClick={() => {
                        // A swipe shouldn't also register as a tap-to-close
                        if (swiped.current) {
                            swiped.current = false
                            return
                        }
                        closeImage()
                    }}
                    onTouchStart={(e) => {
                        const touch = e.touches[0]
                        swiped.current = false
                        touchStart.current = {
                            x: touch.clientX,
                            y: touch.clientY,
                        }
                    }}
                    onTouchEnd={(e) => {
                        if (!touchStart.current) return
                        const touch = e.changedTouches[0]
                        const dx = touch.clientX - touchStart.current.x
                        const dy = touch.clientY - touchStart.current.y
                        touchStart.current = null
                        if (
                            Math.abs(dx) > SWIPE_THRESHOLD &&
                            Math.abs(dx) > Math.abs(dy)
                        ) {
                            swiped.current = true
                            step(dx < 0 ? 1 : -1)
                        }
                    }}
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.85)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: screenPadding,
                        boxSizing: "border-box",
                        zIndex: 9999,
                    }}
                >
                    <img
                        key={activeIndex}
                        src={activeItem.image}
                        alt={activeItem.alt || ""}
                        draggable={false}
                        onClick={(e) => e.stopPropagation()}
                        onLoad={(e) => {
                            const img = e.currentTarget
                            if (img.naturalHeight) {
                                setRatio(
                                    img.naturalWidth / img.naturalHeight
                                )
                            }
                        }}
                        style={{
                            height: imageHeight,
                            width: imageWidth || "auto",
                            objectFit: "contain",
                            display: "block",
                            borderRadius: imageRadius,
                            opacity: ratio ? 1 : 0,
                            transition: "opacity 0.15s ease",
                        }}
                    />

                    {showCloseButton && (
                        <button
                            onClick={closeImage}
                            onMouseEnter={() => setCloseHover(true)}
                            onMouseLeave={() => setCloseHover(false)}
                            aria-label="Close"
                            style={{
                                position: "absolute",
                                top: 20,
                                right: 20,
                                border: "none",
                                backgroundColor: closeHover
                                    ? "rgba(255,255,255,0.22)"
                                    : "rgba(255,255,255,0.10)",
                                color: "#ffffff",
                                fontFamily: "Inter, sans-serif",
                                fontSize: 12,
                                fontWeight: 600,
                                letterSpacing: "0.02em",
                                padding: "8px 14px",
                                borderRadius: 6,
                                cursor: "pointer",
                                transition: "background-color 0.15s ease",
                            }}
                        >
                            Close
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

WorkGrid.defaultProps = {
    columns: 3,
    gap: 16,
    imageRadius: 0,
    sidePadding: 50,
    bottomPadding: 25,
    hoverOpacity: 0.8,
    modalHeight: 80,
    screenPadding: 60,
    showCloseButton: true,
    items: [{ image: "", alt: "" }],
}

addPropertyControls(WorkGrid, {
    items: {
        type: ControlType.Array,
        title: "Items",
        control: {
            type: ControlType.Object,
            controls: {
                image: { type: ControlType.Image, title: "Image" },
                alt: { type: ControlType.String, title: "Alt Text" },
            },
        },
    },
    columns: {
        type: ControlType.Number,
        title: "Columns",
        min: 1,
        max: 8,
        step: 1,
        defaultValue: 3,
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        min: 0,
        max: 64,
        defaultValue: 16,
    },
    sidePadding: {
        type: ControlType.Number,
        title: "Side Padding",
        min: 0,
        max: 200,
        defaultValue: 50,
    },
    bottomPadding: {
        type: ControlType.Number,
        title: "Bottom Padding",
        min: 0,
        max: 200,
        defaultValue: 25,
    },
    imageRadius: {
        type: ControlType.Number,
        title: "Image Radius",
        min: 0,
        max: 40,
        defaultValue: 0,
    },
    hoverOpacity: {
        type: ControlType.Number,
        title: "Hover Opacity",
        min: 0.2,
        max: 1,
        step: 0.05,
        defaultValue: 0.8,
    },
    modalHeight: {
        type: ControlType.Number,
        title: "Expanded Height",
        unit: "% of screen",
        min: 30,
        max: 100,
        step: 1,
        defaultValue: 80,
    },
    screenPadding: {
        type: ControlType.Number,
        title: "Screen Padding",
        min: 0,
        max: 200,
        step: 4,
        defaultValue: 60,
    },
    showCloseButton: {
        type: ControlType.Boolean,
        title: "Close Button",
        defaultValue: true,
    },
})
