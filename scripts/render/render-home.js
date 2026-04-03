import { app } from "../App.js";

const link = document.querySelector("header a[href='/index.html']");
if (link) link.classList.add("active");


const startButton = document.querySelector("button#start");
startButton.addEventListener("click", async () => {
    const response1 = await fetch("/scripts/templates/structure1.json");
    const data1 = await response1.json();
    createStructure("Сооружение1", data1);

    const response2 = await fetch("/scripts/templates/type1.json");
    const data2 = await response2.json();
    createSection("Тип1", data2);
});

async function createSection(sectionName, data = {}){
    if (!data.params) data.params = Array(12).fill().map(() => Array(4));
    if (!data.description) data.description = "Описание пока не заполненно";

    await app.setSection(sectionName, data);
}

async function createStructure(name, data = {}){
    const dateNow = new Date();
    if (!data.planAxel) data.planAxel = "[[0,0,1],[1000,1000,0]]"
    if (!data.leftFasadAxel) data.leftFasadAxel = "[[0,110,0],[1000,130,0]]"
    if (!data.rightFasadAxel) data.rightFasadAxel = "[[0,110,0],[1000,130,0]]"
    if (!data.leftLandAxel) data.leftLandAxel = "[[0,105,0],[1000,105,0]]"
    if (!data.rightLandAxel) data.rightLandAxel = "[[0,105,0],[1000,105,0]]"

    await app.setStructure(name, data)
}