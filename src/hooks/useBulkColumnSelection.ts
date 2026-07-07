import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface BulkColumnSelection {
  columnId: string;
  anchorRowId: string;
  focusRowId: string;
}

export function useBulkColumnSelection<TRow extends { id: string }>(rows: TRow[]) {
  const [columnSelection, setColumnSelection] = useState<BulkColumnSelection | null>(null);
  const columnSelectionRef = useRef<BulkColumnSelection | null>(null);
  const selectedRowIdsRef = useRef<string[]>([]);

  const selectionToRowIds = useCallback(
    (selection: BulkColumnSelection): string[] => {
      const anchorIdx = rows.findIndex((row) => row.id === selection.anchorRowId);
      const focusIdx = rows.findIndex((row) => row.id === selection.focusRowId);
      if (anchorIdx === -1 || focusIdx === -1) return [];
      const start = Math.min(anchorIdx, focusIdx);
      const end = Math.max(anchorIdx, focusIdx);
      return rows.slice(start, end + 1).map((row) => row.id);
    },
    [rows],
  );

  const selectedRowIds = useMemo(
    () => (columnSelection ? selectionToRowIds(columnSelection) : []),
    [columnSelection, selectionToRowIds],
  );

  useEffect(() => {
    columnSelectionRef.current = columnSelection;
    selectedRowIdsRef.current = selectedRowIds;
  }, [columnSelection, selectedRowIds]);

  const syncSelection = useCallback((selection: BulkColumnSelection | null) => {
    columnSelectionRef.current = selection;
    selectedRowIdsRef.current = selection ? selectionToRowIds(selection) : [];
    setColumnSelection(selection);
  }, [selectionToRowIds]);

  const clearColumnSelection = useCallback(() => {
    syncSelection(null);
  }, [syncSelection]);

  const activateCell = useCallback(
    (rowId: string, columnId: string, shiftKey: boolean) => {
      const selection = columnSelectionRef.current;

      if (shiftKey && selection) {
        const clickIdx = rows.findIndex((row) => row.id === rowId);
        if (clickIdx === -1) return;

        if (selection.columnId === columnId) {
          syncSelection({ ...selection, focusRowId: rowId });
          return;
        }

        const anchorIdx = rows.findIndex((row) => row.id === selection.anchorRowId);
        const focusIdx = rows.findIndex((row) => row.id === selection.focusRowId);
        if (anchorIdx === -1) return;
        const start = Math.min(anchorIdx, focusIdx === -1 ? anchorIdx : focusIdx, clickIdx);
        const end = Math.max(anchorIdx, focusIdx === -1 ? anchorIdx : focusIdx, clickIdx);
        syncSelection({
          columnId,
          anchorRowId: rows[start].id,
          focusRowId: rows[end].id,
        });
        return;
      }

      syncSelection({
        columnId,
        anchorRowId: rowId,
        focusRowId: rowId,
      });
    },
    [rows, syncSelection],
  );

  const handleColumnHeaderClick = useCallback(
    (columnId: string) => {
      if (rows.length === 0) return;
      syncSelection({
        columnId,
        anchorRowId: rows[0].id,
        focusRowId: rows[rows.length - 1].id,
      });
    },
    [rows, syncSelection],
  );

  const isCellSelected = useCallback(
    (rowId: string, columnId: string) =>
      columnSelection?.columnId === columnId && selectedRowIds.includes(rowId),
    [columnSelection, selectedRowIds],
  );

  return {
    columnSelection,
    selectedRowIds,
    selectedColumnId: columnSelection?.columnId ?? null,
    activateCell,
    handleColumnHeaderClick,
    isCellSelected,
    clearColumnSelection,
  };
}
