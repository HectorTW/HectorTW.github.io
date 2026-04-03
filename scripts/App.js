import { Layers, DEFAULT_LAYERS_SETTINGS } from "./DXF.js";

function normalizeLayersSettings(data) {
    const def = JSON.parse(JSON.stringify(DEFAULT_LAYERS_SETTINGS));
    if (!data || typeof data !== "object") return def;
    const fb = data.fallback && typeof data.fallback === "object"
        ? {
            color: String(data.fallback.color ?? def.fallback.color),
            width: Number(data.fallback.width) > 0 ? Number(data.fallback.width) : def.fallback.width,
            ois: String(data.fallback.ois ?? def.fallback.ois),
        }
        : { ...def.fallback };
    let items = Array.isArray(data.items) ? data.items : def.items;
    items = items.map((it, i) => ({
        name: String(it.name ?? def.items[i]?.name ?? "").trim(),
        ois: String(it.ois ?? def.items[i]?.ois ?? fb.ois),
        color: String(it.color || def.items[i]?.color || fb.color),
        width: Number(it.width) > 0 ? Number(it.width) : (def.items[i]?.width ?? fb.width),
    })).filter((it) => it.name);
    if (!items.length) {
        items = def.items.map((x) => ({ ...x }));
    }
    return { items, fallback: fb };
}

class DataBase {
    constructor(dbName) {
        this.dbName = dbName;
        this.dbVersion = 26;
        this.db = null;
    }
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                if (!this.db.objectStoreNames.contains("sections")) {
                    this.db.createObjectStore("sections", { keyPath: 'key' });
                }
                if (!this.db.objectStoreNames.contains("structures")) {
                    this.db.createObjectStore("structures", { keyPath: 'key' });
                }
                if (!this.db.objectStoreNames.contains("settings")) {
                    this.db.createObjectStore("settings", { keyPath: 'key' });
                }
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onerror = (event) => {
                reject(`IndexedDB error: ${event.target.error}`);
            };
        });
    }

    async getItem(collectionName, key) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([collectionName], 'readonly');
            const store = transaction.objectStore(collectionName);
            const request = store.get(key);
            request.onsuccess = () => {
                resolve(request.result ? request.result.value : undefined);
            };
            transaction.oncomplete = () => {
                resolve();
            };
            request.onerror = (event) => {
                reject(`Error getting item: ${event.target.error}`);
            };
        });
    }

    async setItem(collectionName, key, value) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([collectionName], 'readwrite');
            const store = transaction.objectStore(collectionName);
            const request = store.put({ key, value });
            request.onerror = (event) => {
                reject(`Error setting item: ${event.target.error}`);
            };
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = (event) => {
                reject(`Transaction error: ${event.target.error}`);
            };
        });
    }

    async getAllKeys(collectionName) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([collectionName], 'readonly');
            const store = transaction.objectStore(collectionName);
            const request = store.getAllKeys();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                reject(`Error getting all keys: ${event.target.error}`);
            };
        });
    }

    async deleteItem(collectionName, key) {
        // Если база ещё не открыта, инициализируем её
        if (!this.db) await this.initialize();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([collectionName], 'readwrite');
            const store = transaction.objectStore(collectionName);
            const request = store.delete(key);

            request.onerror = (event) => {
                reject(`Error deleting item: ${event.target.error}`);
            };

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                reject(`Transaction error: ${event.target.error}`);
            };
        });
    }
}

class AppIndexedDB {
    constructor (){}
    async init(){
        this.DB = new DataBase("PST");
        await this.DB.initialize();
    }

    // Settings
    async getSettings(name){
        const data = await this.DB.getItem("settings", name);
        if (name === "layers") {
            if (data) return normalizeLayersSettings(data);
            const newData = JSON.parse(JSON.stringify(DEFAULT_LAYERS_SETTINGS));
            await this.setSettings(name, newData);
            return newData;
        }
        if (data) return data;

        if (name == "previewSection"){
            const newData = {
                "offset": 4,
                "up": 107,
                "down": 100,
                "plan": "[[0,0,-0.3],[50,20,-0.3],[100,0,0]]",
                "fasad": "[[0,105],[100,109]]",
                "start": 45,
                "length": 20
            };
            await this.setSettings(name, newData);
            return newData;
        };
    }
    async setSettings(name, data){
        await this.DB.setItem("settings", name, data);
    }

    // SECTIONS
    async setSection(sectionName, data = {}) {
        const dateNow = new Date();
        const newData = {
            lastEditDate: dateNow,
            sectionData: data,
        };

        const oldData = await this.getSection(sectionName);
        if (oldData) {
            newData.creationDate = oldData.creationDate;
        } else {
            newData.creationDate = dateNow;
        }

        await this.DB.setItem("sections", sectionName, newData);
    }
    async deleteSection(sectionName){
        await this.DB.deleteItem("sections", sectionName);
    }
    async getSectionsList(){
        return await this.DB.getAllKeys("sections");
    }
    async getSection(sectionName){
        return await this.DB.getItem("sections", sectionName);
    }

    // STRUCTURES
    async setStructure(structureName, data = {}) {
        await this.DB.setItem("structures", structureName, data);
    }
    async deleteStructure(structureName){
        await this.DB.deleteItem("structures", structureName);
    }
    async getStructuresList(){
        return await this.DB.getAllKeys("structures");
    }
    async getStructure(structureName){
        return await this.DB.getItem("structures", structureName);
    }

}

class App extends AppIndexedDB{
    static txtToInfo(text) {
        function parseLine (str) {
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < str.length; i++) {
                const ch = str[i];
                if (ch === '"') {
                    inQuotes = !inQuotes; // переключаем состояние
                    // кавычка не попадает в значение
                } else if (ch === ',' && !inQuotes) {
                    // конец значения
                    values.push(current.trim());
                    current = '';
                } else {
                    current += ch;
                }
            }
            // добавляем последнее значение, если оно не пустое после запятой в конце
            if (current.trim() !== '' || inQuotes) {
                values.push(current.trim());
            }

            return values.map(parseValue);
        }
        function parseLineProps (str, props) {
            const values = {};
            let current = '';
            let inQuotes = false;
            let index = 0;

            for (let i = 0; i < str.length; i++) {
                const ch = str[i];
                if (ch === '"') {
                    inQuotes = !inQuotes;
                } else if (ch === ',' && !inQuotes) {
                    values[props[index]] = current.trim();
                    index++
                    current = '';
                } else {
                    current += ch;
                }
            }
            // добавляем последнее значение, если оно не пустое после запятой в конце
            if (current.trim() !== '' || inQuotes) {
                values[props[index]] = current.trim();
            }

            return Object.fromEntries(
                Object.entries(values).map(([key, value]) => [key, parseValue(value)])
            );
        }
        function parseValue (valStr) {
            // булевы значения
            if (valStr === 'true') return true;
            if (valStr === 'false') return false;

            // строка в кавычках
            if (valStr.startsWith('"') && valStr.endsWith('"')) {
                return valStr.slice(1, -1); // убираем внешние кавычки
            }

            // строка в кавычках
            if (valStr.startsWith('[') && valStr.endsWith(']')) {
                return JSON.parse('{"arr":' + valStr + "}").arr;
            }

            // число (целое или с плавающей точкой)
            if (/^-?\d+(\.\d+)?$/.test(valStr)) {
                return parseFloat(valStr);
            }

            // если ни одно условие не подошло – возвращаем как есть (строка без кавычек)
            // по условию задачи таких значений не ожидается, но оставим для полноты
            return valStr;
        }

        const lines = text.split(/\r?\n/);
        const result = {};
        let sectionName = null;
        let sectionType = null;
        let sectionProps = null;

        for (let line of lines) {
            console.log(line)
            console.log(sectionName)
            line = line.trim();
            if (line === '') continue;

            if (line.startsWith('# ')) {
                sectionName = line.slice(1).trim();
                sectionType = "#"

            } else if (line.startsWith('## ')) {
                sectionName = line.slice(2).trim();
                result[sectionName] = [];
                sectionType = "##"

            } else if (line.startsWith('### ')) {
                const sectionHead = line.slice(3).trim().split(':');
                sectionName = sectionHead[0].trim();
                sectionProps = sectionHead[1].trim().slice(1, -1).split(', ').map(item => item.trim());
                console.log(sectionProps)
                result[sectionName] = [];
                sectionType = "###"

            } else if (sectionType == "#") {
                result[sectionName] = line;

            } else if (sectionType == "##") {
                const values = parseLine(line);
                result[sectionName].push(values);

            } else if (sectionType == "###") {
                const values = parseLineProps(line, sectionProps);
                result[sectionName].push(values);

            }
        }


        return result;
    }
    static infoToTxt(obj) {
        const lines = [];

        for (const [section, rows] of Object.entries(obj)) {
            lines.push(`## ${section}`);

            for (const row of rows) {
                const rowParts = row.map(value => {
                    if (typeof value === 'boolean') {
                        return value ? 'true' : 'false';
                    }
                    if (typeof value === 'number') {
                        return String(value);
                    }
                    if (typeof value === 'string') {
                        // экранирование кавычек внутри строки не предусмотрено
                        return `"${value}"`;
                    }
                    // на всякий случай, если попадётся другой тип
                    return String(value);
                });
                lines.push(rowParts.join(', '));
            }

            lines.push(''); // пустая строка между секциями
        }

        // убираем последнюю пустую строку, если она есть
        while (lines[lines.length - 1] === '') {
            lines.pop();
        }

        return lines.join('\n');
    }
}

export const app = new App()
await app.init()
Layers.hydrateFromSettings(await app.getSettings("layers"))

export function formatDate(date){
    const creation_day = date.toLocaleString('ru-RU', { day: '2-digit' });
    const creation_month = date.toLocaleString('ru-RU', { month: '2-digit' });
    const creation_year = date.toLocaleString('ru-RU', { year: '2-digit' });
    const creation_time = date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return creation_day + "." + creation_month + "." + creation_year + " " + creation_time;
}

export function makeTabs(tabsContainer, buttonsContainer, buttonsOptions, startTab, btnClass){
    const render = (element, tabName) => {
        if (element.getAttribute('switch-name') == tabName) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
    }
    const switchTab = (tabName) => {
        Array.from(tabsContainer.children).forEach(element => render(element, tabName));
        Array.from(buttonsContainer.children).forEach(element => render(element, tabName));
    }

    buttonsOptions.forEach(buttonOption => {
        const button = document.createElement("button");
        button.setAttribute("switch-name", buttonOption.name);
        button.classList.add(btnClass);
        button.innerHTML = buttonOption.inner;
        buttonsContainer.appendChild(button);
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('switch-name');
            switchTab(tabName);
        });
    });
    
    switchTab(startTab);
}

export function makeSwitchHide(container) {
    const switchHideNode = container.querySelector('[switch-hide]');
    const toggleButton = container.querySelector('#switchHideBtn');
    
    if (!switchHideNode || !toggleButton) return;
    
    let isVisible = true;

    function toggleVisibility() {
        if (isVisible) {
            switchHideNode.style.display = 'none';
            window.dispatchEvent(new Event('resize'));
            toggleButton.innerHTML = "▲"
            isVisible = false;
        } else {
            switchHideNode.style.display = "grid";
            window.dispatchEvent(new Event('resize'));
            toggleButton.innerHTML = "▼"
            isVisible = true;
        }
    }
    toggleVisibility();

    toggleButton.addEventListener('click', toggleVisibility);
    
    return;
}

export function getMaxHeightOnSegmentOptimized(points, dist, length) {
    const endDist = dist + length;
    const firstDist = points[0][0];
    const lastDist = points[points.length - 1][0];
    
    // Крайние случаи
    if (endDist <= firstDist) return points[0][1];
    if (dist >= lastDist) return points[points.length - 1][1];
    
    let maxHeight = -Infinity;
    
    // Функция для интерполяции высоты
    const getHeight = (distance) => {
        if (distance <= firstDist) return points[0][1];
        if (distance >= lastDist) return points[points.length - 1][1];
        
        for (let i = 0; i < points.length - 1; i++) {
            const [d1, h1] = points[i];
            const [d2, h2] = points[i + 1];
            
            if (distance >= d1 && distance <= d2) {
                if (d2 === d1) return h1;
                const t = (distance - d1) / (d2 - d1);
                return h1 + (h2 - h1) * t;
            }
        }
        return 0;
    };
    
    // Высота в начальной точке
    maxHeight = Math.max(maxHeight, getHeight(dist));
    
    // Высота в конечной точке
    maxHeight = Math.max(maxHeight, getHeight(endDist));
    
    // Перебираем все точки ломаной, которые попадают в диапазон
    for (let i = 0; i < points.length; i++) {
        const [pointDist, pointHeight] = points[i];
        
        // Если точка строго внутри диапазона (исключая границы, они уже учтены)
        if (pointDist > dist && pointDist < endDist) {
            maxHeight = Math.max(maxHeight, pointHeight);
        }
        
        // Также проверяем отрезки, которые пересекают границы диапазона
        if (i < points.length - 1) {
            const [d1, h1] = points[i];
            const [d2, h2] = points[i + 1];
            
            // Проверяем, пересекает ли отрезок начальную границу
            if (dist > d1 && dist < d2) {
                maxHeight = Math.max(maxHeight, getHeight(dist));
            }
            
            // Проверяем, пересекает ли отрезок конечную границу
            if (endDist > d1 && endDist < d2) {
                maxHeight = Math.max(maxHeight, getHeight(endDist));
            }
        }
    }
    
    return maxHeight;
}

/**
 * Скачивает текстовый файл с заданным содержимым и расширением.
 * @param {string} content - Содержимое файла.
 * @param {string} extension - Расширение файла (например, 'txt', '.txt').
 */
export function downloadTextFile(content, extension) {
    // Приводим расширение к единому формату: с точкой в начале
    const ext = extension.startsWith('.') ? extension : '.' + extension;
    // Имя файла: можно задать любое, здесь используется 'download' + расширение
    const fileName = `download${ext}`;

    // Создаём Blob с текстовым содержимым
    const blob = new Blob([content], { type: 'text/plain' });

    // Создаём временную ссылку для скачивания
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;

    // Добавляем ссылку в DOM, программно кликаем и удаляем
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Освобождаем память, отзывая URL объекта
    URL.revokeObjectURL(link.href);
}

export function initializeModal(modal){
    modal.addEventListener('click', (event) => {
        event.target === modal && modal.classList.remove('active');
    });

    modal.querySelectorAll("button#closeModal").forEach(button => {
        button.addEventListener('click', () => modal.classList.remove('active'));
    });

    document.addEventListener('keydown', (event) => {
        event.key === 'Escape' && modal.classList.remove('active');
    });
}