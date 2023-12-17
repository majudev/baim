import winston from 'winston';
import colors from '../utils/colors';

interface ColorMap {
	[key: string]: string;
}

const levelColors: ColorMap = {
	info: colors.blue,
	debug: colors.yellow,
	error: colors.red,
	reset: colors.reset,
};

const logger = winston.createLogger({
	level: process.env.LOGLEVEL !== undefined ? process.env.LOGLEVEL : 'debug',
	format: winston.format.combine(
		winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		winston.format.printf(({ timestamp, level, message }) => {
			const color = levelColors[level] || '';
			return `${timestamp} ${color}[${level.toUpperCase()}]${colors.reset}: ${message}`;
		})
	),
	transports: [
		new winston.transports.Console(),
		// new winston.transports.File({ filename: 'app.log' }) // Save logs to a file
	]
});

export default logger;
