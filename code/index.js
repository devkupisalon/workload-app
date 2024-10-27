const tg = window.Telegram.WebApp;

tg.enableClosingConfirmation();
tg.ready();

const fetchData = async () => {
    try {
        const response = await fetch(`/validate-init?${tg.initData}`);
        const data = await response.json();
    } catch (error) {
        console.error('Error:', error);
    }
};

fetchData();

const { user: { username, id } } = tg.initDataUnsafe;

class PageController {
    constructor() {
        // Инициализация текущего шага
        this.currentStep = null;
        this.dataObj = null;
        this.timerInterval = null; // Идентификатор интервала обновления времени
        this.elapsedTime = 0; // Прошедшее время с момента начала работы
        this.responsible = null;
        this.start = "Начать работу";
        this.returnText = "Вы уверены, что хотите завершить работу?";
        this.mnClicked = false;
        this.myClicked = false;
        this.alertText = "У вас есть запущенная работа, вы уверены что хотите перейти к списку работ?";
        this.successText = "Фото успешно загружено";
        this.successData = "Данные успешно записаны";
        this.textAfter = "Загрузите фото ПОСЛЕ";
        this.textBefore = "Сначала загрузите фото ДО";

        /** Получаем все элементы со страницы */
        this.data = [
            "order-table",
            "selected-production-arrow",
            "order-selection",
            "selected-production",
            "additional-table",
            "selected-order",
            "start-button",
            "finish-button",
            "selected-work",
            "work-block",
            "modal",
            "modal-buttons",
            "modal-yes",
            "modal-no",
            "modal-photo",
            "uploadfile",
            "modal-finish",
            "upload-form",
            "link-element"
        ].reduce((acc, id) => {
            const itemId = id.replace(/-([a-zA-Z])/g, (match, char) => char.toUpperCase());
            acc[itemId] = document.getElementById(id);
            return acc;
        }, {});

        /** Словарь цветов для состояний */
        this.colors = {
            "В работу": "mistyrose", // Светло красный
            "В процессе": "lightgoldenrodyellow", // Светло желтый
            "Задержка": "salmon" // Красный
        };

        /** Деструтктурируем их */
        [this.ot,
        this.spa,
        this.os,
        this.sp,
        this.at,
        this.so,
        this.sb,
        this.fb,
        this.sw,
        this.wb,
        this.m,
        this.mb,
        this.my,
        this.mn,
        this.mu,
        this.uf,
        this.mf,
        this.f,
        this.le] = Object.values(this.data);

        /** Стили для элементов */
        this.none = { display: "none" };
        this.t = { display: "table", margin: "0 auto" };
        this.ib = { display: "inline-flex" };
        this.center = { display: "flex" };

        /** Объект с картой ключей из данных по заказам и заголовков таблиц */
        this.obj = {
            field: "Вид работы",
            worker: "Сотрудник",
            status: "Статус",
            date: "Дата приезда",
            orderNumber: "Номер заказа",
            time: "Время приезда",
            car: "Авто",
            folder: "Папка с фотографиями"
        };

        /** Объект с картой страниц и элементов */
        this.pagesMap = {
            list: {
                styles: {
                    none: [this.at, this.so, this.sw, this.spa, this.wb, this.sb, this.fb],
                    ib: [this.sp],
                    t: [this.ot],
                    center: [this.os]
                }
            },
            order: {
                clear: this.so,
                method: () => { this.createOrderTable(this.dataObj, this.responsible) },
                styles: {
                    none: [this.ot, this.sw, this.wb, this.sb, this.fb],
                    ib: [this.spa, this.so, this.sp],
                    t: [this.at]
                }
            },
            work: {
                clear: this.sw,
                method: () => { this.createWorksTable(this.dataObj, this.responsible, this.so.textContent) },
                styles: {
                    none: [this.at, this.ot],
                    ib: [this.spa, this.so, this.sp, this.sb, this.fb, this.sw],
                    center: [this.os, this.wb]
                }
            }
        };

        document.addEventListener("DOMContentLoaded", () => {
            this.refreshData();
            const elapsedTime = this.getElapsedTimeFromStorage();
            if (elapsedTime !== 0) {
                this.elapsedTime = elapsedTime;
                this.timerInterval = this.updateInetrval(this.sb);
            }
        });

        // Обработчик события клика на кнопки
        $(".button-class").on("click", () => {
            this.saveDataToStorage();
        });

        // Обработчик события клика на строки
        $(document).on("click", "tr", () => {
            this.saveDataToStorage();
        });

        // обработчик события загрузки страницы для вызова метода loadDataFromStorage
        window.addEventListener('load', () => {
            this.responsible = this.get_responsible(id);
            this.loadDataFromStorage();
        });
    }

    async get_responsible(user_id) {
        const response = await fetch(`/get_responsible?user_id=${user_id}`);
        const { responsible } = await response.json();
        console.log(`Responsible for user with id ${user_id} is ${responsible}`);
        return responsible;
    }

    /** Обновляет текущий шаг на основе переданного номера заказа и отображает соответствующие элементы */
    updateStep() {
        const { keys, currentIndex } = this.getKeys();

        this.currentStep = keys[currentIndex + 1];
        console.log(`Current step after update: ${this.currentStep}`);

        this.setStyle();
    }

    /** Получаем клоючи из объекта и индекс ключа текущего шага */
    getKeys() {
        const keys = Object.keys(this.pagesMap);
        const currentIndex = keys.indexOf(this.currentStep);
        return { keys, currentIndex };
    }

    /** Переходит на предыдущий шаг, если он существует, и обновляет элементы */
    goToPreviousStep() {
        if (this.timerInterval !== null || this.elapsedTime !== 0) {
            this.mb.style.display = "inline-Block";
            this.mb.querySelector("h3").textContent = this.alertText;

            if (!this.mnClicked) {
                this.mn.addEventListener("click", () => {
                    this.mb.style.display = "none";
                    this.mb.querySelector("h3").textContent = this.returnText;
                });
                this.mnClicked = true;
            }

            if (!this.myClicked) {
                this.my.addEventListener("click", () => {
                    this.clearTime();
                    this.mb.style.display = "none"; // Закрытие модального окна
                    this.m.style.display = "none";
                    this.mb.querySelector("h3").textContent = this.returnText;
                    this.go();
                });
                this.myClicked = true;
            }
        } else {
            this.go();
        }
    }

    /** Двигаемся назад */
    go() {
        const { method, clear } = this.pagesMap[this.currentStep];
        const { keys, currentIndex } = this.getKeys();

        if (currentIndex > 0) this.currentStep = keys[currentIndex - 1];
        // Если у предыдущего шага определена функция, вызвать ее
        if (typeof method === 'function') method.call(this);
        if (clear) clear.textContent = '';
        this.saveDataToStorage();

        // Обновить элементы
        this.setStyle();
    }

    /** Обновление данных каждую минуту с помощью setInterval */
    startDataRefreshInterval() {
        setInterval(() => {
            this.refreshData();
        }, 600000);
    }

    /** Обновляет данные, вызывая метод loadData после успешного получения данных */
    async refreshData() {
        const response = await fetch(`/getdata`);
        const { data } = await response.json();
        if (data !== undefined || data !== null) this.dataObj = data; // Используем стрелочную функцию для сохранения контекста this
        this.saveDataToStorage(); // Сохранение данных в хранилище после успешной загрузки
    }

    /** Сохранение данных в хранилище */
    saveDataToStorage() {
        const pageData = {
            responsible: this.responsible,
            selectedOrder: this.so.textContent,
            dataObj: this.dataObj,
            currentStep: this.currentStep,
            elapsedTime: this.elapsedTime,
            timerInterval: this.timerInterval,
            selectedWork: this.sw.textContent
        };

        console.log(`Data saved to storage...`);
        console.log(pageData);

        localStorage.setItem('pageData', JSON.stringify(pageData));
    }

    /** Проверяет отработанное время и обновляет текст кнопки после перезагрузки страницы*/
    checkButton(pageData) {
        const { elapsedTime } = pageData;
        const { sb } = this;
        if (sb) {
            elapsedTime
                ? sb.textContent = this.formatTime(elapsedTime)
                : sb.textContent = 'Начать работу';
        }
    }

    /** Загрузка данных из хранилища */
    loadDataFromStorage() {
        const pageData = JSON.parse(localStorage.getItem('pageData'));
        if (pageData) {
            const { dataObj, responsible, selectedOrder, currentStep, elapsedTime, timerInterval, startTime, selectedWork } = pageData;

            this.currentStep = currentStep;
            this.elapsedTime = elapsedTime;
            this.timerInterval = timerInterval;

            console.log(`loaded data from storage`);
            console.log(pageData);

            const stepData = {
                work: {
                    condition: responsible && selectedOrder && selectedWork,
                    method: () => this.workBlock({ selectedWork, selectedOrder, responsible }, pageData)
                },
                order: {
                    condition: responsible && selectedOrder,
                    method: () => this.createWorksTable(dataObj, responsible, selectedOrder)
                },
                list: {
                    condition: responsible,
                    method: () => {
                        this.createOrderTable(dataObj, responsible);
                        this.processStyle();
                    }
                }
            }

            const selectedStep = Object.keys(stepData).find(step => stepData[step].condition);
            const { method } = stepData[selectedStep] || stepData.list;

            this.currentStep = selectedStep;
            method.call(this);
        }
    }

    /** Применяет стили к элементу, если элемент не равен null */
    style(el, styles) {
        if (el !== null && el !== undefined) Object.assign(el.style, styles);
    }

    /** Применяем стили */
    setStyle() {
        const { styles } = this.pagesMap[this.currentStep];
        Object.entries(styles).forEach(([style, elements]) => {
            elements.forEach((el) => {
                if (el) this.style(el, this[style]);
            });
        });
    }

    /** Обрабатывает стили элементов согласно предопределенной карте стилей */
    processStyle() {
        this.setStyle();
        this.sp.textContent = this.responsible;
    }

    /** Создает таблицу заказов, очищая предыдущие строки и добавляя новые строки на основе выбранного ключа */
    createOrderTable(data, selectedKey) {
        // Очистка таблицы заказов
        while (this.ot.rows.length > 1) {
            this.ot.deleteRow(1);
        }

        // создаем строки для таблицы
        this.createTable(data.carObj[selectedKey], this.ot);
        this.initializeOrderTableClickHandler(data, this.responsible);
    }

    /** Создаем таблицу с видами работ */
    createWorksTable(data, responsible, orderNumber) {
        this.createTable(data.obj[orderNumber][responsible], this.at);
        this.initializeWorkBlock();
        this.so.textContent = orderNumber;
        this.sp.textContent = responsible;
        this.setStyle();
    }

    /** Инициализирует обработчик клика на таблицу заказов */
    initializeOrderTableClickHandler(data, selectedKey, orderNumber = '') {
        // Отключаем предыдущий обработчик клика на строку
        $("tr", this.ot).off("click");

        // Добавляем новый обработчик клика на строку
        $("tr", this.ot).on("click", (event) => {
            $(event.currentTarget).addClass("highlighted-row");
            if (!orderNumber) orderNumber = $(event.currentTarget).find("td:eq(1)").text();
            if (orderNumber) {
                // Обновить текущий шаг и элементы
                this.updateStep();
                this.so.textContent = orderNumber;
                // создаем таблицу с видами работ
                this.createTable(data.obj[orderNumber][selectedKey], this.at);
                this.setStyle();
            }
            this.initializeWorkBlock();
        });
    }

    /** Инициализируем блок с кнопками */
    workBlock(data, pageData) {
        const { sw, so, sp } = this;
        const thisArr = [sw, so, sp];
        Object.values(data).forEach((val, i) => thisArr[i].textContent = val);
        this.setStyle();
        this.checkButton(pageData);
    }

    /** Инициализируем обработчик килка на таблицу видов работ */
    initializeWorkBlock() {
        // Отключаем предыдущий обработчик клика на строку
        $("tr", this.at).off("click");

        // Добавляем новый обработчик клика на строку additionalTable
        $("tr", this.at).on("click", (event) => {
            $(event.currentTarget).addClass("highlighted-row");
            const workType = $(event.currentTarget).find("td:eq(0)").text(); // Получаем выбранный вид работы

            if (workType) {
                // Обновить текущий шаг и элементы
                this.updateStep();
                this.sw.textContent = workType;
                this.setStyle();
            }
        });
    }

    /** Создает таблицу на основе данных и добавляет ее в указанный элемент таблицы */
    createTable(data, tableElement) {
        if (data.length === 0) {
            tableElement.innerHTML = ""; // Очистка таблицы
            tableElement.style.display = "none"; // Скрытие таблицы
            return;
        }
        // Создание заголовков столбцов
        const headerRow = `<tr>${Object.keys(data[0])
            .filter(f => f !== "folder")
            .map(header => `<th>${this.obj[header]}</th>`).join('')}</tr>`;
        // Создание строк для таблицы
        const rows = data.map(order => {
            let backgroundColor = ''; // Переменная для хранения цвета фона
            const rowCells = Object.values(order).map((value, index) => {
                if (index === 2) { // Проверяем третий элемент (индекс 2)
                    backgroundColor = this.colors[value]; // Получаем цвет из словаря
                }
                if (value !== order["folder"]) return `<td>${value}</td>`;
            });
            // Определяем цвет строки
            let rowColor = backgroundColor ? backgroundColor : undefined;
            return `<tr class="hoverable-row" style="background-color: ${rowColor}">${rowCells.join('')}</tr>`;
        });

        // Формирование таблицы
        tableElement.innerHTML = `
        <thead>${headerRow}</thead>
        <tbody>${rows.join('')}</tbody>`;
    }

    /** Обнуляем счетчик времени */
    clearTime() {
        this.elapsedTime = 0;
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.sb.textContent = this.start;
    }

    /** Обновляем данные в таблице производства */
    async updateTimeInSpreadhseet(finish = false) {
        const time = (this.elapsedTime / 3600000).toFixed(2); // Округляем до 2 знаков после запятой;
        console.log(`Затраченное время на работу: ${time} ч.`)
        const dataForUpdate = { time, responsible: this.responsible, orderNumber: this.so.textContent, workType: this.sw.textContent };
        const response = await fetch(`/savedata?data=${encodeURIComponent(JSON.stringify(dataForUpdate))}&finish=${finish}`);
        const { success } = await response.json();
        if (success) console.log(`Work time successfully updated`);
        if (finish) this.clearTime();
        this.saveDataToStorage(); // Сохранение данных в хранилище после успешной загрузки
    }

    /** Остановить работу */
    finishWork() {
        this.mu.querySelector("h3").textContent = this.textAfter;
        // Открытие модального окна
        this.mb.style.display = "inline-block";

        this.my.addEventListener("click", () => {
            this.mb.style.display = "none"; // Закрытие модального окна

            this.showUploadF(true).then(() => {
                this.updateTimeInSpreadhseet(true); // Запись данных в таблицу
                this.m.style.display = "inline-block";
                this.popUp();
                this.mu.querySelector("h3").textContent = this.textBefore;
            });
        });

        this.mn.addEventListener("click", () => {
            this.mb.style.display = "none"; // Закрытие модального окна
        });
    }

    /** Обновляем счетчик времени */
    updateInetrval(startButton) {
        this.elapsedTime = this.getElapsedTimeFromStorage(); // Получаем прошедшее время из хранилища

        return setInterval(() => {
            this.elapsedTime += 1000; // Увеличиваем прошедшее время на 1 секунду
            startButton.textContent = this.formatTime(this.elapsedTime); // Форматируем время
        }, 1000);
        this.saveDataToStorage();
    }

    // Чтение данных из localStorage
    getElapsedTimeFromStorage() {
        const savedElapsedTime = JSON.parse(localStorage.getItem('pageData')).elapsedTime;
        return savedElapsedTime ? Number(savedElapsedTime) : 0;
    }

    /** Пуск/пауза */
    startPauseWork() {
        const startButton = event.target;
        if (startButton.textContent === this.start) {
            this.showUploadF(false).then(() => {
                // Загрузка файла завершена, можно запустить таймер
                if (this.timerInterval === null) {
                    this.elapsedTime = 0;
                }
                this.timerInterval = this.updateInetrval(startButton);
            });
        } else {
            // Завершить или продолжить отсчет времени
            if (this.timerInterval) {
                // Остановить отсчет времени
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                this.updateTimeInSpreadhseet();
            } else {
                // Продолжить отсчет времени
                this.timerInterval = this.updateInetrval(startButton);
            }
        }
    }

    /** Форматирует время в формате чч:мм:сс */
    formatTime(time) {
        const hours = Math.floor(time / (1000 * 60 * 60));
        const minutes = Math.floor((time % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((time % (1000 * 60)) / 1000);
        return `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(seconds)}`;
    }

    /** Добавляет ведущий ноль к числу, если число меньше 10 */
    padZero(number) {
        return number.toString().padStart(2, "0");
    }

    /** Получаем данные из хранилища */
    getStorageData() {
        const pageData = JSON.parse(localStorage.getItem('pageData'));
        if (pageData) {
            return pageData;
        }
    }

    /** Показываем подтверждающее окно */
    popUp() {
        setTimeout(() => {
            this.m.style.display = "none"
        }, 1000);
    }

    /** Закрываем окно загрузки */
    closeModal() {
        this.mu.style.display = "none";
    }

    /** Загружаем фото */
    async showUploadF(after = false) {
        this.mu.style.display = "inline-block";
        this.f.addEventListener("submit", async (event) => {
            event.preventDefault();
            const files = this.uf.files;
            await this.startUpload(files, after, async (uploadObj) => {
                const response = await fetch(`/upload_file?data=${encodeURIComponent(JSON.stringify(uploadObj))}`);
                const { success } = await response.json();
                if (success) {
                    console.log(success);
                    this.mu.style.display = "none";
                    this.mf.style.display = "none";
                    this.uf.value = "";
                }
            });
        });
    }

    /** Инициализируем загрузку фото */
    startUpload(files, after, callback) {
        const { dataObj, responsible, selectedOrder, selectedWork } = this.getStorageData();
        const uploadCount = files.length;
        let fileCount = 0;
        const uploadObj = { blobs: [], attachmentsData: [] };

        const handleFileLoad = (fileData, file, index) => {
            const namePart = after ? "ПОСЛЕ" : "ДО";
            const name = `${selectedWork}-${namePart}-`;
            const parents = [dataObj.carObj[responsible].find(({ orderNumber }) => orderNumber === selectedOrder).folder];
            uploadObj.attachmentsData.push({ mimeType: file.type, name, parents });
            uploadObj.blobs.push(fileData);

            fileCount++;

            if (fileCount === uploadCount) {
                callback(uploadObj); // Вызов коллбэк-функции после завершения загрузки файлов и заполнения uploadObj
            }
        };

        const uploadPromises = Array.from(files).map((file) => {
            return new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = (event) => {
                    const fileData = [...new Int8Array(event.target.result)];
                    handleFileLoad(fileData, file);
                    resolve(); // Резолвим промис после загрузки каждого файла
                };
                fr.readAsArrayBuffer(file);
            });
        });

        return Promise.all(uploadPromises); // Возвращаем промис после создания всех промисов загрузки файлов
    }
}

/** Создание экземпляров классов*/
const pageController = new PageController();

/** Запуск обновления данных каждую минуту */
pageController.startDataRefreshInterval();