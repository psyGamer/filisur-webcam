import axios from "axios"
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"

import ReactPlayer from "react-player";
import {
    MediaController,
    MediaControlBar,
    MediaTimeRange,
    MediaTimeDisplay,
    MediaVolumeRange,
    MediaPlaybackRateButton,
    MediaPlayButton,
    MediaSeekBackwardButton,
    MediaSeekForwardButton,
    MediaMuteButton,
    MediaFullscreenButton,
    MediaLoadingIndicator,
} from "media-chrome/react";
import { 
    MediaPlaybackRateMenu as MediaPlaybackRateMenuType, 
    MediaPlaybackRateMenuButton as MediaPlaybackRateMenuButtonType,
} from "media-chrome/menu";
import { 
    MediaPlaybackRateMenu, 
    MediaPlaybackRateMenuButton 
} from "media-chrome/react/menu";

import VerticalVideoSelector from "../components/VerticalVideoSelector"

import './Categorize.scss'
import TrainDescription from "../components/TrainDescription";

const useFetchPending = () => useQuery({
    queryKey: ['pending'],
    queryFn: () => axios.get<string[]>("/api/categorize/pending"),
    staleTime: 300_000,
})

function Categorize() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { data, error, isFetching, isLoading } = useFetchPending()

    const [selectedVideo, setSelectedVideo] = useState<number>(0)

    const playbackMenuRef = useRef<MediaPlaybackRateMenuType>(null)
    const playbackButtonRef = useRef<MediaPlaybackRateMenuButtonType>(null)

    useEffect(() => {
        if (!playbackMenuRef.current || !playbackButtonRef.current) return
        console.log(playbackMenuRef.current, playbackButtonRef.current)

        // Load preference
        const preferredPlaybackSpeed = localStorage.getItem("categorize-playback-speed")
        if (preferredPlaybackSpeed) {
            const rate = JSON.parse(preferredPlaybackSpeed)
            playbackMenuRef.current.mediaPlaybackRate = rate
            playbackButtonRef.current.mediaPlaybackRate = rate
        }

        let firstMutation = preferredPlaybackSpeed != null

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                // Hack since it tries to change it back to 1x on it's own..
                if (firstMutation) {
                    const rate = JSON.parse(preferredPlaybackSpeed!)
                    playbackMenuRef.current!.mediaPlaybackRate = rate
                    playbackButtonRef.current!.mediaPlaybackRate = rate
                    firstMutation = false
                }

                // Save preference
                if (mutation.type == "attributes" && playbackMenuRef.current) {
                    console.log(`Changed ${playbackMenuRef.current.mediaPlaybackRate}`)
                    localStorage.setItem("categorize-playback-speed", playbackMenuRef.current.mediaPlaybackRate.toString())
                }
            });
        })
        observer.observe(playbackMenuRef.current, { attributes: true })

        return () => observer.disconnect()
    })

    if (isFetching || isLoading) {
        return <p>Loading...</p>
    } else if (error) {
        return <p>Error: {error.message}</p>
    }

    const videos = data!.data
    const selectedIdx = videos.indexOf(searchParams.get("video") || "")

    // Default to first video
    if (selectedIdx < 0) {
        const url = new URL(window.location.href);
        url.searchParams.set("video", videos[0]);
        window.history.pushState({}, "", url);

        setSelectedVideo(selectedIdx)
    }

    return <>
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
            }}
        >
            {/* <VerticalVideoSelector sources={videos} selectedIndex={selectedIdx >= 0 ? selectedIdx : null} onSelectedChanged={idx => {
                const url = new URL(window.location.href)
                url.searchParams.set("video", videos[idx])
                window.history.pushState({}, "", url)

                setSelectedVideo(idx)
            }} />

            <MediaController
                style={{
                    width: '70rem',
                    height: 'fit-content',
                    margin: '1.5rem 0',
                    borderRadius: 'var(--border-radius)'
                }}
            >
                <ReactPlayer 
                    slot="media"
                    src={`/cdn/video/${videos[selectedVideo]}`}
                    playing={true}
                    style={{
                        width: '100%',
                        height: 'auto',
                        aspectRatio: '11/9'
                    }} />
                
                <MediaLoadingIndicator />
                <MediaPlaybackRateMenu 
                    ref={playbackMenuRef}
                    rates={[1,2,3,4,5,10,15]} 
                    mediaPlaybackRate={3}
                    id='playback-menu'
                    hidden />
                <MediaControlBar>
                    <MediaPlayButton />
                    <MediaSeekBackwardButton seekOffset={15} />
                    <MediaSeekForwardButton seekOffset={15} />
                    <MediaTimeRange />
                    <MediaTimeDisplay showDuration />
                    <MediaPlaybackRateMenuButton invokeTarget='playback-menu' ref={playbackButtonRef} />
                </MediaControlBar>
            </MediaController> */}

            <TrainDescription></TrainDescription>
        </div>
    </>
}

export default Categorize