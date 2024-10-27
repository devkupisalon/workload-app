import gauth from './gauth.js';

class SheetsDataProcessor {
    constructor() {
        this.auth = gauth()
        this.sheetsService = this.auth.sheets;
        this.driveService = this.auth.drive;
        this.mimeType = "application/vnd.google-apps.spreadsheet";
        this.id = '';
        this.sheetId = '';
    }

    async getSheetsDataById(spreadsheetId) {
        try {
            if (spreadsheetId === '') {
                throw new Error('Spreadsheet ID is empty');
            }
            const spreadsheet = await this.sheetsService.get(spreadsheetId);
            return spreadsheet;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    async findSheetsByNames(spreadsheetId, sheetNames) {
        try {
            const spreadsheet = await this.getSheetsDataById(spreadsheetId);
            if (!spreadsheet) {
                throw new Error('Spreadsheet not found');
            }
            const { sheets } = spreadsheet;

            const foundSheets = sheets.filter(({ properties: { title } }) => {
                return sheetNames.includes(title);
            });

            return foundSheets;
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async getDataFromSheets(spreadsheetId, sheetNames) {
        try {
            const foundSheets = await this.findSheetsByNames(spreadsheetId, sheetNames);
            let data = '';

            foundSheets.forEach(async ({ properties: { title } }) => {
                data = await this.getSheetData(spreadsheetId, title);
            });

            return data;
        } catch (error) {
            console.error(error);
            return '';
        }
    }

    async getSheetData(spreadsheetId, sheetName) {
        try {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}`;
            const params = {
                method: 'get',
                headers: {
                    Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
                },
                muteHttpExceptions: true
            };

            const response = await UrlFetchApp.fetch(url, params);
            const { values } = JSON.parse(response.getContentText());

            return values;
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async getYearSpreadsheet(name, folderId) {
        const { files } = await this.driveService.list({
            q: `name='${name}' and mimeType='${this.mimeType}' and '${folderId}' in parents`,
            fields: 'files(id)',
        });

        if (files.length === 0) {
            utils.alert(`Таблиц с названием '${name}' не найдена, пожалуста создайте табель на следующий годя для верного расчета даты`);
            return;
        } else {
            return files[0].id;
        }
    }

    async getSpreadsheet(folderId, name, sheetName, mainSpreadsheetId, sourceSheetId, sourceSpreadsheetId) {
        let spreadsheetId, sheetId;
        const { files } = await this.driveService.list({
            q: `name='${name}' and mimeType='${this.mimeType}' and '${folderId}' in parents`,
            fields: 'files(id)',
        });

        if (files.length === 0) {
            spreadsheetId = await Sheets_lib.copySpreadsheet({ fileName: name, sourceSpreadsheetId, folderId });
        } else {
            spreadsheetId = files[0].id;
        }

        sheetId = await this.copySheet(spreadsheetId, mainSpreadsheetId, sourceSheetId, sheetName);

        this.id = spreadsheetId;
        this.sheetId = sheetId;

        return { spreadsheetId, sheetId };
    }

    async getSheetId(sheetName) {
        const spreadsheet = await this.getSheetsDataById(this.id);
        return spreadsheet.sheets.find((sheet) => {
            return sheet.properties.title === sheetName;
        }).properties.sheetId;
    }

    async copySheet(destinationSpreadsheetId, sourceSpreadsheetId, sheetId, title) {
        const newSheetId = await this.sheetsService.Sheets.copyTo({ destinationSpreadsheetId }, sourceSpreadsheetId, sheetId).sheetId;
        this.renameSheet(destinationSpreadsheetId, title, newSheetId);
        return newSheetId;
    }

    async renameSheet(spreadsheetId, title, sheetId) {
        let requests = [];
        const spreadsheet = await this.getSheetsDataById(spreadsheetId);
        const { sheets } = spreadsheet;

        if (sheets[0].properties.title === 'Лист1') {
            requests.push({ deleteSheet: { sheetId: sheets[0].properties.sheetId } });
        }

        requests.push({ updateSheetProperties: { properties: { sheetId, title }, fields: 'title' } });

        await this.sheetsService.batchUpdate({ requests }, spreadsheetId);
    }

    async batchSetData(range, values, spreadsheetId) {
        const requests = {
            data: { range, values },
            valueInputOption: 'USER_ENTERED'
        };

        try {
            const response = await this.sheetsService.Values.batchUpdate(requests, spreadsheetId);
            if (response) {
                console.log(response);
                return response;
            }
            console.log('No response received.');
        } catch (e) {
            console.log('Failed to update data with error: %s', e.message);
        }
    }

    async getRowGroupsFromSheet(spreadsheetId, ranges, sheetName) {
        const [{ properties: { sheetId }, rowGroups }] = (await this.sheetsService.get(spreadsheetId, { ranges })).sheets
            .filter(({ properties: { title } }) => title === sheetName);
        return { sheetId, rowGroups };
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

    async getRowsCount(sheetName, spreadsheetId) {
        try {
            const response = await this.sheetsService.get(spreadsheetId);
            const { sheets } = response;
            const sheet = sheets.find(s => s.properties.title === sheetName);
            const { gridProperties: { rowCount }, sheetId } = sheet.properties;

            return { rowCount, sheetId };
        } catch (e) { console.log('Failed with error %s', e.message); }
    }
}

export default SheetsDataProcessor;
