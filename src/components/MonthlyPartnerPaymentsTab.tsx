import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import { CheckCircle2, DownloadCloud, FileSpreadsheet, IndianRupee, Pencil, RotateCcw, Save } from "lucide-react";
import { SchoolPartner, SchoolWork, SchoolDistrict } from "../types";
import {
  PARTNER_PAYMENT_HEADERS,
  PARTNER_PAYMENT_TOTAL_PAY_COLUMN,
  PARTNER_PAY_COL_ACCOUNT_HOLDER,
  PARTNER_PAY_COL_ACCOUNT_NUMBER,
  PARTNER_PAY_COL_DAYS,
  PARTNER_PAY_COL_IFSC,
  PARTNER_PAY_COL_MONTHLY,
  PARTNER_PAY_COL_PARTNER_NAME,
  PARTNER_PAY_COL_PER_TOILET,
  PARTNER_PAY_COL_SCHOOL_CATEGORY,
  PARTNER_PAY_COL_SCHOOL_NAME,
  PARTNER_PAY_COL_STATUS,
  PARTNER_PAY_COL_TOILETS,
  PARTNER_PAY_COL_TOTAL,
  PARTNER_PAY_TEXT_TO_SCHOOL_FIELD,
  STANDARD_MONTH_DAYS,
  PartnerPayEditableField,
  PartnerPayNumericField,
  PartnerPayStatus,
  PartnerPayTextField,
  PartnerPayTextValues,
  PartnerPayValues,
  applyPartnerPayFieldChange,
  buildPartnerPaymentRowsFromPartners,
  computePartnerPayableAmount,
  getPartnerPayBaseValues,
  getPartnerPayStatus,
  getPartnerPayTextBaseValues,
  isPartnerPayNumericField,
  partnerPayStatusClass,
} from "../lib/school-work-helpers";
import {
  type AxisBulkPayRowInput,
  type BulkPayPartnerSheetInput,
  type SavedBulkPayRecord,
} from "../utils";
import PartnerPayBulkEditModal from "./PartnerPayBulkEditModal";

interface MonthlyPartnerPaymentsTabProps {
  partners: SchoolPartner[];
  schools?: SchoolWork[];
  districts?: SchoolDistrict[];
  selectedMonth?: string;
  monthsList?: string[];
  onMonthChange?: (monthKey: string) => void;
  defaultDays: number;
  onSaveWorkdays?: (payload: {
    block: string;
    district?: string;
    monthKey: string;
    defaultDays: number;
    updates: Array<{ id: string; cleaningDays: number; billingToilets?: number }>;
  }) => Promise<boolean>;
  onSavePayUpdates?: (
    updates: Array<{ id: string; changes: { partnerMonthlyPay: number; rates: number } }>,
  ) => Promise<boolean>;
  onSavePartnerDetails?: (
    updates: Array<{ id: string; changes: Partial<SchoolWork> }>,
  ) => Promise<boolean>;
  onSavePaymentStatus?: (
    updates: Array<{ id: string; paymentStatus: PartnerPayStatus }>,
  ) => Promise<boolean>;
  onExportAxisBulkPay?: (payload: {
    items: AxisBulkPayRowInput[];
    partnerSheet: BulkPayPartnerSheetInput;
    partnerIds: string[];
    partnerHeaders: readonly string[];
  }) => Promise<void>;
  isExportingBulkPay?: boolean;
  lastSavedBulkPay?: SavedBulkPayRecord | null;
  onViewSavedBulkPay?: () => void;
  readOnly?: boolean;
}

type NumericDraftMap = Record<string, Partial<PartnerPayValues>>;
type TextDraftMap = Record<string, Partial<PartnerPayTextValues>>;
type StatusDraftMap = Record<string, PartnerPayStatus>;

type PartnerPayColumnField = PartnerPayEditableField | "paymentStatus";

type ColumnSelection = {
  field: PartnerPayColumnField;
  anchorPartnerId: string;
  focusPartnerId: string;
};

const EDITABLE_FIELDS: Array<{ field: PartnerPayColumnField; label: string; col: number }> = [
  { field: "schoolName", label: "School Name", col: PARTNER_PAY_COL_SCHOOL_NAME },
  { field: "schoolCategory", label: "School Category", col: PARTNER_PAY_COL_SCHOOL_CATEGORY },
  { field: "partnerName", label: "Partner Name", col: PARTNER_PAY_COL_PARTNER_NAME },
  { field: "accountHolderName", label: "Account Holder Name", col: PARTNER_PAY_COL_ACCOUNT_HOLDER },
  { field: "accountNumber", label: "Account Number", col: PARTNER_PAY_COL_ACCOUNT_NUMBER },
  { field: "ifscCode", label: "IFSC", col: PARTNER_PAY_COL_IFSC },
  { field: "toilets", label: "No of Toilets", col: PARTNER_PAY_COL_TOILETS },
  { field: "days", label: "No of Days", col: PARTNER_PAY_COL_DAYS },
  { field: "perToiletPay", label: "Pay per Toilet", col: PARTNER_PAY_COL_PER_TOILET },
  { field: "monthlyPay", label: "Monthly Pay", col: PARTNER_PAY_COL_MONTHLY },
  { field: "paymentStatus", label: "Status", col: PARTNER_PAY_COL_STATUS },
];

function countDraftChanges(
  numericDrafts: NumericDraftMap,
  textDrafts: TextDraftMap,
  statusDrafts: StatusDraftMap,
): number {
  const numeric = Object.values(numericDrafts).reduce((sum, changes) => sum + Object.keys(changes).length, 0);
  const text = Object.values(textDrafts).reduce((sum, changes) => sum + Object.keys(changes).length, 0);
  return numeric + text + Object.keys(statusDrafts).length;
}

function selectionToPartnerIds(
  selection: ColumnSelection,
  partners: SchoolPartner[],
): string[] {
  const anchorIdx = partners.findIndex((p) => p.id === selection.anchorPartnerId);
  const focusIdx = partners.findIndex((p) => p.id === selection.focusPartnerId);
  if (anchorIdx === -1 || focusIdx === -1) return [];
  const start = Math.min(anchorIdx, focusIdx);
  const end = Math.max(anchorIdx, focusIdx);
  return partners.slice(start, end + 1).map((p) => p.id);
}

export default function MonthlyPartnerPaymentsTab({
  partners,
  schools = [],
  districts = [],
  selectedMonth,
  monthsList,
  onMonthChange,
  defaultDays,
  onSaveWorkdays,
  onSavePayUpdates,
  onSavePartnerDetails,
  onSavePaymentStatus,
  onExportAxisBulkPay,
  isExportingBulkPay = false,
  lastSavedBulkPay = null,
  onViewSavedBulkPay,
  readOnly = false,
}: MonthlyPartnerPaymentsTabProps) {
  const monthMultiplier = 1;
  const [districtFilter, setDistrictFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const manualDaysPartnerIdsRef = useRef<Set<string>>(new Set());
  const [numericDrafts, setNumericDrafts] = useState<NumericDraftMap>({});
  const [textDrafts, setTextDrafts] = useState<TextDraftMap>({});
  const [statusDrafts, setStatusDrafts] = useState<StatusDraftMap>({});
  const [saving, setSaving] = useState(false);
  const [columnSelection, setColumnSelection] = useState<ColumnSelection | null>(null);
  const [checkedPartnerIds, setCheckedPartnerIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const columnSelectionRef = useRef<ColumnSelection | null>(null);
  const selectedPartnerIdsRef = useRef<string[]>([]);

  const schoolsById = useMemo(() => {
    const map: Record<string, SchoolWork> = {};
    for (const school of schools) {
      map[school.id] = school;
    }
    return map;
  }, [schools]);

  const blocks = useMemo(
    () => Array.from(new Set(partners.map((partner) => partner.block).filter(Boolean))).sort(),
    [partners],
  );

  const districtOptions = useMemo(() => {
    const fromConfig = districts.map((d) => d.name).filter(Boolean);
    const fromPartners = partners.map((p) => p.district).filter(Boolean);
    return Array.from(new Set([...fromConfig, ...fromPartners])).sort();
  }, [districts, partners]);

  const filteredPartners = useMemo(() => {
    let list = [...partners];
    if (districtFilter) {
      list = list.filter((partner) => partner.district === districtFilter);
    }
    if (blockFilter) {
      list = list.filter((partner) => partner.block === blockFilter);
    }
    return list.sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [partners, districtFilter, blockFilter]);

  const selectedPartnerIds = useMemo(
    () =>
      columnSelection ? selectionToPartnerIds(columnSelection, filteredPartners) : [],
    [columnSelection, filteredPartners],
  );

  useEffect(() => {
    columnSelectionRef.current = columnSelection;
    selectedPartnerIdsRef.current = selectedPartnerIds;
  }, [columnSelection, selectedPartnerIds]);

  useEffect(() => {
    setNumericDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const partner of filteredPartners) {
        if (!partner.id || manualDaysPartnerIdsRef.current.has(partner.id)) continue;
        const draft = next[partner.id];
        if (draft?.days === undefined) continue;
        const updated = { ...draft };
        delete updated.days;
        if (Object.keys(updated).length === 0) {
          delete next[partner.id];
        } else {
          next[partner.id] = updated;
        }
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [defaultDays, filteredPartners]);

  const resolveValues = useCallback(
    (partner: SchoolPartner): PartnerPayValues => {
      const school = partner.schoolWorkId ? schoolsById[partner.schoolWorkId] : undefined;
      const base = getPartnerPayBaseValues(partner, school, selectedMonth, defaultDays);
      return { ...base, ...(numericDrafts[partner.id] || {}) };
    },
    [schoolsById, selectedMonth, defaultDays, numericDrafts],
  );

  const resolveTextValues = useCallback(
    (partner: SchoolPartner): PartnerPayTextValues => {
      const school = partner.schoolWorkId ? schoolsById[partner.schoolWorkId] : undefined;
      const base = getPartnerPayTextBaseValues(partner, school);
      return { ...base, ...(textDrafts[partner.id] || {}) };
    },
    [schoolsById, textDrafts],
  );

  const resolvePaymentStatus = useCallback(
    (partner: SchoolPartner): PartnerPayStatus => {
      if (statusDrafts[partner.id]) return statusDrafts[partner.id];
      return getPartnerPayStatus(partner, selectedMonth);
    },
    [statusDrafts, selectedMonth],
  );

  const paymentRows = useMemo(
    () =>
      buildPartnerPaymentRowsFromPartners(
        filteredPartners,
        monthMultiplier,
        schoolsById,
        selectedMonth,
        defaultDays,
        numericDrafts,
        statusDrafts,
      ),
    [filteredPartners, monthMultiplier, schoolsById, selectedMonth, defaultDays, numericDrafts, statusDrafts],
  );

  const totalPayable = useMemo(
    () =>
      paymentRows.reduce(
        (sum, row) => sum + (Number(row[PARTNER_PAY_COL_TOTAL]) || 0),
        0,
      ),
    [paymentRows],
  );

  const changeCount = countDraftChanges(numericDrafts, textDrafts, statusDrafts);
  const canEdit = !readOnly && Boolean(onSaveWorkdays || onSavePayUpdates || onSavePartnerDetails || onSavePaymentStatus);

  const applyNumericDraftUpdate = useCallback(
    (partnerId: string, field: PartnerPayNumericField, rawValue: string) => {
      const partner = filteredPartners.find((p) => p.id === partnerId);
      if (!partner) return;
      if (field === "days") {
        manualDaysPartnerIdsRef.current.add(partnerId);
      }
      const school = partner.schoolWorkId ? schoolsById[partner.schoolWorkId] : undefined;
      const base = getPartnerPayBaseValues(partner, school, selectedMonth, defaultDays);
      const current = { ...base, ...(numericDrafts[partnerId] || {}) };
      const nextValues = applyPartnerPayFieldChange(
        current,
        field,
        field === "days" ? Number(rawValue) || defaultDays : Number(rawValue) || 0,
      );

      setNumericDrafts((prev) => {
        const next = { ...prev };
        const draft: Partial<PartnerPayValues> = { ...(next[partnerId] || {}) };
        let changed = false;

        for (const key of Object.keys(nextValues) as Array<keyof PartnerPayValues>) {
          if (nextValues[key] !== base[key]) {
            draft[key] = nextValues[key];
            changed = true;
          } else {
            delete draft[key];
          }
        }

        if (!changed || Object.keys(draft).length === 0) {
          delete next[partnerId];
        } else {
          next[partnerId] = draft;
        }
        return next;
      });
    },
    [filteredPartners, schoolsById, selectedMonth, defaultDays, numericDrafts],
  );

  const applyNumericDraftUpdateMany = useCallback(
    (partnerIds: string[], field: PartnerPayNumericField, value: string) => {
      if (partnerIds.length === 0) return;
      if (field === "days") {
        for (const partnerId of partnerIds) {
          manualDaysPartnerIdsRef.current.add(partnerId);
        }
      }
      setNumericDrafts((prev) => {
        let next = prev;
        for (const partnerId of partnerIds) {
          const partner = filteredPartners.find((p) => p.id === partnerId);
          if (!partner) continue;
          const school = partner.schoolWorkId ? schoolsById[partner.schoolWorkId] : undefined;
          const base = getPartnerPayBaseValues(partner, school, selectedMonth, defaultDays);
          const current = { ...base, ...(next[partnerId] || {}) };
          const nextValues = applyPartnerPayFieldChange(
            current,
            field,
            field === "days" ? Number(value) || defaultDays : Number(value) || 0,
          );
          const draft: Partial<PartnerPayValues> = { ...(next[partnerId] || {}) };
          let changed = false;
          for (const key of Object.keys(nextValues) as Array<keyof PartnerPayValues>) {
            if (nextValues[key] !== base[key]) {
              draft[key] = nextValues[key];
              changed = true;
            } else {
              delete draft[key];
            }
          }
          if (!changed || Object.keys(draft).length === 0) {
            delete next[partnerId];
          } else {
            next = { ...next, [partnerId]: draft };
          }
        }
        return next;
      });
    },
    [filteredPartners, schoolsById, selectedMonth, defaultDays],
  );

  const applyTextDraftUpdate = useCallback(
    (partnerId: string, field: PartnerPayTextField, rawValue: string) => {
      const partner = filteredPartners.find((p) => p.id === partnerId);
      if (!partner) return;
      const school = partner.schoolWorkId ? schoolsById[partner.schoolWorkId] : undefined;
      const base = getPartnerPayTextBaseValues(partner, school);
      const value = rawValue.trim();

      setTextDrafts((prev) => {
        const next = { ...prev };
        const draft: Partial<PartnerPayTextValues> = { ...(next[partnerId] || {}) };
        if (value === base[field]) {
          delete draft[field];
        } else {
          draft[field] = value;
        }
        if (Object.keys(draft).length === 0) {
          delete next[partnerId];
        } else {
          next[partnerId] = draft;
        }
        return next;
      });
    },
    [filteredPartners, schoolsById],
  );

  const applyTextDraftUpdateMany = useCallback(
    (partnerIds: string[], field: PartnerPayTextField, value: string) => {
      if (partnerIds.length === 0) return;
      const trimmed = value.trim();
      setTextDrafts((prev) => {
        let next = prev;
        for (const partnerId of partnerIds) {
          const partner = filteredPartners.find((p) => p.id === partnerId);
          if (!partner) continue;
          const school = partner.schoolWorkId ? schoolsById[partner.schoolWorkId] : undefined;
          const base = getPartnerPayTextBaseValues(partner, school);
          const draft: Partial<PartnerPayTextValues> = { ...(next[partnerId] || {}) };
          if (trimmed === base[field]) {
            delete draft[field];
          } else {
            draft[field] = trimmed;
          }
          if (Object.keys(draft).length === 0) {
            delete next[partnerId];
          } else {
            next = { ...next, [partnerId]: draft };
          }
        }
        return next;
      });
    },
    [filteredPartners, schoolsById],
  );

  const applyStatusDraftUpdate = useCallback(
    (partnerId: string, status: PartnerPayStatus) => {
      const partner = filteredPartners.find((p) => p.id === partnerId);
      if (!partner) return;
      const base = getPartnerPayStatus(partner, selectedMonth);
      setStatusDrafts((prev) => {
        const next = { ...prev };
        if (status === base) {
          delete next[partnerId];
        } else {
          next[partnerId] = status;
        }
        return next;
      });
    },
    [filteredPartners, selectedMonth],
  );

  const applyStatusDraftUpdateMany = useCallback(
    (partnerIds: string[], status: PartnerPayStatus) => {
      if (partnerIds.length === 0) return;
      setStatusDrafts((prev) => {
        let next = { ...prev };
        for (const partnerId of partnerIds) {
          const partner = filteredPartners.find((p) => p.id === partnerId);
          if (!partner) continue;
          const base = getPartnerPayStatus(partner, selectedMonth);
          if (status === base) {
            delete next[partnerId];
          } else {
            next = { ...next, [partnerId]: status };
          }
        }
        return next;
      });
    },
    [filteredPartners, selectedMonth],
  );

  const handleFieldChange = useCallback(
    (partnerId: string, field: PartnerPayColumnField, value: string) => {
      const selection = columnSelectionRef.current;
      const selectedIds = selectedPartnerIdsRef.current;
      const targets =
        selection?.field === field && selectedIds.includes(partnerId)
          ? selectedIds
          : [partnerId];
      if (field === "paymentStatus") {
        const status = value as PartnerPayStatus;
        if (targets.length > 1) {
          applyStatusDraftUpdateMany(targets, status);
        } else {
          applyStatusDraftUpdate(partnerId, status);
        }
        return;
      }
      if (isPartnerPayNumericField(field)) {
        if (targets.length > 1) {
          applyNumericDraftUpdateMany(targets, field, value);
        } else {
          applyNumericDraftUpdate(partnerId, field, value);
        }
        return;
      }
      if (targets.length > 1) {
        applyTextDraftUpdateMany(targets, field, value);
      } else {
        applyTextDraftUpdate(partnerId, field, value);
      }
    },
    [applyNumericDraftUpdate, applyNumericDraftUpdateMany, applyTextDraftUpdate, applyTextDraftUpdateMany, applyStatusDraftUpdate, applyStatusDraftUpdateMany],
  );

  const clearColumnSelection = useCallback(() => {
    columnSelectionRef.current = null;
    selectedPartnerIdsRef.current = [];
    setColumnSelection(null);
  }, []);

  const activateCell = useCallback(
    (partnerId: string, field: PartnerPayColumnField, shiftKey: boolean) => {
      const clickIdx = filteredPartners.findIndex((p) => p.id === partnerId);
      if (clickIdx === -1) return;

      const selection = columnSelectionRef.current;
      if (shiftKey) {
        if (selection?.field === field) {
          const next = { ...selection, focusPartnerId: partnerId };
          columnSelectionRef.current = next;
          selectedPartnerIdsRef.current = selectionToPartnerIds(next, filteredPartners);
          setColumnSelection(next);
          return;
        }
        const anchorId =
          selection?.focusPartnerId ??
          selection?.anchorPartnerId ??
          filteredPartners[0]?.id;
        const anchorIdx = filteredPartners.findIndex((p) => p.id === anchorId);
        const start = Math.min(anchorIdx >= 0 ? anchorIdx : 0, clickIdx);
        const end = Math.max(anchorIdx >= 0 ? anchorIdx : 0, clickIdx);
        const next = {
          field,
          anchorPartnerId: filteredPartners[start].id,
          focusPartnerId: filteredPartners[end].id,
        };
        columnSelectionRef.current = next;
        selectedPartnerIdsRef.current = selectionToPartnerIds(next, filteredPartners);
        setColumnSelection(next);
        return;
      }
      const next = { field, anchorPartnerId: partnerId, focusPartnerId: partnerId };
      columnSelectionRef.current = next;
      selectedPartnerIdsRef.current = [partnerId];
      setColumnSelection(next);
    },
    [filteredPartners],
  );

  const handleBulkApplyValue = useCallback(
    (value: string) => {
      const selection = columnSelectionRef.current;
      const selectedIds = selectedPartnerIdsRef.current;
      if (!selection || selectedIds.length === 0) return;
      const field = selection.field;
      if (field === "paymentStatus") {
        applyStatusDraftUpdateMany(selectedIds, value as PartnerPayStatus);
        return;
      }
      if (isPartnerPayNumericField(field)) {
        applyNumericDraftUpdateMany(selectedIds, field, value);
        return;
      }
      applyTextDraftUpdateMany(selectedIds, field, value);
    },
    [applyNumericDraftUpdateMany, applyTextDraftUpdateMany, applyStatusDraftUpdateMany],
  );

  const handleColumnHeaderClick = useCallback(
    (field: PartnerPayColumnField) => {
      if (!canEdit) return;
      const allIds = filteredPartners.map((p) => p.id);
      if (allIds.length === 0) return;
      const next = {
        field,
        anchorPartnerId: allIds[0],
        focusPartnerId: allIds[allIds.length - 1],
      };
      columnSelectionRef.current = next;
      selectedPartnerIdsRef.current = allIds;
      setColumnSelection(next);
    },
    [canEdit, filteredPartners],
  );

  useEffect(() => {
    clearColumnSelection();
    setCheckedPartnerIds([]);
  }, [districtFilter, blockFilter, clearColumnSelection]);

  const allFilteredChecked =
    filteredPartners.length > 0 &&
    filteredPartners.every((partner) => checkedPartnerIds.includes(partner.id));

  const togglePartnerCheck = useCallback((partnerId: string) => {
    setCheckedPartnerIds((prev) =>
      prev.includes(partnerId)
        ? prev.filter((id) => id !== partnerId)
        : [...prev, partnerId],
    );
  }, []);

  const toggleSelectAllFiltered = useCallback(() => {
    if (allFilteredChecked) {
      const filteredIds = new Set(filteredPartners.map((partner) => partner.id));
      setCheckedPartnerIds((prev) => prev.filter((id) => !filteredIds.has(id)));
      return;
    }
    setCheckedPartnerIds((prev) =>
      Array.from(new Set([...prev, ...filteredPartners.map((partner) => partner.id)])),
    );
  }, [allFilteredChecked, filteredPartners]);

  const handleBulkPaymentStatus = useCallback(
    (status: PartnerPayStatus) => {
      if (checkedPartnerIds.length === 0) return;
      applyStatusDraftUpdateMany(checkedPartnerIds, status);
    },
    [applyStatusDraftUpdateMany, checkedPartnerIds],
  );

  const handleDiscard = () => {
    setNumericDrafts({});
    setTextDrafts({});
    setStatusDrafts({});
    manualDaysPartnerIdsRef.current = new Set();
    clearColumnSelection();
    setCheckedPartnerIds([]);
  };

  const handleSave = async () => {
    if (!selectedMonth || changeCount === 0) return;
    setSaving(true);
    try {
      const workdayUpdatesByBlock = new Map<
        string,
        Array<{ id: string; cleaningDays: number; billingToilets?: number }>
      >();
      const payUpdates: Array<{ id: string; changes: { partnerMonthlyPay: number; rates: number } }> =
        [];
      const detailUpdatesBySchool = new Map<string, Partial<SchoolWork>>();

      for (const partner of partners) {
        const numericDraft = numericDrafts[partner.id];
        const textDraft = textDrafts[partner.id];
        if ((!numericDraft && !textDraft) || !partner.schoolWorkId) continue;
        const school = schoolsById[partner.schoolWorkId];
        const values = resolveValues(partner);

        if (
          numericDraft &&
          (numericDraft.toilets !== undefined || numericDraft.days !== undefined) &&
          school &&
          onSaveWorkdays
        ) {
          const block = school.block || partner.block;
          if (block) {
            const list = workdayUpdatesByBlock.get(block) || [];
            list.push({
              id: school.id,
              cleaningDays: values.days,
              billingToilets: values.toilets,
            });
            workdayUpdatesByBlock.set(block, list);
          }
        }

        if (
          numericDraft &&
          (numericDraft.monthlyPay !== undefined || numericDraft.perToiletPay !== undefined) &&
          onSavePayUpdates
        ) {
          payUpdates.push({
            id: partner.schoolWorkId,
            changes: {
              partnerMonthlyPay: values.monthlyPay,
              rates: values.monthlyPay,
            },
          });
        }

        if (textDraft && onSavePartnerDetails) {
          const schoolChanges: Partial<SchoolWork> = {
            ...(detailUpdatesBySchool.get(partner.schoolWorkId) || {}),
          };
          for (const [field, val] of Object.entries(textDraft) as Array<
            [PartnerPayTextField, string]
          >) {
            const schoolField = PARTNER_PAY_TEXT_TO_SCHOOL_FIELD[field];
            schoolChanges[schoolField] = val as never;
          }
          if (Object.keys(schoolChanges).length > 0) {
            detailUpdatesBySchool.set(partner.schoolWorkId, schoolChanges);
          }
        }
      }

      for (const [block, updates] of workdayUpdatesByBlock) {
        const blockSchools = schools.filter((s) => s.block === block);
        const updateById = new Map(updates.map((u) => [u.id, u]));
        const fullUpdates = blockSchools.map((school) => {
          const explicit = updateById.get(school.id);
          if (explicit) return explicit;
          const linkedPartner = partners.find((p) => p.schoolWorkId === school.id);
          const values = linkedPartner
            ? resolveValues(linkedPartner)
            : getPartnerPayBaseValues(
                { monthlyPay: 0, perToiletPay: 0, noOfToilets: 0 },
                school,
                selectedMonth,
                defaultDays,
              );
          return {
            id: school.id,
            cleaningDays: values.days,
            billingToilets: values.toilets,
          };
        });
        const ok = await onSaveWorkdays!({
          block,
          monthKey: selectedMonth,
          defaultDays,
          updates: fullUpdates,
        });
        if (!ok) return;
      }

      if (payUpdates.length > 0 && onSavePayUpdates) {
        const ok = await onSavePayUpdates(payUpdates);
        if (!ok) return;
      }

      const detailUpdates = Array.from(detailUpdatesBySchool.entries()).map(([id, changes]) => ({
        id,
        changes,
      }));
      if (detailUpdates.length > 0 && onSavePartnerDetails) {
        const ok = await onSavePartnerDetails(detailUpdates);
        if (!ok) return;
      }

      if (Object.keys(statusDrafts).length > 0 && onSavePaymentStatus && selectedMonth) {
        const statusUpdates = Object.entries(statusDrafts).map(([id, paymentStatus]) => ({
          id,
          paymentStatus,
        }));
        const ok = await onSavePaymentStatus(statusUpdates);
        if (!ok) return;
      }

      setNumericDrafts({});
      setTextDrafts({});
      setStatusDrafts({});
      clearColumnSelection();
      setCheckedPartnerIds([]);
      setIsBulkEditOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Partner Payments");
    const periodLabel =
      monthMultiplier > 1
        ? `${monthMultiplier} months${selectedMonth ? ` from ${selectedMonth}` : ""}`
        : selectedMonth || "Monthly";
    ws.addRow([`Monthly Partner Payments — ${periodLabel}`]);
    ws.addRow([]);
    ws.addRow(PARTNER_PAYMENT_HEADERS);
    filteredPartners.forEach((partner, index) => {
      const values = resolveValues(partner);
      const textValues = resolveTextValues(partner);
      const payable = computePartnerPayableAmount(values, monthMultiplier, defaultDays);
      const paymentStatus = resolvePaymentStatus(partner);
      const school = partner.schoolWorkId ? schoolsById[partner.schoolWorkId] : undefined;
      ws.addRow([
        school?.srNo || index + 1,
        textValues.schoolName,
        textValues.schoolCategory,
        textValues.partnerName,
        textValues.accountHolderName,
        textValues.accountNumber,
        textValues.ifscCode,
        values.toilets,
        values.days,
        values.perToiletPay,
        values.monthlyPay,
        payable,
        paymentStatus,
        partner.remarks || "",
      ]);
    });
    ws.addRow([]);
    const totalRow = Array(PARTNER_PAYMENT_HEADERS.length).fill("");
    totalRow[PARTNER_PAYMENT_TOTAL_PAY_COLUMN - 1] = "TOTAL";
    totalRow[PARTNER_PAYMENT_TOTAL_PAY_COLUMN] = totalPayable;
    ws.addRow(totalRow);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `monthly_partner_payments_${(selectedMonth || "export").replace(/\s+/g, "_")}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAxisBulkPay = async () => {
    if (!onExportAxisBulkPay) return;
    const items: AxisBulkPayRowInput[] = filteredPartners.map((partner) => {
      const values = resolveValues(partner);
      const textValues = resolveTextValues(partner);
      const payable = computePartnerPayableAmount(values, monthMultiplier, defaultDays);
      return {
        paymentAmount: payable,
        beneficiaryName: textValues.accountHolderName,
        accountNo: textValues.accountNumber,
        ifscCode: textValues.ifscCode,
        remarks: `${textValues.schoolName} - ${selectedMonth || ""}`,
      };
    });
    const partnerSheet: BulkPayPartnerSheetInput = {
      month: selectedMonth || "",
      district: districtFilter || "All Districts",
      block: blockFilter || "All Blocks",
      partnerRows: paymentRows.map((row) => row.map((cell) => cell)),
    };
    await onExportAxisBulkPay({
      items,
      partnerSheet,
      partnerIds: filteredPartners.map((partner) => partner.id),
      partnerHeaders: PARTNER_PAYMENT_HEADERS,
    });
  };

  const renderNumericDisplayCell = (
    partner: SchoolPartner,
    field: PartnerPayNumericField,
    displayValue: number,
    colIndex: number,
  ) => {
    const isDirty = Boolean(numericDrafts[partner.id]?.[field]);
    return (
      <td
        key={colIndex}
        className={`p-2 border border-[#d4d4d4] text-center ${isDirty ? "bg-orange-50 text-orange-700 font-semibold" : ""}`}
      >
        {displayValue}
      </td>
    );
  };

  const renderTextDisplayCell = (
    partner: SchoolPartner,
    field: PartnerPayTextField,
    displayValue: string,
    colIndex: number,
  ) => {
    const isDirty = Boolean(textDrafts[partner.id]?.[field]);
    return (
      <td
        key={colIndex}
        className={`p-2 border border-[#d4d4d4] ${isDirty ? "bg-orange-50 text-orange-700 font-semibold" : ""}`}
      >
        {displayValue}
      </td>
    );
  };

  const renderStatusDisplayCell = (
    partner: SchoolPartner,
    displayStatus: PartnerPayStatus,
    colIndex: number,
  ) => {
    const isDirty = Boolean(statusDrafts[partner.id]);
    return (
      <td key={colIndex} className="p-2 border border-[#d4d4d4] text-center">
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${partnerPayStatusClass(displayStatus)} ${
            isDirty ? "ring-1 ring-orange-400" : ""
          }`}
        >
          {displayStatus}
        </span>
      </td>
    );
  };

  const selectedFieldLabel = EDITABLE_FIELDS.find((f) => f.field === columnSelection?.field)?.label;

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <DownloadCloud className="text-[#ff791a]" size={18} />
            Partner Payments
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Bank sheet export — use Bulk Edit for bank details, toilets, days, and pay
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {monthsList && selectedMonth && onMonthChange && (
            <select
              value={selectedMonth}
              onChange={(event) => onMonthChange(event.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
            >
              {monthsList.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          )}
          <select
            value={districtFilter}
            onChange={(event) => setDistrictFilter(event.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <option value="">All Districts</option>
            {districtOptions.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
          <select
            value={blockFilter}
            onChange={(event) => setBlockFilter(event.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <option value="">All Blocks</option>
            {blocks.map((block) => (
              <option key={block} value={block}>
                {block}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={31}
            value={defaultDays}
            readOnly
            title="Synced from Create Invoice / View Saved"
            className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 cursor-default"
          />
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setIsBulkEditOpen(true)}
                disabled={filteredPartners.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-40 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Pencil size={14} /> Bulk Edit ({filteredPartners.length})
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={changeCount === 0 || saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw size={14} /> Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={changeCount === 0 || saving || !selectedMonth}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Save size={14} /> {saving ? "Saving..." : `Save ${changeCount || ""} change${changeCount === 1 ? "" : "s"}`}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={exportExcel}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded cursor-pointer border border-slate-200"
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>
          {onExportAxisBulkPay && !readOnly && (
            <button
              type="button"
              onClick={exportAxisBulkPay}
              disabled={filteredPartners.length === 0 || isExportingBulkPay}
              title="Generate, download, and save Axis Bank Bulk Pay file (Excel 97–2003)"
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer"
            >
              {isExportingBulkPay ? (
                "Saving..."
              ) : (
                <>
                  <IndianRupee size={14} className="stroke-[2.5]" />
                  Bulk Pay ({filteredPartners.length})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {lastSavedBulkPay && onViewSavedBulkPay && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black text-violet-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Bulk Pay Saved
            </p>
            <p className="text-[11px] text-violet-700 mt-1 font-mono truncate" title={lastSavedBulkPay.filename}>
              {lastSavedBulkPay.filename}
            </p>
            <p className="text-[10px] text-violet-500 mt-0.5">
              {lastSavedBulkPay.month} {lastSavedBulkPay.year} · {lastSavedBulkPay.recordCount} records · ₹{Number(lastSavedBulkPay.totalAmount || 0).toLocaleString("en-IN")}
            </p>
          </div>
          <button
            type="button"
            onClick={onViewSavedBulkPay}
            className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-[10px] font-bold cursor-pointer shrink-0"
          >
            View Saved Files
          </button>
        </div>
      )}

      <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 mb-4 text-xs">
        <span className="font-bold text-slate-700">Total payable: </span>
        <span className="font-black text-[#ff791a] text-lg">
          ₹{totalPayable.toLocaleString("en-IN")}
        </span>
        <span className="text-slate-500 ml-2">
          ({filteredPartners.length} partners
          {selectedMonth ? ` — ${selectedMonth}` : ""})
        </span>
      </div>

      {canEdit && changeCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-3 text-xs text-amber-900">
          <strong>{changeCount}</strong> unsaved bulk edit change{changeCount === 1 ? "" : "s"} — open{" "}
          <button
            type="button"
            onClick={() => setIsBulkEditOpen(true)}
            className="font-bold text-[#ff791a] hover:underline cursor-pointer"
          >
            Bulk Edit
          </button>{" "}
          or click Save to apply
        </div>
      )}

      {canEdit && checkedPartnerIds.length > 0 && (
        <div className="bg-slate-900 px-4 py-3 text-white flex flex-wrap items-center justify-between gap-3 mb-3 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-yellow-400 text-yellow-950 font-black text-xs rounded-full">
              {checkedPartnerIds.length} selected
            </span>
            <span className="text-xs text-slate-300 hidden sm:inline">
              Mark payment status for checked partners — click Save when done
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkPaymentStatus("Paid")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white cursor-pointer"
            >
              Mark Paid
            </button>
            <button
              type="button"
              onClick={() => handleBulkPaymentStatus("Unpaid")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-slate-700 hover:bg-slate-600 border-slate-500 text-white cursor-pointer"
            >
              Mark Unpaid
            </button>
            <button
              type="button"
              onClick={() => handleBulkPaymentStatus("Hold")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-amber-600 hover:bg-amber-500 border-amber-500 text-white cursor-pointer"
            >
              Mark Hold
            </button>
            <button
              type="button"
              onClick={() => setCheckedPartnerIds([])}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto max-h-[560px] border border-[#d4d4d4] rounded-lg">
        <table
          className="w-full text-xs text-left min-w-[1300px] border-collapse"
          style={{ fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif" }}
        >
          <thead>
            <tr className="bg-[#e2efda] text-[#1f4e2d] sticky top-0">
              {canEdit && (
                <th className="p-2 w-10 border border-[#d4d4d4] text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredChecked}
                    onChange={toggleSelectAllFiltered}
                    title="Select all partners in view"
                    className="w-4 h-4 cursor-pointer accent-[#ff791a]"
                  />
                </th>
              )}
              {PARTNER_PAYMENT_HEADERS.map((header) => (
                  <th
                    key={header}
                    className="p-2 whitespace-nowrap border border-[#d4d4d4] font-semibold"
                  >
                    {header}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {paymentRows.length === 0 ? (
              <tr>
                <td
                  colSpan={PARTNER_PAYMENT_HEADERS.length + (canEdit ? 1 : 0)}
                  className="p-8 text-center text-slate-400"
                >
                  No partner records found for this filter.
                </td>
              </tr>
            ) : (
              filteredPartners.map((partner, index) => {
                const row = paymentRows[index];
                const values = resolveValues(partner);
                const textValues = resolveTextValues(partner);
                const payable = computePartnerPayableAmount(values, monthMultiplier, defaultDays);
                const rowDirty =
                  Boolean(
                    (numericDrafts[partner.id] && Object.keys(numericDrafts[partner.id]).length > 0) ||
                      (textDrafts[partner.id] && Object.keys(textDrafts[partner.id]).length > 0) ||
                      statusDrafts[partner.id],
                  );

                const isChecked = checkedPartnerIds.includes(partner.id);

                return (
                  <tr
                    key={partner.id}
                    className={`border-t border-[#d4d4d4] hover:bg-slate-50 ${rowDirty ? "bg-orange-50/40" : ""} ${
                      isChecked ? "bg-blue-50/50" : ""
                    }`}
                  >
                    {canEdit && (
                      <td className="p-2 border border-[#d4d4d4] text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePartnerCheck(partner.id)}
                          className="w-4 h-4 cursor-pointer accent-[#ff791a]"
                        />
                      </td>
                    )}
                    {row.map((cell, cellIndex) => {
                      if (cellIndex === PARTNER_PAY_COL_SCHOOL_NAME) {
                        return renderTextDisplayCell(
                          partner,
                          "schoolName",
                          textValues.schoolName,
                          cellIndex,
                        );
                      }
                      if (cellIndex === PARTNER_PAY_COL_SCHOOL_CATEGORY) {
                        return renderTextDisplayCell(
                          partner,
                          "schoolCategory",
                          textValues.schoolCategory,
                          cellIndex,
                        );
                      }
                      if (cellIndex === PARTNER_PAY_COL_PARTNER_NAME) {
                        return renderTextDisplayCell(
                          partner,
                          "partnerName",
                          textValues.partnerName,
                          cellIndex,
                        );
                      }
                      if (cellIndex === PARTNER_PAY_COL_ACCOUNT_HOLDER) {
                        return renderTextDisplayCell(
                          partner,
                          "accountHolderName",
                          textValues.accountHolderName,
                          cellIndex,
                        );
                      }
                      if (cellIndex === PARTNER_PAY_COL_ACCOUNT_NUMBER) {
                        return renderTextDisplayCell(
                          partner,
                          "accountNumber",
                          textValues.accountNumber,
                          cellIndex,
                        );
                      }
                      if (cellIndex === PARTNER_PAY_COL_IFSC) {
                        return renderTextDisplayCell(
                          partner,
                          "ifscCode",
                          textValues.ifscCode,
                          cellIndex,
                        );
                      }
                      if (cellIndex === PARTNER_PAY_COL_TOILETS) {
                        return renderNumericDisplayCell(partner, "toilets", values.toilets, cellIndex);
                      }
                      if (cellIndex === PARTNER_PAY_COL_DAYS) {
                        return renderNumericDisplayCell(partner, "days", values.days, cellIndex);
                      }
                      if (cellIndex === PARTNER_PAY_COL_PER_TOILET) {
                        return renderNumericDisplayCell(
                          partner,
                          "perToiletPay",
                          values.perToiletPay,
                          cellIndex,
                        );
                      }
                      if (cellIndex === PARTNER_PAY_COL_MONTHLY) {
                        return renderNumericDisplayCell(
                          partner,
                          "monthlyPay",
                          values.monthlyPay,
                          cellIndex,
                        );
                      }
                      if (cellIndex === PARTNER_PAY_COL_TOTAL) {
                        return (
                          <td
                            key={cellIndex}
                            className="p-2 border border-[#d4d4d4] font-semibold text-right"
                          >
                            ₹{payable.toLocaleString("en-IN")}
                          </td>
                        );
                      }
                      if (cellIndex === PARTNER_PAY_COL_STATUS) {
                        return renderStatusDisplayCell(
                          partner,
                          resolvePaymentStatus(partner),
                          cellIndex,
                        );
                      }
                      return (
                        <td key={cellIndex} className="p-2 border border-[#d4d4d4]">
                          {String(cell)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <PartnerPayBulkEditModal
          isOpen={isBulkEditOpen}
          onClose={() => setIsBulkEditOpen(false)}
          selectedMonth={selectedMonth}
          filteredPartners={filteredPartners}
          paymentRows={paymentRows}
          changeCount={changeCount}
          saving={saving}
          columnSelection={columnSelection}
          selectedPartnerIds={selectedPartnerIds}
          selectedFieldLabel={selectedFieldLabel}
          editableFields={EDITABLE_FIELDS}
          numericDrafts={numericDrafts}
          textDrafts={textDrafts}
          statusDrafts={statusDrafts}
          monthMultiplier={monthMultiplier}
          defaultDays={defaultDays}
          resolveValues={resolveValues}
          resolveTextValues={resolveTextValues}
          resolvePaymentStatus={resolvePaymentStatus}
          onFieldChange={handleFieldChange}
          onBulkApplyValue={handleBulkApplyValue}
          onActivateCell={activateCell}
          onColumnHeaderClick={handleColumnHeaderClick}
          onClearColumnSelection={clearColumnSelection}
          onDiscard={handleDiscard}
          onSave={handleSave}
        />
      )}
    </section>
  );
}
