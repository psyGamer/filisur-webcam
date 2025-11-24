import { Router } from "express";

const router = Router()

router.get("/categorize/pending", async (_, res) => {
    res.status(200).send([
        "/videos/2025-11-23/2025-11-23_10-58-05.mp4"
    ])
})

export default router