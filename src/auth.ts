import express, { Request, Response, NextFunction, Router } from 'express';
import logger from './utils/logger';
import { performance } from 'perf_hooks';

const router: Router = express.Router();

//router.use();

router.get('/protected', (req: Request, res: Response) => {
    res.json({
        status: "success"
    });
});

export default router;
