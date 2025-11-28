import moment from "moment"

import fs from "node:fs"
import path from "path"

import { type Train, type Schedule, type TrainInformation } from '../common/train.ts'
import { getCategoryFromNumber, type Locomotive } from '../common/locomotive.ts'

import logger from "./logger.ts"

const reISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.{0,1}\d*))(?:Z|(\+|-)([\d|:]*))?$/;

type HourMinute = { hour: number, minute: number }

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

type LocomotiveAllocationEntry = {
    number: number
    service_identifier: string
    distance_km: number

    yesterday: {
        location: string
        train_number: string
        service_identifier: string
    }
    tomorrow: {
        location: string
        train_number: string
        service_identifier: string
    }

    routes: {
        origin_location: string
        destination_location: string

        locomotive_position: string | null
        train_number: string

        departure_time: HourMinute
        arrival_time: HourMinute
    }[]
}
type TrainAllocationEntry = {
    number: string

    origin_location: string
    destination_location: string

    departure_time: HourMinute
    arrival_time: HourMinute

    locomotives: {
        number: number
        role: string | null
        position: number
    }[]
}
type LocomotiveAllocations = { 
    locomotives: LocomotiveAllocationEntry[]
    trains: TrainAllocationEntry[] 
}

function jsonMomementReceiver(_: string, value: any) {
    // Manually parse moments
    if (typeof value != 'string' || !reISO.exec(value)) return value

    const parsedMoment = moment(value)
    if (parsedMoment.isValid()) return parsedMoment

    return value
}

const dataDir = `${import.meta.dirname}/../../data/schedule`
const allocationDir = `${import.meta.dirname}/../../data/locomotive_allocations`

// Read index
const indexPath = path.join(dataDir, "index.json")
const indexFile = fs.readFileSync(indexPath, { encoding: 'utf-8' })
const indexJson = JSON.parse(indexFile, jsonMomementReceiver) as ScheduleIndex

// Read all schedules
const schedules = indexJson.map(entry => {
    const schedulePath = path.join(dataDir, entry.file_path)
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

let allocationCache: { [key: string]: LocomotiveAllocations | null } = ({})

export function getTrainInformation(day: moment.Moment, number: string): TrainInformation | null {
    // Find scheduled train
    const train = schedules
        .filter(schedule => schedule.start_date <= day && schedule.end_date >= day)
        .map(schedule => schedule.trains
            .filter(train => train.applicable_weekdays.includes(day.weekday()) 
                          && (!train.applicable_start_date || train.applicable_start_date <= day) 
                          && (!train.applicable_end_date || train.applicable_end_date >= day))
            .find(train => train.number == number))
        .find(x => x)
    
    if (!train) return null

    // Search for train in day's allocations
    const allocationPath = path.join(allocationDir, `${day.format('YYYY_MM_DD')}.min.json`)

    let allocationEntry = allocationCache[allocationPath]
    if (allocationEntry == undefined) {
        try {
            const allocationFile = fs.readFileSync(allocationPath, { encoding: 'utf-8' })
            const allocationJson = JSON.parse(allocationFile, jsonMomementReceiver) as LocomotiveAllocations
    
            logger.info(`Found locomotive allocations for '${allocationPath}' with ${allocationJson.locomotives.length} locomotives and ${allocationJson.trains.length} trains`)
            allocationCache[allocationPath] = allocationEntry = allocationJson
        } catch (err) {
            // Ignore
            logger.error(`Failed to find locomotive allocations for '${allocationPath}'`)
            allocationCache[allocationPath] = allocationEntry = null
        }
    }
    if (!allocationEntry) return { train: train, locomotives: [] } as TrainInformation

    const minTimeHM = train.arrival_time || train.transit_time
    const maxTimeHM = train.departure_time || train.transit_time

    const minTime = minTimeHM ? minTimeHM.hour*60 + minTimeHM.minute : null
    const maxTime = maxTimeHM ? maxTimeHM.hour*60 + maxTimeHM.minute : null

    const allocatedTrain = allocationEntry.trains.find(t => t.number == number
        && (!minTime || (t.departure_time.hour*60 + t.departure_time.minute) <= minTime)
        && (!maxTime || (t.arrival_time.hour*60 + t.arrival_time.minute) >= maxTime))
    if (!allocatedTrain) return { train: train, locomotives: [] } as TrainInformation

    return {
        train: train,
        locomotives: allocatedTrain.locomotives.map(loco => ({
            number: loco.number,
            category: getCategoryFromNumber(loco.number),
            isTowed: loco.role == 'S',
            positionIndex: loco.position
        } as Locomotive))
    } as TrainInformation
}