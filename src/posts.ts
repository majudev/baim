import express, { Request, Response, NextFunction, Router } from 'express';
import bodyParser from 'body-parser';
import logger from './utils/logger';
import { performance } from 'perf_hooks';
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

const router: Router = express.Router();

router.post('/v1', bodyParser.text({type: 'text/plain'}), async (req: Request, res: Response) => {
    const postContent = req.body as string;
    logger.info('postContent: ' + postContent);
    const db = await open({
        filename: 'database.db',
        driver: sqlite3.Database
    })
    await db.exec('INSERT INTO "Post" (`postContent`) VALUES (\'' + postContent + '\')');
    res.status(200).json({
        status: "success",
        postContent: postContent,
    });
});

router.get('/v1', async (req: Request, res: Response) => {
    const db = await open({
        filename: 'database.db',
        driver: sqlite3.Database
    })
    const result = await db.all('SELECT postId,postContent FROM "Post"');

    res.status(200).json({
        status: "success",
        posts: [
            result
        ],
    });
});

router.delete('/v1/:postId', async (req: Request, res: Response) => {
    const postId = req.params.postId;

    const db = await open({
        filename: 'database.db',
        driver: sqlite3.Database
    })
    await db.exec('DELETE FROM "Post" WHERE postId=\'' + postId + '\'');

    res.status(204).end();
});

export default router;
