import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express from 'express'

import { createServer as createViteServer } from 'vite'

import videos from './server/videos.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function createServer() {
    const app = express()

    // Setup server routes
    app.use("/videos", videos)

    // Setup Vite middleware
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom'
    })
    app.use(vite.middlewares)
    app.use('*all', async (req, res, next) => {
        try {
            let url = req.originalUrl;
      
            let template = fs.readFileSync(
              path.resolve(__dirname, "index.html"),
              "utf-8"
            );
      
            template = await vite.transformIndexHtml(url, template);
            res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
            vite.ssrFixStacktrace(e as Error);
            next(e);
        }
    })

    app.listen(5173)
}

createServer()