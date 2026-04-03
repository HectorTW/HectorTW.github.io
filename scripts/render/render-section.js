import { TableManager } from "../managers/TableManager.js";
import { CanvasManager } from "../managers/CanvasManager.js";

import { app, formatDate, makeSwitchHide, makeTabs } from "../App.js";

import { Section } from "../Section.js";
import { Polyline } from "../DXF.js"
import { Layers } from "../DXF.js"

class TableOptions {
    static params = () => ({
        tableHeader: `Настройка параметров`,
        tableDescription: "A, B, C ... L - 12-ть параметров сечения, через которые задаються координаты точек",
        columns: [
            {dataType: "string", isCenterAlign: true, key: 'key',  header: 'Буква', width: "1%", calculatedFunction: (rowData, index) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')[index]},
            {dataType: "boolean", isCenterAlign: true, key: 'isShow', header: 'Подсказка?', width: "1%"},
            {dataType: "string", isCenterAlign: false, key: 'description',  header: 'Описание',width: "1fr"},
            {dataType: "string", isCenterAlign: false, key: 'funcText', header: 'Функция', width: "1fr"},
        ]
    })
    static dots = () => ({
        columns: [
            {dataType: "number", isCenterAlign: true, width: "1%", header: 'Верх', key: 'up'},
            {dataType: "number", isCenterAlign: true, width: "1%", header: 'Низ', key: 'down'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'A', key: 'A'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'B', key: 'B'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'C', key: 'C'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'D', key: 'D'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'E', key: 'E'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'F', key: 'F'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'G', key: 'G'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'H', key: 'H'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'I', key: 'I'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'J', key: 'J'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'K', key: 'K'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'L', key: 'L'},
            {dataType: "number", isCenterAlign: true, width: "1%", header: 'Конст', key: 'const'},
        ],
        controls: {
            addRowBeforeSelected: true,
            addRowAfterSelected: true,
            deleteSelectedRow: true,
            deleteAllRows: true,
            bottomButton: true,
            moveSelectedRowUp: true,
            moveSelectedRowDown: true,
        }
    })
    static dotsX = () => ({
        tableHeader: `Точки геометрии сечения, координаты по <span class="badge badge-orange">оси X</span>`,
        tableDescription: "Указываются коэфициенты для параметров, координата точки сечения вычисляеться через сумму произведений",
        ...this.dots()
    })
    static dotsY = () => ({
        tableHeader: `Точки геометрии сечения, координаты по <span class="badge badge-orange">оси Y</span>`,
        tableDescription: "Указываются коэфициенты для параметров, координата точки сечения вычисляеться через сумму произведений",
        ...this.dots()
    })
    static drawFasadAndPlan = () => ({
        columns: [
            {dataType: "boolean", isCenterAlign: true, width: "1px", header: 'Замкнутая', key: 'isClose'},
            {dataType: "string", isCenterAlign: true, width: "1px", header: 'Штриховка', key: 'hatch', options:["нет", "голубой", "бетон"]},
            {dataType: "string", isCenterAlign: true, width: "120px", header: 'Слой', key: 'layer', options: Layers.getLayersList()},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'Точка 1', key: 'dot1'},
            {dataType: "number", isCenterAlign: true, width: "1fr", header: 'Точка 2', key: 'dot2'},
        ],
        controls: {
            addRowBeforeSelected: true,
            addRowAfterSelected: true,
            deleteSelectedRow: true,
            deleteAllRows: true,
            bottomButton: true,
            moveSelectedRowUp: true,
            moveSelectedRowDown: true,
        }
    })
    static drawPlan = () => ({
        tableHeader: `Полилинии плана`,
        tableDescription: "Информация о полилиниях отрисовываемых на плане",
        ...this.drawFasadAndPlan()
    })
    static drawFasad = () => ({
        tableHeader: `Полилинии фасада`,
        tableDescription: "Информация о полилиниях отрисовываемых на фасаде",
        ...this.drawFasadAndPlan()
    })
    static drawSection = () => ({
        tableHeader: `Полилинии сечения`,
        tableDescription: "Информация о полилиниях отрисовываемых на сечении",
        columns: [
            {dataType: "boolean", isCenterAlign: true, width: "1px", header: 'Замкнутая', key: "isClose"},
            {dataType: "string", isCenterAlign: true, width: "1px", header: 'Штриховка', key: 'hatch', options:["нет", "голубой", "бетон"]},
            {dataType: "string", isCenterAlign: true, width: "120px", header: 'Слой', key: 'layer', options: Layers.getLayersList()},
            {dataType: "string", isCenterAlign: true, width: "1fr", header: 'номера точек', key: 'dotsTextArray'},
            {dataType: "string", isCenterAlign: true, width: "1px", header: 'Всего', key: "total", calculatedFunction: (rowData) => {
                const arr = rowData.dotsTextArray?.split(',').map(item => item.trim()).map(Number) || [];
                return arr.length;
            }},
        ],
        controls: {
            addRowBeforeSelected: true,
            addRowAfterSelected: true,
            deleteSelectedRow: true,
            deleteAllRows: true,
            bottomButton: true,
            moveSelectedRowUp: true,
            moveSelectedRowDown: true,
        }
    })
}

document.querySelector("header a[href='/pages/sections.html']").classList.add("active");

const urlParams = new URLSearchParams(window.location.search);
const SECTION_NAME = urlParams.get('name');
const TABLE_NAMES = ["params", "dotsX", "dotsY", "drawPlan", "drawFasad", "drawSection"];
const INPUTS_NAMES = ["offset", "start", "length", "up", "down", "plan", "fasad"]

const TABLES = {};
const sectionAllData = await app.getSection(SECTION_NAME);
const sectionData = sectionAllData.sectionData;
const previewData = await app.getSettings("previewSection")

document.querySelector("a#name").innerHTML = SECTION_NAME;
document.querySelector("a#info").innerHTML =
    "изм. " + formatDate(sectionAllData.creationDate) + "<br>"
    + "созд. " + formatDate(sectionAllData.lastEditDate);
document.querySelector("#description").value = sectionData.description;

makeTabs(
    document.querySelector("#canvasContainer .tabs"),
    document.querySelector("#canvasContainer .nav-menu"),
    [
        {name: "section",inner: `Сечение`},
        {name: "plan",inner: `План`},
        {name: "fasad",inner: `Фасад`}
    ],
    "fasad",
    "card-link"
)
makeSwitchHide(document.querySelector("#previewCard"))

INPUTS_NAMES.forEach(name => {
    const input = document.querySelector("#previewSection #" + name);
    input.value = previewData[name];
    input.addEventListener("input", (e)=>{
        switch (name) {
            case "offset":
            case "start":
            case "length":
            case "up":
            case "down":
                previewData[input.id] = Number(input.value);
                break;

            case "plan":
            case "fasad":
                previewData[input.id] = input.value && JSON.parse('{"arr":' + input.value + "}").arr;
                break;
        
            default:
                break;
        }
        update();
    })
});

// makeTables
TABLE_NAMES.forEach(tableName => {
    const options = {
        ...TableOptions[tableName](),
        initialData: sectionData[tableName],
        container: document.querySelector("#" + tableName),
        ifDataUpdateFunction: update,
    };
    TABLES[tableName] = new TableManager(options);
});

// makePreview
const controls = [{text: '⟲', title: 'Отрисовать', action: () => update(true)}];
const sectionCanvas = new CanvasManager({
    container: document.querySelector("#sectionCanvas"),
    canvasHeader: 'Поперечное сечение подпорной стенки',
    tableDescription: 'Используйте колесо мыши для масштабирования и зажмите левую кнопку для перемещения',
    controls
});
const planCanvas = new CanvasManager({
    container: document.querySelector("#planCanvas"),
    canvasHeader: 'План подпорной стенки',
    tableDescription: 'Используйте колесо мыши для масштабирования и зажмите левую кнопку для перемещения',
    controls
});
const fasadCanvas = new CanvasManager({
    container: document.querySelector("#fasadCanvas"),
    canvasHeader: 'Фасад подпорной стенки',
    tableDescription: 'Используйте колесо мыши для масштабирования и зажмите левую кнопку для перемещения',
    controls
});

function getDataFromTables(){
    if (TABLE_NAMES.some(tableName => !TABLES[tableName])) return
    const data = {};
    TABLE_NAMES.forEach(tableName => {
        sectionData[tableName] = TABLES[tableName].getTableDataAsArrayOfObjects()
    })
    data.description = document.querySelector("#description").value;
    return data
}

document.getElementById("saveBtn").addEventListener("click", () => {
    const data = getDataFromTables();
    if (!data) return;
    app.setSection(SECTION_NAME, data);
})


function update(isSetWindow = false){
    const data = getDataFromTables();
    if (!data) return;
    
    ["dotsX", "dotsY"].forEach(key => {
        TABLES[key].updateMovingHeadersFunction((rowData) => [
            null,
            null,
            ...sectionData.params.map((rowData) => rowData.isShow ? rowData.description : null)
        ]);
    });

    const section = new Section(sectionData);
    const props = section.getProps(previewData.up, previewData.down);
    
    // sectionCanvas
    sectionCanvas.clear();
    sectionCanvas.addAxle({
        layer: "s0.25",
        text: "Ось X=0",
        coord: 0,
        axle: "y"
    });
    sectionCanvas.addAxle({
        layer: "s0.25",
        text: "Ось Y=100",
        coord: 100,
        axle: "x"
    });
    sectionCanvas.addAxle({
        layer: "s0.25",
        text: "Ось Y=100",
        coord: 100,
        axle: "x"
    });
    sectionCanvas.addDots(
        section.getSectionDots(props, previewData.offset),
        true
    );
    sectionCanvas.addPolylines(
        section.getSectionPolylines(props, previewData.offset),
        true
    );
    sectionCanvas.redraw();

    // planCanvas
    planCanvas.clear();
    planCanvas.addPolylines(
        section.getPlanPolylines(
            props,
            previewData.offset,
            JSON.parse(previewData.plan),
            previewData.start,
            previewData.length
        ),
        true
    );
    planCanvas.addPolyline(
        new Polyline (
            "s0.25",
            JSON.parse(previewData.plan),
            false,
        ),
        false
    );
    planCanvas.redraw();

    // fasadCanvas
    fasadCanvas.addPolyline(
        new Polyline (
            "s0.25",
            JSON.parse(previewData.fasad),
            false,
        ),
        false
    );
    fasadCanvas.addAxle({
        layer: "s0.25",
        text: "Ось X=100",
        coord: 100,
        axle: "x"
    });
    fasadCanvas.addPolylines(
        section.getFasadPolylines(
            props,
            previewData.offset,
            JSON.parse(previewData.fasad),
            previewData.start,
            previewData.length
        ),
        true
    );
    fasadCanvas.redraw();

    if (!isSetWindow) return
    sectionCanvas.setWindow();
    planCanvas.setWindow();
    fasadCanvas.setWindow();
}
update(true);
