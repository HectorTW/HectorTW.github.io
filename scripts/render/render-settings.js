import { TableManager } from "../managers/TableManager.js";
import { app } from "../App.js";
import { Layers, DEFAULT_LAYERS_SETTINGS } from "../DXF.js";

document.querySelector("header a[href='/pages/settings.html']")?.classList.add("active");

const layerSettings = await app.getSettings("layers");

function fillFallbackForm(fb) {
    document.getElementById("fallbackColor").value = fb.color;
    document.getElementById("fallbackWidth").value = String(fb.width);
    document.getElementById("fallbackOis").value = fb.ois;
}

fillFallbackForm(layerSettings.fallback);

const layersTable = new TableManager({
    containerId: "layersTable",
    tableHeader: "Слои чертежа",
    tableDescription:
        "Имя слоя в данных, имя для DXF (код 8 / OIS), цвет линии на превью (#rrggbb или #rgb), толщина линии на канвасе.",
    initialData: layerSettings.items,
    columns: [
        { dataType: "string", isCenterAlign: false, key: "name", header: "Имя слоя в данных", width: "1fr" },
        { dataType: "string", isCenterAlign: false, key: "ois", header: "Имя слоя в AutoCAD", width: "1fr" },
        { dataType: "color", isCenterAlign: false, key: "color", header: "Цвет", width: "150px" },
        { dataType: "number", isCenterAlign: true, key: "width", header: "Толщина", width: "1%" },
    ],
    controls: {
        addRowAtBeginning: true,
        addRowAtEnd: true,
        addRowBeforeSelected: true,
        addRowAfterSelected: true,
        deleteSelectedRow: true,
        deleteAllRows: false,
        moveSelectedRowUp: true,
        moveSelectedRowDown: true,
        export: false,
        import: false,
        bottomButton: false,
    },
});

function collectPayload() {
    const rows = layersTable.getTableDataAsArrayOfObjects();
    const names = rows.map((r) => String(r.name ?? "").trim()).filter(Boolean);
    if (new Set(names).size !== names.length) {
        return { error: "Имена слоёв должны быть уникальными и непустыми." };
    }
    const fbEl = document.getElementById("fallbackColor");
    const fwEl = document.getElementById("fallbackWidth");
    const foEl = document.getElementById("fallbackOis");
    const fallback = {
        color: (fbEl.value || "").trim() || DEFAULT_LAYERS_SETTINGS.fallback.color,
        width: Math.max(0.25, Number(fwEl.value) || DEFAULT_LAYERS_SETTINGS.fallback.width),
        ois: (foEl.value || "").trim() || DEFAULT_LAYERS_SETTINGS.fallback.ois,
    };
    const items = rows
        .map((r) => ({
            name: String(r.name ?? "").trim(),
            ois: String(r.ois ?? "").trim() || fallback.ois,
            color: (String(r.color ?? "").trim() || fallback.color),
            width: Math.max(0.25, Number(r.width) || fallback.width),
        }))
        .filter((r) => r.name);
    if (!items.length) {
        return { error: "Добавьте хотя бы один слой в таблице." };
    }
    return { payload: { items, fallback } };
}

document.getElementById("saveLayers").addEventListener("click", async () => {
    const status = document.getElementById("saveStatus");
    const result = collectPayload();
    if (result.error) {
        status.textContent = result.error;
        return;
    }
    await app.setSettings("layers", result.payload);
    Layers.hydrateFromSettings(result.payload);
    status.textContent = "Сохранено. Новые цвета применятся на открытых чертежах после обновления страницы.";
    setTimeout(() => {
        status.textContent = "";
    }, 4500);
});

document.getElementById("resetLayers").addEventListener("click", async () => {
    if (!confirm("Сбросить слои к значениям по умолчанию?")) return;
    const def = JSON.parse(JSON.stringify(DEFAULT_LAYERS_SETTINGS));
    await app.setSettings("layers", def);
    Layers.hydrateFromSettings(def);
    location.reload();
});
