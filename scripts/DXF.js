/** Настройки слоёв по умолчанию (IndexedDB ключ `layers`). */
export const DEFAULT_LAYERS_SETTINGS = {
    items: [
        { name: "s0.25", ois: "!OIS-K-s0.25", color: "#ff0000", width: 1 },
        { name: "s0.5-1", ois: "!OIS-K-s0.5-1", color: "#00ffff", width: 2 },
        { name: "s0.5-2", ois: "!OIS-K-s0.5-2", color: "#0000ff", width: 2 },
        { name: "s0.5-3", ois: "!OIS-K-s0.5-3", color: "#ff00ff", width: 2 },
        { name: "s1", ois: "!OIS-K-s1", color: "#00ff00", width: 4 },
        { name: "punktir", ois: "!OIS-K-punktir", color: "#ffff00", width: 2 },
    ],
    fallback: {
        color: "#000000",
        width: 1,
        ois: "0",
    },
};

export class Layers {
    static LAYER_TO_COLOUR = {};
    static LAYER_TO_WIDTH = {};
    static LAYER_TO_OIS = {};
    /** Порядок имён для выпадающих списков и UI */
    static _orderedNames = [];

    /**
     * Применить настройки из IndexedDB (или null — использовать DEFAULT_LAYERS_SETTINGS).
     */
    static hydrateFromSettings(settings) {
        const base = DEFAULT_LAYERS_SETTINGS;
        const rawFb = settings?.fallback && typeof settings.fallback === "object"
            ? settings.fallback
            : base.fallback;
        const fb = {
            color: String(rawFb.color ?? base.fallback.color),
            width: Number(rawFb.width) > 0 ? Number(rawFb.width) : base.fallback.width,
            ois: String(rawFb.ois ?? base.fallback.ois),
        };

        let rows = Array.isArray(settings?.items) ? settings.items : base.items;
        rows = rows.map((it) => ({
            name: String(it.name ?? "").trim(),
            ois: it.ois != null ? String(it.ois) : fb.ois,
            color: String(it.color || fb.color),
            width: Number(it.width) > 0 ? Number(it.width) : fb.width,
        })).filter((it) => it.name && it.name !== "default");

        if (!rows.length) {
            rows = base.items.map((it) => ({ ...it }));
        }

        const c = { default: fb.color };
        const w = { default: fb.width };
        const o = { default: fb.ois };
        const list = [];
        for (const it of rows) {
            list.push(it.name);
            c[it.name] = it.color;
            w[it.name] = it.width;
            o[it.name] = it.ois;
        }

        this.LAYER_TO_COLOUR = c;
        this.LAYER_TO_WIDTH = w;
        this.LAYER_TO_OIS = o;
        this._orderedNames = list;
    }

    static getLayersList() {
        return this._orderedNames.length
            ? [...this._orderedNames]
            : DEFAULT_LAYERS_SETTINGS.items.map((x) => x.name);
    }

    static getStrokeStyle(layer) {
        return this.LAYER_TO_COLOUR[layer] || this.LAYER_TO_COLOUR.default;
    }

    static getLineWidth(layer) {
        const v = this.LAYER_TO_WIDTH[layer];
        return v !== undefined ? v : this.LAYER_TO_WIDTH.default;
    }

    static getOIS(layer) {
        return this.LAYER_TO_OIS[layer] || this.LAYER_TO_OIS.default;
    }
}

Layers.hydrateFromSettings(null);

export class DXF {
    constructor(string = ""){
        this.string = string;
    }
    addCode(groupCode, value){
        this.string += groupCode;
        this.string += "\n";
        this.string += value;
        this.string += "\n";
    }
    addDXF(dxf){
        this.string += dxf.string;
    }
    getString = () => this.string;
}

export class FileDXF {
    static get(entitys, fileName = "file.dxf"){
        const dxf = new DXF();
        dxf.addCode(0, "SECTION");
        dxf.addCode(2, "HEADER");
        dxf.addCode(9, "$ACADVER");
        dxf.addCode(1, "AC1009");
        dxf.addCode(0, "ENDSEC");

        dxf.addCode(0, "SECTION");
        dxf.addCode(2, "TABLES");
        dxf.addCode(0, "ENDSEC");

        dxf.addCode(0, "SECTION");
        dxf.addCode(2, "BLOCKS");
        dxf.addCode(0, "ENDSEC");

        dxf.addCode(0, "SECTION");
        dxf.addCode(2, "ENTITIES");

        entitys.forEach(element => {
            dxf.addDXF(element.getDXF())
        });

        dxf.addCode(0, "ENDSEC");
        dxf.addCode(0, "EOF");

        const blob = new Blob([dxf.getString()], {type: 'application/dxf'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
    }
}

export class Polyline {
    constructor(layer, coords, isClose = false){
        this.layer = layer;
        this.coords = coords;
        this.isClose = isClose;
    }
    getDXF(offsetX = 0, offsetY = 0){
        const dxf = new DXF();
        dxf.addCode(0, "POLYLINE");
        dxf.addCode(8, Layers.getOIS(this.layer));
        dxf.addCode(70, this.isClose ? 1 : 0);
        dxf.addCode(66, 1);

        for (let index = 0; index < this.coords.length; index++) {
            const vertex = this.coords[index];
            dxf.addCode(0, "VERTEX");
            dxf.addCode(8, this.layer);

            dxf.addCode(10, vertex[0] + offsetX);
            dxf.addCode(20, vertex[1] + offsetY);
            dxf.addCode(30, 0.0);

            dxf.addCode(42, vertex[2] ? vertex[2] : 0);
        }

        dxf.addCode(0, "SEQEND");
        dxf.addCode(8, this.layer);

        return dxf
    }
}