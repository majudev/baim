import express, { Request, Response } from 'express';
import requestLogger from './utils/requestLogger';
import basicAuth from 'express-basic-auth';

const app = express();

app.use(express.json());
app.use(requestLogger);

import authRouter from './auth';
app.options('/auth');
app.use('/auth', authRouter);

app.use(basicAuth({
    users: { 'admin': 'supersecret' }
}))

const port = 9030;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
