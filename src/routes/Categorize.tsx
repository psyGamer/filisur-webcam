import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { useSearchParams } from "react-router-dom"
import VerticalVideoSelector from "../components/VerticalVideoSelector"
import VideoButton from "../components/VideoButton"

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

    return <>
        <VerticalVideoSelector sources={data!.data} />
    </>
}

export default Categorize