import { Router } from 'express'

const router = Router()

router.get("/*path", async (req, res) => {
    // @ts-ignore
    const video_path = req.params.path

    console.log(`Vidoe Request: ${video_path}`)
})

export default router
