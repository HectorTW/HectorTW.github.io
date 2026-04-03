(defun c:PL2TXT (/ ent pline pt pts data str insPt mtext)
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
(princ)