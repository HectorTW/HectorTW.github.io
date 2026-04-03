import { TableManager } from "../managers/TableManager.js";
import { app, formatDate, initializeModal } from "../App.js";

document.querySelector("header a[href='/pages/structures.html']").classList.add("active");

function initCreateModal(){
    const openButton = document.querySelector("button#openCreateModal");
    const modal = document.querySelector(".modal#create");
    openButton.addEventListener("click", () => {
        modal.querySelector("input").value = "";
        modal.classList.add("active")
    });
    initializeModal(modal);
    modal.querySelector("button#create").addEventListener("click", () => {
        const value = modal.querySelector("input").value;
        value && create(value);
        modal.classList.remove("active");
    });
}
function initDeleteModal(structureName){
    const modal = document.querySelector(".modal#delete");
    modal.querySelector("span#name").innerHTML = structureName
    modal.classList.add("active");
    initializeModal(modal);
    modal.querySelector("button#delete").addEventListener("click", async () => {
        await app.deleteStructure(structureName);
        modal.classList.remove("active");
        updateList();
    });
}
function initLoadModal(){
    let dataObject = null;
    const openButton = document.querySelector("button#openLoadModal");
    const modal = document.querySelector(".modal#load");
    const dropZone = modal.querySelector('#dropZone');
    const fileInput = modal.querySelector('#fileInput');
    const statusDiv = modal.querySelector('#status');
    const nameInput =  modal.querySelector("input#name")

    openButton.addEventListener("click", () => {
        nameInput.value = "";
        statusDiv.innerHTML = "";
        modal.classList.add("active")
    });
    initializeModal(modal);

    modal.querySelector("button#create").addEventListener('click', async () => {
        const structureName = nameInput.value;
        if (!structureName) return setStatus('Укажите имя сооружения', false);
        if (!dataObject) return setStatus('Сначала выберите файл', false);
        await create(structureName, dataObject);
        modal.classList.remove("active");
        updateList()
    });

    function setStatus(message, isSuccess = true) {
        statusDiv.innerHTML = `<span style="width: 100%" class="badge ${isSuccess ? 'badge-green' : 'badge-red'}">${message}</span?`;
    }

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            loadData(file);
            setStatus(`Выбран файл: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`, true);
        } else {
            setStatus('Это не файл', false);
        }
    });

    dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) {
            loadData(file);
            setStatus(`Выбран файл: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`, true);
        } else {
            setStatus('Это не файл', false);
        }
    });

    async function loadData(file){
        const reader = new FileReader();
        reader.onload = (event) => {
            dataObject = app.txtToInfo(event.target.result);
            console.log(dataObject)
        };
        reader.readAsText(file);
    } 

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, (e) => e.preventDefault());
        document.body.addEventListener(eventName, (e) => e.stopPropagation());
    });
}
function initTemplateModal(){
    const templates = {
        "Сооружение1": "/scripts/templates/structure1.json"
    }

    const openButton = document.querySelector("button#openTemplateModal");

    const modal = document.querySelector(".modal#template");
    const templateList = modal.querySelector("#templateList")
    const createButton = modal.querySelector("button#create");
    const statusDiv = modal.querySelector('#status');
    const input = modal.querySelector("input");

    const select = document.createElement('select');
    templateList.appendChild(select);
    select.className = 'form-input bg-surface big';
    select.style.textAlign = "left";

    let isFirst = true;
    for (const key in templates) {
        const element = templates[key];
        const optionElement = document.createElement('option');
        optionElement.value = key;
        optionElement.textContent = key;
        if (isFirst) {
            isFirst = false;
            optionElement.selected = true;
        }
        select.appendChild(optionElement);
    }
    
    function setStatus(message, isSuccess = true) {
        statusDiv.innerHTML = `<span style="width: 100%" class="badge ${isSuccess ? 'badge-green' : 'badge-red'}">${message}</span?`;
    }

    initializeModal(modal);

    openButton.addEventListener("click", () => {
        modal.classList.add("active")
    });

    createButton.addEventListener("click", async () => {
        const name = input.value;    
        const response = await fetch(templates[select.value]);
        const data = await response.json();
        if (!name) return setStatus('Укажите имя сооружения', false);
        if (!data) return setStatus('Ошибка загрузки файла', false);
        create(name, data);
        modal.classList.remove("active");
    });
}

async function updateList() {
    const container = document.getElementById("list");
    const sectionsList = await app.getStructuresList();
    if (sectionsList.length === 0) {
        container.innerHTML = "Здесь пока пусто, создайте новое сечение или загрузите его из файла";
    } else {
        const items = await Promise.all(
            sectionsList.map(async (name) => {
                const data = await app.getStructure(name);
                return {
                    name: name,
                    description: data.description,
                    creationDate: data.creationDate,
                    lastEditDate: data.lastEditDate,
                };
            })
        );
        items.sort((a, b) => b.lastEditDate - a.lastEditDate);
        const tableData = items.map(item => [
            item.name,
            item.description,
            formatDate(item.creationDate),
            formatDate(item.lastEditDate)
        ]);

        new TableManager({
            container: container,
            tableHeader: "Список сооружений",
            tableDescription: "Названия, описания и даты",
            columns: [
                { isCenterAlign: true, width: "1%", header: 'Название', key: 'name', isNotEditable: true },
                { isCenterAlign: false, width: "1fr", header: 'Описание', isNotEditable: true },
                { isCenterAlign: true, width: "1%", header: 'Дата создания', isNotEditable: true },
                { isCenterAlign: true, width: "1%", header: 'Дата изменения', isNotEditable: true },
                { isCenterAlign: true, width: "1%", header: 'Редактировать', buttonText: "Открыть...", buttonFunction: (rowData) => edit(rowData.name) },
                { isCenterAlign: true, width: "1%", header: 'Удалить', buttonText: "X", buttonFunction: (rowData) => initDeleteModal(rowData.name) }
            ],
            initialData: tableData
        });
    }
}

function edit(name){
    var encodedText = encodeURIComponent(name);
    var url = 'structure.html?name=' + encodedText;
    window.open(url, '_self');
}

async function create(name, data = {}){
    if (!data.planAxel) data.planAxel = "[[0,0,1],[1000,1000,0]]"
    if (!data.leftFasadAxel) data.leftFasadAxel = "[[0,110,0],[1000,130,0]]"
    if (!data.rightFasadAxel) data.rightFasadAxel = "[[0,110,0],[1000,130,0]]"
    if (!data.leftLandAxel) data.leftLandAxel = "[[0,105,0],[1000,105,0]]"
    if (!data.rightLandAxel) data.rightLandAxel = "[[0,105,0],[1000,105,0]]"

    await app.setStructure(name, data);

    updateList();
}

initCreateModal();
initLoadModal();
initTemplateModal();
updateList();





