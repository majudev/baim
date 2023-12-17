import {NextFunction, Response, Request} from 'express';
import logger from '../utils/logger';

/**
 * HTTP request logger - express middleware.
 */
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
	const ip = req.header('CF-Connecting-IP') ?? req.ip

	logger.info('[' + ip + '] ' + req.method + ' ' + req.originalUrl);

	next();
};

export default requestLogger;
