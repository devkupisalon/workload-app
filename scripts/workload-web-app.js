import SheetsDataProcessor from './sheets-processor.js';
import logger from '../logs/logger.js';
import gauth from './gauth.js';
import { constants } from '../constants.js';

/** responsibles ID */
const { mainID,
    workloadID,
    armaturka,
    zakroischik,
    obivschik,
    shvei,
    rulist,
    master,
    detailing,
    storonniki,
    malyrka,
    electric } = constants;

/**
 * Класс WorkWebApp представляет веб-приложение для работы с данными о производствах и заказах.
 */
class WorkWebApp {
    /**
     * Создает экземпляр класса WorkWebApp.
     */
    constructor() {
        this.processor = new SheetsDataProcessor();
        this.id = workloadID;
        this.access_token = gauth().access_token;
        this.sheetName = "настройки";
        this.workSheetName = "Рабочий Лист";
        this.col = "T";
        this.colStatus = "H";
        this.data = null;
        this.dataSheetName = 'полные данные';
        this.config = 'config';
        this.workersSheetName = 'Сотрудники производств'
        this.mainId = mainID;
        this.withAutoSheetName = 'данные с авто';
        this.workersObj = {};
        this.withCarObj = {};
        this.idObj = {
            Арматурка: armaturka,
            Закройщик: zakroischik,
            Обивщик: obivschik,
            Швеи: shvei,
            Рулист: rulist,
            Мастер: master,
            Детейлинг: detailing,
            Сторонники: storonniki,
            Малярка: malyrka,
            Электрик: electric
        };
    }

    async get_responsible(user_id) {
        const responsible = await this.processor.get_data(this.id, this.config)
            .find(r => r[1].includes(String(user_id)));
            console.log(responsible);
            logger.info(responsible);
        return responsible;
    }

    /**
     * Получает данные из листа с информацией о заказах с автомобилем.
     * Возвращает объект с данными, группированными по ответственным лицам.
     */
    async getOrdersWithCar() {
        this.withCarObj = await this.processor.get_data(this.id, this.withAutoSheetName)
            .slice(1)
            .reduce((acc, [, time, orderNumber, car, , responsible, , , , folder, anketaLink]) => {
                const responsibles = responsible.split(',');
                responsibles.forEach(res => {
                    res = res.trim();
                    folder = folder !== null && folder !== undefined ? folder.match(/\/folders\/([\w-]+)/)?.[1] : folder;
                    if (!acc[res] && res !== '') acc[res] = []
                    if (res !== '') acc[res].push({ orderNumber, time, car, folder, anketaLink });
                });
                return acc;
            }, {});
        logger.info(JSON.stringify(this.withCarObj, null, 2));
    }

    /**
     * Получает список исполнителей и их ответственных лиц из исходных данных.
     */
    async getWorkers() {
        // Получаем данные исполнителей и ответственных лиц из листа
        this.workersObj = await this.processor.get_data(this.mainId, this.workersSheetName)
            .slice(1)
            .reduce((acc, [worker, responsible]) => {
                // Создаем массив для каждого ответственного лица, если он еще не существует
                if (!acc[responsible]) acc[responsible] = [];
                // Добавляем исполнителя в массив для соответствующего ответственного лица
                acc[responsible].push(worker);
                return acc;
            }, {});
    }

    /**
     * Получает данные из исходного листа, включая список исполнителей и ответственных лиц.
     * Возвращает объект с данными и список ответственных лиц.
     */
    async getData() {
        await this.getOrdersWithCar();
        await this.getWorkers();
        let obj = await this.processor.get_data(this.id, this.dataSheetName)
            .slice(1)
            .reduce((acc, [orderId, field, responsible, worker, status, , , , , sequentialInResponsible, workHours, spareHours, sequentialInOrder]) => {
                if (!acc.responsibles) acc.responsibles = new Set();
                if (!acc[orderId]) acc[orderId] = {};
                if (!acc[orderId][responsible]) acc[orderId][responsible] = []
                acc.responsibles.add(responsible)
                acc[orderId][responsible].push({ field, worker, status, sequentialInResponsible, workHours, spareHours, sequentialInOrder })
                return acc;
            }, {});

        obj.responsibles = Array.from(obj.responsibles);
        this.data = { obj, workersObj: this.workersObj, carObj: this.withCarObj };
        return this.data;
    }

    /**
     * Находит и группирует строки данных по номеру заказа
     * @param {Object} orderData - Объект с информацией о заказе
     * @param {string} orderData.orderNumber - Номер заказа для поиска и группировки
     * @param {Sheet} orderData.sourceSheet - Лист, на котором производится поиск
     * @returns {Array} - Массив сгруппированных значений
     */
    findIndex(orderData) {
        const { orderNumber, values, workType } = orderData;
        let stopSearch = false;
        let groupedValues = 0;

        values.forEach(([, , orderNum, , work], index) => {
            // Проверяем, если найден номер заказа
            if (orderNum == orderNumber) stopSearch = true;

            // Если поиск активен и текущее значение пустое или равно номеру заказа, добавляем строку к сгруппированным значениям
            if (stopSearch && (orderNum == "" || orderNum === orderNumber) && work === workType) groupedValues = index;

            // Если текущее значение не пустое и не равно номеру заказа, сбрасываем поиск
            if (orderNum !== "" && index !== 0 && orderNum !== orderNumber) stopSearch = false;

        });

        return groupedValues;
    }

    /**
     * Обновляет данные в таблице.
     * @param {Object} data - Объект с данными для обновления.
     * @param {number} data.time - Время работы.
     * @param {string} data.responsible - Ответственный за работу.
     * @param {string} data.orderNumber - Номер заказа.
     * @param {string} data.workType - Тип работы.
     * @param {boolean} finish - Флаг, указывающий, завершена ли работа.
     */
    async update(data_obj) {
        const { data, finish } = data_obj;
        const { time, responsible, orderNumber, workType } = JSON.parse(data);
        const index = this.findIndex({ orderNumber, workType, values: await this.processor.getSheetData(this.idObj[responsible], this.workSheetName).slice(1) });
        await this.processor.batchSetData(`${this.workSheetName}!${this.col}${index + 2}`, [[time]], this.idObj[responsible]);
        if (finish) await this.processor.batchSetData(`${this.workSheetName}!${this.colStatus}${index + 2}`, [["Закончено"]], this.idObj[responsible]);
    }

    async batchUploadFiles(data) {
        try {
            // Получаем информацию о вложениях и созданные blob'ы
            const { attachmentsData, blobs } = JSON.parse(data);
            const boundary = "xxxxxxxxxx"; // Уникальная граница нужна для разделения частей в multipart запросе

            // Создаем массив запросов для каждого вложения
            const requests = attachmentsData.map(async (metadata, index) => {
                // Формирование multipart тела запроса
                let body = `--${boundary}\r\n`;
                body += `Content-Disposition: form-data; name="metadata"\r\n`;
                body += `Content-Type: application/json; charset=UTF-8\r\n\r\n`;
                body += `${JSON.stringify(metadata)}\r\n`;

                body += `--${boundary}\r\n`;
                body += `Content-Disposition: form-data; name="file"; filename="${metadata.name}"\r\n`;
                body += `Content-Type: image/png\r\n\r\n`;

                // Объединение данных и blob'ов для формирования payload
                let payload = new Uint8Array([...new TextEncoder().encode(body), ...new Uint8Array(blobs[index]), ...new TextEncoder().encode(`\r\n--${boundary}--`)]);

                // Формирование объекта запроса для fetch API
                let request = {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.access_token}`,
                        'Content-Type': `multipart/related; boundary=${boundary}`
                    },
                    body: payload
                };

                // Отправка запроса на загрузку файла на Google Диск
                return await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', request)
                    .then(response => {
                        if (response.ok) {
                            return "success";
                        } else {
                            throw new Error('Failed to upload file');
                        }
                    });
            });

            // Отправка всех запросов и проверка успешности загрузки
            return Promise.all(requests)
                .then(results => {
                    if (results.every(result => result === "success")) {
                        return "All files uploaded successfully";
                    } else {
                        throw new Error('Some files failed to upload');
                    }
                });

        } catch (error) {
            logger.error(error);
            return error;

        }
    }
}

const work = new WorkWebApp();
const getData = async () => { return await work.getData() };
const updateTime = async (data, finish) => { await work.update(data) };
const uploadFile = async (data) => { await work.batchUploadFiles(data) };
const get_responsible = async (user_id) => { return await work.get_responsible(user_id) };

export { getData, updateTime, uploadFile, get_responsible };