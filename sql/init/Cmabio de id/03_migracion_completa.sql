-- ============================================================
-- MIGRACION COMPLETA: smallint -> int
-- 1. Respaldar y DROP FKs, PKs, DEFAULTs
-- 2. ALTER columnas a INT
-- 3. Recrear PKs, FKs, DEFAULTs
-- ============================================================
DECLARE @sql NVARCHAR(MAX), @name SYSNAME, @table SYSNAME;

-- ============================================================
-- 1. RESPALDAR y DROP FKs
-- ============================================================
IF OBJECT_ID('tempdb..#FKs') IS NOT NULL DROP TABLE #FKs;
SELECT fk.name, OBJECT_NAME(fk.parent_object_id) AS parent_table,
       OBJECT_NAME(fk.referenced_object_id) AS ref_table,
       fk.delete_referential_action_desc, fk.update_referential_action_desc,
       STRING_AGG(COL_NAME(fkc.parent_object_id, fkc.parent_column_id), ', ')
           WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS parent_cols,
       STRING_AGG(COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id), ', ')
           WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS ref_cols
INTO #FKs
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = 'dbo'
GROUP BY fk.name, fk.parent_object_id, fk.referenced_object_id,
         fk.delete_referential_action_desc, fk.update_referential_action_desc;

DECLARE fk_c CURSOR FOR SELECT name, parent_table FROM #FKs;
OPEN fk_c; FETCH NEXT FROM fk_c INTO @name, @table;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC('ALTER TABLE dbo.[' + @table + '] DROP CONSTRAINT [' + @name + ']');
    PRINT 'DROP FK: ' + @name;
    FETCH NEXT FROM fk_c INTO @name, @table;
END
CLOSE fk_c; DEALLOCATE fk_c;

-- ============================================================
-- 2. RESPALDAR y DROP DEFAULTs en columnas SMALLINT
-- ============================================================
IF OBJECT_ID('tempdb..#Defaults') IS NOT NULL DROP TABLE #Defaults;
SELECT dc.name, OBJECT_NAME(dc.parent_object_id) AS table_name, c.name AS column_name,
       dc.definition
INTO #Defaults
FROM sys.default_constraints dc
JOIN sys.objects o ON o.object_id = dc.parent_object_id
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.default_object_id = dc.object_id
WHERE o.schema_id = SCHEMA_ID('dbo') AND c.system_type_id = 52;

DECLARE def_c CURSOR FOR SELECT name, table_name FROM #Defaults;
OPEN def_c; FETCH NEXT FROM def_c INTO @name, @table;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC('ALTER TABLE dbo.[' + @table + '] DROP CONSTRAINT [' + @name + ']');
    PRINT 'DROP DEFAULT: ' + @name;
    FETCH NEXT FROM def_c INTO @name, @table;
END
CLOSE def_c; DEALLOCATE def_c;

-- ============================================================
-- 3. RESPALDAR y DROP TODAS las PK
-- ============================================================
IF OBJECT_ID('tempdb..#PKs') IS NOT NULL DROP TABLE #PKs;
SELECT kc.name AS pk_name, o.name AS table_name,
       STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS cols
INTO #PKs
FROM sys.key_constraints kc
JOIN sys.objects o ON o.object_id = kc.parent_object_id
JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id AND ic.is_included_column = 0
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.type = 'PK' AND o.schema_id = SCHEMA_ID('dbo')
GROUP BY kc.name, o.name;

DECLARE pk_c CURSOR FOR SELECT pk_name, table_name FROM #PKs;
OPEN pk_c; FETCH NEXT FROM pk_c INTO @name, @table;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC('ALTER TABLE dbo.[' + @table + '] DROP CONSTRAINT [' + @name + ']');
    PRINT 'DROP PK: ' + @name;
    FETCH NEXT FROM pk_c INTO @name, @table;
END
CLOSE pk_c; DEALLOCATE pk_c;

-- ============================================================
-- 4. ALTER todas las columnas SMALLINT a INT
-- ============================================================
DECLARE @columna SYSNAME, @nullable NVARCHAR(10);

DECLARE col_c CURSOR FOR
    SELECT c.TABLE_NAME, c.COLUMN_NAME,
           CASE WHEN c.IS_NULLABLE = 'YES' THEN 'NULL' ELSE 'NOT NULL' END
    FROM INFORMATION_SCHEMA.COLUMNS c
    WHERE c.DATA_TYPE = 'smallint' AND c.TABLE_SCHEMA = 'dbo'
      AND c.TABLE_NAME NOT LIKE 'VW_%'
      AND EXISTS (SELECT 1 FROM sys.objects o WHERE o.name = c.TABLE_NAME AND o.type = 'U' AND o.schema_id = SCHEMA_ID('dbo'))
    ORDER BY c.TABLE_NAME, c.COLUMN_NAME;

OPEN col_c; FETCH NEXT FROM col_c INTO @table, @columna, @nullable;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'ALTER TABLE dbo.[' + @table + '] ALTER COLUMN [' + @columna + '] INT ' + @nullable;
    PRINT 'ALTER ' + @table + '.' + @columna + ' -> INT';
    EXEC sp_executesql @sql;
    FETCH NEXT FROM col_c INTO @table, @columna, @nullable;
END
CLOSE col_c; DEALLOCATE col_c;

PRINT 'TODAS las columnas alteradas.';

-- ============================================================
-- 5. RECREAR PKs
-- ============================================================
DECLARE @cols NVARCHAR(MAX);
DECLARE pk2_c CURSOR FOR SELECT pk_name, table_name, cols FROM #PKs;
OPEN pk2_c; FETCH NEXT FROM pk2_c INTO @name, @table, @cols;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'ALTER TABLE dbo.[' + @table + '] ADD CONSTRAINT [' + @name + '] PRIMARY KEY (' + @cols + ')';
    PRINT 'RECREATE PK: ' + @name;
    EXEC sp_executesql @sql;
    FETCH NEXT FROM pk2_c INTO @name, @table, @cols;
END
CLOSE pk2_c; DEALLOCATE pk2_c;

-- ============================================================
-- 6. RECREAR FKs
-- ============================================================
DECLARE @refTable SYSNAME, @parentCols NVARCHAR(500), @refCols NVARCHAR(500);
DECLARE @delAct NVARCHAR(60), @updAct NVARCHAR(60);

DECLARE fk2_c CURSOR FOR
    SELECT name, parent_table, parent_cols, ref_table, ref_cols,
           delete_referential_action_desc, update_referential_action_desc
    FROM #FKs;
OPEN fk2_c; FETCH NEXT FROM fk2_c INTO @name, @table, @parentCols, @refTable, @refCols, @delAct, @updAct;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'ALTER TABLE dbo.[' + @table + '] ADD CONSTRAINT [' + @name + ']' +
               ' FOREIGN KEY (' + @parentCols + ')' +
               ' REFERENCES dbo.[' + @refTable + '](' + @refCols + ')' +
               CASE @delAct WHEN 'CASCADE' THEN ' ON DELETE CASCADE' ELSE '' END +
               CASE @updAct WHEN 'CASCADE' THEN ' ON UPDATE CASCADE' ELSE '' END;
    PRINT 'RECREATE FK: ' + @name;
    EXEC sp_executesql @sql;
    FETCH NEXT FROM fk2_c INTO @name, @table, @parentCols, @refTable, @refCols, @delAct, @updAct;
END
CLOSE fk2_c; DEALLOCATE fk2_c;

-- ============================================================
-- 7. RECREAR DEFAULTs
-- ============================================================
DECLARE @defName SYSNAME, @defTable SYSNAME, @defCol SYSNAME, @defVal NVARCHAR(200);
DECLARE def2_c CURSOR FOR SELECT name, table_name, column_name, definition FROM #Defaults;
OPEN def2_c; FETCH NEXT FROM def2_c INTO @defName, @defTable, @defCol, @defVal;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF @defName IS NULL SET @defName = 'DF_' + @defTable + '_' + @defCol;
    SET @sql = 'ALTER TABLE dbo.[' + @defTable + '] ADD CONSTRAINT [' + @defName + '] DEFAULT ' + @defVal + ' FOR [' + @defCol + ']';
    PRINT 'RECREATE DEFAULT: ' + @defName;
    EXEC sp_executesql @sql;
    FETCH NEXT FROM def2_c INTO @defName, @defTable, @defCol, @defVal;
END
CLOSE def2_c; DEALLOCATE def2_c;

-- ============================================================
-- 8. LIMPIEZA
-- ============================================================
DROP TABLE #FKs;
DROP TABLE #PKs;
DROP TABLE #Defaults;

-- ============================================================
-- 9. VERIFICACION
-- ============================================================
PRINT 'Columnas SMALLINT restantes:';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE DATA_TYPE = 'smallint' AND TABLE_SCHEMA = 'dbo'
  AND TABLE_NAME NOT LIKE 'VW_%'
ORDER BY TABLE_NAME, COLUMN_NAME;

DECLARE @totalFK INT;
SELECT @totalFK = COUNT(*) FROM sys.foreign_keys WHERE OBJECT_SCHEMA_NAME(parent_object_id) = 'dbo';
PRINT 'Total FK: ' + CAST(@totalFK AS VARCHAR);
PRINT 'FIN - migracion completada.';
