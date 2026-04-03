import { Wall } from "./Wall.js";

const jsonToArray = (string) => string && JSON.parse('{"arr":' + string + "}").arr;
export class Structure {
    constructor (structureData, sections){
        this.walls = {};
        this.sections = sections;
        this.wallsTable = structureData.wallsTable;

        this.planAxel = structureData.planAxel;
        this.leftFasadAxel = structureData.leftFasadAxel;
        this.leftLandAxel = structureData.leftLandAxel;
        this.rightFasadAxel = structureData.rightFasadAxel;
        this.rightLandAxel = structureData.rightLandAxel;

        this.wallsTable.forEach(wallDataRow => {
            const wallName = wallDataRow.name;
            this.walls[wallName] = new Wall(this, wallDataRow, structureData[wallName]);
        });
    }
    draw(planCanvas, leftFasadCanvas, rightFasadCanvas){
        for (const key in this.walls) {
            const wall = this.walls[key];
            if (wall.bort == "Левый"){
                wall.draw(planCanvas, leftFasadCanvas);
            } else {
                wall.draw(planCanvas, rightFasadCanvas);
            }
        }
    }
    drawWall(wallName, planCanvas, fasadCanvas){
        this.walls[wallName].draw(planCanvas, fasadCanvas);
    }
}