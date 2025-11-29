import { Router } from "express";
import moment from 'moment'

import { getLocomotives, getTrainByNumber, getTrainsInTimespan } from './schedule.ts'
import type { TrainInformation } from "../common/train.ts";

const router = Router()

router.get("/pending", async (_, res) => {
    res.status(200).send([
        "2025-11-23/2025-11-23_09-00-15.mp4",
        "2025-11-23/2025-11-23_09-30-32.mp4",
        "2025-11-23/2025-11-23_09-32-11.mp4",
        "2025-11-23/2025-11-23_09-58-24.mp4",
        "2025-11-23/2025-11-23_10-00-23.mp4",
        "2025-11-23/2025-11-23_10-01-34.mp4",
        "2025-11-23/2025-11-23_10-58-05.mp4",
        "2025-11-23/2025-11-23_10-59-21.mp4",
        "2025-11-23/2025-11-23_11-00-39.mp4",
        "2025-11-23/2025-11-23_11-02-28.mp4",
        "2025-11-23/2025-11-23_11-55-53.mp4",
        "2025-11-23/2025-11-23_11-58-50.mp4",
        "2025-11-23/2025-11-23_12-02-16.mp4",
        "2025-11-23/2025-11-23_12-58-13.mp4",
        "2025-11-23/2025-11-23_12-58-48.mp4",
        "2025-11-28/2025-11-28_17-46-32.mp4"
    ])
})

router.get("/train-info", async (req, res) => {
    // @ts-ignore
    const dayInput: string | undefined = req.query.day
    const day = moment(dayInput, "YYYY-MM-DD", true)

    // @ts-ignore
    const trainNumber: string | undefined = req.query.train

    if (dayInput == undefined || !day.isValid()) {
        res.status(400).send("Expected target day in format '?day=[YYYY-MM-DD]'")
        return
    }
    if (trainNumber == undefined) {
        res.status(400).send("Expected target train number in format '?train=[number]'")
        return
    }

    const train = getTrainByNumber(day, trainNumber)
    if (!train) {
        // Return 204 instead of 404, since a 404 would get logged to the console..
        res.status(204).send(`Train number '${trainNumber}' on day '${dayInput}' was not found`)
        return
    }

    res.status(200).json({
        train: train,
        locomotives: getLocomotives(train, day)
    } as TrainInformation)
})
router.get("/suggestions", async (req, res) => {
    const { time: timeInput, regularVariance: regularVarianceInput, freightVariance: freightVarianceInput } = req.query as {
        time: string
        regularVariance: string
        freightVariance: string
    }

    const time = moment(timeInput, 'YYYY-MM-DD_HH-mm-ss', true)
    if (!time?.isValid()) {
        res.status(400).send("Expected starting time in format '?time=[YYYY-MM-DD_HH-mm-ss]'")
        return
    }

    const regularVariance = Number(regularVarianceInput)
    if (Number.isNaN(regularVariance)) {
        res.status(400).send("Expected regular train variance in format '?regularVariance=[minutes]'")
        return
    }

    const freightVariance = Number(freightVarianceInput)
    if (Number.isNaN(freightVariance)) {
        res.status(400).send("Expected freight train variance in format '?freightVariance=[minutes]'")
        return
    }

    const regularTrains = getTrainsInTimespan(time.clone().subtract(regularVariance, 'minutes'), time.clone().add(regularVariance, 'minutes'))
                            .filter(train => train.information?.classifier != 'G')
    const freightTrains = getTrainsInTimespan(time.clone().subtract(freightVariance, 'minutes'), time.clone().add(freightVariance, 'minutes'))
                            .filter(train => train.information?.classifier == 'G')

    res.status(200).json([...regularTrains, ...freightTrains])
})

export default router