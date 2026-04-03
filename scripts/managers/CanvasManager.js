
import { Layers } from "../DXF.js"
import { FileDXF } from "../DXF.js";
/**
 * Универсальный класс для отрисовки в координатах на canvas
 */
export class CanvasManager {
    /**
     * @param {Object} properties - Объект с настройками СanvasManager
     * @param {string} properties.container - ID контейнера для canvas
     * @param {string} properties.containerId - ID контейнера для canvas
     * @param {string} properties.canvasHeader - Название canvas
     * @param {string} properties.tableDescription - Описание canvas
     * @param {Array} properties.controls - Настройки кнопок управления
     */
    constructor(properties) {
        this.container = properties.container || document.getElementById(properties.containerId);
        if (!this.container) {
            throw new Error(`Контейнер с ID "${properties.containerId}" не найден`);
        }

        this.header = properties.canvasHeader;
        this.description = properties.tableDescription;
        this.controls = properties.controls || [];

        // Блокировки взаимодействия
        this.lockZoom = !!properties.lockZoom;
        this.lockNavigation = !!properties.lockNavigation;

        // Массивы для хранения элементов
        this.dots = [];
        this.polylines = [];
        this.axles = [];
        this.dims = [];

        // Область отрисовки (глобальные координаты)
        this.worldLeft = 0;
        this.worldTop = 0;
        this.worldWidth = 1000;
        this.worldHeight = 1000;

        // Размеры canvas
        this.canvasWidth = 800;
        this.canvasHeight = 600;

        // Текущий DPR для "ретина" рендера
        this._dpr = 1;

        // Resize/visibility observers
        this._resizeObserver = null;
        this._intersectionObserver = null;
        this._rafSyncCanvasSize = 0;
        this._handleWindowResize = null;
        this._handleVisibilityChange = null;

        // Масштаб и смещение для преобразования координат
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        // Ограничения масштаба (можно менять извне при необходимости)
        this.minScale = 0.025;
        this.maxScale = 100;

        this.initialize();
        this.setupEventListeners();
    }

    initialize() {
        // Очищаем контейнер
        this.container.innerHTML = '';

        this.canvasWrapper = document.createElement('div');
        this.canvasWrapper.className = 'table-container';
        this.container.appendChild(this.canvasWrapper);
        this.canvasWrapper.style.height = "100%"

        // Создаем контейнер для кнопок управления (как в примере)
        this.controlsContainer = document.createElement('div');
        this.controlsContainer.className = 'controls';
        this.canvasWrapper.appendChild(this.controlsContainer);

        const div = document.createElement('div');
        this.controlsContainer.appendChild(div);

        // Заголовок
        if (this.header) {
            const h3 = document.createElement('h3');
            h3.classList.add("card-title");
            h3.innerHTML = this.header;
            div.appendChild(h3);
        }

        // Описание
        if (this.description) {
            const p = document.createElement('p');
            p.classList.add("card-subtitle");
            p.innerHTML = this.description;
            div.appendChild(p);
        }

        const button = document.createElement('button');
        button.classList.add("btn");
        button.classList.add("btn-secondary");
        button.classList.add("btn-small");
        button.textContent = "↧🗎";
        button.title = "Скачать DXF Файл";
        button.addEventListener('click', ()=>{
            FileDXF.get(this.polylines);
        });
        this.controlsContainer.appendChild(button);

        // Кнопки управления (оставляем прежний класс, чтобы не ломать стили)
        if (this.controls.length > 0) {
            this.controls.forEach(control => {
                const button = document.createElement('button');
                button.classList.add("btn");
                button.classList.add("btn-secondary");
                button.classList.add("btn-small");
                button.innerHTML = control.text;
                button.title = control.title || '';
                button.addEventListener('click', control.action);
                this.controlsContainer.appendChild(button);
            });
        }

        // Создаем контейнер для canvas
        this.canvasContainer = document.createElement('div');
        this.canvasContainer.className = 'canvas-container';
        // this.canvasContainer.style.position = 'relative';
        this.canvasContainer.style.flexGrow = 1;
        this.canvasWrapper.appendChild(this.canvasContainer);

        // Создаем canvas
        this.canvas = document.createElement('canvas');
        // CSS размер — 100% от контейнера
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';

        // Fallback (пока layout ещё не посчитан)
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        this.canvasContainer.appendChild(this.canvas);

        // Контекст для рисования
        this.ctx = this.canvas.getContext('2d');

        // Информационная панель
        this.infoPanel = document.createElement('div');
        this.infoPanel.className = 'canvas-info';
        this.infoPanel.style.marginTop = '10px';
        this.infoPanel.style.fontSize = '12px';
        this.canvasWrapper.appendChild(this.infoPanel);

        // Синхронизируем пиксельный размер canvas с реальным размером на странице
        this._setupAutoCanvasResize();
        this._scheduleSyncCanvasSize(true);

        this.updateInfo();
    }

    /**
     * Синхронизирует canvas.width/height по размеру контейнера (+DPR).
     * Сначала canvas ставится в 2px, чтобы контейнер занял нужный размер по CSS,
     * затем размер берётся из контейнера и canvas восстанавливается до 100% — изменение размера моментальное.
     */
    syncCanvasSize(forceRedraw = false) {
        if (!this.canvas || !this.canvasContainer) return;

        // Минимальный размер canvas по style, чтобы контейнер определил свой размер по CSS
        this.canvas.style.width = '2px';
        this.canvas.style.height = '2px';

        const cssWidth = this.canvasContainer.offsetWidth;
        const cssHeight = this.canvasContainer.offsetHeight;

        // Восстанавливаем CSS-размер canvas по контейнеру
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';

        // Если контейнер ещё не имеет размеров (display:none и т.п.), не трогаем
        if (!cssWidth || !cssHeight) return;

        const dpr = Math.max(1, (window.devicePixelRatio || 1));
        const nextPixelWidth = Math.max(1, Math.round(cssWidth * dpr));
        const nextPixelHeight = Math.max(1, Math.round(cssHeight * dpr));

        const sizeChanged =
            this.canvas.width !== nextPixelWidth ||
            this.canvas.height !== nextPixelHeight ||
            this.canvasWidth !== cssWidth ||
            this.canvasHeight !== cssHeight ||
            this._dpr !== dpr;

        if (!sizeChanged && !forceRedraw) return;

        this._dpr = dpr;
        this.canvasWidth = cssWidth;
        this.canvasHeight = cssHeight;

        // Важно: присваивание width/height сбрасывает состояние контекста
        this.canvas.width = nextPixelWidth;
        this.canvas.height = nextPixelHeight;
        this.ctx = this.canvas.getContext('2d');

        // Рисуем в CSS-пикселях, а под капотом масштабируем на DPR
        this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

        this.redraw();
    }

    _scheduleSyncCanvasSize(forceRedraw = false) {
        if (this._rafSyncCanvasSize) cancelAnimationFrame(this._rafSyncCanvasSize);
        this._rafSyncCanvasSize = requestAnimationFrame(() => {
            this._rafSyncCanvasSize = 0;
            this.syncCanvasSize(forceRedraw);
        });
    }

    _setupAutoCanvasResize() {
        // Защита от повторной инициализации
        if (this._resizeObserver) this._resizeObserver.disconnect();
        if (this._intersectionObserver) this._intersectionObserver.disconnect();
        if (this._handleWindowResize) window.removeEventListener('resize', this._handleWindowResize);
        if (this._handleVisibilityChange) document.removeEventListener('visibilitychange', this._handleVisibilityChange);

        // Моментальная синхронизация без RAF — размер меняется сразу
        this._handleWindowResize = () => this.syncCanvasSize(true);
        window.addEventListener('resize', this._handleWindowResize, { passive: true });

        this._handleVisibilityChange = () => {
            if (!document.hidden) this.syncCanvasSize(true);
        };
        document.addEventListener('visibilitychange', this._handleVisibilityChange);

        // Следим за изменением размеров контейнера — синхронизация сразу, без плавности
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this.syncCanvasSize(true));
            this._resizeObserver.observe(this.canvasContainer);
            this._resizeObserver.observe(this.canvasContainer.closest('.main-content'));
        }

        // При появлении в зоне видимости тоже пересинхронизируемся
        if (typeof IntersectionObserver !== 'undefined') {
            this._intersectionObserver = new IntersectionObserver((entries) => {
                const anyVisible = entries.some(e => e.isIntersecting);
                if (anyVisible) this.syncCanvasSize(true);
            });
            this._intersectionObserver.observe(this.canvas);
        }
    }

    setupEventListeners() {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        // Масштабирование колесом мыши
        this.canvas.addEventListener('wheel', (e) => {
            if (this.lockZoom) return;
            e.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Преобразуем координаты мыши в мировые
            const worldXBefore = this.screenToWorldX(x);
            const worldYBefore = this.screenToWorldY(y);
            
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const nextScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * zoomFactor));
            if (nextScale === this.scale) return;
            this.scale = nextScale;
            
            // Корректируем смещение так, чтобы мировая координата под курсором НЕ изменилась
            const { ppu, padX, padY } = this._getViewParams();
            this.offsetX = worldXBefore - ((x - padX) / ppu) - this.worldLeft;
            this.offsetY = worldYBefore - ((this.canvasHeight - y - padY) / ppu) - this.worldTop;
            
            this.redraw();
        });

        // Перемещение с зажатой левой кнопкой мыши
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.lockNavigation) return;
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            if (this.lockNavigation) return;
            
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            
            // Преобразуем смещение в мировые координаты
            const { ppu } = this._getViewParams();
            this.offsetX -= dx / ppu;
            this.offsetY += dy / ppu;
            
            lastX = e.clientX;
            lastY = e.clientY;
            
            this.redraw();
        });

        this.canvas.addEventListener('mouseup', () => {
            isDragging = false;
            this.canvas.style.cursor = 'default';
        });

        this.canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            this.canvas.style.cursor = 'default';
        });

        // Отображение координат при наведении
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const worldX = this.screenToWorldX(x);
            const worldY = this.screenToWorldY(y);
            
            this.infoPanel.innerHTML = `Координаты: ${worldX.toFixed(2)}, ${worldY.toFixed(2)} | Масштаб: ${this.scale.toFixed(2)}x`;
        });
    }

    /**
     * Параметры "камеры" для изотропного масштаба (1 единица мира = одинаково по X и Y).
     */
    _getViewParams() {
        const basePpu = Math.min(this.canvasWidth / this.worldWidth, this.canvasHeight / this.worldHeight) || 1;
        const ppu = basePpu * this.scale;
        const padX = (this.canvasWidth - (this.worldWidth * ppu)) / 2;
        const padY = (this.canvasHeight - (this.worldHeight * ppu)) / 2;
        return { ppu, padX, padY };
    }

    worldToScreenX(worldX) {
        const { ppu, padX } = this._getViewParams();
        return (worldX - this.worldLeft - this.offsetX) * ppu + padX;
    }
    worldToScreenY(worldY) {
        const { ppu, padY } = this._getViewParams();
        return this.canvasHeight - ((worldY - this.worldTop - this.offsetY) * ppu + padY);
    }
    screenToWorldX(screenX) {
        const { ppu, padX } = this._getViewParams();
        return ((screenX - padX) / ppu) + this.worldLeft + this.offsetX;
    }
    screenToWorldY(screenY) {
        const { ppu, padY } = this._getViewParams();
        return ((this.canvasHeight - screenY - padY) / ppu) + this.worldTop + this.offsetY;
    }

    setWindow() {
        const coords = this._collectAutoWindowCoords();
        if (coords.length === 0) return;

        // Находим границы
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        coords.forEach(coord => {
            const [x, y] = coord;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });

        // Добавляем отступ 10%
        const spanX = (maxX - minX);
        const spanY = (maxY - minY);
        const paddingX = (spanX === 0 ? 1 : spanX * 0.1);
        const paddingY = (spanY === 0 ? 1 : spanY * 0.1);

        this.worldLeft = minX - paddingX;
        this.worldTop = minY - paddingY;
        this.worldWidth = spanX + 2 * paddingX;
        this.worldHeight = spanY + 2 * paddingY;

        // Делаем "цену деления" одинаковой по X/Y: подгоняем world-окно под аспект canvas
        const targetAspect = (this.canvasWidth && this.canvasHeight) ? (this.canvasWidth / this.canvasHeight) : 1;
        const currentAspect = this.worldWidth / this.worldHeight;
        if (Number.isFinite(targetAspect) && targetAspect > 0 && Number.isFinite(currentAspect) && currentAspect > 0) {
            const cx = this.worldLeft + this.worldWidth / 2;
            const cy = this.worldTop + this.worldHeight / 2;

            if (currentAspect > targetAspect) {
                // Слишком широкое окно — увеличиваем высоту
                const newH = this.worldWidth / targetAspect;
                this.worldHeight = newH;
                this.worldTop = cy - newH / 2;
            } else {
                // Слишком высокое окно — увеличиваем ширину
                const newW = this.worldHeight * targetAspect;
                this.worldWidth = newW;
                this.worldLeft = cx - newW / 2;
            }
        }

        // Сбрасываем масштаб и смещение
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.redraw();
    }

    addDot(dot, autoWindow = false) {
        dot.__autoWindow = !!autoWindow;
        this.dots.push(dot);
        this.redraw();
    }

    addDots(dots, autoWindow = false) {
        if (!Array.isArray(dots) || dots.length === 0) return;
        this.dots.push(...dots.map(d => {
            d.__autoWindow = !!autoWindow;
            return d;
        }));
        this.redraw();
    }

    addPolyline(poly, autoWindow = false) {
        poly.__autoWindow = !!autoWindow;
        this.polylines.push(poly);
        this.redraw();
    }

    addPolylines(polylines, autoWindow = false) {
        if (!Array.isArray(polylines) || polylines.length === 0) return;
        this.polylines.push(...polylines.map(p => {
            p.__autoWindow = !!autoWindow;
            return p;
        }));
        this.redraw();
    }

    addAxle(axle, autoWindow = false) {
        const item = { ...axle, __autoWindow: !!autoWindow };
        this.axles.push(item);
        this.redraw();
    }

    addAxles(axles, autoWindow = false) {
        if (!Array.isArray(axles) || axles.length === 0) return;
        const flag = !!autoWindow;
        this.axles.push(...axles.map(a => ({ ...a, __autoWindow: flag })));
        this.redraw();
    }

    addDim(dim, autoWindow = false) {
        dim.__autoWindow = !!autoWindow;
        this.dims.push(dim);
        this.redraw();
    }


    /**
     * Сбор координат для setWindow() по элементам с __autoWindow=true
     * @returns {Array<[number, number]>}
     */
    _collectAutoWindowCoords() {
        const coords = [];

        // Точки
        this.dots.forEach(dot => {
            if (!dot.__autoWindow) return;
            if (Array.isArray(dot.coords) && dot.coords.length >= 2) {
                coords.push([dot.coords[0], dot.coords[1]]);
            }
        });

        // Полилинии
        this.polylines.forEach(poly => {
            if (!poly.__autoWindow) return;
            if (!Array.isArray(poly.coords)) return;
            poly.coords.forEach(p => {
                if (!Array.isArray(p) || p.length < 2) return;
                coords.push([p[0], p[1]]);
            });
        });

        // Для осей — добавляем точки так, чтобы линия гарантированно попала в окно.
        // Если есть база (coords), протягиваем ось через базовые min/max. Если базы нет — используем небольшой дефолтный диапазон.
        const hasBase = coords.length > 0;
        let baseMinX = 0, baseMaxX = 1, baseMinY = 0, baseMaxY = 1;
        if (hasBase) {
            baseMinX = Math.min(...coords.map(c => c[0]));
            baseMaxX = Math.max(...coords.map(c => c[0]));
            baseMinY = Math.min(...coords.map(c => c[1]));
            baseMaxY = Math.max(...coords.map(c => c[1]));
        }

        this.axles.forEach(axle => {
            if (!axle.__autoWindow) return;
            const coord = axle.coord;
            if (typeof coord !== 'number' || !Number.isFinite(coord)) return;

            if (axle.axle === 'x') {
                coords.push([baseMinX, coord]);
                coords.push([baseMaxX, coord]);
            } else if (axle.axle === 'y') {
                coords.push([coord, baseMinY]);
                coords.push([coord, baseMaxY]);
            }
        });

        return coords;
    }

    drawPolylineWithBulge(ctx, polyline) {
        const points = polyline.coords;
        if (points.length < 2) return;

        const layer = polyline.layer || 'default';
        const isClose = !!polyline.isClose;
        ctx.strokeStyle = Layers.getStrokeStyle(layer);
        ctx.lineWidth = Layers.getLineWidth(layer);
        ctx.beginPath();

        // Преобразуем первую точку
        const firstPoint = points[0];
        const firstX = this.worldToScreenX(firstPoint[0]);
        const firstY = this.worldToScreenY(firstPoint[1]);
        ctx.moveTo(firstX, firstY);

        // Обрабатываем сегменты полилинии
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const bulge = p1[2] || 0; // bulge находится в третьей колонке

            const x1 = this.worldToScreenX(p1[0]);
            const y1 = this.worldToScreenY(p1[1]);
            const x2 = this.worldToScreenX(p2[0]);
            const y2 = this.worldToScreenY(p2[1]);

            // Если bulge равен 0, это обычный отрезок
            if (Math.abs(bulge) < 0.0000001) {
                ctx.lineTo(x2, y2);
            } else {
                // Рисуем дугу через bulge
                this.drawBulgeArc(ctx, x1, y1, x2, y2, -bulge);
            }
        }

        // Замыкаем полилинию (последняя -> первая), если требуется
        if (isClose) {
            const p1 = points[points.length - 1];
            const p2 = points[0];
            const bulge = p1[2] || 0;

            const x1 = this.worldToScreenX(p1[0]);
            const y1 = this.worldToScreenY(p1[1]);
            const x2 = this.worldToScreenX(p2[0]);
            const y2 = this.worldToScreenY(p2[1]);

            if (Math.abs(bulge) < 0.0000001) {
                ctx.closePath(); // добавит прямой сегмент к стартовой точке
            } else {
                this.drawBulgeArc(ctx, x1, y1, x2, y2, -bulge);
                ctx.closePath();
            }
        }

        ctx.stroke();

        // Рисуем текст если есть
        if (polyline.text) {
            const lastPoint = points[points.length - 1];
            const textX = this.worldToScreenX(lastPoint[0]) + 5;
            const textY = this.worldToScreenY(lastPoint[1]) - 5;
            
            ctx.fillStyle = Layers.getStrokeStyle(layer);
            ctx.font = '12px Arial';
            ctx.fillText(polyline.text, textX, textY);
        }
    }

    drawBulgeArc(ctx, x1, y1, x2, y2, bulge) {
        // Вычисляем параметры дуги
        const chord = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        
        if (chord < 0.0001) {
            ctx.lineTo(x2, y2);
            return;
        }

        // Вычисляем радиус
        const sagitta = Math.abs(bulge) * chord / 2;
        let radius;
        
        if (Math.abs(bulge) > 0.0001) {
            radius = (chord * chord) / (8 * Math.abs(sagitta)) + Math.abs(sagitta) / 2;
        } else {
            // Почти прямая линия
            ctx.lineTo(x2, y2);
            return;
        }

        // Вычисляем центр дуги
        const chordMidX = (x1 + x2) / 2;
        const chordMidY = (y1 + y2) / 2;
        
        // Вектор от середины хорды к центру
        const chordAngle = Math.atan2(y2 - y1, x2 - x1);
        const perpendicularAngle = chordAngle + Math.PI / 2;
        
        // Направление центра (зависит от знака bulge)
        const direction = bulge > 0 ? 1 : -1;
        const centerX = chordMidX + direction * (radius - sagitta) * Math.cos(perpendicularAngle);
        const centerY = chordMidY + direction * (radius - sagitta) * Math.sin(perpendicularAngle);

        // Вычисляем начальный и конечный углы
        let startAngle = Math.atan2(y1 - centerY, x1 - centerX);
        let endAngle = Math.atan2(y2 - centerY, x2 - centerX);

        // Корректируем углы для направления дуги
        if (bulge > 0) {
            // Против часовой стрелки
            if (endAngle <= startAngle) endAngle += 2 * Math.PI;
        } else {
            // По часовой стрелке
            if (startAngle <= endAngle) startAngle += 2 * Math.PI;
        }

        // Рисуем дугу
        ctx.arc(centerX, centerY, radius, startAngle, endAngle, bulge < 0);
    }

    updateInfo() {
        this.infoPanel.innerHTML = `
            Область: ${this.worldLeft.toFixed(2)}, ${this.worldTop.toFixed(2)} - 
            ${(this.worldLeft + this.worldWidth).toFixed(2)}, ${(this.worldTop + this.worldHeight).toFixed(2)} |
            Масштаб: ${this.scale.toFixed(2)}x
        `;
    }

    redraw() {
        // Очищаем canvas
        // Контекст уже в CSS-пикселях (setTransform на DPR), очищаем в CSS размерах
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Рисуем оси
        this.axles.forEach(axle => this.drawAxleInternal(axle));

        // Рисуем полилинии
        this.polylines.forEach(poly => this.drawPolylineWithBulge(this.ctx, poly));

        // Рисуем dim
        this.dims.forEach(dim => this.drawDimInternal(dim));

        // Рисуем точки
        this.dots.forEach(dot => this.drawDotInternal(dot));

        this.updateInfo();
    }

    drawDotInternal(dot) {
        const layer = dot.layer || 'default';
        const [x, y] = dot.coords;
        
        const screenX = this.worldToScreenX(x);
        const screenY = this.worldToScreenY(y);
        
        this.ctx.beginPath();
        this.ctx.fillStyle = Layers.getStrokeStyle(layer);
        this.ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Рисуем текст
        if (dot.text) {
            this.ctx.fillStyle = Layers.getStrokeStyle(layer);
            this.ctx.font = '14px Arial';
            this.ctx.fillText(dot.text, screenX + 5, screenY - 5);
        }
    }

    drawDimInternal(dim) {
        const layer = dim.layer || 'default';

        // Извлекаем параметры
        const [point1, point2] = dim.coords;
        const dimCoord = dim.dimCoord;
        const angle = dim.dimAngle * Math.PI / 180; // Переводим в радианы
        
        // Направляющий вектор для выноски
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        
        // Нормаль (перпендикуляр) к направлению выноски
        const normX = -dirY;
        const normY = dirX;
        
        // Функция для проекции точки на линию выноски
        function projectPointToDimLine(point) {
            // Вектор от точки dimCoord к текущей точке
            const vecX = point[0] - dimCoord[0];
            const vecY = point[1] - dimCoord[1];
            
            // Проекция на направляющий вектор
            const projection = vecX * dirX + vecY * dirY;
            
            // Координаты точки на выноске
            const projX = dimCoord[0] + projection * dirX;
            const projY = dimCoord[1] + projection * dirY;

            
            return [projX, projY, projection];
        }
        
        // Проекции обеих точек
        const proj1 = projectPointToDimLine(point1);
        const proj2 = projectPointToDimLine(point2);
        
        // Определяем крайние точки выноски
        const startX = proj1[0];
        const startY = proj1[1];
        const endX = proj2[0];
        const endY = proj2[1];
        
        // Сохраняем текущее состояние контекста
        this.ctx.save();

        this.ctx.strokeStyle = Layers.getStrokeStyle(layer);
        this.ctx.lineWidth = Layers.getLineWidth(layer);
        
        // 1. Рисуем отрезок выноски
        this.ctx.beginPath();
        this.ctx.moveTo(this.worldToScreenX(startX), this.worldToScreenY(startY));
        this.ctx.lineTo(this.worldToScreenX(endX), this.worldToScreenY(endY));
        this.ctx.stroke();
        
        // 2. Рисуем перпендикуляры
        // Первый перпендикуляр
        this.ctx.beginPath();
        this.ctx.moveTo(this.worldToScreenX(point1[0]), this.worldToScreenY(point1[1]));
        this.ctx.lineTo(this.worldToScreenX(proj1[0]), this.worldToScreenY(proj1[1]));
        this.ctx.stroke();
        
        // Второй перпендикуляр
        this.ctx.beginPath();
        this.ctx.moveTo(this.worldToScreenX(point2[0]), this.worldToScreenY(point2[1]));
        this.ctx.lineTo(this.worldToScreenX(proj2[0]), this.worldToScreenY(proj2[1]));
        this.ctx.stroke();
        
        // 3. Рисуем засечки
        this.ctx.beginPath();
        this.ctx.fillStyle = Layers.getStrokeStyle(layer);
        this.ctx.arc(this.worldToScreenX(proj1[0]), this.worldToScreenY(proj1[1]), 3, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.fillStyle = Layers.getStrokeStyle(layer);
        this.ctx.arc(this.worldToScreenX(proj2[0]), this.worldToScreenY(proj2[1]), 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 4. Рисуем текст
        // Середина выноски
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        
        // Смещение текста от линии
        const textX = this.worldToScreenX(midX);
        const textY = this.worldToScreenY(midY);
        
        // Настраиваем стиль текста
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Поворачиваем контекст для текста
        this.ctx.translate(textX, textY);
        this.ctx.rotate(-angle);
        
        // Рисуем текст
        const text = dim.textFunction(Math.hypot(startX - endX, startY - endY));
        this.ctx.fillText(text, 0, -10);
        
        // Восстанавливаем состояние контекста
        this.ctx.restore();
    }

    drawAxleInternal(axle) {
        const layer = axle.layer || 'default';
        const coord = axle.coord;
        
        this.ctx.strokeStyle = Layers.getStrokeStyle(layer);
        this.ctx.lineWidth = Layers.getLineWidth(layer);
        this.ctx.setLineDash([5, 3]);
        
        if (axle.axle === 'x') {
            const screenY = this.worldToScreenY(coord);
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(this.canvasWidth, screenY);
            this.ctx.stroke();
            
            // Подпись
            if (axle.text) {
                this.ctx.fillStyle = Layers.getStrokeStyle(layer);
                this.ctx.font = '12px Arial';
                this.ctx.fillText(axle.text, 10, screenY - 5);
            }
        } else if (axle.axle === 'y') {
            const screenX = this.worldToScreenX(coord);
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, this.canvasHeight);
            this.ctx.stroke();
            
            // Подпись
            if (axle.text) {
                this.ctx.fillStyle = Layers.getStrokeStyle(layer);
                this.ctx.font = '12px Arial';
                this.ctx.fillText(axle.text, screenX + 5, 15);
            }
        }
        
        this.ctx.setLineDash([]);
    }

    clear(layer = null) {
        if (layer === null) {
            this.dots = [];
            this.polylines = [];
            this.axles = [];
        } else {
            this.dots = this.dots.filter(dot => dot.layer !== layer);
            this.polylines = this.polylines.filter(poly => poly.layer !== layer);
            this.axles = this.axles.filter(axle => axle.layer !== layer);
        }
        this.redraw();
    }

    resize(width, height) {
        // Если нужно задать фиксированный размер — задаём размер контейнера, а canvas синхронизируем
        this.canvasContainer.style.width = `${width}px`;
        this.canvasContainer.style.height = `${height}px`;
        this._scheduleSyncCanvasSize(true);
    }

    setWorldRect(worldLeft, worldTop, worldWidth, worldHeight) {
        this.worldLeft = worldLeft;
        this.worldTop = worldTop;
        this.worldWidth = Math.max(1e-9, worldWidth);
        this.worldHeight = Math.max(1e-9, worldHeight);
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.redraw();
    }
}
