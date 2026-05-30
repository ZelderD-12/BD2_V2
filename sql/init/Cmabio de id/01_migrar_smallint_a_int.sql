-- ============================================================
-- MIGRAR todas las columnas SMALLINT a INT
-- Compatible con DBeaver (sin GO)
-- ============================================================

-- ============================================================
-- 1. RESPALDO y DROP de TODAS las FK del schema dbo
-- ============================================================
IF OBJECT_ID('tempdb..#FksBackup') IS NOT NULL DROP TABLE #FksBackup;

SELECT
    fk.name AS fk_name,
    OBJECT_NAME(fk.parent_object_id) AS parent_table,
    OBJECT_NAME(fk.referenced_object_id) AS ref_table,
    fk.delete_referential_action_desc,
    fk.update_referential_action_desc,
    STRING_AGG(COL_NAME(fkc.parent_object_id, fkc.parent_column_id), ', ')
        WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS parent_cols,
    STRING_AGG(COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id), ', ')
        WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS ref_cols
INTO #FksBackup
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = 'dbo'
GROUP BY fk.name, fk.parent_object_id, fk.referenced_object_id,
         fk.delete_referential_action_desc, fk.update_referential_action_desc;

PRINT CONCAT('FK respaldadas: ', @@ROWCOUNT);

-- ============================================================
-- 1b. RESPALDO de TODAS las PK
-- ============================================================
IF OBJECT_ID('tempdb..#PKsBackup') IS NOT NULL DROP TABLE #PKsBackup;

SELECT kc.name AS pk_name, o.name AS table_name,
       STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS cols
INTO #PKsBackup
FROM sys.key_constraints kc
JOIN sys.objects o ON o.object_id = kc.parent_object_id
JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id AND ic.is_included_column = 0
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.type = 'PK' AND o.schema_id = SCHEMA_ID('dbo')
GROUP BY kc.name, o.name;

PRINT CONCAT('PK respaldadas: ', @@ROWCOUNT);

DECLARE @sql NVARCHAR(MAX);
DECLARE @fkName SYSNAME, @ptable SYSNAME, @fkParentCols NVARCHAR(500);

DECLARE fk_cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT fk_name, parent_table FROM #FksBackup;

OPEN fk_cur;
FETCH NEXT FROM fk_cur INTO @fkName, @ptable;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'ALTER TABLE dbo.[' + @ptable + '] DROP CONSTRAINT [' + @fkName + ']';
    PRINT '  DROP FK: ' + @fkName;
    EXEC sp_executesql @sql;
    FETCH NEXT FROM fk_cur INTO @fkName, @ptable;
END
CLOSE fk_cur; DEALLOCATE fk_cur;
PRINT 'Todas las FK eliminadas.';

-- ============================================================
-- 2. Tabla de migración: TODAS las columnas SMALLINT
-- ============================================================
IF OBJECT_ID('tempdb..#MigrateColToInt') IS NOT NULL
    DROP TABLE #MigrateColToInt;

CREATE TABLE #MigrateColToInt (
    tabla    SYSNAME,
    columna  SYSNAME,
    es_pk    BIT DEFAULT 0
);

INSERT INTO #MigrateColToInt (tabla, columna, es_pk) VALUES
-- PKs simples
('Caso_Especial',         'id_caso_especial',      1),
('Categoria_Medicamento', 'id_categoria',           1),
('Cita',                  'id_cita',                1),
('Empleado',              'id_medico',              1),
('Estados_Citas',         'id_estado_cita',         1),
('Estados_Tickets',       'id_estado_ticket',       1),
('HistorialClinico',      'id_historial',           1),
('LogTicket',             'id_ticket',              1),
('LogUsuario',            'id_log',                 1),
('Medicamento',           'id_medicamento',         1),
('Parametro',             'id_Parametro',           1),
('Receta',                'id_receta',              1),
('Rol',                   'id_rol',                 1),
('Sede',                  'id_sede',                1),
('Servicio',              'id_servicio',            1),
('Sesion',                'id_sesion',              1),
('Ticket',                'id_ticket',              1),
('Usuario',               'id_usuario',             1),
-- FK / columnas referenciadas (no PK)
('Caso_Especial',         'prioridad_caso_especial',0),
('Cita',                  'id_estado_cita',         0),
('Cita',                  'id_medico',              0),
('Cita',                  'id_paciente',            0),
('Cita',                  'id_sede',                0),
('Cita',                  'id_servicio',            0),
('Cita_Historial_Cambios','id_cita',                0),
('Cita_Historial_Cambios','id_paciente',            0),
('Cita_Historial_Cambios','id_recepcionista',       0),
('Empleado',              'id_usuario_m',           0),
('HistorialClinico',      'id_cita',                0),
('HistorialClinico',      'id_medico',              0),
('HistorialClinico',      'id_paciente',            0),
('HistorialClinico',      'creado_por',             0),
('HistorialClinico',      'modificado_por',         0),
('Inventario_Sede',       'id_inventario',          0),
('LogUsuario',            'usuario_afectado_id',    0),
('LogUsuario',            'usuario_ejecutor',       0),
('Receta',                'id_cita',                0),
('Receta',                'id_medicamento',         0),
('Receta',                'id_medico',              0),
('Receta',                'id_paciente',            0),
('Receta_Detalle',        'id_detalle',             0),
('Receta_Detalle',        'id_medicamento',         0),
('Receta_Detalle',        'id_receta',              0),
('Sede',                  'capacidad_slots',        0),
('Sesion',                'id_usuario',             0),
('Ticket',                'id_caso_especial_ticekt',0),
('Ticket',                'id_cita',                0),
('Ticket',                'id_estado_ticket',       0),
('Ticket',                'id_paciente',            0),
('Ticket',                'id_recepcionista',       0),
('Ticket',                'id_sede',                0),
('Ticket',                'id_servicio',            0),
('Usuario',               'rol',                    0);

-- PKs compuestas (es_pk=0 para que el loop no las maneje)
INSERT INTO #MigrateColToInt (tabla, columna, es_pk) VALUES
('Inventario_Sede',      'id_medicamento',          0),
('Inventario_Sede',      'id_sede',                 0),
('Medicamento_Categoria','id_categoria',            0),
('Medicamento_Categoria','id_medicamento',          0);

DECLARE @cnt INT;
SELECT @cnt = COUNT(*) FROM #MigrateColToInt;
PRINT CONCAT('Columnas a migrar: ', @cnt);

-- Tabla temporal con tablas que tienen PK compuesta
IF OBJECT_ID('tempdb..#CompositePkTables') IS NOT NULL DROP TABLE #CompositePkTables;

SELECT o.name AS table_name
INTO #CompositePkTables
FROM sys.indexes i
JOIN sys.objects o ON o.object_id = i.object_id
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
WHERE i.is_primary_key = 1 AND o.schema_id = SCHEMA_ID('dbo')
GROUP BY o.name, i.index_id
HAVING COUNT(*) > 1;

-- ============================================================
-- 3. Migrar cada columna
-- ============================================================
DECLARE @tabla    SYSNAME,
        @columna  SYSNAME,
        @es_pk    BIT,
        @pkName   SYSNAME,
        @colType  SYSNAME,
        @nullable NVARCHAR(10);

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT tabla, columna, es_pk FROM #MigrateColToInt
    ORDER BY es_pk DESC, tabla, columna;

OPEN cur;
FETCH NEXT FROM cur INTO @tabla, @columna, @es_pk;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns c
        JOIN sys.objects o ON o.object_id = c.object_id
        WHERE o.name = @tabla AND c.name = @columna AND o.schema_id = SCHEMA_ID('dbo')
    )
    BEGIN
        PRINT '  [SKIP] No encontrada: ' + @tabla + '.' + @columna;
        FETCH NEXT FROM cur INTO @tabla, @columna, @es_pk;
        CONTINUE;
    END

    SELECT @colType = t.name,
           @nullable = CASE c.is_nullable WHEN 1 THEN 'NULL' ELSE 'NOT NULL' END
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    JOIN sys.objects o ON o.object_id = c.object_id
    WHERE o.name = @tabla AND c.name = @columna AND o.schema_id = SCHEMA_ID('dbo');

    IF @colType IS NULL
    BEGIN
        PRINT '  [SKIP] Sin tipo: ' + @tabla + '.' + @columna;
        FETCH NEXT FROM cur INTO @tabla, @columna, @es_pk;
        CONTINUE;
    END

    IF @colType <> 'smallint'
    BEGIN
        PRINT '  [SKIP] ' + @tabla + '.' + @columna + ' ya es ' + @colType;
        FETCH NEXT FROM cur INTO @tabla, @columna, @es_pk;
        CONTINUE;
    END

    PRINT '  Migrando ' + @tabla + '.' + @columna + ' (' + @colType + ' -> INT)...';

    -- Backup y DROP de indexes no PK que referencian esta columna
    DECLARE idx_cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT DISTINCT i.name
        FROM sys.indexes i
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        JOIN sys.objects o ON o.object_id = i.object_id
        WHERE o.name = @tabla AND c.name = @columna
          AND i.is_primary_key = 0 AND i.is_unique_constraint = 0
          AND i.type IN (1,2) AND o.schema_id = SCHEMA_ID('dbo');

    DECLARE @idxName SYSNAME, @idxCols NVARCHAR(500), @isUniq BIT;
    CREATE TABLE #IdxBackup (idx_name SYSNAME, idx_cols NVARCHAR(500), is_unique BIT, is_desc BIT);

    OPEN idx_cur;
    FETCH NEXT FROM idx_cur INTO @idxName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @idxCols = STRING_AGG(c2.name + CASE ic2.is_descending_key WHEN 1 THEN ' DESC' ELSE ' ASC' END, ', ')
                          WITHIN GROUP (ORDER BY ic2.key_ordinal),
               @isUniq  = MAX(CAST(i2.is_unique AS INT))
        FROM sys.indexes i2
        JOIN sys.index_columns ic2 ON ic2.object_id = i2.object_id AND ic2.index_id = i2.index_id AND ic2.is_included_column = 0
        JOIN sys.columns c2 ON c2.object_id = ic2.object_id AND c2.column_id = ic2.column_id
        JOIN sys.objects o2 ON o2.object_id = i2.object_id
        WHERE i2.name = @idxName AND o2.name = @tabla AND o2.schema_id = SCHEMA_ID('dbo');

        INSERT INTO #IdxBackup VALUES (@idxName, @idxCols, @isUniq, 0);
        SET @sql = 'DROP INDEX [' + @idxName + '] ON dbo.[' + @tabla + ']';
        PRINT '      DROP INDEX ' + @idxName;
        EXEC sp_executesql @sql;
        FETCH NEXT FROM idx_cur INTO @idxName;
    END
    CLOSE idx_cur; DEALLOCATE idx_cur;

    -- Backup y DROP de UNIQUE CONSTRAINTS
    DECLARE uc_cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT kc.name FROM sys.key_constraints kc
        JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        JOIN sys.objects o ON o.object_id = kc.parent_object_id
        WHERE kc.type = 'UQ' AND o.name = @tabla AND c.name = @columna AND o.schema_id = SCHEMA_ID('dbo');

    CREATE TABLE #UcBackup (uc_name SYSNAME, uc_cols NVARCHAR(500));
    DECLARE @ucName SYSNAME, @ucCols NVARCHAR(500);

    OPEN uc_cur;
    FETCH NEXT FROM uc_cur INTO @ucName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @ucCols = STRING_AGG(c2.name, ', ') WITHIN GROUP (ORDER BY ic2.key_ordinal)
        FROM sys.key_constraints kc2
        JOIN sys.index_columns ic2 ON ic2.object_id = kc2.parent_object_id AND ic2.index_id = kc2.unique_index_id
        JOIN sys.columns c2 ON c2.object_id = ic2.object_id AND c2.column_id = ic2.column_id
        WHERE kc2.name = @ucName;

        INSERT INTO #UcBackup VALUES (@ucName, @ucCols);
        SET @sql = 'ALTER TABLE dbo.[' + @tabla + '] DROP CONSTRAINT [' + @ucName + ']';
        PRINT '      DROP UQ ' + @ucName;
        EXEC sp_executesql @sql;
        FETCH NEXT FROM uc_cur INTO @ucName;
    END
    CLOSE uc_cur; DEALLOCATE uc_cur;

    -- DROP PK si es columna PK simple
    SET @pkName = NULL;
    IF @es_pk = 1
    BEGIN
        SELECT @pkName = kc.name FROM sys.key_constraints kc
        JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        JOIN sys.objects o ON o.object_id = kc.parent_object_id
        WHERE kc.type = 'PK' AND o.name = @tabla AND c.name = @columna AND o.schema_id = SCHEMA_ID('dbo');

        IF @pkName IS NOT NULL
        BEGIN
            SET @sql = 'ALTER TABLE dbo.[' + @tabla + '] DROP CONSTRAINT [' + @pkName + ']';
            PRINT '      DROP PK ' + @pkName;
            EXEC sp_executesql @sql;
        END
    END

    -- Saltar ALTER si la columna pertenece a una PK compuesta
    IF EXISTS (
        SELECT 1 FROM sys.indexes i
        WHERE i.is_primary_key = 1 AND i.object_id = OBJECT_ID('dbo.' + @tabla)
          AND (SELECT COUNT(*) FROM sys.index_columns ic2
               WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id AND ic2.is_included_column = 0) > 1
    )
    BEGIN
        PRINT '      [SKIP] PK compuesta, se migrara despues: ' + @tabla + '.' + @columna;
    END
    ELSE
    BEGIN
        SET @sql = 'ALTER TABLE dbo.[' + @tabla + '] ALTER COLUMN [' + @columna + '] INT ' + @nullable;
        EXEC sp_executesql @sql;
        PRINT '      ALTER COLUMN OK';
    END

    -- RECREAR PK
    IF @es_pk = 1 AND @pkName IS NOT NULL
    BEGIN
        SET @sql = 'ALTER TABLE dbo.[' + @tabla + '] ADD CONSTRAINT [' + @pkName + '] PRIMARY KEY ([' + @columna + '])';
        EXEC sp_executesql @sql;
        PRINT '      RECREAR PK OK';
    END

    -- RECREAR UNIQUE CONSTRAINTS
    DECLARE @uc2Name SYSNAME, @uc2Cols NVARCHAR(500);
    DECLARE uc2_cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT uc_name, uc_cols FROM #UcBackup;
    OPEN uc2_cur;
    FETCH NEXT FROM uc2_cur INTO @uc2Name, @uc2Cols;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = 'ALTER TABLE dbo.[' + @tabla + '] ADD CONSTRAINT [' + @uc2Name + '] UNIQUE (' + @uc2Cols + ')';
        PRINT '      RECREAR UQ ' + @uc2Name;
        EXEC sp_executesql @sql;
        FETCH NEXT FROM uc2_cur INTO @uc2Name, @uc2Cols;
    END
    CLOSE uc2_cur; DEALLOCATE uc2_cur;
    DROP TABLE #UcBackup;

    -- RECREAR INDEXES
    DECLARE idx2_cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT idx_name, idx_cols, is_unique FROM #IdxBackup;
    DECLARE @idx2Name SYSNAME, @idx2Cols NVARCHAR(500), @idx2Uniq BIT;
    OPEN idx2_cur;
    FETCH NEXT FROM idx2_cur INTO @idx2Name, @idx2Cols, @idx2Uniq;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = 'CREATE ' + CASE @idx2Uniq WHEN 1 THEN 'UNIQUE ' ELSE '' END +
                   'INDEX [' + @idx2Name + '] ON dbo.[' + @tabla + '] (' + @idx2Cols + ')';
        PRINT '      RECREAR INDEX ' + @idx2Name;
        EXEC sp_executesql @sql;
        FETCH NEXT FROM idx2_cur INTO @idx2Name, @idx2Cols, @idx2Uniq;
    END
    CLOSE idx2_cur; DEALLOCATE idx2_cur;
    DROP TABLE #IdxBackup;

    FETCH NEXT FROM cur INTO @tabla, @columna, @es_pk;
END

CLOSE cur; DEALLOCATE cur;
PRINT 'Migracion de columnas completada.';

-- ============================================================
-- 4. PKs COMPUESTAS
-- ============================================================
DECLARE @compTable SYSNAME, @pkCompName SYSNAME;

DECLARE comp_pk CURSOR LOCAL FAST_FORWARD FOR
    SELECT table_name FROM #CompositePkTables;

OPEN comp_pk;
FETCH NEXT FROM comp_pk INTO @compTable;
WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT 'Procesando PK compuesta: ' + @compTable;

    -- Capturar columnas de la PK ANTES de dropearla
    IF OBJECT_ID('tempdb..#CompCols') IS NOT NULL DROP TABLE #CompCols;
    SELECT c.name, ic.key_ordinal
    INTO #CompCols
    FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    JOIN sys.objects o ON o.object_id = i.object_id
    WHERE i.is_primary_key = 1 AND o.name = @compTable AND o.schema_id = SCHEMA_ID('dbo');

    SELECT @pkCompName = kc.name FROM sys.key_constraints kc
    JOIN sys.objects o ON o.object_id = kc.parent_object_id
    WHERE kc.type = 'PK' AND o.name = @compTable AND o.schema_id = SCHEMA_ID('dbo');

    -- DROP PK
    IF @pkCompName IS NOT NULL
    BEGIN
        SET @sql = 'ALTER TABLE dbo.[' + @compTable + '] DROP CONSTRAINT [' + @pkCompName + ']';
        EXEC sp_executesql @sql;
        PRINT '  DROP PK: ' + @pkCompName;
    END

    -- ALTER cada columna de la PK compuesta
    DECLARE compCols CURSOR LOCAL FAST_FORWARD FOR
        SELECT name FROM #CompCols ORDER BY key_ordinal;

    DECLARE @colName NVARCHAR(128);
    OPEN compCols;
    FETCH NEXT FROM compCols INTO @colName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @nullable = CASE c.is_nullable WHEN 1 THEN 'NULL' ELSE 'NOT NULL' END
        FROM sys.columns c JOIN sys.objects o ON o.object_id = c.object_id
        WHERE o.name = @compTable AND c.name = @colName AND o.schema_id = SCHEMA_ID('dbo');

        SET @sql = 'ALTER TABLE dbo.[' + @compTable + '] ALTER COLUMN [' + @colName + '] INT ' + @nullable;
        PRINT '  ALTER ' + @compTable + '.' + @colName + ' -> INT';
        EXEC sp_executesql @sql;
        FETCH NEXT FROM compCols INTO @colName;
    END
    CLOSE compCols; DEALLOCATE compCols;

    -- RECREAR PK
    IF @pkCompName IS NOT NULL
    BEGIN
        DECLARE @compColList NVARCHAR(MAX);
        SELECT @compColList = STRING_AGG(name, ', ') WITHIN GROUP (ORDER BY key_ordinal) FROM #CompCols;

        SET @sql = 'ALTER TABLE dbo.[' + @compTable + '] ADD CONSTRAINT [' + @pkCompName + '] PRIMARY KEY (' + @compColList + ')';
        EXEC sp_executesql @sql;
        PRINT '  RECREAR PK: ' + @pkCompName;
    END

    DROP TABLE #CompCols;
    FETCH NEXT FROM comp_pk INTO @compTable;
END
CLOSE comp_pk; DEALLOCATE comp_pk;

PRINT 'PKs compuestas procesadas.';
DROP TABLE #CompositePkTables;

-- ============================================================
-- 5. RECREAR PKs (por si fueron dropeadas y no recreadas)
-- ============================================================
IF OBJECT_ID('tempdb..#PKsBackup') IS NOT NULL
BEGIN
    DECLARE @pkName2 SYSNAME, @pkTable2 SYSNAME, @pkCols2 NVARCHAR(MAX);
    DECLARE pk2_cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT pk_name, table_name, cols FROM #PKsBackup;
    OPEN pk2_cur;
    FETCH NEXT FROM pk2_cur INTO @pkName2, @pkTable2, @pkCols2;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = @pkName2)
        BEGIN
            SET @sql = 'ALTER TABLE dbo.[' + @pkTable2 + '] ADD CONSTRAINT [' + @pkName2 + '] PRIMARY KEY (' + @pkCols2 + ')';
            PRINT '  RECREAR PK: ' + @pkName2;
            EXEC sp_executesql @sql;
        END
        FETCH NEXT FROM pk2_cur INTO @pkName2, @pkTable2, @pkCols2;
    END
    CLOSE pk2_cur; DEALLOCATE pk2_cur;
    DROP TABLE #PKsBackup;
END

-- ============================================================
-- 6. RECREAR TODAS las FK
-- ============================================================
DECLARE @refTable SYSNAME, @refCols NVARCHAR(500), @parentCols NVARCHAR(500);
DECLARE @deleteAction NVARCHAR(60), @updateAction NVARCHAR(60);

DECLARE fk_rec CURSOR LOCAL FAST_FORWARD FOR
    SELECT fk_name, parent_table, parent_cols, ref_table, ref_cols,
           delete_referential_action_desc, update_referential_action_desc
    FROM #FksBackup;

OPEN fk_rec;
FETCH NEXT FROM fk_rec INTO @fkName, @ptable, @parentCols, @refTable, @refCols,
    @deleteAction, @updateAction;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'ALTER TABLE dbo.[' + @ptable + '] ADD CONSTRAINT [' + @fkName + ']' +
               ' FOREIGN KEY (' + @parentCols + ')' +
               ' REFERENCES dbo.[' + @refTable + '](' + @refCols + ')' +
               CASE @deleteAction WHEN 'CASCADE' THEN ' ON DELETE CASCADE' ELSE '' END +
               CASE @updateAction WHEN 'CASCADE' THEN ' ON UPDATE CASCADE' ELSE '' END;
    PRINT '  RECREAR FK: ' + @fkName;
    EXEC sp_executesql @sql;
    FETCH NEXT FROM fk_rec INTO @fkName, @ptable, @parentCols, @refTable, @refCols,
        @deleteAction, @updateAction;
END
CLOSE fk_rec; DEALLOCATE fk_rec;

DROP TABLE #FksBackup;
PRINT 'Todas las FK recreadas.';

-- ============================================================
-- 6. VERIFICACIÓN FINAL
-- ============================================================
PRINT 'Columnas SMALLINT restantes:';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE DATA_TYPE = 'smallint' AND TABLE_SCHEMA = 'dbo'
ORDER BY TABLE_NAME, COLUMN_NAME;

PRINT 'SPs con parametros SMALLINT pendientes:';
SELECT OBJECT_NAME(p.object_id) AS sp_name, p.name AS param_name
FROM sys.parameters p
JOIN sys.types t   ON t.user_type_id = p.user_type_id
JOIN sys.objects o ON o.object_id = p.object_id
WHERE t.name = 'smallint' AND o.type = 'P'
ORDER BY sp_name, p.parameter_id;

PRINT 'FIN: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT 'Lista vacia arriba = migracion 100% completa.';
