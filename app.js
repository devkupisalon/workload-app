import express from 'express';
import path from 'path';

import logger from './logs/logger.js';
import { constants, __dirname } from './constants.js';
import { getData, updateTime, uploadFile } from './scripts/workload-web-app.js'

const { HOME } = constants;
const app = express();

const stylesPath = path.join(__dirname, 'styles');
const codePath = path.join(__dirname, 'code');

app.get('/styles/:path', (req, res) => res.sendFile(path.join(stylesPath, req.params.path)));

app.get('/scripts/:path', (req, res) => res.sendFile(path.join(codePath, req.params.path)));

app.get('/', (req, res) => res.sendFile(HOME));

app.use((error, req, res, next) => {
    logger.error(`An error occurred: ${error.message}`);
    res.status(500).send(error);
});

app.get('/upload_file', async (req, res) => {
    try {
        logger.info(`Data successfully received from mini-app: ${req.query}`);
        const success = await uploadFile(req.query.data);

        return res.json({ success });
    } catch (error) {
        logger.error(`An error occurred in save_data: ${error.message}`);
        return res.status(500).json({ error: error.toString() });
    }
});

app.get('/savedata', async (req, res) => {
    try {
        logger.info(`Data successfully received from mini-app: ${req.query}`);
        const success = await updateTime(req.query);

        return res.json({ success });
    } catch (error) {
        logger.error(`An error occurred in save_data: ${error.message}`);
        return res.status(500).json({ error: error.toString() });
    }
});

app.get('/getdata', async (req, res) => {
    try {
        const data = await getData();

        return res.json({ data });
    } catch (error) {
        logger.error(`An error occurred in get_data: ${error.message}`);
        return res.status(500).json({ error: error.toString() });
    }
});

app.listen('8001', (err) => {
    if (err) {
        logger.error(err.message);
    }
    logger.info('Server is running on port 8000');
});