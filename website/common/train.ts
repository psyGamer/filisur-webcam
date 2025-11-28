import moment from "moment"

export type Train = {
    number: string
    arrival_time: { hour: number, minute: number } | null
    departure_time: { hour: number, minute: number } | null
    transit_time: { hour: number, minute: number } | null

    applicable_weekdays: number[]
    applicable_start_date: moment.Moment | null
    applicable_end_date: moment.Moment | null

    information?: {
        classifier: string
        origin: string
        destination: string
    }
}

export type Schedule = {
    start_date: moment.Moment
    end_date: moment.Moment

    trains: Train[]
}