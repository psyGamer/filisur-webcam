import moment from "moment"
import type { Locomotive } from "./locomotive"

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
export function isTrainApplicable(train: Train, time: moment.Moment): boolean {
    return train.applicable_weekdays.includes(time.weekday()) 
        && (!train.applicable_start_date || train.applicable_start_date <= time)
        && (!train.applicable_end_date || train.applicable_end_date >= time)
}

export type Schedule = {
    start_date: moment.Moment
    end_date: moment.Moment

    trains: Train[]
}
export function isScheduleApplicable(schedule: Schedule, time: moment.Moment): boolean {
    return schedule.start_date <= time && schedule.end_date >= time
}


export type TrainInformation = {
    train: Train
    locomotives: Locomotive[]
}
