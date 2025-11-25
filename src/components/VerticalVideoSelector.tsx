import { useRef, useState, useEffect, useCallback } from 'react';

import VideoButton from './VideoButton'

import './VerticalVideoSelector.scss'

function VerticalVideoSelector({ sources } : { sources: string[] }) {
    const [selected, setSelected] = useState(0)
    const [fadeClass, setFadeClass] = useState<string>("")

    const selectorRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const element = 
        <div className={`video-selector ${fadeClass}`} ref={selectorRef}>
            <div className="scroll-container" ref={containerRef}>
                {sources.map((src, idx) => {
                    const style = { 
                        '--normal-scale-factor': idx == selected ? 1.0 : 0.8,
                        '--hover-scale-factor':  idx == selected ? 1.0 : 0.9,
                    } as React.CSSProperties

                    const videoRef = useRef<HTMLDivElement>(null)

                    return (
                        <div
                            className={`video ${idx == selected ? 'selected' : ''}`}
                            ref={videoRef}
                            key={idx}
                            style={style} 
                            onClick={_ => {
                                setSelected(idx)
                                videoRef.current?.scrollIntoView({ behavior:"smooth", block: "center" })
                            }}
                        >
                            <VideoButton source={src} />
                        </div>)
                })}
            </div>
        </div>
    
    // Dynamically show fade at top/bottom of scroll area
    const frame = useRef<number | null>(null)

    const measure = useCallback(() => {
        console.log(`Measure: ${containerRef.current}`)

        const el = containerRef.current
        if (!el) return

        const fade: number = 64
        selectorRef.current?.style.setProperty("--top-fade", (Math.min(1.0, el.scrollTop / fade)).toString())
        selectorRef.current?.style.setProperty("--bottom-fade", (Math.min(1.0, (el.scrollHeight - (el.scrollTop + el.clientHeight)) / fade)).toString())
    }, [])
    const handleScroll = useCallback(() => {
        if (frame.current !== null) return

        frame.current = requestAnimationFrame(() => {
            frame.current = null
            measure()
        })
    }, [measure])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        // Initial measurement
        measure()

        // Set up event listeners
        el.addEventListener('scroll', handleScroll, { passive: true })

        // Set up observers for dynamic content changes
        const resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(el)

        const mutationObserver = new MutationObserver(measure)
        mutationObserver.observe(el, { childList: true, subtree: true })

        // Cleanup function
        return () => {
            el.removeEventListener('scroll', handleScroll)
            resizeObserver.disconnect()
            mutationObserver.disconnect()

            if (frame.current !== null) {
                cancelAnimationFrame(frame.current)
            }
        }
    })

    return element
}

export default VerticalVideoSelector