import { google } from 'googleapis';

const gauth = () => {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });
    return { sheets, drive, access_token: auth.getCredentials.access_token };
};

export default gauth;