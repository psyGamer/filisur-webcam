import { Router } from "express";
import moment from 'moment'

import { getTrainInformation } from './schedule.ts'

const router = Router()

router.get("/categorize/pending", async (_, res) => {
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
    ])
})

router.get("/categorize/train-info", async (req, res) => {
    // @ts-ignore
    const dayInput: string | undefined = req.query.day
    const day = moment(dayInput, "YYYY-MM-DD", true)

    console.log(day.toJSON())

    // @ts-ignore
    const trainNumber: string | undefined = req.query.train

    if (!dayInput || !day.isValid()) {
        res.status(400).send("Expected target day in format '?day=<YYYY-MM-DD>'")
        return
    }
    if (!trainNumber) {
        res.status(400).send("Expected target train number in format '?train=<number>'")
        return
    }

    const info = getTrainInformation(day, trainNumber)
    if (!info) {
        // Return 204 instead of 404, since a 404 would get logged to the console..
        res.status(204).send(`Train number '${trainNumber}' on day '${dayInput}' was not found`)
        return
    }

    res.status(200).json(info)
})

export default router