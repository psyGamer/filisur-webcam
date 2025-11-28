import moment from "moment"

import fs from "node:fs"
import path from "path"

import { type Train, type Schedule } from '../common/train.ts'
import { type Locomotive } from '../common/locomotive.ts'

const reISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.{0,1}\d*))(?:Z|(\+|-)([\d|:]*))?$/;

type ScheduleIndex = {
    start_date: moment.Moment
    end_date: moment.Moment
    file_path: string
}[]
type TrainEntry = {
    number: string
    arrival_time: string
    departure_time: string
    transit_time: string

    applicable_weekdays?: string
    applicable_start_date?: moment.Moment
    applicable_end_date?: moment.Moment

    information?: {
        classifier: string
        origin: string
        destination: string
    }
}

function jsonMomementReceiver(_: string, value: any) {
    // Manually parse moments
    if (typeof value != 'string' || !reISO.exec(value)) return value

    const parsedMoment = moment(value)
    if (parsedMoment.isValid()) return parsedMoment

    return value
}

// Read index
const indexPath = path.join(process.env.SCHEDULE_DIRECTORY, "index.json")
const indexFile = fs.readFileSync(indexPath, { encoding: 'utf-8' })
const indexJson = JSON.parse(indexFile, jsonMomementReceiver) as ScheduleIndex

// Read all schedules
const schedules = indexJson.map(entry => {
    const schedulePath = path.join(process.env.SCHEDULE_DIRECTORY, entry.file_path)
    const scheduleFile = fs.readFileSync(schedulePath, { encoding: 'utf-8' })
    const scheduleFileStripped = scheduleFile.split('\n').map(line => line.trimStart().startsWith('//') ? '' : line).join('\n')
    const scheduleJson = JSON.parse(scheduleFileStripped, jsonMomementReceiver) as TrainEntry[]

    return {
        start_date: entry.start_date,
        end_date: entry.end_date,
        trains: scheduleJson.map(train => {
            const [arrHour, arrMinute] = train.arrival_time ? train.arrival_time.split(':') : [undefined, undefined]
            const [depHour, depMinute] = train.departure_time ? train.departure_time.split(':') : [undefined, undefined]
            const [traHour, traMinute] = train.transit_time ? train.transit_time.split(':') : [undefined, undefined]

            return ({
                number: train.number,
                arrival_time: train.arrival_time ? { hour: Number(arrHour), minute: Number(arrMinute) } : null,
                departure_time: train.departure_time ? { hour: Number(depHour), minute: Number(depMinute) } : null,
                transit_time: train.transit_time ? { hour: Number(traHour), minute: Number(traMinute) } : null,
                
                // @ts-ignore
                applicable_weekdays: !train.applicable_weekdays ? [1,2,3,4,5,6,7] : train.applicable_weekdays.split('').map(c => c - '0'),
                applicable_start_date: train.applicable_start_date || null,
                applicable_end_date: train.applicable_end_date || null,

                information: train.information,
            }) as Train;
        })
    } as Schedule
})

type TrainInformation = {
    train: Train
    locomotives: Locomotive[]
}
export function getTrainInformation(day: moment.Moment, number: string): TrainInformation | null {
    const train = schedules
        .filter(schedule => schedule.start_date <= day && schedule.end_date >= day)
        .map(schedule => schedule.trains
            .filter(train => train.applicable_weekdays.includes(day.weekday()) 
                          && (!train.applicable_start_date || train.applicable_start_date <= day) 
                          && (!train.applicable_end_date || train.applicable_end_date >= day))
            .find(train => train.number == number))
        .find(x => x)
    
    if (!train) return null

    return { train: train, locomotives: [] } as TrainInformation
}