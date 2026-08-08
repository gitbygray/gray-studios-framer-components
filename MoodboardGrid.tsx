import { addPropertyControls, ControlType } from "framer"
import { useState, useEffect, useRef } from "react"

// Minimum horizontal travel (px) before a touch counts as a swipe
const SWIPE_THRESHOLD = 50

// Fixed chrome inside the modal so the image area height is predictable
const HEADER_HEIGHT = 32
const HEADER_MARGIN = 12

// Mixes a color toward black by `amount` (0–1). Handles hex and rgb/rgba.
function darken(color, amount) {
    if (typeof color !== "string") return color
    let r = 0
    let g = 0
    let b = 0
    let a = 1

    if (color.startsWith("#")) {
        let hex = color.slice(1)
        if (hex.length === 3 || hex.length === 4) {
            hex = hex
                .split("")
                .map((c) => c + c)
                .join("")
        }
        r = parseInt(hex.slice(0, 2), 16)
        g = parseInt(hex.slice(2, 4), 16)
        b = parseInt(hex.slice(4, 6), 16)
        if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16) / 255
    } else {
        const parts = color.match(/[\d.]+/g)
        if (!parts || parts.length < 3) return color
        r = parseFloat(parts[0])
        g = parseFloat(parts[1])
        b = parseFloat(parts[2])
        if (parts.length > 3) a = parseFloat(parts[3])
    }

    const mix = (v) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))))
    return `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${a})`
}

export default function MoodboardGrid(props) {
    const {
        items,
        columns,
        gap,
        cardRadius,
        cardPadding,
        bgColor,
        borderColor,
        textColor,
        captionColor,
        sidePadding,
        bottomPadding,
        modalHeight,
        screenPadding,
        headerPadding,
    } = props
    const [activeIndex, setActiveIndex] = useState(null)
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

    const openCard = (i) => {
        setRatio(null)
        setActiveIndex(i)
    }

    const closeCard = () => {
        setRatio(null)
        setCloseHover(false)
        setActiveIndex(null)
    }

    // Step to the next/previous item, wrapping at both ends
    const step = (direction) => {
        if (activeIndex === null || items.length < 2) return
        setRatio(null)
        setActiveIndex(
            (activeIndex + direction + items.length) % items.length
        )
    }

    // Arrow keys to navigate, Escape to close
    useEffect(() => {
        if (activeIndex === null || typeof window === "undefined") return
        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                closeCard()
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

    const chromeHeight = cardPadding * 2 + HEADER_HEIGHT + HEADER_MARGIN

    // Target size: modalHeight% of the device height, never closer than
    // screenPadding to any edge of the screen
    const cardMaxHeight = viewport
        ? Math.min(
              viewport.height * (modalHeight / 100),
              viewport.height - screenPadding * 2
          )
        : 0
    const maxImageHeight = viewport
        ? Math.max(cardMaxHeight - chromeHeight, 0)
        : 0
    const maxImageWidth = viewport
        ? Math.max(viewport.width - screenPadding * 2 - cardPadding * 2, 0)
        : 0

    let imageHeight = maxImageHeight
    let imageWidth = ratio ? imageHeight * ratio : null
    if (ratio && imageWidth > maxImageWidth) {
        imageWidth = maxImageWidth
        imageHeight = imageWidth / ratio
    }

    const closeBg = darken(bgColor, closeHover ? 0.16 : 0.08)

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
                        onClick={() => openCard(i)}
                        style={{
                            cursor: "pointer",
                            display: "block",
                            breakInside: "avoid",
                            marginBottom: gap,
                            borderRadius: cardRadius,
                            border: `1px solid ${borderColor}`,
                            backgroundColor: bgColor,
                            padding: cardPadding,
                            boxSizing: "border-box",
                        }}
                    >
                        {item.image && (
                            <img
                                src={item.image}
                                alt={item.caption || ""}
                                style={{
                                    width: "100%",
                                    display: "block",
                                    borderRadius: Math.max(
                                        cardRadius - cardPadding,
                                        0
                                    ),
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
                        closeCard()
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
                        backgroundColor: "rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: screenPadding,
                        boxSizing: "border-box",
                        zIndex: 9999,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            height: imageHeight + chromeHeight,
                            width: imageWidth
                                ? imageWidth + cardPadding * 2
                                : "auto",
                            display: "flex",
                            flexDirection: "column",
                            borderRadius: cardRadius,
                            border: `1px solid ${borderColor}`,
                            backgroundColor: bgColor,
                            padding: cardPadding,
                            boxSizing: "border-box",
                            overflow: "hidden",
                            opacity: ratio ? 1 : 0,
                            transition: "opacity 0.15s ease",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12,
                                height: HEADER_HEIGHT,
                                marginBottom: HEADER_MARGIN,
                                paddingLeft: headerPadding,
                                paddingRight: headerPadding,
                                boxSizing: "border-box",
                                fontSize: 12,
                                fontFamily: "Inter, sans-serif",
                                flexShrink: 0,
                            }}
                        >
                            <span
                                style={{
                                    color: captionColor,
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {activeItem.handle}
                            </span>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 16,
                                    flexShrink: 0,
                                }}
                            >
                                <span
                                    style={{
                                        color: textColor,
                                        fontWeight: 600,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {activeItem.caption}
                                </span>
                                <button
                                    onClick={closeCard}
                                    onMouseEnter={() => setCloseHover(true)}
                                    onMouseLeave={() => setCloseHover(false)}
                                    style={{
                                        border: "none",
                                        backgroundColor: closeBg,
                                        color: textColor,
                                        fontFamily: "Inter, sans-serif",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        padding: "6px 12px",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                        transition:
                                            "background-color 0.15s ease",
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <img
                                key={activeIndex}
                                draggable={false}
                                src={activeItem.image}
                                alt={activeItem.caption || ""}
                                onLoad={(e) => {
                                    const img = e.currentTarget
                                    if (img.naturalHeight) {
                                        setRatio(
                                            img.naturalWidth /
                                                img.naturalHeight
                                        )
                                    }
                                }}
                                style={{
                                    height: "100%",
                                    width: "100%",
                                    objectFit: "contain",
                                    display: "block",
                                    borderRadius: Math.max(
                                        cardRadius - cardPadding,
                                        0
                                    ),
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

MoodboardGrid.defaultProps = {
    columns: 4,
    gap: 16,
    cardRadius: 14,
    cardPadding: 14,
    sidePadding: 50,
    bottomPadding: 25,
    modalHeight: 80,
    screenPadding: 60,
    headerPadding: 6,
    bgColor: "#f7f7f7",
    borderColor: "#e0e0e0",
    textColor: "#111111",
    captionColor: "#555555",
    items: [
        {
            handle: "@doyougaia",
            caption: "FOUNDER'S NOTE [N° 01]",
            image: "",
            link: "",
        },
    ],
}

addPropertyControls(MoodboardGrid, {
    items: {
        type: ControlType.Array,
        title: "Items",
        control: {
            type: ControlType.Object,
            controls: {
                image: { type: ControlType.Image, title: "Image" },
                handle: { type: ControlType.String, title: "Handle" },
                caption: { type: ControlType.String, title: "Caption" },
                link: { type: ControlType.Link, title: "Link" },
            },
        },
    },
    columns: {
        type: ControlType.Number,
        title: "Columns",
        min: 1,
        max: 8,
        step: 1,
        defaultValue: 4,
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
    modalHeight: {
        type: ControlType.Number,
        title: "Modal Height",
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
    headerPadding: {
        type: ControlType.Number,
        title: "Header Padding",
        min: 0,
        max: 40,
        defaultValue: 6,
    },
    cardRadius: {
        type: ControlType.Number,
        title: "Card Radius",
        min: 0,
        max: 40,
        defaultValue: 14,
    },
    cardPadding: {
        type: ControlType.Number,
        title: "Card Padding",
        min: 0,
        max: 40,
        defaultValue: 14,
    },
    bgColor: {
        type: ControlType.Color,
        title: "Card BG",
        defaultValue: "#f7f7f7",
    },
    borderColor: {
        type: ControlType.Color,
        title: "Border Color",
        defaultValue: "#e0e0e0",
    },
    textColor: {
        type: ControlType.Color,
        title: "Caption Color",
        defaultValue: "#111111",
    },
    captionColor: {
        type: ControlType.Color,
        title: "Handle Color",
        defaultValue: "#555555",
    },
})
