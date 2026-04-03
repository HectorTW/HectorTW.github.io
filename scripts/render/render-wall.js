import { TableManager } from "../managers/TableManager.js";
import { CanvasManager } from "../managers/CanvasManager.js";

import { app, formatDate, makeTabs } from "../App.js";

import { Section } from "../Section.js";
import { Polyline } from "../DXF.js"
import { Structure } from "../Structure.js";

document.querySelector("header a[href='/pages/structures.html']").classList.add("active");

const urlParams = new URLSearchParams(window.location.search);
const STRUCTURE_NAME = urlParams.get('nameS');
const WALL_NAME = urlParams.get('nameW');
const ALL_STRUCTURE_DATA = await app.getStructure(STRUCTURE_NAME);
const STRUCTURE_DATA = ALL_STRUCTURE_DATA.data;

document.querySelector("a#nameS").innerHTML = STRUCTURE_NAME;
document.querySelector("a#nameS").href = 'structure.html?name=' + encodeURIComponent(STRUCTURE_NAME);
document.querySelector("a#nameS").target = "_self";
document.querySelector("a#nameW").innerHTML = WALL_NAME;
document.querySelector("a#info").innerHTML = 
"изм. " + formatDate(ALL_STRUCTURE_DATA.creationDate) + "<br>"
+ "созд. " + formatDate(ALL_STRUCTURE_DATA.lastEditDate);

makeTabs(
    document.querySelector("#canvasContainer .tabs"),
    document.querySelector("#canvasContainer .nav-menu"),
    [
        {name: "plan",inner: `План`},
        {name: "fasad",inner: `Фасад`},
    ],
    "plan",
    "card-link"
)

const sections_container = {}
const sections_list = await app.getSectionsList();

for (const sectionName of sections_list) {
    const sectionInfo = await app.getSection(sectionName);
    sections_container[sectionName] = new Section(sectionInfo.sectionData);
}

let wallTable;
wallTable = new TableManager({
    container: document.querySelector("#table"),
    initialData: STRUCTURE_DATA[WALL_NAME],
    tableHeader: "Подпорные стенки стены",
    tableDescription: "Создайте новую стену сооружения и настройте её",
    columns: [
        {dataType: "string", isCenterAlign: false,width: "100px", header: 'Тип', key: 'type', options: sections_list},
        {dataType: "number", isCenterAlign: true, width: "1%", header: 'Длина', key: 'length'},
        {dataType: "number", isCenterAlign: true, width: "1%", header: 'Отметка ф.', key: 'down'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'A', key: 'A'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'B', key: 'B'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'C', key: 'C'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'D', key: 'D'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'E', key: 'E'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'F', key: 'F'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'G', key: 'G'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'H', key: 'H'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'I', key: 'I'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'G', key: 'G'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'K', key: 'K'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'L', key: 'L'},
    ],
    controls: {
        addRowAtBeginning: true,
        addRowAtEnd: true,
        addRowBeforeSelected: true,
        addRowAfterSelected: true,
        moveSelectedRowUp: true,
        moveSelectedRowDown: true,
        deleteSelectedRow: true,
        deleteAllRows: true,
        bottomButton: true,
    },
    firstColumnFunction: (rowIndex) => WALL_NAME + "." + (rowIndex + 1),
    ifDataUpdateFunction: () => update(),
});

const controls = [{text: '⟲', title: 'Отрисовать', action: () => update(true)}];
const planCanvas = new CanvasManager({
    container: document.querySelector("#planCanvas"),
    canvasHeader: 'План подпорной стены',
    tableDescription: 'Используйте колесо мыши для масштабирования и зажмите левую кнопку для перемещения',
    controls: controls
});
const fasadCanvas = new CanvasManager({
    container: document.querySelector("#fasadCanvas"),
    canvasHeader: 'Фасад подпорной стены',
    tableDescription: 'Используйте колесо мыши для масштабирования и зажмите левую кнопку для перемещения',
    controls: controls
});

function update(isSetWindow = false){
    if (!wallTable || !planCanvas || !fasadCanvas) return;
    fasadCanvas.clear();
    planCanvas.clear();

    wallTable.updateMovingHeadersFunction((rowData) => [
        null,
        null,
        null,
        ...sections_container[rowData.type].data.params.map((rowData) => rowData.isShow ? rowData.description : null)
    ])
    STRUCTURE_DATA[WALL_NAME] = wallTable.getTableDataAsArrayOfObjects();

    const structure = new Structure(STRUCTURE_DATA, sections_container);
    structure.drawWall(WALL_NAME, planCanvas, fasadCanvas);

    fasadCanvas.addPolyline(new Polyline ("s0.25", structure[structure.walls[WALL_NAME].bort == "Левый" ? "leftFasadAxel": "rightFasadAxel"], false), false);
    planCanvas.addPolyline(new Polyline ("s0.25", structure.planAxel, false), false);

    if (!isSetWindow) return
    planCanvas.setWindow();
    fasadCanvas.setWindow();
}

update(true);