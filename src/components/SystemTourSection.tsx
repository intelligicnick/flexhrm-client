import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  CheckCircle2,
  Lightbulb,
  Play,
  Grid3X3,
  MousePointerClick,
  BookOpen,
} from "lucide-react";
import {
  SYSTEM_TOUR_CATEGORIES,
  getOrderedTourSections,
  getSectionsForCategory,
  getCategoryForSection,
  type TourSection,
} from "../lib/system-tour";
import { useHRMS } from "../context/HRMSContext";
import TourThumbnail from "./TourThumbnail";

export default function SystemTourSection() {
  const { navigateToTab } = useHRMS();
  const orderedSections = useMemo(() => getOrderedTourSections(), []);
  const [view, setView] = useState<"topics" | "wizard">("topics");
  const [expandedCategoryId, setExpandedCategoryId] = useState<string>(
    SYSTEM_TOUR_CATEGORIES[0]?.id ?? "",
  );
  const [activeSectionId, setActiveSectionId] = useState<string>(
    orderedSections[0]?.id ?? "",
  );
  const [stepIndex, setStepIndex] = useState(0);

  const activeSection = useMemo(
    () => orderedSections.find((s) => s.id === activeSectionId) ?? orderedSections[0],
    [activeSectionId, orderedSections],
  );

  const activeCategory = useMemo(
    () => (activeSection ? getCategoryForSection(activeSection.id) : undefined),
    [activeSection],
  );

  const totalSteps = activeSection?.steps.length ?? 0;
  const currentStep = activeSection?.steps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex >= totalSteps - 1;

  const openSection = (section: TourSection) => {
    setActiveSectionId(section.id);
    setExpandedCategoryId(section.categoryId);
    setStepIndex(0);
    setView("wizard");
  };

  const goNext = () => {
    if (!isLastStep) setStepIndex((i) => i + 1);
  };

  const goPrev = () => {
    if (!isFirstStep) setStepIndex((i) => i - 1);
  };

  const totalGuides = orderedSections.length;
  const totalStepsAll = orderedSections.reduce((n, s) => n + s.steps.length, 0);

  if (!activeSection || !currentStep) return null;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-slate-50 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#ff791a] text-white flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
            <Compass size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-slate-900">System Tour</h3>
            <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">
              Organised in {SYSTEM_TOUR_CATEGORIES.length} sections — {totalGuides} guides,{" "}
              {totalStepsAll} steps. Open one section, pick a guide, follow the click steps.
            </p>
          </div>
          {view === "wizard" && (
            <button
              type="button"
              onClick={() => setView("topics")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shrink-0"
            >
              <Grid3X3 size={14} />
              All sections
            </button>
          )}
        </div>
      </div>

      {view === "topics" ? (
        <div className="space-y-4">
          {SYSTEM_TOUR_CATEGORIES.map((category, catIdx) => {
            const sections = getSectionsForCategory(category.id);
            const isExpanded = expandedCategoryId === category.id;
            const CatIcon = category.icon;
            const sectionStepCount = sections.reduce((n, s) => n + s.steps.length, 0);

            return (
              <div
                key={category.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden"
              >
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => setExpandedCategoryId(isExpanded ? "" : category.id)}
                  className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-slate-50/80 transition cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#ff791a] flex items-center justify-center shrink-0">
                    <CatIcon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Section {catIdx + 1} of {SYSTEM_TOUR_CATEGORIES.length}
                    </p>
                    <p className="text-sm font-extrabold text-slate-900">{category.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{category.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {sections.length} guides · {sectionStepCount} steps
                    </p>
                    <ChevronRight
                      size={18}
                      className={`text-slate-400 ml-auto mt-1 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Guides within category */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/40">
                    {sections.map((section) => {
                      const Icon = section.icon;
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => openSection(section)}
                          className="group text-left rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md hover:border-orange-200 transition-all cursor-pointer"
                        >
                          <TourThumbnail
                            sectionId={section.id}
                            title={section.title}
                            icon={Icon}
                            stepIndex={0}
                            stepTitle={section.steps[0]?.title}
                            totalSteps={section.steps.length}
                            compact
                          />
                          <div className="p-3.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-extrabold text-slate-800 group-hover:text-[#ff791a] transition">
                                {section.title}
                              </p>
                              <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
                                {section.steps.length} steps
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {section.summary}
                            </p>
                            <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#ff791a]">
                              <Play size={12} className="fill-current" />
                              Start guide
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Step wizard */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Breadcrumb */}
          <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setView("topics")}
              className="font-bold text-slate-500 hover:text-[#ff791a] transition cursor-pointer"
            >
              All sections
            </button>
            <ChevronRight size={12} className="text-slate-300" />
            {activeCategory && (
              <>
                <span className="font-bold text-slate-600">{activeCategory.title}</span>
                <ChevronRight size={12} className="text-slate-300" />
              </>
            )}
            <span className="font-extrabold text-[#ff791a]">{activeSection.title}</span>
          </div>

          {/* Section header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#ff791a] flex items-center justify-center shrink-0">
                <activeSection.icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-800 truncate">
                  {activeSection.title}
                </p>
                <p className="text-[11px] text-slate-500">{activeSection.summary}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {activeSection.steps.map((step, idx) => {
                const done = idx < stepIndex;
                const current = idx === stepIndex;
                return (
                  <button
                    key={step.title}
                    type="button"
                    onClick={() => setStepIndex(idx)}
                    title={step.title}
                    className={`w-8 h-8 rounded-lg text-[10px] font-black transition cursor-pointer flex items-center justify-center ${
                      current
                        ? "bg-[#ff791a] text-white shadow-sm"
                        : done
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    {done ? <CheckCircle2 size={14} /> : idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 space-y-5">
            <TourThumbnail
              sectionId={activeSection.id}
              title={activeSection.title}
              icon={activeSection.icon}
              stepIndex={stepIndex}
              stepTitle={currentStep.title}
              totalSteps={totalSteps}
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#ff791a] text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm">
                  {stepIndex + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#ff791a]">
                    Step {stepIndex + 1} of {totalSteps}
                  </p>
                  <h4 className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {currentStep.title}
                  </h4>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{currentStep.body}</p>
                  {currentStep.clicks && currentStep.clicks.length > 0 && (
                    <div className="mt-4 rounded-xl border border-orange-100 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#ff791a] flex items-center gap-1.5 mb-3">
                        <MousePointerClick size={14} />
                        Where to click
                      </p>
                      <ol className="space-y-2.5">
                        {currentStep.clicks.map((click, i) => (
                          <li key={i} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
                            <span className="w-6 h-6 rounded-lg bg-orange-100 text-[#ff791a] text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="flex-1 pt-0.5">{click}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {currentStep.tip && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5">
                      <Lightbulb size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 font-medium leading-relaxed">
                        {currentStep.tip}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={goPrev}
                disabled={isFirstStep}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {activeSection.sidebarTab && isLastStep && (
                  <button
                    type="button"
                    onClick={() => navigateToTab(activeSection.sidebarTab!)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Open {activeSection.sidebarTab}
                    <ExternalLink size={14} />
                  </button>
                )}
                {!isLastStep ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    Next step
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const idx = orderedSections.findIndex((s) => s.id === activeSectionId);
                      const next = orderedSections[idx + 1];
                      if (next) {
                        openSection(next);
                      } else {
                        setView("topics");
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    {orderedSections.findIndex((s) => s.id === activeSectionId) <
                    orderedSections.length - 1 ? (
                      <>
                        <BookOpen size={14} />
                        Next guide
                      </>
                    ) : (
                      "Back to all sections"
                    )}
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
