import express, { Request, Response, NextFunction, Router } from 'express';
import { performance } from 'perf_hooks';

const router: Router = express.Router();

router.get('/version', (req: Request, res: Response) => {
    res.json({
        status: "success",
        version: "1.0",
    });
});

export default router;
