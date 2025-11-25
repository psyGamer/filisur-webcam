import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { useSearchParams } from "react-router-dom"
import VerticalVideoSelector from "../components/VerticalVideoSelector"
import VideoButton from "../components/VideoButton"

import './Categorize.scss'

const useFetchPending = () => useQuery({
    queryKey: ['pending'],
    queryFn: () => axios.get<string[]>("/api/categorize/pending"),
    staleTime: 300_000,
})

function Categorize() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { data, error, isFetching, isLoading } = useFetchPending()

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
    }

    return <>
        <VerticalVideoSelector sources={videos} selectedIndex={selectedIdx >= 0 ? selectedIdx : null} onSelectedChanged={idx => {
            const url = new URL(window.location.href);
            url.searchParams.set("video", videos[idx]);
            window.history.pushState({}, "", url);

            // setSearchParams({ video: ":3" })
            // console.log(searchParams.get("video"))
        }} />
    </>
}

export default Categorize