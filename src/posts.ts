import express, { Request, Response, NextFunction, Router } from 'express';
import bodyParser from 'body-parser';
import logger from './utils/logger';
import { performance } from 'perf_hooks';
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

// this is a top-level await 
(async () => {
    // open the database
    const db = await sqlite3.open({
      filename: '/tmp/database.db',
      driver: sqlite3.Database
    })
})()

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const router: Router = express.Router();

router.post('/v1', bodyParser.text({type: 'text/plain'}), async (req: Request, res: Response) => {
    const postContent = req.body as string;
    logger.info('postContent: ' + postContent);
    res.status(200).json({
        status: "success",
        postId: 0,
        postContent: postContent,
    });
});

router.get('/v1', async (req: Request, res: Response) => {
    res.status(200).json({
        status: "success",
        posts: [
            {
                postId: 0,
                postContent: 'postContent',
            }
        ],
    });
});

router.delete('/v1/:postId', async (req: Request, res: Response) => {
    const postId = Number.parseInt(req.params.postId);

    res.status(204).end();
});

router.post('/v2', bodyParser.text({type: 'text/plain'}), async (req: Request, res: Response) => {
    try{
        const postContent = req.body as string;
        logger.info('postContent: ' + JSON.stringify(postContent));
        const newPost = await prisma.post.create({
            data: {
                postContent: postContent,
            }
        });
        res.status(200).json({
            status: "success",
            postId: newPost.postId,
            postContent: newPost.postContent,
        });
    }catch(e){
        res.status(500).json({
            status: "error",
            details: JSON.stringify(e),
        });
    }
});

router.get('/v2', async (req: Request, res: Response) => {
    try{
        const allPosts = await prisma.post.findMany({

        });
        res.status(200).json({
            status: "success",
            posts: allPosts,
        });
    }catch(e){
        res.status(500).json({
            status: "error",
            details: JSON.stringify(e),
        });
    }
});

router.delete('/v2/:postId', async (req: Request, res: Response) => {
    try{
        const postId = Number.parseInt(req.params.postId);
        
        await prisma.post.delete({
            where: {
                postId: postId,
            }
        });

        res.status(204).end();
    }catch(e){
        res.status(500).json({
            status: "error",
            details: JSON.stringify(e),
        });
    }
});

export default router;
