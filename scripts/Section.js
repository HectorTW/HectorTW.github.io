import { Polyline } from "./DXF.js"

export class Section {
    constructor(sectionData){
        this.data = sectionData;
    }
    getData = () => this.data;
    getProps(up, down){
        if (!this.data.params) return
        const result = {}
        const h = up - down;
        this.data.params.forEach(element => {
            const key = element.key;
            const funcText = element.funcText;
            const func = Function("h", "return " + funcText)

            result[key] = func(h);
        });
        const props = {up, down, ...result}

        return props
    }
    getSectionDots(props, offset){
        const sign = 1 / offset < 0 ? -1 : 1;

        const dots = [];
        const dotsX = this.data['dotsX'];
        const dotsY = this.data['dotsY'];
        const dotsAmount = Math.min(dotsX.length, dotsY.length)
        for (let index = 0; index < dotsAmount; index++) {
            let xCoord = offset;
            let yCoord = 0;
            for (const key in props) {
                xCoord += sign*props[key]*parseFloat(dotsX[index][key]);
                yCoord += props[key]*parseFloat(dotsY[index][key]);
            }
            xCoord += sign*dotsX[index].const;
            yCoord += dotsY[index].const;

            dots.push({
                layer: "s0.5-3",
                text: (index + 1),
                coords: [xCoord, yCoord]
            });
        }
        return dots;
    }
    getSectionPolylines(props, offset){
        const dots = this.getSectionDots(props, offset);
        const s2a = (string) => string?.split(',').map(item => item.trim()).map(Number) || [];

        return this.data.drawSection.map(polyData => {
            return new Polyline (
                polyData.layer,
                s2a(polyData.dotsTextArray).map(dotNumber => dots[dotNumber - 1].coords),
                polyData.isClose,
            );
        })
    }
    getPlanPolylines(props, offset, planPolylineCoords, start, length){
        const dots = this.getSectionDots(props, offset);
        const options = (dotNumber) => [
            planPolylineCoords,
            start,
            start + length,
            -dots[dotNumber-1].coords[0]
        ];

        function transformArray(arr) {
            if (!Array.isArray(arr) || arr.length === 0) return [];
            
            // Создаем копию массива, чтобы не мутировать оригинал
            const result = arr.map(subArr => [...subArr]);
            
            // Получаем значения последних элементов каждого подмассива
            // кроме последнего подмассива
            const lastElements = [];
            for (let i = 0; i < arr.length - 1; i++) {
                lastElements.push(arr[i][arr[i].length - 1]);
            }
            
            // Перемещаем элементы по часовой стрелке
            for (let i = 0; i < result.length; i++) {
                const lastIndex = result[i].length - 1;
                
                if (i === 0) {
                    // Для первого массива берем последний элемент из последнего массива
                    result[i][lastIndex] = -arr[arr.length - 1][lastIndex];
                } else {
                    // Для остальных берем элементы из предыдущих массивов
                    result[i][lastIndex] = -lastElements[i - 1];
                }
            }
            
            return result;
        }

        return this.data.drawPlan.map(polyData => {
            const result = [];
            result.push(...offsetPolylineWithBulge(...options(polyData.dot1)))
            result.push(...transformArray(offsetPolylineWithBulge(...options(polyData.dot2))).reverse())
            return new Polyline (
                polyData.layer,
                result,
                polyData.isClose,
            );
        })
    }
    getFasadPolylines(props, offset, fasadPolylineCoords, start, length){
        const upHeightStart = getHeightByDistanceCompact(fasadPolylineCoords, start);
        const upHeightEnd = getHeightByDistanceCompact(fasadPolylineCoords, start + length);
        const sectionStart = this.getSectionDots({...props, up: upHeightStart}, offset);
        const sectionEnd = this.getSectionDots({...props, up: upHeightEnd}, offset);

        return this.data.drawFasad.map(polyData => {
            const result = [];
            result.push([start, sectionStart[polyData.dot1-1].coords[1]])
            result.push([start, sectionStart[polyData.dot2-1].coords[1]])
            result.push([start + length, sectionEnd[polyData.dot2-1].coords[1]])
            result.push([start + length, sectionEnd[polyData.dot1-1].coords[1]])
            return new Polyline (
                polyData.layer,
                result,
                polyData.isClose,
            );
        })
    }
}

function offsetPolylineWithBulge(polyline, startDist, endDist, offset) {
    // Вспомогательные функции
    function distance(p1, p2) {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function normalize(v) {
        const length = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
        return length === 0 ? [0, 0] : [v[0] / length, v[1] / length];
    }

    function perpendicular(v, sign) {
        return [sign * -v[1], sign * v[0]];
    }

    // Вычисление параметров дуги из bulge
    function getArcParams(startPoint, endPoint, bulge) {
        if (Math.abs(bulge) < 1e-12) return null;
        
        const chord = distance(startPoint, endPoint);
        if (chord < 1e-12) return null;

        const angle = 4 * Math.atan(Math.abs(bulge));
        const radius = Math.abs(chord / (2 * Math.sin(angle / 2)));
        
        const chordVec = [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]];
        const chordUnit = normalize(chordVec);
        const sign = Math.sign(bulge);
        const perpVec = perpendicular(chordUnit, sign);
        
        const midPoint = [
            (startPoint[0] + endPoint[0]) / 2,
            (startPoint[1] + endPoint[1]) / 2
        ];
        
        const midToCenterDist = Math.sqrt(radius * radius - (chord / 2) * (chord / 2));
        
        const center = [
            midPoint[0] + perpVec[0] * midToCenterDist,
            midPoint[1] + perpVec[1] * midToCenterDist
        ];
        
        const startAngle = Math.atan2(startPoint[1] - center[1], startPoint[0] - center[0]);
        const endAngle = Math.atan2(endPoint[1] - center[1], endPoint[0] - center[0]);
        
        let arcAngle = endAngle - startAngle;
        if (sign > 0 && arcAngle < 0) arcAngle += 2 * Math.PI;
        if (sign < 0 && arcAngle > 0) arcAngle -= 2 * Math.PI;
        
        return {
            center,
            radius,
            startAngle,
            endAngle,
            arcAngle,
            chord,
            bulge,
            sign
        };
    }

    // Найти точку на отрезке
    function pointOnSegment(p1, p2, t) {
        return [
            p1[0] + (p2[0] - p1[0]) * t,
            p1[1] + (p2[1] - p1[1]) * t
        ];
    }

    // Найти точку на дуге по пройденному расстоянию
    function pointOnArc(arcParams, distanceFromStart) {
        if (distanceFromStart <= 0) {
            return [arcParams.startX, arcParams.startY];
        }
        if (distanceFromStart >= arcParams.length) {
            return [arcParams.endX, arcParams.endY];
        }
        
        const angleFromStart = (distanceFromStart / arcParams.length) * arcParams.arcAngle;
        const angle = arcParams.startAngle + angleFromStart;
        
        return [
            arcParams.center[0] + arcParams.radius * Math.cos(angle),
            arcParams.center[1] + arcParams.radius * Math.sin(angle)
        ];
    }

    // Сместить точку вдоль нормали
    function offsetPoint(point, direction, offsetDist) {
        const normal = perpendicular(direction, 1);
        return [
            point[0] + normal[0] * offsetDist,
            point[1] + normal[1] * offsetDist
        ];
    }

    // Создать параметры дуги из двух точек и центра
    function createArcFromCenter(center, radius, startPoint, endPoint, originalSign) {
        const startAngle = Math.atan2(startPoint[1] - center[1], startPoint[0] - center[0]);
        const endAngle = Math.atan2(endPoint[1] - center[1], endPoint[0] - center[0]);
        
        let arcAngle = endAngle - startAngle;
        if (originalSign > 0 && arcAngle < 0) arcAngle += 2 * Math.PI;
        if (originalSign < 0 && arcAngle > 0) arcAngle -= 2 * Math.PI;
        
        const chord = distance(startPoint, endPoint);
        const bulge = Math.tan(arcAngle / 4) * Math.sign(arcAngle);
        
        return {
            startPoint: [startPoint[0], startPoint[1], bulge],
            endPoint: [endPoint[0], endPoint[1], 0],
            center,
            radius,
            startAngle,
            endAngle,
            arcAngle,
            length: Math.abs(arcAngle) * radius
        };
    }

    const result = [];
    let accumulatedDist = 0;
    let inOffsetSection = false;
    let lastPoint = null;
    
    for (let i = 0; i < polyline.length - 1; i++) {
        const startPoint = polyline[i];
        const endPoint = polyline[i + 1];
        const bulge = startPoint[2];
        
        const p1 = [startPoint[0], startPoint[1]];
        const p2 = [endPoint[0], endPoint[1]];
        
        // Длина сегмента
        let segLength;
        let arcParams = null;
        
        if (Math.abs(bulge) < 1e-12) {
            // Линейный сегмент
            segLength = distance(p1, p2);
        } else {
            // Дуговой сегмент
            arcParams = getArcParams(p1, p2, bulge);
            segLength = Math.abs(arcParams.arcAngle) * arcParams.radius;
        }
        
        const segStartDist = accumulatedDist;
        const segEndDist = accumulatedDist + segLength;
        
        // Проверяем, пересекается ли сегмент с диапазоном смещения
        const intersects = segEndDist > startDist && segStartDist < endDist;
        
        if (intersects) {
            // Начальная и конечная точки смещения в этом сегменте
            const localStartDist = Math.max(startDist - segStartDist, 0);
            const localEndDist = Math.min(endDist - segStartDist, segLength);
            
            if (Math.abs(bulge) < 1e-12) {
                // Линейный сегмент - смещаем часть
                const direction = normalize([p2[0] - p1[0], p2[1] - p1[1]]);

                const t = localStartDist / segLength;
                let offsetStartPoint = pointOnSegment(p1, p2, t);

                // Конечная точка смещения
                let offsetEndPoint;
                if (localEndDist >= segLength) {
                    // Заканчиваем в конце сегмента
                    offsetEndPoint = p2;
                } else {
                    // Находим точку внутри сегмента
                    const t = localEndDist / segLength;
                    offsetEndPoint = pointOnSegment(p1, p2, t);
                }
                
                // Смещаем точки
                const offsetStart = offsetPoint(offsetStartPoint, direction, offset);
                const offsetEnd = offsetPoint(offsetEndPoint, direction, offset);
                
                // Добавляем в результат
                result.push([...offsetStart, 0]);
                inOffsetSection = true;
                
                result.push([...offsetEnd, 0]);
                
                lastPoint = offsetEndPoint;
            } else {
                // Дуговой сегмент - смещаем часть дуги
                arcParams.startX = p1[0];
                arcParams.startY = p1[1];
                arcParams.endX = p2[0];
                arcParams.endY = p2[1];
                arcParams.length = segLength;
                
                // Начальная точка смещения на дуге
                let arcStartPoint;
                if (localStartDist <= 0) {
                    arcStartPoint = p1;
                } else {
                    arcStartPoint = pointOnArc(arcParams, localStartDist);
                }
                
                // Конечная точка смещения на дуге
                let arcEndPoint;
                if (localEndDist >= segLength) {
                    arcEndPoint = p2;
                } else {
                    arcEndPoint = pointOnArc(arcParams, localEndDist);
                }
                
                // Смещаем дугу (центр тот же, меняем радиус)
                const newRadius = arcParams.radius - offset * arcParams.sign;
                
                // Углы для начальной и конечной точек
                const startAngle = Math.atan2(arcStartPoint[1] - arcParams.center[1], 
                                            arcStartPoint[0] - arcParams.center[0]);
                const endAngle = Math.atan2(arcEndPoint[1] - arcParams.center[1], 
                                          arcEndPoint[0] - arcParams.center[0]);
                
                // Вычисляем угол дуги
                let arcAngle = endAngle - startAngle;
                if (arcParams.sign > 0 && arcAngle < 0) arcAngle += 2 * Math.PI;
                if (arcParams.sign < 0 && arcAngle > 0) arcAngle -= 2 * Math.PI;
                
                // Смещенные точки
                const offsetStart = [
                    arcParams.center[0] + newRadius * Math.cos(startAngle),
                    arcParams.center[1] + newRadius * Math.sin(startAngle)
                ];
                
                const offsetEnd = [
                    arcParams.center[0] + newRadius * Math.cos(endAngle),
                    arcParams.center[1] + newRadius * Math.sin(endAngle)
                ];
                
                // Вычисляем новый bulge
                const newBulge = arcParams.sign * Math.tan(arcAngle / 4) * Math.sign(arcAngle);
                
                // Добавляем в результат
                if (!inOffsetSection) {
                    result.push([...offsetStart, newBulge]);
                    inOffsetSection = true;
                } else {
                    result.push([...offsetStart, newBulge]);
                }
                
                result.push([...offsetEnd, 0]);
                
                lastPoint = arcEndPoint;
            }
        }
        accumulatedDist += segLength;
    }
    
    // Убедимся, что у последней точки bulge = 0
    if (result.length > 0) {
        result[result.length - 1][2] = 0;
    }
    
    return result;
}
function getSignPolylineWithBulge(polyline, startDist) {
    // Вспомогательные функции
    function distance(p1, p2) {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function normalize(v) {
        const length = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
        return length === 0 ? [0, 0] : [v[0] / length, v[1] / length];
    }

    function perpendicular(v, sign) {
        return [sign * -v[1], sign * v[0]];
    }

    // Вычисление параметров дуги из bulge
    function getArcParams(startPoint, endPoint, bulge) {
        if (Math.abs(bulge) < 1e-12) return null;
        
        const chord = distance(startPoint, endPoint);
        if (chord < 1e-12) return null;

        const angle = 4 * Math.atan(Math.abs(bulge));
        const radius = Math.abs(chord / (2 * Math.sin(angle / 2)));
        
        const chordVec = [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]];
        const chordUnit = normalize(chordVec);
        const sign = Math.sign(bulge);
        const perpVec = perpendicular(chordUnit, sign);
        
        const midPoint = [
            (startPoint[0] + endPoint[0]) / 2,
            (startPoint[1] + endPoint[1]) / 2
        ];
        
        const midToCenterDist = Math.sqrt(radius * radius - (chord / 2) * (chord / 2));
        
        const center = [
            midPoint[0] + perpVec[0] * midToCenterDist,
            midPoint[1] + perpVec[1] * midToCenterDist
        ];
        
        const startAngle = Math.atan2(startPoint[1] - center[1], startPoint[0] - center[0]);
        const endAngle = Math.atan2(endPoint[1] - center[1], endPoint[0] - center[0]);
        
        let arcAngle = endAngle - startAngle;
        if (sign > 0 && arcAngle < 0) arcAngle += 2 * Math.PI;
        if (sign < 0 && arcAngle > 0) arcAngle -= 2 * Math.PI;
        
        return {
            center,
            radius,
            startAngle,
            endAngle,
            arcAngle,
            chord,
            bulge,
            sign
        };
    }

    let accumulatedDist = 0;
    
    for (let i = 0; i < polyline.length - 1; i++) {
        const startPoint = polyline[i];
        const endPoint = polyline[i + 1];
        const bulge = startPoint[2];
        
        const p1 = [startPoint[0], startPoint[1]];
        const p2 = [endPoint[0], endPoint[1]];
        
        // Длина сегмента
        let segLength;
        let arcParams = null;
        
        if (Math.abs(bulge) < 1e-12) {
            // Линейный сегмент
            segLength = distance(p1, p2);
        } else {
            // Дуговой сегмент
            arcParams = getArcParams(p1, p2, bulge);
            segLength = Math.abs(arcParams.arcAngle) * arcParams.radius;
        }
        
        const segStartDist = accumulatedDist;
        const segEndDist = accumulatedDist + segLength;
        
        // Проверяем, пересекается ли сегмент с диапазоном смещения
        
        if (segEndDist > startDist) {
            return Math.sign(bulge);
        }
        accumulatedDist += segLength;
    }
}
function getPolylineWithBulgeLength(polyline) {
    // Вспомогательные функции
    function distance(p1, p2) {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function normalize(v) {
        const length = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
        return length === 0 ? [0, 0] : [v[0] / length, v[1] / length];
    }

    function perpendicular(v, sign) {
        return [sign * -v[1], sign * v[0]];
    }

    // Вычисление параметров дуги из bulge
    function getArcParams(startPoint, endPoint, bulge) {
        if (Math.abs(bulge) < 1e-12) return null;
        
        const chord = distance(startPoint, endPoint);
        if (chord < 1e-12) return null;

        const angle = 4 * Math.atan(Math.abs(bulge));
        const radius = Math.abs(chord / (2 * Math.sin(angle / 2)));
        
        const chordVec = [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]];
        const chordUnit = normalize(chordVec);
        const sign = Math.sign(bulge);
        const perpVec = perpendicular(chordUnit, sign);
        
        const midPoint = [
            (startPoint[0] + endPoint[0]) / 2,
            (startPoint[1] + endPoint[1]) / 2
        ];
        
        const midToCenterDist = Math.sqrt(radius * radius - (chord / 2) * (chord / 2));
        
        const center = [
            midPoint[0] + perpVec[0] * midToCenterDist,
            midPoint[1] + perpVec[1] * midToCenterDist
        ];
        
        const startAngle = Math.atan2(startPoint[1] - center[1], startPoint[0] - center[0]);
        const endAngle = Math.atan2(endPoint[1] - center[1], endPoint[0] - center[0]);
        
        let arcAngle = endAngle - startAngle;
        if (sign > 0 && arcAngle < 0) arcAngle += 2 * Math.PI;
        if (sign < 0 && arcAngle > 0) arcAngle -= 2 * Math.PI;
        
        return {
            center,
            radius,
            startAngle,
            endAngle,
            arcAngle,
            chord,
            bulge,
            sign
        };
    }

    let accumulatedDist = 0;
    
    for (let i = 0; i < polyline.length - 1; i++) {
        const startPoint = polyline[i];
        const endPoint = polyline[i + 1];
        const bulge = startPoint[2];
        
        const p1 = [startPoint[0], startPoint[1]];
        const p2 = [endPoint[0], endPoint[1]];
        
        // Длина сегмента
        let segLength;
        let arcParams = null;
        
        if (Math.abs(bulge) < 1e-12) {
            // Линейный сегмент
            segLength = distance(p1, p2);
        } else {
            // Дуговой сегмент
            arcParams = getArcParams(p1, p2, bulge);
            segLength = Math.abs(arcParams.arcAngle) * arcParams.radius;
        }

        accumulatedDist += segLength;
    }
    return accumulatedDist
}
function findEndDistForOffsetLength(polyline, startDist, targetLength, offset) {
    // Вспомогательные функции
    function distance(p1, p2) {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function normalize(v) {
        const length = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
        return length === 0 ? [0, 0] : [v[0] / length, v[1] / length];
    }

    function perpendicular(v, sign) {
        return [sign * -v[1], sign * v[0]];
    }

    // Вычисление параметров дуги из bulge
    function getArcParams(startPoint, endPoint, bulge) {
        if (Math.abs(bulge) < 1e-12) return null;
        
        const chord = distance(startPoint, endPoint);
        if (chord < 1e-12) return null;

        const angle = 4 * Math.atan(Math.abs(bulge));
        const radius = Math.abs(chord / (2 * Math.sin(angle / 2)));
        
        const chordVec = [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]];
        const chordUnit = normalize(chordVec);
        const sign = Math.sign(bulge);
        const perpVec = perpendicular(chordUnit, sign);
        
        const midPoint = [
            (startPoint[0] + endPoint[0]) / 2,
            (startPoint[1] + endPoint[1]) / 2
        ];
        
        const midToCenterDist = Math.sqrt(radius * radius - (chord / 2) * (chord / 2));
        
        const center = [
            midPoint[0] + perpVec[0] * midToCenterDist,
            midPoint[1] + perpVec[1] * midToCenterDist
        ];
        
        const startAngle = Math.atan2(startPoint[1] - center[1], startPoint[0] - center[0]);
        const endAngle = Math.atan2(endPoint[1] - center[1], endPoint[0] - center[0]);
        
        let arcAngle = endAngle - startAngle;
        if (sign > 0 && arcAngle < 0) arcAngle += 2 * Math.PI;
        if (sign < 0 && arcAngle > 0) arcAngle -= 2 * Math.PI;
        
        return {
            center,
            radius,
            startAngle,
            endAngle,
            arcAngle,
            chord,
            bulge,
            sign
        };
    }

    // Функция для вычисления длины смещенного сегмента
    function getOffsetSegmentLength(startPoint, endPoint, bulge, startDistOnSegment, endDistOnSegment, offset) {
        if (Math.abs(bulge) < 1e-12) {
            // Линейный сегмент
            const segmentLength = distance(startPoint, endPoint);
            
            // Если смещение не влияет на длину (параллельное смещение)
            // Для линейного сегмента длина смещенной части такая же как и исходной
            const originalLength = Math.min(endDistOnSegment, segmentLength) - Math.max(startDistOnSegment, 0);
            return Math.max(0, originalLength);
        } else {
            // Дуговой сегмент
            const arcParams = getArcParams(startPoint, endPoint, bulge);
            if (!arcParams) return 0;
            
            const segLength = Math.abs(arcParams.arcAngle) * arcParams.radius;
            
            // Убедимся, что диапазон в пределах сегмента
            const effectiveStart = Math.max(startDistOnSegment, 0);
            const effectiveEnd = Math.min(endDistOnSegment, segLength);
            
            if (effectiveEnd <= effectiveStart) return 0;
            
            // Вычисляем углы для начала и конца сегмента
            const startAngle = arcParams.startAngle + (effectiveStart / segLength) * arcParams.arcAngle;
            const endAngle = arcParams.startAngle + (effectiveEnd / segLength) * arcParams.arcAngle;
            
            // Угловая длина
            let angleLength = endAngle - startAngle;
            
            // Нормализуем угол в зависимости от направления
            if (arcParams.sign > 0 && angleLength < 0) {
                angleLength += 2 * Math.PI;
            } else if (arcParams.sign < 0 && angleLength > 0) {
                angleLength -= 2 * Math.PI;
            }
            
            // Длина смещенной дуги
            const offsetRadius = arcParams.radius - offset * arcParams.sign;
            
            // Если offsetRadius <= 0, значит дуга выродилась
            if (offsetRadius <= 0) return 0;
            
            return Math.abs(angleLength) * offsetRadius;
        }
    }

    // Функция для поиска точки на исходной полилинии, где достигается заданная длина смещенной
    function findEndDist(startDist, targetLength) {
        let accumulatedLength = 0;
        let accumulatedDist = 0;
        
        // Сначала пройдемся по полилинии, чтобы найти сегмент, содержащий startDist
        let startSegmentIndex = -1;
        let startSegmentOffset = 0;
        let currentDist = 0;
        
        for (let i = 0; i < polyline.length - 1; i++) {
            const startPoint = polyline[i];
            const endPoint = polyline[i + 1];
            const bulge = startPoint[2];
            
            const p1 = [startPoint[0], startPoint[1]];
            const p2 = [endPoint[0], endPoint[1]];
            
            let segLength;
            if (Math.abs(bulge) < 1e-12) {
                segLength = distance(p1, p2);
            } else {
                const arcParams = getArcParams(p1, p2, bulge);
                segLength = Math.abs(arcParams.arcAngle) * arcParams.radius;
            }
            
            if (currentDist <= startDist && currentDist + segLength > startDist) {
                startSegmentIndex = i;
                startSegmentOffset = startDist - currentDist;
                break;
            }
            
            currentDist += segLength;
        }
        
        if (startSegmentIndex === -1) {
            // startDist находится за пределами полилинии
            return null;
        }
        
        // Теперь идем от startDist и суммируем длины смещенных сегментов
        accumulatedDist = startDist;
        
        for (let i = startSegmentIndex; i < polyline.length - 1; i++) {
            const startPoint = polyline[i];
            const endPoint = polyline[i + 1];
            const bulge = startPoint[2];
            
            const p1 = [startPoint[0], startPoint[1]];
            const p2 = [endPoint[0], endPoint[1]];
            
            let segLength;
            let arcParams = null;
            
            if (Math.abs(bulge) < 1e-12) {
                segLength = distance(p1, p2);
            } else {
                arcParams = getArcParams(p1, p2, bulge);
                segLength = Math.abs(arcParams.arcAngle) * arcParams.radius;
            }
            
            const segStartDist = (i === startSegmentIndex) ? startSegmentOffset : 0;
            const segEndDist = segLength;
            
            // Проверяем, сколько мы можем взять из этого сегмента
            let remainingTarget = targetLength - accumulatedLength;
            
            if (remainingTarget <= 0) {
                // Мы уже достигли нужной длины
                break;
            }
            
            // Функция для вычисления длины смещенной части сегмента от start до end
            function getOffsetLengthForRange(start, end) {
                return getOffsetSegmentLength(p1, p2, bulge, start, end, offset);
            }
            
            // Проверяем, поместится ли оставшаяся длина в этот сегмент
            const maxOffsetLengthInSegment = getOffsetLengthForRange(segStartDist, segEndDist);
            
            if (maxOffsetLengthInSegment >= remainingTarget) {
                // Нужно найти точку внутри сегмента
                // Используем бинарный поиск для нахождения endDist в этом сегменте
                let low = segStartDist;
                let high = segEndDist;
                let mid;
                
                for (let iter = 0; iter < 50; iter++) { // ограничим количество итераций
                    mid = (low + high) / 2;
                    
                    const offsetLength = getOffsetLengthForRange(segStartDist, mid);
                    
                    if (Math.abs(offsetLength - remainingTarget) < 1e-6) {
                        break;
                    }
                    
                    if (offsetLength < remainingTarget) {
                        low = mid;
                    } else {
                        high = mid;
                    }
                }
                
                // Вычисляем конечное расстояние
                const segmentStartGlobal = accumulatedDist - segStartDist;
                const endDist = segmentStartGlobal + mid;
                return endDist;
            } else {
                // Берем весь сегмент
                accumulatedLength += maxOffsetLengthInSegment;
                accumulatedDist += (segEndDist - segStartDist);
            }
        }
        
        // Если мы дошли до конца, возвращаем общее расстояние
        // Вычисляем общую длину полилинии
        let totalLength = 0;
        for (let i = 0; i < polyline.length - 1; i++) {
            const startPoint = polyline[i];
            const endPoint = polyline[i + 1];
            const bulge = startPoint[2];
            
            const p1 = [startPoint[0], startPoint[1]];
            const p2 = [endPoint[0], endPoint[1]];
            
            if (Math.abs(bulge) < 1e-12) {
                totalLength += distance(p1, p2);
            } else {
                const arcParams = getArcParams(p1, p2, bulge);
                totalLength += Math.abs(arcParams.arcAngle) * arcParams.radius;
            }
        }
        
        return Math.min(accumulatedDist, totalLength);
    }
    
    return findEndDist(startDist, targetLength);
}
function getHeightByDistanceCompact(points, dist) {
    // Граничные случаи
    if (dist <= points[0][0]) return points[0][1];
    if (dist >= points[points.length - 1][0]) return points[points.length - 1][1];
    
    // Поиск отрезка и интерполяция
    for (let i = 0; i < points.length - 1; i++) {
        const [d1, h1] = points[i];
        const [d2, h2] = points[i + 1];
        
        if (dist >= d1 && dist <= d2) {
            if (d2 === d1) return h1;
            const t = (dist - d1) / (d2 - d1);
            return h1 + (h2 - h1) * t;
        }
    }
    
    throw new Error('Не удалось найти отрезок для интерполяции');
}
function getMaxHeightOnSegment(points, dist, length) {
    // Проверка входных данных
    if (!points || points.length === 0) {
        throw new Error('Массив точек не может быть пустым');
    }
    
    if (length < 0) {
        throw new Error('Длина участка не может быть отрицательной');
    }
    
    const endDist = dist + length;
    const firstDist = points[0][0];
    const lastDist = points[points.length - 1][0];
    
    // Если весь участок до начала трассы
    if (endDist <= firstDist) {
        return points[0][1];
    }
    
    // Если весь участок после конца трассы
    if (dist >= lastDist) {
        return points[points.length - 1][1];
    }
    
    // Находим начальный индекс отрезка, содержащего dist
    let startSegmentIndex = -1;
    for (let i = 0; i < points.length - 1; i++) {
        if (dist >= points[i][0] && dist <= points[i + 1][0]) {
            startSegmentIndex = i;
            break;
        }
        if (i === 0 && dist < points[i][0]) {
            startSegmentIndex = 0;
            break;
        }
    }
    
    if (startSegmentIndex === -1) {
        throw new Error('Не удалось найти начальный отрезок');
    }
    
    // Функция для получения высоты в любой точке
    function getHeightAt(distance) {
        if (distance <= firstDist) return points[0][1];
        if (distance >= lastDist) return points[points.length - 1][1];
        
        for (let i = 0; i < points.length - 1; i++) {
            const [d1, h1] = points[i];
            const [d2, h2] = points[i + 1];
            
            if (distance >= d1 && distance <= d2) {
                if (d2 === d1) return h1;
                const t = (distance - d1) / (d2 - d1);
                return h1 + (h2 - h1) * t;
            }
        }
        return 0;
    }
    
    let maxHeight = -Infinity;
    
    // Добавляем высоту в начальной точке
    const startHeight = getHeightAt(dist);
    maxHeight = Math.max(maxHeight, startHeight);
    
    // Добавляем высоту в конечной точке
    const endHeight = getHeightAt(endDist);
    maxHeight = Math.max(maxHeight, endHeight);
    
    // Проверяем все вершины ломаной на участке
    for (let i = 0; i < points.length; i++) {
        const pointDist = points[i][0];
        const pointHeight = points[i][1];
        
        // Если вершина находится внутри участка
        if (pointDist > dist && pointDist < endDist) {
            maxHeight = Math.max(maxHeight, pointHeight);
        }
    }
    
    // Проверяем локальные максимумы внутри отрезков
    for (let i = 0; i < points.length - 1; i++) {
        const [d1, h1] = points[i];
        const [d2, h2] = points[i + 1];
        
        // Если отрезок полностью или частично находится на участке
        const segmentStart = Math.max(dist, d1);
        const segmentEnd = Math.min(endDist, d2);
        
        if (segmentStart < segmentEnd) {
            // Если функция на отрезке монотонна, экстремумы только на концах
            // Для линейной функции максимальное значение на отрезке всегда
            // на одном из концов или в локальном максимуме, если он внутри
            if (h1 !== h2) {
                // Для линейной функции максимум всегда на концах отрезка,
                // но проверим, не находится ли точка перегиба внутри участка
                // (для линейной функции это неактуально, оставляем для общности)
            }
        }
    }
    
    return maxHeight;
}
function getMaxHeightOnSegmentOptimized(points, dist, length) {
    const endDist = dist + length;
    const firstDist = points[0][0];
    const lastDist = points[points.length - 1][0];
    
    // Крайние случаи
    if (endDist <= firstDist) return points[0][1];
    if (dist >= lastDist) return points[points.length - 1][1];
    
    let maxHeight = -Infinity;
    
    // Функция для интерполяции высоты
    const getHeight = (distance) => {
        if (distance <= firstDist) return points[0][1];
        if (distance >= lastDist) return points[points.length - 1][1];
        
        for (let i = 0; i < points.length - 1; i++) {
            const [d1, h1] = points[i];
            const [d2, h2] = points[i + 1];
            
            if (distance >= d1 && distance <= d2) {
                if (d2 === d1) return h1;
                const t = (distance - d1) / (d2 - d1);
                return h1 + (h2 - h1) * t;
            }
        }
        return 0;
    };
    
    // Высота в начальной точке
    maxHeight = Math.max(maxHeight, getHeight(dist));
    
    // Высота в конечной точке
    maxHeight = Math.max(maxHeight, getHeight(endDist));
    
    // Перебираем все точки ломаной, которые попадают в диапазон
    for (let i = 0; i < points.length; i++) {
        const [pointDist, pointHeight] = points[i];
        
        // Если точка строго внутри диапазона (исключая границы, они уже учтены)
        if (pointDist > dist && pointDist < endDist) {
            maxHeight = Math.max(maxHeight, pointHeight);
        }
        
        // Также проверяем отрезки, которые пересекают границы диапазона
        if (i < points.length - 1) {
            const [d1, h1] = points[i];
            const [d2, h2] = points[i + 1];
            
            // Проверяем, пересекает ли отрезок начальную границу
            if (dist > d1 && dist < d2) {
                maxHeight = Math.max(maxHeight, getHeight(dist));
            }
            
            // Проверяем, пересекает ли отрезок конечную границу
            if (endDist > d1 && endDist < d2) {
                maxHeight = Math.max(maxHeight, getHeight(endDist));
            }
        }
    }
    
    return maxHeight;
}