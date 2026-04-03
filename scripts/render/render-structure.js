import { TableManager } from "../managers/TableManager.js";
import { CanvasManager } from "../managers/CanvasManager.js";

import { app, formatDate, downloadTextFile, makeTabs } from "../App.js";

import { Structure } from "../Structure.js";
import { Section } from "../Section.js";
import { Polyline } from "../DXF.js"

document.querySelector("header a[href='/pages/structures.html']").classList.add("active");

const INPUTS_NAMES = ["planAxel", "leftFasadAxel", "rightFasadAxel", "leftLandAxel", "rightLandAxel"]

const urlParams = new URLSearchParams(window.location.search);
const NAME = urlParams.get('name');
const allData = await app.getStructure(NAME);
const data = allData.data;

document.querySelector("a#name").innerHTML = NAME;
document.querySelector("a#info").innerHTML = 
"изм. " + formatDate(allData.creationDate) + "<br>"
+ "созд. " + formatDate(allData.lastEditDate);

makeTabs(
    document.querySelector("#canvasContainer .tabs"),
    document.querySelector("#canvasContainer .nav-menu"),
    [
        {name: "plan", inner: `План`},
        {name: "leftFasad", inner: `Левый фасад`},
        {name: "rightFasad", inner: `Правый фасад`},
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

let wallsTable = null;
wallsTable = new TableManager({
    containerId: 'wallsTable',
    tableHeader: "Стены сооружения",
    tableDescription: "Создайте новую стену сооружения и настройте её",
    initialData: data.wallsTable,
    columns: [
        {dataType: "string", isCenterAlign: true, width: "1%", header: 'Назание', key: 'name'},
        {dataType: "string", isCenterAlign: true, width: "1fr", header: 'Борт', key: 'bort', options:["Левый", "Правый"]},
        {dataType: "number", isCenterAlign: true, width: "1%",  header: 'Смещение', key: 'offset'},
        {dataType: "number", isCenterAlign: true, width: "1%", header: 'Зазор', key: 'gap'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'ПК начала', key: 'startDist'},
        {dataType: "number", isCenterAlign: true, width: "1fr", header: 'ПК конца', key: 'endDist'},
        {dataType: "string", isCenterAlign: true, width: "1%", header: 'Выбрать', buttonText:"Выбрать...", buttonFunction: (rowData) => edit(rowData.name)},
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
    ifDataUpdateFunction: () => update(),
});


INPUTS_NAMES.forEach(inputName => {
    const input = document.querySelector("#" + inputName);
    input.value = data[inputName]
    input.addEventListener("input", update)
});

const controls = [{text: '⟲', title: 'Отрисовать', action: () => update(true)}];
const planCanvas = new CanvasManager({
    container: document.querySelector("#planCanvas"),
    canvasHeader: 'План подпорной стены',
    tableDescription: 'Используйте колесо мыши для масштабирования и зажмите левую кнопку для перемещения',
    controls: controls
});
const leftFasadCanvas = new CanvasManager({
    container: document.querySelector("#leftFasadCanvas"),
    canvasHeader: 'Фасад подпорной стены',
    tableDescription: 'Используйте колесо мыши для масштабирования и зажмите левую кнопку для перемещения',
    controls: controls
});
const rightFasadCanvas = new CanvasManager({
    container: document.querySelector("#rightFasadCanvas"),
    canvasHeader: 'Фасад подпорной стены',
    tableDescription: 'Используйте колесо мыши для масштабирования и зажмите левую кнопку для перемещения',
    controls: controls
});

function update(isSetWindow = false){
    if (!wallsTable || !planCanvas || !leftFasadCanvas || !rightFasadCanvas) return;

    leftFasadCanvas.clear();
    rightFasadCanvas.clear();
    planCanvas.clear();

    const structure = new Structure(data, sections_container);
    structure.draw(planCanvas, leftFasadCanvas, rightFasadCanvas)

    leftFasadCanvas.addPolyline(new Polyline ("s0.25", structure.leftFasadAxel, false), false);
    rightFasadCanvas.addPolyline(new Polyline ("s0.25", structure.rightFasadAxel, false), false);
    planCanvas.addPolyline(new Polyline ("s0.25", structure.planAxel, false), false);

    if (!isSetWindow) return
    planCanvas.setWindow();
    leftFasadCanvas.setWindow();
    rightFasadCanvas.setWindow();
}

update(true);

function edit(wallName){
    var encodedText1 = encodeURIComponent(NAME);
    var encodedText2 = encodeURIComponent(wallName);
    var url = 'wall.html?nameS=' + encodedText1 + '&nameW=' + encodedText2;
    window.open(url, '_self');
}

document.querySelector("#downloadLisp").addEventListener("click", () => downloadTextFile(`(defun c:PL2TXT (/ ent pline pt pts data str insPt mtext)
  ;; Запрос выбора полилинии
  (while (not (setq ent (car (entsel "\nВыберите полилинию: "))))
    (princ "\nНе выбрана полилиния!")
  )
  
  ;; Проверка, что выбранный объект - полилиния
  (if (wcmatch (cdr (assoc 0 (entget ent))) "*POLYLINE")
    (progn
      ;; Получение точек полилинии
      (setq pts (get-polyline-points ent))
      
      ;; Запрос точки вставки текста
      (setq insPt (getpoint "\nУкажите точку вставки текста: "))
      
      ;; Формирование данных в требуемом формате
      (setq data (format-polyline-data pts))
      
      ;; Создание мультитекста
      (command "_.mtext" insPt "_Justify" "TL" "_Height" 2.5 "_Width" 0
               "_Content" data "")
      
      (princ "\nТекст с координатами создан.")
    )
    (princ "\nВыбранный объект не является полилинией!")
  )
  (princ)
)

;; Функция получения точек полилинии с bulge
(defun get-polyline-points (ent / obj pts i param pt bulge)
  (vl-load-com)
  (setq obj (vlax-ename->vla-object ent))
  
  (cond
    ;; Для легких полилиний
    ((= (vla-get-objectname obj) "AcDbPolyline")
     (setq pts '())
     (setq i 0)
     (repeat (fix (1+ (vlax-curve-getendparam obj)))
       (setq param (float i))
       (setq pt (vlax-curve-getpointatparam obj param))
       ;; Получение bulge для текущей вершины
       (if (< i (vlax-curve-getendparam obj))
         (setq bulge (vlax-invoke obj 'GetBulge i))
         (setq bulge 0.0)
       )
       ;; Добавляем точку и bulge
       (setq pts (append pts (list (list (car pt) (cadr pt) bulge))))
       (setq i (1+ i))
     )
    )
    
    ;; Для 3D полилиний
    ((= (vla-get-objectname obj) "AcDb3dPolyline")
     (setq pts '())
     (setq i 0)
     (repeat (fix (1+ (vlax-curve-getendparam obj)))
       (setq param (float i))
       (setq pt (vlax-curve-getpointatparam obj param))
       ;; Для 3D полилиний bulge обычно нет
       (setq pts (append pts (list (list (car pt) (cadr pt) (caddr pt) 0.0))))
       (setq i (1+ i))
     )
    )
  )
  pts
)

;; Функция форматирования данных полилинии
(defun format-polyline-data (pts / str pt x y z)
  (setq str "[")
  (foreach pt pts
    (setq x (rtos (nth 0 pt) 2 15))
    (setq y (rtos (nth 1 pt) 2 15))
    (setq z (rtos (nth 2 pt) 2 15))
    (setq str (strcat str "\n    [" x "," y "," z "],"))
  )
  ;; Удаляем последнюю запятую и добавляем закрывающую скобку
  (setq str (substr str 1 (1- (strlen str))))
  (setq str (strcat str "\n]"))
  str
)

;; Функция для проверки и загрузки
(defun c:PL2TXT_START ()
  (princ "\nКоманда PL2TXT загружена.")
  (princ "\nИспользуйте команду PL2TXT для запуска.")
  (princ)
)

(princ "\nВведите PL2TXT для запуска команды.")
(princ)`, "lsp"))
