import axios from "axios"
import { useEffect, useMemo, useRef, useState } from "react";
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
import { TrainList, type TrainDescription } from "../components/TrainDescription";
import moment from "moment";

function Categorize() {
    const [searchParams, setSearchParams] = useSearchParams()
    const videoPath = useMemo(() => searchParams.get("video"), [searchParams])
    const videoTime = useMemo(() => {
        if (!videoPath) return null

        const fileName = videoPath.split('/')[1]
        if (!fileName) return null

        const timeCode = fileName.split('.')[0]
        if (!timeCode) return null

        const time = moment(timeCode, "YYYY-MM-DD_HH-mm-ss")
        return time.isValid() ? time : null
    }, [videoPath])

    const { data, error, isFetching, isLoading } = useQuery({
        queryKey: ['pending'],
        queryFn: () => axios.get<string[]>("/api/categorize/pending"),
        staleTime: 300_000,
    })

    const playbackMenuRef = useRef<MediaPlaybackRateMenuType>(null)
    const playbackButtonRef = useRef<MediaPlaybackRateMenuButtonType>(null)
    const [playing, setPlaying] = useState<boolean>(true)

    const [trainDescriptions, setTrainDescriptions] = useState<TrainDescription[]>([{}])

    useEffect(() => {
        // Default to first video
        if (data && !videoPath) {
            setSearchParams({ "video": data.data[0] })
        }
    })

    if (isFetching || isLoading) {
        return <p>Loading...</p>
    } else if (error) {
        return <p>Error: {error.message}</p>
    }

    // Load playback speed preference
    const preferredPlaybackSpeedJson = localStorage.getItem("categorize-playback-speed") || '1'
    const preferredPlaybackSpeed = JSON.parse(preferredPlaybackSpeedJson)
    const playbackSpeed = typeof preferredPlaybackSpeed == 'number' && preferredPlaybackSpeed > 0 ? preferredPlaybackSpeed : 1

    return <>
        <div className="categorize-view">
            <VerticalVideoSelector sources={data!.data} value={videoPath!} onChanged={idx => {
                // Save playback speed preference
                if (playbackMenuRef.current) {
                    localStorage.setItem("categorize-playback-speed", playbackMenuRef.current.mediaPlaybackRate.toString())
                }

                setSearchParams({ "video": idx })
                setPlaying(true)
                setTrainDescriptions([{}])
            }} />

            <div className="media-box">
                <MediaController>
                    <ReactPlayer 
                        slot="media"
                        src={videoPath ? `/cdn/video/${videoPath}` : undefined}
                        playing={playing}
                        onPlay={() => setPlaying(true)}
                        onPause={() => setPlaying(false)}
                        playbackRate={playbackSpeed}
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
                </MediaController>

                <div className="control-btns">
                    <button className='button button-danger'>Zurücksetzen</button>
                    <button className='button'>Speichern</button>
                    <button className='button button-primary'>Weiter</button>
                </div>
            </div>
            

            <TrainList time={videoTime!} descriptions={trainDescriptions} setDescriptions={setTrainDescriptions} />
        </div>
    </>
}

export default Categorize