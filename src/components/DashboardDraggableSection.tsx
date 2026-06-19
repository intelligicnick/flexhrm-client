import React, { useState } from "react";
import { GripVertical } from "lucide-react";
import type { DashboardWidgetId } from "../lib/dashboard-section-order";
import {
  DASHBOARD_WIDGET_LABELS,
  FULL_WIDTH_DASHBOARD_WIDGETS,
} from "../lib/dashboard-section-order";

type DashboardDraggableSectionProps = {
  widgetId: DashboardWidgetId;
  onReorder: (draggedId: DashboardWidgetId, targetId: DashboardWidgetId) => void;
  children: React.ReactNode;
};

export default function DashboardDraggableSection({
  widgetId,
  onReorder,
  children,
}: DashboardDraggableSectionProps) {
  const [dragOver, setDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fullWidth = FULL_WIDTH_DASHBOARD_WIDGETS.has(widgetId);

  return (
    <div
      className={`relative group rounded-xl transition ${
        fullWidth ? "col-span-1 sm:col-span-2 lg:col-span-4" : ""
      } ${dragOver ? "ring-2 ring-[#ff791a]/50 ring-offset-2" : ""} ${
        isDragging ? "opacity-50" : ""
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const draggedId = event.dataTransfer.getData("text/plain") as DashboardWidgetId;
        if (draggedId && draggedId !== widgetId) {
          onReorder(draggedId, widgetId);
        }
      }}
    >
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", widgetId);
          event.dataTransfer.effectAllowed = "move";
          setIsDragging(true);
        }}
        onDragEnd={() => setIsDragging(false)}
        className="flex items-center gap-1 px-2 py-1 mb-1 rounded-lg border border-dashed border-slate-200 bg-slate-50/90 text-[9px] font-bold text-slate-500 cursor-grab active:cursor-grabbing hover:border-[#ff791a]/40 hover:text-[#ff791a] transition"
        title={`Drag ${DASHBOARD_WIDGET_LABELS[widgetId]} to reorder`}
      >
        <GripVertical size={12} />
        {DASHBOARD_WIDGET_LABELS[widgetId]}
      </div>
      {children}
    </div>
  );
}
