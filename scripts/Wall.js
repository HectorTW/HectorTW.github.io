import { getMaxHeightOnSegmentOptimized } from "./App.js";

export class Wall {
    constructor(structure, wallDataRow, wallData) {
        this.structure = structure;

        this.gap = wallDataRow.gap;
        this.bort = wallDataRow.bort;
        this.offset = wallDataRow.offset;
        this.endDist = wallDataRow.endDist;
        this.startDist = wallDataRow.startDist;

        this.wallData = wallData;
    }
    draw(planCanvas, fasadCanvas){
        fasadCanvas.addAxle({
            layer: "s0.25",
            text: "Ось Y=" + this.startDist,
            coord: this.startDist,
            axle: "y"
        });
        fasadCanvas.addAxle({
            layer: "s0.25",
            text: "Ось Y=" + this.endDist,
            coord: this.endDist,
            axle: "y"
        });
    
        const sign = this.endDist - this.startDist > 0 ? 1 : -1;
        let axelDist = this.startDist;
        this.wallData.forEach((pstData, index) => {
            const type = pstData.type;
            const down = pstData.down;
            const offset = this.offset;
            const section = this.structure.sections[type];

            if (!type || !down || !section || !offset) return

            const length = index == this.wallData.length - 1 ? Math.abs(this.endDist - axelDist) : pstData.length;
            if (!length) return

            const pstStartAxelDist = sign < 0 ? axelDist - length : axelDist;
            const fasadAxel = this.structure[this.bort == "Левый" ? "leftFasadAxel": "rightFasadAxel"]

            const props = section.getProps(getMaxHeightOnSegmentOptimized(fasadAxel, pstStartAxelDist, length), down);
            for (const key in props) {
                if (pstData[key]) props[key] = pstData[key];
            }
            fasadCanvas.addPolylines(
                section.getFasadPolylines(props, offset, fasadAxel, pstStartAxelDist, length),
                true
            );
            planCanvas.addPolylines(
                section.getPlanPolylines(props, offset, this.structure.planAxel, pstStartAxelDist, length),
                true
            );

            axelDist += sign * pstData.length;
            axelDist += sign * this.gap;
        });
    }
}