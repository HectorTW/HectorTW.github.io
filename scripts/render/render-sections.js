import { TableManager } from "../managers/TableManager.js";
import { app, formatDate, initializeModal } from "../App.js";

document.querySelector("header a[href='/pages/sections.html']").classList.add("active");

function initCreateModal(){
    const openButton = document.querySelector("button#openCreateModal");

    const modal = document.querySelector(".modal#create");
    const createButton = modal.querySelector("button#create");
    const input = modal.querySelector("input");

    initializeModal(modal);

    openButton.addEventListener("click", () => {
        input.value = "";
        modal.classList.add("active")
    });


    createButton.addEventListener("click", () => {
        const value = input.value;
        value && create(value);
        modal.classList.remove("active");
    });
}

function initTemplateModal(){
    const templates = {
        "Тип1": "/scripts/templates/type1.json"
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

function initDeleteModal(name){
    const modal = document.querySelector(".modal#delete");
    const deleteButton = document.querySelector("button#delete");
    const spanName = document.querySelector("span#name");

    initializeModal(modal);
    spanName.innerHTML = name
    modal.classList.add("active");

    deleteButton.addEventListener("click", async () => {
        await app.deleteSection(name);
        modal.classList.remove("active");
        update();
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
        const sectionName = nameInput.value;
        if (!sectionName) return setStatus('Укажите имя сечения', false);
        if (!dataObject) return setStatus('Сначала выберите файл', false);
        await create(sectionName, dataObject);
        modal.classList.remove("active");
        update()
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
            console.log(JSON.stringify(dataObject))
        };
        reader.readAsText(file);
    } 

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, (e) => e.preventDefault());
        document.body.addEventListener(eventName, (e) => e.stopPropagation());
    });
}

async function update() {
    const container = document.getElementById("savedList");
    const sectionsList = await app.getSectionsList();
    if (sectionsList.length === 0) {
        container.innerHTML = "Здесь пока пусто, создайте новое сечение или загрузите его из файла";
    } else {
        const items = await Promise.all(
            sectionsList.map(async (sectionName) => {
                const sectionData = await app.getSection(sectionName);
                return {
                    name: sectionName,
                    description: sectionData.sectionData.description,
                    creationDate: sectionData.creationDate,
                    lastEditDate: sectionData.lastEditDate,
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
            tableHeader: "Список сечений",
            tableDescription: "Названия, описания, просмотр и редактирование",
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

function edit(sectionName){
    var encodedText = encodeURIComponent(sectionName);
    var url = 'section.html?name=' + encodedText;
    window.open(url, '_self');
}

async function create(sectionName, data = {}){
    if (!data.params) data.params = Array(12).fill().map(() => Array(4));
    if (!data.description) data.description = "Описание пока не заполненно";
    if (!data.drawPreview) data.drawPreview = [[4, 100, 107, "[[0,0,-0.3],[50,20,-0.3],[100,0,0]]", "[[0,105],[100,109]]", 45, 20]];

    await app.setSection(sectionName, data);

    update();
}

initCreateModal();
initLoadModal();
initTemplateModal();

update();



