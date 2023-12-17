import express, { Request, Response } from 'express';
import requestLogger from './utils/requestLogger';
import basicAuth from 'express-basic-auth';
import { rateLimit } from 'express-rate-limit'

const app = express();

app.use(express.json());
app.use(requestLogger);

import authRouter from './auth';
app.options('/auth');
app.use('/auth', authRouter);

app.use(basicAuth({
    users: { 'admin': 'supersecret' }
}));

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	// store: ... , // Use an external store for consistency across multiple server instances.
});

// Apply the rate limiting middleware to all requests.
app.use(limiter);

const port = 9030;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
