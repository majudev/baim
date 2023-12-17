import express, { Request, Response, NextFunction, Router } from 'express';
import logger from './utils/logger';
import { createClient } from 'redis';
import { performance } from 'perf_hooks';

const router: Router = express.Router();

export default router;
