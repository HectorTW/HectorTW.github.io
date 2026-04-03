/**
 * Универсальный класс для управления таблицами
 * 
 * @param {Object} properties - Объект с настройками таблицы
 * 
 * @param {Array} properties.initialData - Начальные данные таблицы (опционально)
 * @param {Array} properties.initialObjData - Начальные данные таблицы (опционально)
 * 
 * @param {Object} properties.container - 
 * @param {string} properties.containerId - ID контейнера для таблицы
 * @param {string} properties.tableHeader - Название таблицы
 * @param {string} properties.tableDescription - Описание таблицы
 * @param {boolean} properties.editableHeaders - Можно ли редактировать заголовки (по умолчанию false)
 * @param {boolean} properties.saveToLocalStorage - Сохранять ли данные в localStorage (по умолчанию false)
 * @param {boolean} properties.autoSave - Автоматически сохранять при изменении данных (по умолчанию false, требует saveToLocalStorage: true)
 * @param {Function} properties.dynamicHeadersFunction - Функция для динамических заголовков (опционально)
 * @param {Function} properties.movingHeadersFunction - Функция для движущихся заголовков над выделенной строкой (dataRow, index) => string[] (опционально)
 * @param {Function} properties.firstColumnFunction - 
 * @param {Function} properties.ifDataUpdateFunction - 
 * 
 * 
 * @param {Array} properties.columns - Массив настроек столбцов
 * 
 * @param {Array} properties.columns[].options - Опции для выпадающего списка (опционально)
 * @param {string} properties.columns[].header - Заголовок столбца
 * @param {string} properties.columns[].key - Ключ для данных (опционально)
 * @param {string} properties.columns[].buttonText - Текст кнопки (опционально, по умолчанию "Действие")
 * @param {string} properties.columns[].width - 
 * @param {string} properties.columns[].dataType - "string"|"boolean"|"number"|"color" (color — пикер и #hex)
 * @param {boolean} properties.columns[].isTextarea - Является ли столбец многострочным полем textarea (опционально)
 * @param {boolean} properties.columns[].isNotEditable - 
 * @param {string|number} properties.columns[].textareaHeight - Высота textarea в px, например "80" или "80px" (опционально, при isTextarea)
 * @param {boolean} properties.columns[].isCenterAlign - 
 * @param {Function} properties.columns[].dataFunction - Функция преобразования данных (опционально)
 * @param {Function} properties.columns[].calculatedFunction - Функция для автоматического расчета (опционально)
 * @param {Function} properties.columns[].buttonFunction - Функция для кнопки в столбце (опционально)
 * 
 * 
 * @param {Object} properties.controls - Настройки видимости кнопок управления
 * 
 * @param {boolean} properties.controls.addRowAtBeginning - Показать кнопку добавления строки в начало (по умолчанию true)
 * @param {boolean} properties.controls.addRowAtEnd - Показать кнопку добавления строки в конец (по умолчанию true)
 * @param {boolean} properties.controls.addRowBeforeSelected - Показать кнопку добавления строки перед выделенной (по умолчанию true)
 * @param {boolean} properties.controls.addRowAfterSelected - Показать кнопку добавления строки после выделенной (по умолчанию true)
 * @param {boolean} properties.controls.deleteSelectedRow - Показать кнопку удаления выделенной строки (по умолчанию true)
 * @param {boolean} properties.controls.deleteAllRows - Показать кнопку удаления всех строк (по умолчанию true)
 * @param {boolean} properties.controls.moveSelectedRowUp - Показать кнопку поднять выделенную строку вверх (по умолчанию true)
 * @param {boolean} properties.controls.moveSelectedRowDown - Показать кнопку опустить выделенную строку вниз (по умолчанию true)
 * @param {boolean} properties.controls.export - Показать кнопку экспорта (по умолчанию true)
 * @param {boolean} properties.controls.import - Показать кнопку импорта (по умолчанию true)
 * @param {boolean} properties.controls.bottomButton - Показать кнопку импорта (по умолчанию true)
 */
export class TableManager {
    /** Нормализация цвета для input[type=color] и хранения: всегда #rrggbb в нижнем регистре. */
    static normalizeColorHex(val) {
        const s = String(val ?? "").trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
        if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
            const r = s[1], g = s[2], b = s[3];
            return (`#${r}${r}${g}${g}${b}${b}`).toLowerCase();
        }
        return "#000000";
    }

    constructor(properties) {
        // Валидация обязательных параметров
        if (!properties || !(properties.container || properties.containerId)) {
            throw new Error('Необходимо указать containerId в properties');
        }
        if (!properties.columns || !Array.isArray(properties.columns) || properties.columns.length === 0) {
            throw new Error('Необходимо указать массив columns в properties');
        }

        // Проверка существования контейнера
        this.container = properties.container || document.getElementById(properties.containerId);
        if (!this.container) {
            throw new Error(`Контейнер с ID "${properties.containerId}" не найден`);
        }

        // Сохраняем containerId для localStorage
        this.containerId = properties.containerId;

        this.firstColumnFunction = properties.firstColumnFunction || null;
        this.ifDataUpdateFunction = properties.ifDataUpdateFunction || null;

        // Инициализация столбцов
        this.columns = properties.columns.map(col => ({
            header: col.header || '',
            key: col.key || null,
            dataFunction: col.dataFunction || ((val) => val),
            options: col.options || null,
            calculatedFunction: col.calculatedFunction || null,
            dataType: col.dataType || "string",
            isTextarea: col.isTextarea || false,
            isNotEditable: col.isNotEditable || false,
            textareaHeight: col.textareaHeight != null ? (typeof col.textareaHeight === 'number' ? `${col.textareaHeight}px` : String(col.textareaHeight)) : '60px',
            buttonFunction: col.buttonFunction || null,
            buttonText: col.buttonText || 'Действие',
            width: col.width || "auto",
            isCenterAlign: col.isCenterAlign || false,
        }));

        this.headers = this.columns.map(col => col.header);
        this.originalHeaders = [...this.headers];
        this.validHeadersNames = this.columns.map((col, index) => col.key || `column_${index}`);
        this.dataFunction = this.columns.map(col => col.dataFunction);

        // Настройки таблицы
        this.editableHeaders = properties.editableHeaders || false;
        this.dynamicHeadersFunction = properties.dynamicHeadersFunction || null;
        this.movingHeadersFunction = properties.movingHeadersFunction || null;
        this.tempHeaders = null;

        // Настройки кнопок управления
        this.controlsConfig = {
            addRowAtBeginning: properties.controls?.addRowAtBeginning || false,
            addRowAtEnd: properties.controls?.addRowAtEnd || false,
            addRowBeforeSelected: properties.controls?.addRowBeforeSelected || false,
            addRowAfterSelected: properties.controls?.addRowAfterSelected || false,
            deleteSelectedRow: properties.controls?.deleteSelectedRow || false,
            deleteAllRows: properties.controls?.deleteAllRows || false,
            moveSelectedRowUp: properties.controls?.moveSelectedRowUp || false,
            moveSelectedRowDown: properties.controls?.moveSelectedRowDown || false,
            export: properties.controls?.export || false,
            import: properties.controls?.import || false,
            bottomButton: properties.controls?.bottomButton || false
        };

        this.tableHeader = properties.tableHeader || false;
        this.tableDescription = properties.tableDescription || false;

        // Настройки localStorage
        this.saveToLocalStorage = properties.saveToLocalStorage || false;
        this.autoSave = properties.autoSave && this.saveToLocalStorage || false;
        this.storageKey = `tableManager_${this.containerId}`;

        // Данные таблицы
        this.rows = [];
        this.selectedRow = null;
        this.tableId = `table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.isEditing = false;

        // Загружаем данные из localStorage, если включено сохранение
        if (this.saveToLocalStorage) {
            this._loadFromLocalStorage();
        }

        // Загружаем начальные данные, если они указаны
        if (properties.initialData && Array.isArray(properties.initialData)) {
            this.rows = properties.initialData.map(row => {
                // Если строка - это массив, используем как есть
                if (Array.isArray(row)) {
                    return [...row];
                }
                // Если строка - это объект, преобразуем в массив по порядку столбцов
                if (typeof row === 'object') {
                    return this.columns.map(col => {
                        const key = col.key || this.validHeadersNames[this.columns.indexOf(col)];
                        return row[key] !== undefined ? row[key] : '';
                    });
                }
                return [];
            });
        }

        this.init();
    }

    updateMovingHeadersFunction(movingHeadersFunction){
        this.movingHeadersFunction = movingHeadersFunction || null;
    }

    init() {
        this.clearContainer();
        this.createTableStructure();
        this.createControls();
        this.renderTable();
        this.attachEvents();
        this.saveDataIfNeeded();
    }

    clearContainer() {
        this.container.innerHTML = '';
    }

    createTableStructure() {
        // Создаем обертку для таблицы
        this.tableWrapper = document.createElement('div');
        this.tableWrapper.className = 'table-container';
        this.tableWrapper.id = this.tableId;
        this.tableWrapper.style.position = 'relative';

        // Создаем контейнер для кнопок управления
        this.controlsContainer = document.createElement('div');
        this.controlsContainer.className = 'controls';
        this.tableWrapper.appendChild(this.controlsContainer);

        // Создаем элемент таблицы
        this.table = document.createElement('table');
        this.tableWrapper.appendChild(this.table);

        // Контейнер для движущихся заголовков (поверх таблицы над выделенной строкой)
        this.movingHeadersOverlay = document.createElement('div');
        this.movingHeadersOverlay.className = 'moving-headers-overlay';
        this.movingHeadersOverlay.style.display = 'none';
        this.movingHeadersOverlay.style.position = 'absolute';
        this.movingHeadersOverlay.style.left = '0';
        this.movingHeadersOverlay.style.pointerEvents = 'none';
        this.movingHeadersOverlay.style.zIndex = '10';
        this.tableWrapper.appendChild(this.movingHeadersOverlay);

        this.container.appendChild(this.tableWrapper);
    }

    createControls() {
        const buttons = [];

        const div = document.createElement('div');
        this.controlsContainer.appendChild(div);

        if (this.tableHeader) {
            const h3 = document.createElement('h3');
            h3.classList.add("card-title");
            h3.innerHTML = this.tableHeader;
            div.appendChild(h3);
        }

        if (this.tableDescription) {
            const p = document.createElement('p');
            p.classList.add("card-subtitle");
            p.innerHTML = this.tableDescription;
            div.appendChild(p);
        }

        if (this.controlsConfig.addRowAtBeginning) {
            buttons.push({
                text: '↥☰',
                action: () => this.addRowAtBeginning(),
                title: 'Добавить строку в начало таблицы'
            });
        }

        if (this.controlsConfig.addRowAtEnd) {
            buttons.push({
                text: '↧☰',
                action: () => this.addRowAtEnd(),
                title: 'Добавить строку в конец таблицы'
            });
        }

        if (this.controlsConfig.export) {
            buttons.push({
                text: '↥🗎',
                action: () => this.demoExport(),
                title: 'Экспорт данных таблицы'
            });
        }

        if (this.controlsConfig.import) {
            buttons.push({
                text: '↧🗎',
                action: () => this.demoImport(),
                title: 'Импорт данных в таблицу'
            });
        }

        if (this.controlsConfig.addRowBeforeSelected) {
            buttons.push({
                text: '↱☰',
                action: () => this.addRowBeforeSelected(),
                title: 'Добавить новую строку перед выделенной'
            });
        }

        if (this.controlsConfig.addRowAfterSelected) {
            buttons.push({
                text: '↳☰',
                action: () => this.addRowAfterSelected(),
                title: 'Добавить новую строку после выделенной'
            });
        }

        if (this.controlsConfig.moveSelectedRowUp) {
            buttons.push({
                text: '↑',
                action: () => this.moveSelectedRowUp(),
                title: 'Поднять выделенную строку вверх'
            });
        }

        if (this.controlsConfig.moveSelectedRowDown) {
            buttons.push({
                text: '↓',
                action: () => this.moveSelectedRowDown(),
                title: 'Опустить выделенную строку вниз'
            });
        }

        if (this.controlsConfig.deleteSelectedRow) {
            buttons.push({
                text: 'X',
                action: () => this.deleteSelectedRow(),
                title: 'Удалить выделенную строку'
            });
        }

        if (this.controlsConfig.deleteAllRows) {
            buttons.push({
                text: 'X☰',
                action: () => this.deleteAllRows(),
                title: 'Удалить все строки таблицы'
            });
        }

        buttons.forEach(btnConfig => {
            const button = document.createElement('button');
            button.textContent = btnConfig.text;
            button.title = btnConfig.title;
            button.classList.add("btn");
            button.classList.add("btn-secondary");
            button.classList.add("btn-small");
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                btnConfig.action();
            });
            this.controlsContainer.appendChild(button);
        });
        
        if (this.controlsConfig.bottomButton) {
            const button = document.createElement("button");
            button.textContent = "Добавить строчку";
            button.title = "Добавить строку в конец";
            button.classList.add("btn");
            button.classList.add("btn-addrow");

            button.addEventListener('click', (e) => this.addRowAtEnd());
            this.tableWrapper.appendChild(button);
        }
    }

    // Метод для получения текущих заголовков (с учетом динамических)
    getCurrentHeaders() {
        if (this.dynamicHeadersFunction && this.selectedRow !== null && this.rows[this.selectedRow]) {
            const newHeaders = this.dynamicHeadersFunction(this.rows[this.selectedRow]);
            if (Array.isArray(newHeaders)) {
                return mergeArraysWithSecondEnding(newHeaders, this.originalHeaders);
            }
        }
        return this.headers;
    }

    // Метод для обновления только заголовков без перерисовки всей таблицы
    updateHeadersOnly() {
        if (!this.table) return;

        const thead = this.table.querySelector('thead');
        if (!thead) return;

        const currentHeaders = this.getCurrentHeaders();
        const headerRow = thead.querySelector('tr');
        if (!headerRow) return;

        const thElements = headerRow.querySelectorAll('th:not(.row-number)');

        thElements.forEach((th, index) => {
            if (index < currentHeaders.length) {
                const oldContent = th.innerHTML;
                const newContent = currentHeaders[index];

                if (this.columns[index].isCenterAlign){
                    th.style.textAlign = "center";
                }

                if (oldContent !== newContent) {
                    th.innerHTML = newContent;
                }

                const isEditable = this.editableHeaders &&
                    (!this.dynamicHeadersFunction || this.selectedRow === null);

                if (isEditable) {
                    th.className = 'editable';
                    th.setAttribute('contenteditable', 'true');
                } else {
                    th.className = '';
                    th.removeAttribute('contenteditable');
                }
            }
        });
    }

    // Получить данные строки как объект для использования в функциях
    getRowData(rowIndex) {
        if (rowIndex < 0 || rowIndex >= this.rows.length) {
            return null;
        }
        const row = this.rows[rowIndex];
        const rowData = {};
        this.columns.forEach((col, index) => {
            const key = col.key || this.validHeadersNames[index];
            rowData[key] = row[index];
        });
        return rowData;
    }

    renderTable() {
        this.table.innerHTML = '';
        this.table.style = "white-space: nowrap;"

        const colgroup = document.createElement("colgroup");
        const col1 = document.createElement("col");
        col1.style = "width: 1%"
        colgroup.appendChild(col1);

        this.table.appendChild(colgroup)


        const currentHeaders = this.getCurrentHeaders();

        // Создаем заголовок таблицы
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // Добавляем заголовок для номера строки
        const thNumber = document.createElement('th');
        thNumber.textContent = '#';
        thNumber.className = 'row-number';
        headerRow.appendChild(thNumber);

        // Создаем заголовки столбцов
        currentHeaders.forEach((headerText, index) => {
            const th = document.createElement('th');
            th.innerHTML = headerText;

            const col = document.createElement("col");
            col.style.width = this.columns[index].width;

            if (this.columns[index].isCenterAlign) th.style.textAlign = "center";
            
            colgroup.appendChild(col);

            const isEditable = this.editableHeaders &&
                (!this.dynamicHeadersFunction || this.selectedRow === null);

            if (isEditable) {
                th.className = 'editable';
                th.setAttribute('contenteditable', 'true');
                

                th.addEventListener('blur', (e) => {
                    this.headers[index] = e.target.textContent.trim() || this.originalHeaders[index];
                });

                th.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        th.blur();
                    }
                });
            }

            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        this.table.appendChild(thead);

        // Создаем тело таблицы
        const tbody = document.createElement('tbody');

        this.rows.forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            tr.dataset.index = rowIndex;

            // Добавляем ячейку с номером строки
            const tdNumber = document.createElement('td');
            if (this.firstColumnFunction){
                tdNumber.textContent = this.firstColumnFunction(rowIndex);
            } else {
                tdNumber.textContent = rowIndex + 1;
            }
            tdNumber.className = 'row-number';

            tdNumber.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectRow(rowIndex);
            });

            tr.appendChild(tdNumber);

            // Добавляем ячейки с данными
            this.columns.forEach((column, cellIndex) => {
                const td = document.createElement('td');

                // Проверяем тип столбца
                if (column.dataType == "boolean") {
                    // Столбец с чекбоксом
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = row[cellIndex] === true || row[cellIndex] === 'true';
                    checkbox.className = 'table-checkbox';

                    checkbox.addEventListener('change', (e) => {
                        this.rows[rowIndex][cellIndex] = e.target.checked;
                        this.saveDataIfNeeded();
                        this.updateCalculatedCellsInRow(rowIndex);
                        if (this.selectedRow === rowIndex && this.dynamicHeadersFunction) {
                            this.updateHeadersOnly();
                        }
                    });

                    td.appendChild(checkbox);
                    td.style.textAlign = 'center';

                } else if (column.buttonFunction) {
                    // Столбец с кнопкой
                    const button = document.createElement('button');
                    button.textContent = column.buttonText;
                    // button.className = 'table-action-button';
                    button.classList.add("btn");
                    button.classList.add("btn-secondary");
                    button.classList.add("btn-small");

                    button.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const rowData = this.getRowData(rowIndex);
                        if (rowData) {
                            column.buttonFunction(rowData, rowIndex);
                        }
                    });

                    td.appendChild(button);
                    td.style.textAlign = 'center';

                } else if (column.calculatedFunction) {
                    td.style.textAlign = 'center';
                    // Автоматически рассчитываемый столбец
                    const rowData = this.getRowData(rowIndex);
                    const calculatedValue = column.calculatedFunction(rowData, rowIndex);
                    const badge = document.createElement("span");
                    badge.textContent = calculatedValue !== null && calculatedValue !== undefined ? calculatedValue : '';
                    badge.classList.add('badge');
                    badge.classList.add('badge-orange');
                    td.appendChild(badge);

                } else if (column.options && Array.isArray(column.options)) {
                    // Выпадающий список
                    const select = document.createElement('select');
                    select.className = 'form-input bg-surface';

                    if (column.isCenterAlign){
                        select.style.textAlign = "center";
                    }

                    column.options.forEach(option => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        if (row[cellIndex] === option) {
                            optionElement.selected = true;
                        }
                        select.appendChild(optionElement);
                    });

                    const cellContainer = document.createElement('div');
                    cellContainer.className = 'cell-container';
                    cellContainer.appendChild(select);
                    td.appendChild(cellContainer);

                    select.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this.moveToNextCell(rowIndex, cellIndex);
                        }
                    });

                    select.addEventListener('change', (e) => {
                        this.rows[rowIndex][cellIndex] = e.target.value;
                        this.saveDataIfNeeded();
                        this.updateCalculatedCellsInRow(rowIndex);
                        if (this.selectedRow === rowIndex && this.dynamicHeadersFunction) {
                            this.updateHeadersOnly();
                        }
                    });

                    td.addEventListener('click', (e) => {
                        if (e.target === td || e.target === cellContainer || e.target === select) {
                            this.selectRowWithoutRerender(rowIndex);
                        }
                    });

                } else if (column.dataType === "color") {
                    const hex = TableManager.normalizeColorHex(row[cellIndex]);
                    this.rows[rowIndex][cellIndex] = hex;

                    const wrap = document.createElement("div");
                    wrap.className = "table-color-cell";

                    const picker = document.createElement("input");
                    picker.type = "color";
                    picker.className = "table-color-picker";
                    picker.value = hex;
                    picker.setAttribute("title", "Цвет");

                    const textInput = document.createElement("input");
                    textInput.type = "text";
                    textInput.className = "form-input bg-surface table-color-hex";
                    textInput.value = hex;
                    textInput.setAttribute("spellcheck", "false");
                    textInput.setAttribute("autocomplete", "off");

                    const onColorCommitted = (value) => {
                        const v = TableManager.normalizeColorHex(value);
                        this.rows[rowIndex][cellIndex] = v;
                        picker.value = v;
                        textInput.value = v;
                        this.saveDataIfNeeded();
                        this.updateCalculatedCellsInRow(rowIndex);
                        if (this.selectedRow === rowIndex && this.dynamicHeadersFunction) {
                            this.updateHeadersOnly();
                        }
                    };

                    picker.addEventListener("input", () => {
                        onColorCommitted(picker.value);
                    });

                    textInput.addEventListener("change", () => {
                        onColorCommitted(textInput.value);
                    });

                    textInput.addEventListener("keydown", (e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            onColorCommitted(textInput.value);
                            this.moveToNextCell(rowIndex, cellIndex);
                        }
                    });

                    wrap.appendChild(picker);
                    wrap.appendChild(textInput);
                    td.appendChild(wrap);

                    td.addEventListener("click", (e) => {
                        if (e.target === td || e.target === wrap || e.target === picker || e.target === textInput) {
                            this.selectRowWithoutRerender(rowIndex);
                        }
                    });

                    if (column.isCenterAlign) {
                        wrap.style.justifyContent = "center";
                    }

                } else if (column.isTextarea) {
                    // Столбец с textarea: фиксированная высота, ширина ячейки, без ручного ресайза, со скроллом
                    const textarea = document.createElement('textarea');
                    textarea.className = 'table-textarea';
                    textarea.value = row[cellIndex] !== undefined && row[cellIndex] !== null ? String(row[cellIndex]) : '';
                    textarea.style.height = column.textareaHeight;
                    textarea.style.minHeight = column.textareaHeight;
                    textarea.style.maxHeight = column.textareaHeight;
                    textarea.setAttribute("autocomplete", "off");

                    td.appendChild(textarea);

                    textarea.addEventListener('input', () => {
                        this.rows[rowIndex][cellIndex] = textarea.value;
                        this.saveDataIfNeeded();
                        this.updateCalculatedCellsInRow(rowIndex);
                        if (this.selectedRow === rowIndex && this.dynamicHeadersFunction) {
                            this.updateHeadersOnly();
                        }
                    });

                    textarea.addEventListener('input', function(e) {
                        // Заменяем переносы строк и множественные пробелы на один пробел
                        this.value = this.value.replace(/\s+/g, ' ').trim();
                    });

                    textarea.addEventListener('change', () => {
                        this.rows[rowIndex][cellIndex] = textarea.value;
                        this.saveDataIfNeeded();
                    });

                    textarea.addEventListener('keydown', (e) => {
                        if (e.key === 'Tab') {
                            e.preventDefault();
                            this.moveToNextCell(rowIndex, cellIndex);
                        }
                    });

                    td.addEventListener('click', (e) => {
                        if (e.target === td || e.target === textarea) {
                            this.selectRowWithoutRerender(rowIndex);
                        }
                    });

                } else if (column.isNotEditable){
                    const badge = document.createElement("span");
                    badge.textContent = row[cellIndex] !== undefined ? row[cellIndex] : '';
                    badge.classList.add('badge');
                    badge.classList.add('badge-grey');
                    if (column.isCenterAlign){
                        badge.style.display = "inline-block";
                        badge.style.textAlign = "center";
                    }
                    td.appendChild(badge);
                } else {
                    // Стандартная редактируемая ячейка
                    td.textContent = row[cellIndex] !== undefined ? row[cellIndex] : '';
                    td.setAttribute('contenteditable', 'true');
                     
                    if (column.isCenterAlign){
                        td.style.textAlign = "center";
                    }

                    td.addEventListener('click', (e) => {
                        if (e.detail === 1) {
                            this.selectRowWithoutRerender(rowIndex);
                        }
                    });

                    td.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        this.selectRowWithoutRerender(rowIndex);

                        setTimeout(() => {
                            td.focus();
                            const range = document.createRange();
                            range.selectNodeContents(td);
                            const selection = window.getSelection();
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }, 0);
                    });

                    td.addEventListener('blur', (e) => {
                        const newValue = e.target.textContent.trim() || '';
                        this.rows[rowIndex][cellIndex] = newValue;
                        this.saveDataIfNeeded();
                        this.updateCalculatedCellsInRow(rowIndex);
                        if (this.selectedRow === rowIndex && this.dynamicHeadersFunction) {
                            this.updateHeadersOnly();
                        }
                    });

                    td.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this.moveToNextCell(rowIndex, cellIndex);
                        }
                    });
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        this.table.appendChild(tbody);

        // Восстанавливаем выделение строки
        if (this.selectedRow !== null && this.selectedRow < this.rows.length) {
            this.highlightSelectedRow();
            if (this.movingHeadersFunction) {
                this.updateMovingHeaders();
            }
        } else if (this.movingHeadersFunction) {
            this.hideMovingHeaders();
        }
    }

    selectRowWithoutRerender(rowIndex) {
        this.clearSelectionWithoutRerender();
        this.selectedRow = rowIndex;
        this.highlightSelectedRow();

        if (this.dynamicHeadersFunction) {
            this.updateHeadersOnly();
        }
        if (this.movingHeadersFunction) {
            this.updateMovingHeaders();
        }
    }

    clearSelectionWithoutRerender() {
        const rows = this.table.querySelectorAll('tbody tr');
        rows.forEach(row => row.classList.remove('selected'));
        const hadSelection = this.selectedRow !== null;
        this.selectedRow = null;

        if (hadSelection && this.dynamicHeadersFunction) {
            this.updateHeadersOnly();
        }
        if (this.movingHeadersFunction) {
            this.hideMovingHeaders();
        }
    }

    /**
     * Обновляет движущиеся заголовки над выделенной строкой
     */
    updateMovingHeaders() {
        if (!this.movingHeadersFunction || this.selectedRow === null || !this.table) {
            this.hideMovingHeaders();
            return;
        }

        const rowData = this.getRowData(this.selectedRow);
        const headerTexts = this.movingHeadersFunction(rowData, this.selectedRow);

        if (!Array.isArray(headerTexts) || headerTexts.length === 0) {
            this.hideMovingHeaders();
            return;
        }

        // Формируем массив текстов: null/undefined → заголовок по умолчанию
        const displayTexts = this.columns.map((col, i) => {
            return headerTexts[i];
            // const text = headerTexts[i];
            // return text != null ? String(text) : this.originalHeaders[i];
        });

        const selectedRowEl = this.table.querySelector(`tbody tr[data-index="${this.selectedRow}"]`);
        if (!selectedRowEl) {
            this.hideMovingHeaders();
            return;
        }

        const thead = this.table.querySelector('thead');
        const tableRect = this.table.getBoundingClientRect();
        const wrapperRect = this.tableWrapper.getBoundingClientRect();
        const rowRect = selectedRowEl.getBoundingClientRect();

        // const overlayHeight = thead ? thead.offsetHeight : 30;
        const overlayHeight = 160;
        const overlayTop = rowRect.top - wrapperRect.top - overlayHeight;

        this.movingHeadersOverlay.innerHTML = '';
        this.movingHeadersOverlay.style.display = 'block';
        this.movingHeadersOverlay.style.top = `${overlayTop}px`;
        this.movingHeadersOverlay.style.left = `${overlayHeight/2}px`;
        this.movingHeadersOverlay.style.width = `${this.table.offsetWidth}px`;
        this.movingHeadersOverlay.style.height = `${overlayHeight}px`;

        const overlayTable = document.createElement('table');
        overlayTable.className = 'moving-headers-table';
        overlayTable.style.width = '100%';
        overlayTable.style.height = '100%';
        overlayTable.style.tableLayout = 'fixed';
        overlayTable.style.whiteSpace = 'nowrap';
        overlayTable.style.borderCollapse = 'collapse';

        const colgroup = this.table.querySelector('colgroup');
        const newColgroup = colgroup.cloneNode(true);

        const originalCols = colgroup.children;
        const newCols = newColgroup.children;

        for (let i = 0; i < originalCols.length; i++) {
            const width = originalCols[i].offsetWidth;
            newCols[i].style.width = width + 'px';
        }

        if (colgroup) {
            overlayTable.appendChild(newColgroup);
        }


        const overlayThead = document.createElement('thead');
        const overlayRow = document.createElement('tr');
        overlayRow.style.transform = "skew(-45deg)";

        const thNumber = document.createElement('th');
        thNumber.className = 'row-number hide';
        overlayRow.appendChild(thNumber); 

        displayTexts.forEach((text, index) => {
            const th = document.createElement('th');
            overlayRow.appendChild(th);
            if (text) {
                th.innerHTML = "<div>"+text+"</div>";
            } else {
                th.classList.add("hide");
            }
        });

        overlayThead.appendChild(overlayRow);
        overlayTable.appendChild(overlayThead);
        this.movingHeadersOverlay.appendChild(overlayTable);
    }

    /**
     * Скрывает движущиеся заголовки
     */
    hideMovingHeaders() {
        if (this.movingHeadersOverlay) {
            this.movingHeadersOverlay.style.display = 'none';
            this.movingHeadersOverlay.innerHTML = '';
        }
    }

    moveToNextCell(rowIndex, cellIndex) {
        const tbody = this.table.querySelector('tbody');

        let nextCell;
        if (cellIndex < this.columns.length - 1) {
            const currentRow = tbody.children[rowIndex];
            nextCell = currentRow.children[cellIndex + 2];
        } else if (rowIndex < this.rows.length - 1) {
            const nextRow = tbody.children[rowIndex + 1];
            if (nextRow) {
                nextCell = nextRow.children[1];
            }
        }

        if (nextCell) {
            const textarea = nextCell.querySelector('textarea.table-textarea');
            if (textarea) {
                textarea.focus();
            } else if (nextCell.querySelector('select')) {
                const select = nextCell.querySelector('select');
                select.focus();
            } else if (nextCell.querySelector('input.table-color-hex')) {
                nextCell.querySelector('input.table-color-hex').focus();
            } else if (nextCell.querySelector('input.table-color-picker')) {
                nextCell.querySelector('input.table-color-picker').focus();
            } else if (nextCell.hasAttribute('contenteditable')) {
                nextCell.focus();
            }
        }
        this.updateMovingHeaders();
    }

    demoExport() {
        const data = this.exportToJSON();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'table-data.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    demoImport() {
        const jsonData = prompt('Введите JSON данные для импорта:', this.exportToJSON());
        if (jsonData) {
            if (this.importFromJSON(jsonData)) {
                alert('Данные успешно импортированы!');
                this.saveDataIfNeeded();
            } else {
                alert('Ошибка импорта данных! Проверьте формат JSON.');
            }
        }
    }

    attachEvents() {
        document.addEventListener('click', (e) => {
            if (!this.table.contains(e.target)) {
                this.clearSelectionWithoutRerender();
            }
        });

        if (this.movingHeadersFunction) {
            const updateOnScroll = () => {
                if (this.selectedRow !== null) this.updateMovingHeaders();
            };
            window.addEventListener('scroll', updateOnScroll, true);
            this.tableWrapper.addEventListener('scroll', updateOnScroll);
        }

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveData();
            }
        });
    }

    selectRow(rowIndex) {
        this.selectRowWithoutRerender(rowIndex);
    }

    highlightSelectedRow() {
        const rows = this.table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const index = parseInt(row.dataset.index);
            if (index === this.selectedRow) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
    }

    clearSelection() {
        this.clearSelectionWithoutRerender();
    }

    addRowAtBeginning() {
        const newRow = this.generateEmptyRow();
        this.rows.unshift(newRow);
        this.selectedRow = 0;
        this.renderTable();
        this.saveDataIfNeeded();

        setTimeout(() => {
            this.focusFirstEditableCell(0);
        }, 10);
    }

    addRowAtEnd() {
        const newRow = this.generateEmptyRow();
        this.rows.push(newRow);
        this.selectedRow = this.rows.length - 1;
        this.renderTable();
        this.saveDataIfNeeded();

        setTimeout(() => {
            this.focusFirstEditableCell(this.rows.length - 1);
        }, 10);
    }

    addRowBeforeSelected() {
        if (this.selectedRow === null) {
            alert('Сначала выделите строку! Кликните на любую ячейку с данными в нужной строке.');
            return;
        }

        const newRow = this.generateEmptyRow();
        this.rows.splice(this.selectedRow, 0, newRow);
        this.renderTable();
        this.saveDataIfNeeded();

        setTimeout(() => {
            this.focusFirstEditableCell(this.selectedRow);
        }, 10);
    }

    addRowAfterSelected() {
        if (this.selectedRow === null) {
            alert('Сначала выделите строку! Кликните на любую ячейку с данными в нужной строке.');
            return;
        }

        const newRow = this.generateEmptyRow();
        this.rows.splice(this.selectedRow + 1, 0, newRow);
        this.selectedRow = this.selectedRow + 1;
        this.renderTable();
        this.saveDataIfNeeded();

        setTimeout(() => {
            this.focusFirstEditableCell(this.selectedRow);
        }, 10);
    }

    focusFirstEditableCell(rowIndex) {
        const row = this.table.querySelector(`tbody tr[data-index="${rowIndex}"]`);
        if (row) {
            const firstTd = row.querySelector('td:not(.row-number)');
            if (firstTd) {
                const textarea = firstTd.querySelector('textarea.table-textarea');
                if (textarea) {
                    textarea.focus();
                } else if (firstTd.querySelector('select')) {
                    const select = firstTd.querySelector('select');
                    select.focus();
                } else if (firstTd.querySelector('input.table-color-hex')) {
                    firstTd.querySelector('input.table-color-hex').focus();
                } else if (firstTd.querySelector('input.table-color-picker')) {
                    firstTd.querySelector('input.table-color-picker').focus();
                } else if (firstTd.hasAttribute('contenteditable')) {
                    firstTd.focus();
                }
            }
        }
    }

    deleteSelectedRow() {
        if (this.selectedRow === null) {
            alert('Сначала выделите строку для удаления! Кликните на любую ячейку с данными в нужной строке.');
            return;
        }

        this.rows.splice(this.selectedRow, 1);
        this.selectedRow = null;
        this.renderTable();
        this.saveDataIfNeeded();
    }

    moveSelectedRowUp() {
        if (this.selectedRow === null) {
            alert('Сначала выделите строку! Кликните на любую ячейку в нужной строке.');
            return;
        }
        if (this.selectedRow === 0) {
            return;
        }
        const idx = this.selectedRow;
        [this.rows[idx - 1], this.rows[idx]] = [this.rows[idx], this.rows[idx - 1]];
        this.selectedRow = idx - 1;
        this.renderTable();
        this.saveDataIfNeeded();
    }

    moveSelectedRowDown() {
        if (this.selectedRow === null) {
            alert('Сначала выделите строку! Кликните на любую ячейку в нужной строке.');
            return;
        }
        if (this.selectedRow >= this.rows.length - 1) {
            return;
        }
        const idx = this.selectedRow;
        [this.rows[idx], this.rows[idx + 1]] = [this.rows[idx + 1], this.rows[idx]];
        this.selectedRow = idx + 1;
        this.renderTable();
        this.saveDataIfNeeded();
    }

    deleteAllRows() {
        if (this.rows.length === 0) {
            return;
        }

        if (confirm('Удалить все строки таблицы?')) {
            this.rows = [];
            this.selectedRow = null;
            this.renderTable();
            this.saveDataIfNeeded();
        }
    }

    generateEmptyRow() {
        return this.columns.map((column, index) => {
            if (column.dataType == "boolean") {
                return false;
            }
            if (column.dataType === "color") {
                return "#000000";
            }
            if (column.options && Array.isArray(column.options) && column.options.length > 0) {
                return column.options[0];
            }
            return '';
        });
    }

    addRowWithData(data, position = null) {
        let rowData;
        if (Array.isArray(data)) {
            rowData = [...data];
        } else if (typeof data === 'object') {
            rowData = this.columns.map(col => {
                const key = col.key || this.validHeadersNames[this.columns.indexOf(col)];
                return data[key] !== undefined ? data[key] : '';
            });
        } else {
            throw new Error('Данные должны быть массивом или объектом');
        }

        if (position === null) {
            this.rows.push(rowData);
            this.selectedRow = this.rows.length - 1;
        } else {
            this.rows.splice(position, 0, rowData);
            this.selectedRow = position;
        }

        this.renderTable();
        this.saveDataIfNeeded();
    }

    saveData() {
        console.log('Данные сохранены:', {
            headers: this.headers,
            rows: this.rows,
            tableId: this.tableId
        });
        alert('Данные сохранены в консоль!');
    }

    getData() {
        return {
            headers: [...this.headers],
            rows: [...this.rows]
        };
    }

    getTableDataAsArrayOfObjects() {
        const data = this.rows.map((rowData) => {
            const rowObject = {};
            for (let index = 0; index < rowData.length; index++) {
                const col = this.columns[index];
                if (col.dataType == "number") {
                    rowObject[this.validHeadersNames[index]] = Number(rowData[index]);
                } else if (col.dataType === "color") {
                    rowObject[this.validHeadersNames[index]] = TableManager.normalizeColorHex(rowData[index]);
                } else {
                    rowObject[this.validHeadersNames[index]] = rowData[index];
                }
            }
            return rowObject;
        });
        return data;
    }

    exportToJSON() {
        return JSON.stringify(this.getData(), null, 2);
    }

    importFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.headers && data.rows) {
                this.headers = [...data.headers];
                this.rows = [...data.rows];
                this.selectedRow = null;
                this.renderTable();
                this.saveDataIfNeeded();
                return true;
            }
        } catch (error) {
            console.error('Ошибка импорта данных:', error);
        }
        return false;
    }

    updateHeadersForSelectedRow() {
        if (this.dynamicHeadersFunction && this.selectedRow !== null) {
            this.updateHeadersOnly();
        }
    }

    // Метод для обновления рассчитываемых ячеек в строке
    updateCalculatedCellsInRow(rowIndex) {
        if (rowIndex < 0 || rowIndex >= this.rows.length) return;

        const tbody = this.table.querySelector('tbody');
        if (!tbody) return;

        const row = tbody.children[rowIndex];
        if (!row) return;

        this.columns.forEach((column, cellIndex) => {
            if (column.calculatedFunction) {
                const td = row.children[cellIndex + 1]; // +1 потому что есть ячейка с номером
                if (td) {
                    td.innerHTML = "";
                    const rowData = this.getRowData(rowIndex);
                    const calculatedValue = column.calculatedFunction(rowData, rowIndex);
                    const badge = document.createElement("span");
                    badge.textContent = calculatedValue !== null && calculatedValue !== undefined ? calculatedValue : '';
                    badge.classList.add('badge');
                    badge.classList.add('badge-orange');
                    td.appendChild(badge);
                }
            }
        });
    }

    // Методы для работы с localStorage
    _saveToLocalStorage() {
        if (!this.saveToLocalStorage) return;

        try {
            const data = {
                headers: this.headers,
                rows: this.rows,
                timestamp: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Ошибка сохранения в localStorage:', error);
        }
    }

    _loadFromLocalStorage() {
        if (!this.saveToLocalStorage) return false;

        try {
            const savedData = localStorage.getItem(this.storageKey);
            if (savedData) {
                const data = JSON.parse(savedData);
                if (data.headers && data.rows) {
                    this.headers = [...data.headers];
                    this.rows = [...data.rows];
                    return true;
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки из localStorage:', error);
        }
        return false;
    }

    saveDataIfNeeded() {
        const data = this.getTableDataAsArrayOfObjects();
        this.objData = data;
        if(this.ifDataUpdateFunction){
            this.ifDataUpdateFunction(data);
        }
        if (this.autoSave && this.saveToLocalStorage) {
            this._saveToLocalStorage();
        }
    }

    // Публичный метод для ручного сохранения
    manualSave() {
        if (this.saveToLocalStorage) {
            this._saveToLocalStorage();
            return true;
        }
        return false;
    }

    // Публичный метод для очистки localStorage
    clearLocalStorage() {
        if (this.saveToLocalStorage) {
            localStorage.removeItem(this.storageKey);
            return true;
        }
        return false;
    }

    static makeDataKeyd(data, options){
        const initialData = data;
        const properties = options;
        const columns = properties.columns.map(col => ({
            key: col.key || null,
            dataFunction: col.dataFunction || ((val) => val),
        }));
        const validHeadersNames = columns.map((col, index) => col.key || `column_${index}`);
        const dataFunction = columns.map(col => col.dataFunction);

        return initialData.map((rowData) => {
            const rowObject = {};
            for (let index = 0; index < rowData.length; index++) {
                rowObject[validHeadersNames[index]] = dataFunction[index](rowData[index]);
            }
            return rowObject;
        });
    }
}




// Вспомогательная функция для объединения массивов (если она используется)
function mergeArraysWithSecondEnding(arr1, arr2) {
    if (!arr1 || !Array.isArray(arr1)) return arr2;
    if (!arr2 || !Array.isArray(arr2)) return arr1;
    
    const result = [...arr1];
    const startIndex = Math.max(0, arr1.length - arr2.length);
    
    for (let i = 0; i < arr2.length; i++) {
        const targetIndex = startIndex + i;
        if (targetIndex < result.length) {
            result[targetIndex] = arr2[i];
        } else {
            result.push(arr2[i]);
        }
    }
    
    return result;
}
