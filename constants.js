import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const constants = {
    ...Object.keys(process.env).reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
    }, {}),
    HOME: `${__dirname}/index.html`,
};

export { constants, __dirname };