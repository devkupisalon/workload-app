import gauth from './gauth.js';
import logger from '../logs/logger.js';

class SheetsDataProcessor {
    constructor() {
        this.auth = gauth()
        this.sheetsService = this.auth.sheets.spreadsheets;
        this.driveService = this.auth.drive;
    }

    async get_data(spreadsheetId, range) {
        try {
            const { data: { values } } = await this.sheetsService.values.get({
                spreadsheetId,
                range,
            });
            logger.info(values);
            return values
        } catch (error) {
            logger.error(error.message);
        }
    }

    async batchSetData(range, values, spreadsheetId) {

        try {

            const requestBody = { values };
            const { data } = await this.sheetsService.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody,
            });

            if (data.spreadsheetId) {
                logger.info('User data saved successfully');
                return true;
            }
        } catch (error) {
            logger.error(error.stack);
            return false;
        }
    }

    async deleteRows(spreadsheetId, sheetId, startIndex, endIndex) {
        if (endIndex - startIndex === 1) endIndex += 1;
        const request = {
            deleteDimension: {
                range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex,
                    endIndex
                }
            }
        };

        console.log(request);

        const response = await this.sheetsService.batchUpdate({ requests: [request] }, spreadsheetId);
        console.log(response);
    }

    async clear(A1, ssID) {
        try {
            const response = await this.sheetsService.Values.batchClear({ ranges: A1 }, ssID);
            if (response) { console.log(response); return; }
            console.log('Response null');
        } catch (e) { console.log('Failed with error %s', e.message) }
    }

    async insertRows(sheetId, startIndex, endIndex, spreadsheetId) {
        try {
            const resource = {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId,
                                dimension: 'ROWS',
                                startIndex,
                                endIndex
                            },
                            inheritFromBefore: true
                        }
                    }
                ]
            };

            const response = await this.sheetsService.batchUpdate(resource, spreadsheetId);
            if (response) { console.log(response); return; }
            console.log('Response null');
        } catch (e) { console.log('Failed with error %s', e.message); }
    }
}

export default SheetsDataProcessor;
