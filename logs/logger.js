import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { __dirname } from '../constants.js';

const customTimeFormat = () => `,"time":"${new Date().toISOString()}"`;

if (!fs.existsSync(__dirname)) {
    fs.mkdirSync(__dirname, { recursive: true });
}

const logFilePath = path.join(__dirname, 'app.log');

const logger = pino({
    level: 'debug',
    timestamp: customTimeFormat,
    transport: ({
        targets: [{
            target: 'pino-pretty'
        },
        {
            target: 'pino/file', options: { destination: logFilePath, mkdir: true },
        }]
    }),
});

export default logger;