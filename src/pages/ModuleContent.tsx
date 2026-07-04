import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Users, 
  KeyRound,
  UserPlus, 
  TrendingUp, 
  IndianRupee, 
  Map, 
  HelpCircle, 
  FileSpreadsheet, 
  Heart, 
  RotateCw,
  Plus,
  Search,
  Shield,
  CalendarOff,
  Calendar,
  CheckCircle,
  Clock,
  Briefcase,
  UserCircle,
  Target,
  LayoutDashboard,
  Contact,
  Wrench,
  Coins,
  Calculator,
  Megaphone,
  LogOut,
  ChevronDown,
  ChevronUp,
  Menu,
  Settings,
  Bell,
  Lock,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  Building,
  Landmark,
  CheckCircle2,
  FileText,
  BarChart4,
  Edit2,
  Check,
  X,
  Trash2,
  Gift,
  Cake,
  Phone,
  Mail,
  Globe,
  Filter,
  CheckSquare,
  Square,
  Archive,
  Download,
  DownloadCloud,
  Eye,
  School,
  Gavel,
  Compass,
  Smartphone,
  ScanLine,
} from "lucide-react";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Employee, EXCEL_ROW_HEADERS, SchoolWork, SCHOOL_EXCEL_ROW_HEADERS } from "../types";
import PasswordInput from "../components/PasswordInput";
import SystemTourSection from "../components/SystemTourSection";
import BlockedAppsConfigurationPanel from "../components/BlockedAppsConfigurationPanel";
import { ROLE_ACCESS_SECTIONS } from "../lib/system-tour";
import {
  generateCSV,
  getEmployeeHeaderValue,
  normalizeSkillCategory,
  employeeMatchesSkillFilters,
  computeProratedGrossAndBasic,
  resolveFullMonthSalary,
  isEmployeeEsicCovered,
  calculatePfAmounts,
  calculateProfessionalTax,
  isPfEsicCompliant,
  isProfessionalTaxApplicable,
  quoteCSVValue,
  downloadAxisBulkPayXls,
  saveAxisBulkPayArchive,
  getAxisDebitAccountNo,
  buildAxisBulkPayFilename,
  parseMonthYear,
  parseBulkPayXlsWorkbook,
  getBulkPayPreviewHeaderRowCount,
} from "../utils";
import { formatAuditLogDetails, groupAuditLogsByDate, formatAuditLogTime } from "../utils/formatAuditLogDetails";
import CsvImporter from "../components/CsvImporter";
import EmployeeTable from "../components/EmployeeTable";
import EmployeeFormModal from "../components/EmployeeFormModal";
import SchoolWorkImporter from "../components/SchoolWorkImporter";
import SchoolWorkTable from "../components/SchoolWorkTable";
import MonthlyInvoiceTab from "../components/MonthlyInvoiceTab";
import SchoolExpensesPanel from "../components/SchoolExpensesPanel";
import FieldTeamPanel from "../components/FieldTeamPanel";
import TendersPanel from "../components/TendersPanel";
import ContractsPanel from "../components/ContractsPanel";
import RenewalsPanel from "../components/RenewalsPanel";
import BgDdPanel from "../components/BgDdPanel";
import MonitorPanel from "../components/MonitorPanel";
import SchoolSupervisorFormModal from "../components/SchoolSupervisorFormModal";
import { getSchoolHeaderValue } from "../lib/school-work-helpers";
import { parseApiError } from "../api";
import { isSchoolWorkTab, isBidsTab, isRenewalsTab, isBgDdTab, isMonitorTab } from "../routes";
import { RENEWAL_TAB_TO_CATEGORY } from "../lib/renewals";
import {
  getCurrentFY, getFinancialYears, MONTH_NAME_LIST, getMonthsForFY,
  getCalendarYearFromFYRange, normalizeMonthKey, safeNumber, getDaysInMonthStatic,
  getCurrentMonthName, getTodayBirthdayLabel, getOrdinalDay, parseDateOfBirth,
  formatEmployeeBirthDate,
} from "../lib/date-helpers";
import { isEmployeeExitedGeneral, isEmployeeExitedOnDayStatic, isEmployeeExitedForMonth } from "../lib/employee-helpers";
import { getSalaryColumnValue, resolveEmployeeDailyWage } from "../lib/salary-columns";
import {
  countMonthAttendance,
  isWeeklyOffDay,
  getDayOfWeekForMonthDay,
  getEffectiveAttendanceStatus,
  getBulkAttendanceDisabledDays,
  filterSelectableBulkDays,
  employeeMatchesAttendanceRecordFilter,
} from "../lib/attendance-helpers";
import { getModuleKey, PERMISSION_MODULES, SidebarItemDef, isAdminModuleTab } from "../lib/permissions";
import {
  clampSelectedColumns,
  isColumnAllowed,
  isFilterLocked,
  isFilterVisible,
  SALARY_COLUMNS,
  type SalaryColumn,
} from "../lib/role-ui-restrictions";
import { tabToPath, pathToTab, DEFAULT_PATH } from "../routes";
import AdminAccountsPanel from "../components/admin/AdminAccountsPanel";
import RolesPermissionsPanel from "../components/admin/RolesPermissionsPanel";
import DialerOverlay from "../components/ui/DialerOverlay";
import DirectoryContactCard from "../components/DirectoryContactCard";
import { formatPhoneDisplay, phoneToDialString } from "../lib/phone-helpers";
import ConfettiRain from "../components/ui/ConfettiRain";
import ExcelPreviewGrid from "../components/ExcelPreviewGrid";
import BirthdaysTab from "../components/BirthdaysTab";
import BulkAttendanceDateCalendar from "../components/BulkAttendanceDateCalendar";
import EmployeeAttendanceMarkingView from "../components/EmployeeAttendanceMarkingView";
import AttendancePdfUploadWizard from "../components/AttendancePdfUploadWizard";
import LedgerRecordedOverviewModal from "../components/LedgerRecordedOverviewModal";
import {
  getMonthLedger,
  sumMonthTotals,
  defaultTempLedgerEntry,
  getLedgerDateBoundsForMonth,
} from "../lib/ledger-helpers";
import {
  buildLabeledGrandTotalRow,
  sumExportRows,
} from "../lib/export-totals";
import SearchableMultiSelect from "../components/ui/SearchableMultiSelect";
import { Switch } from "../components/ui/Switch";
import { matchesMultiSelectFilter } from "../lib/filter-helpers";
import { useHRMS } from "../context/HRMSContext";
import EmployeesPage from "./EmployeesPage";
import AdminDashboardPage from "./AdminDashboardPage";

function attendanceBadgeClass(code: string): string {
  const base = "text-[9px] font-black text-center rounded px-1 py-0.5 inline-block min-w-[1.5rem]";
  switch (code) {
    case "P":
      return `${base} bg-emerald-100 text-emerald-800`;
    case "A":
      return `${base} bg-rose-100 text-rose-800`;
    case "L":
      return `${base} bg-amber-100 text-amber-800`;
    case "H":
      return `${base} bg-blue-100 text-blue-800`;
    case "WO":
      return `${base} bg-red-100 text-red-800`;
    default:
      return `${base} bg-slate-100 text-slate-400 font-semibold`;
  }
}

function paymentStatusBadgeClass(status: string): string {
  const base = "px-2 py-1 rounded text-xs font-bold border inline-block";
  if (status === "Paid") return `${base} bg-emerald-50 border-emerald-200 text-emerald-700`;
  if (status === "Hold") return `${base} bg-amber-50 border-amber-250 text-amber-700`;
  return `${base} bg-slate-100 border-slate-200 text-slate-600`;
}

export default function ModuleContent() {
  const [isSchoolBulkEditMode, setIsSchoolBulkEditMode] = useState(false);
  const [isSchoolImporterOpen, setIsSchoolImporterOpen] = useState(false);
  const {
    isLoggedIn,
    sessionUser,
    sessionRole,
    sessionLocations,
    sessionPermissions,
    rolesList,
    isFetchingRoles,
    usernameInput,
    passwordInput,
    loginError,
    loginView,
    forgotUsername,
    forgotError,
    forgotMessage,
    issuedResetToken,
    resetTokenInput,
    resetNewPassword,
    resetConfirmPassword,
    resetError,
    resetSuccess,
    adminsList,
    inviteUsername,
    invitePassword,
    inviteRole,
    inviteLocations,
    editingAdminUsername,
    editAdminRole,
    editAdminLocations,
    editAdminDisabled,
    editAdminNewPassword,
    editAdminPasswordError,
    editAdminPasswordSuccess,
    isResettingAdminPassword,
    inviteError,
    inviteSuccess,
    isFetchingAdmins,
    roleNameInput,
    roleDescInput,
    rolePermsInput,
    roleUiInput,
    salaryUiRestrictions,
    roleError,
    roleSuccess,
    activePimSubTab,
    sidebarSearch,
    isSidebarCollapsed,
    isProfileOpen,
    isMobileProfileOpen,
    adminProfileInfo,
    isFetchingProfile,
    profileLoadingError,
    oldPassword,
    newPassword,
    confirmNewPassword,
    changePasswordError,
    changePasswordSuccess,
    profileEmail,
    profileEmailError,
    profileEmailSuccess,
    isSavingProfileEmail,
    myInfoTab,
    setMyInfoTab,
    roleAccessSection,
    setRoleAccessSection,
    rawEmployees,
    selectedIds,
    isFormOpen,
    currentEmployee,
    isLoading,
    esicEligibilityLimit,
    basicSalaryPercentage,
    companyBranch,
    rawCustomLocations,
    locationCompliance,
    locationPtEnabled,
    isFetchingLocations,
    newLocCompliance,
    newLocPtEnabled,
    customRoles,
    isFetchingJobRoles,
    auditLogsList,
    isFetchingAuditLogs,
    auditSearch,
    auditFilterAdmin,
    auditFilterAction,
    expandedLogId,
    bulkPayArchives,
    isFetchingBulkPayArchives,
    isExportingBulkPay,
    lastSavedBulkPay,
    highlightedBulkPayId,
    bulkPayArchiveYearFilter,
    editingLocIndex,
    editingLocValue,
    newLocNameInput,
    selectedLocs,
    ledgerEmployeeId,
    ledgerType,
    ledgerAmount,
    selectedMonth,
    ledgerSearchQuery,
    ledgerSelectedEmployeeIds,
    ledgerLocationFilters,
    ledgerSkillFilters,
    ledgerRoleFilters,
    isLedgerLocationDropdownOpen,
    isLedgerSkillDropdownOpen,
    isLedgerRoleDropdownOpen,
    tempLedgerEntries,
    salarySearchQuery,
    salaryLocationFilters,
    salaryFilterType,
    salaryJoinStartFilter,
    salaryJoinEndFilter,
    salaryExitStartFilter,
    salaryExitEndFilter,
    salaryMinSalaryFilter,
    salaryMaxSalaryFilter,
    salaryMinDailyWageFilter,
    salaryMaxDailyWageFilter,
    salaryGenderFilter,
    salaryMaritalFilter,
    salaryEsicFilter,
    salarySkillFilters,
    salaryRoleFilters,
    salaryPaymentStatusFilter,
    isSalarySkillDropdownOpen,
    isSalaryRoleDropdownOpen,
    selectedSalaryEmployeeIds,
    birthdaySearchMonth,
    showConfetti,
    simulatedBirthdayEmpIds,
    helplines,
    isFetchingHelplines,
    newHelplineName,
    newHelplinePhone,
    newHelplineRole,
    newHelplineCategory,
    newHelplineLocation,
    helplineSearchQuery,
    helplineLocationFilters,
    attendanceDb,
    isFetchingAttendance,
    attendanceLocationFilters,
    attendanceRoleFilters,
    attendanceSkillFilters,
    isAttendanceRoleDropdownOpen,
    isAttendanceSkillDropdownOpen,
    bulkWizardRoleFilters,
    bulkWizardSkillFilters,
    isBulkWizardRoleDropdownOpen,
    isBulkWizardSkillDropdownOpen,
    attendanceSearchQuery,
    hideAttendanceAbsentColumn,
    setHideAttendanceAbsentColumn,
    promptHideAttendanceAbsentColumn,
    bulkStartDay,
    bulkEndDay,
    bulkStatus,
    bulkWizardStep,
    isBulkWizardOpen,
    attendanceSubView,
    individualAttendanceEmployeeId,
    attendanceRecordFilter,
    bulkSelLocations,
    bulkSelEmployees,
    bulkSelMonths,
    bulkCalendarMonth,
    bulkSelDates,
    bulkConfirm1,
    bulkConfirm2,
    activeDirectorySubTab,
    directorySearch,
    directoryLocationFilters,
    directoryGender,
    activeDialerContact,
    activeDialerStatus,
    selectedSalaryColumns,
    savedReportTemplates,
    savedSalaryTemplates,
    isFetchingTemplates,
    newReportTemplateName,
    newSalaryTemplateName,
    activeReportTemplateName,
    activeSalaryTemplateName,
    editingRoleIndex,
    editingRoleValue,
    newRoleNameInput,
    selectedRoles,
    selectedReportColumns,
    reportLocFilters,
    reportJoinStartFilter,
    reportJoinEndFilter,
    reportExitStartFilter,
    reportExitEndFilter,
    reportMinSalaryFilter,
    reportMaxSalaryFilter,
    reportGenderFilter,
    reportMaritalFilter,
    reportEsicFilter,
    reportSkillFilters,
    reportRoleFilters,
    isReportLocDropdownOpen,
    isSkillDropdownOpen,
    isRoleDropdownOpen,
    reportSearchQuery,
    selectedReportEmployeeIds,
    applySessionFromAuthMe,
    fetchRoles,
    updateLocationCompliance,
    updateLocationPtEnabled,
    fetchLocations,
    fetchJobRoles,
    fetchBulkPayArchives,
    handleDownloadBulkPayArchive,
    handleDeleteBulkPayArchive,
    fetchAuditLogs,
    handleFlushAuditLogs,
    handleExportAuditPDF,
    handleExportAuditExcel,
    handleAddLocationFromConfig,
    handleEditLocationFromConfig,
    fetchHelplines,
    handleAddHelpline,
    handleDeleteHelpline,
    fetchAttendanceForMonth,
    getDaysInSelectedMonth,
    handleCellAttendanceChange,
    handleApplyBulkAttendance,
    handleApplyBulkWizardAttendance,
    handleApplyPdfAttendanceImport,
    handleEmployeeBulkAttendanceChange,
    openEmployeeAttendanceMarking,
    closeEmployeeAttendanceMarking,
    downloadAttendanceExcel,
    downloadAttendancePDF,
    normalizeTemplates,
    fetchExportTemplates,
    handleSaveReportTemplate,
    handleLoadReportTemplate,
    handleDeleteReportTemplate,
    handleSaveSalaryTemplate,
    handleLoadSalaryTemplate,
    handleDeleteSalaryTemplate,
    handleDeleteLocations,
    handleAddRoleFromConfig,
    handleEditRoleFromConfig,
    handleDeleteRoles,
    saveBatchLedgerRecords,
    handleSaveBatchLedgerRecords,
    handleSaveLedgerRecord,
    handleUpdatePaymentStatus,
    handleBulkUpdatePaymentStatus,
    handleCallInitiate,
    downloadReportsCSV,
    downloadReportsExcel,
    downloadReportsPDF,
    downloadSalaryExcel,
    downloadSalaryPDF,
    downloadPfSalaryExcel,
    fetchEmployees,
    fetchAdmins,
    fetchAdminProfile,
    handlePasswordChangeSubmit,
    handleProfileEmailSave,
    triggerSuccess,
    handleLoginSubmit,
    handleForgotPasswordSubmit,
    handleResetPasswordSubmit,
    openForgotPassword,
    backToSignIn,
    handleInviteAdminSubmit,
    handleUpdateAdminSubmit,
    handleResetAdminPasswordSubmit,
    resetEditAdminPasswordFields,
    handleLogout,
    handleSaveRoleSubmit,
    handleDeleteRole,
    handleSaveEmployee,
    handleBulkImport,
    handleDeleteEmployee,
    handleBulkDelete,
    buildAxisBulkPayItems,
    handleExportAxisBulkPay,
    handleExportSchoolAxisBulkPay,
    handleExportSelected,
    handlePimSubTabClick,
    navigateToTab,
    toggleSidebarGroup,
    expandedSidebarGroups,
    isSchoolFormOpen,
    setIsSchoolFormOpen,
    currentSchool,
    setCurrentSchool,
    handleSaveSchoolWork,
    openAddSchoolForm,
    showFlushAuditModal,
    closeFlushAuditModal,
    flushAuditPassword,
    setFlushAuditPassword,
    flushAuditError,
    isFlushingAuditLogs,
    bulkPayPreview,
    setBulkPayPreview,
    registryLocations,
    registeredJobRoles,
    reportLocationExportLabel,
    setNewPassword,
    openFlushAuditModal,
    handleViewBulkPayArchive,
    birthdayTodayList,
    birthdayMonthList,
    birthdayTodayLabel,
    isFetchingBirthdays,
    resolveEmployeePhone,
    isSchoolLoading,
    schoolDashboardStats,
    handleBulkSchoolImport,
    existingSchoolUdiseCodes,
    rawSchoolWorks,
    selectedSchoolIds,
    setSelectedSchoolIds,
    handleDeleteSchoolWork,
    handleBulkDeleteSchools,
    handleExportSchoolsSelected,
    handleAddExpenseRecord,
    handleDeleteExpenseRecord,
    schoolDistricts,
    schoolBlocks,
    schoolBulkEditDrafts,
    isSubmittingSchoolBulkEdit,
    handleSchoolBulkEditDraftChange,
    handleSchoolBulkEditDraftChangeMany,
    handleDiscardSchoolBulkEditDrafts,
    handleApplySchoolBulkEdit,
    handleUpdateVisitStatus,
    handleBulkUpdateVisitStatus,
    handleRespondSupervisorRequest,
    handleCloseSupervisorRequest,
    handleResolveSupervisorEscalation,
    handleUpdateCommitmentDiary,
    handleGenerateSchoolBilling,
    handleDeleteSchoolBilling,
    handleSaveSchoolWorkdays,
    handleSavePartnerPayUpdates,
    handleSavePartnerPayDetails,
    handleSavePartnerPaymentStatus,
    fetchSchoolBillings,
    rawSchoolBillings,
    rawSchoolVisits,
    rawSupervisorRequests,
    rawCommitmentDiary,
    rawTenders,
    fetchTenders,
    handleCreateTender,
    handleUpdateTender,
    handleDeleteTender,
    handleBulkUpdateTenders,
    handleBulkDeleteTenders,
    handleImportTenders,
    rawContracts,
    fetchContracts,
    handleCreateContract,
    handleUpdateContract,
    handleDeleteContract,
    handleImportContracts,
    rawRenewals,
    fetchRenewals,
    handleCreateRenewal,
    handleUpdateRenewal,
    handleDeleteRenewal,
    handleImportRenewals,
    rawBgDdRecords,
    fetchBgDdRecords,
    handleCreateBgDdRecord,
    handleUpdateBgDdRecord,
    handleDeleteBgDdRecord,
    pendingSupervisorRequestCount,
    fieldTeamView,
    setFieldTeamView,
    tenderDeadlineFilter,
    renewalExpiryFilter,
    bgDdExpiryFilter,
    bgDdTypeFilter,
    schoolDistrictFilter,
    setSchoolDistrictFilter,
    rawSchoolPartners,
    rawSchoolSupervisors,
    isSupervisorFormOpen,
    setIsSupervisorFormOpen,
    currentSupervisor,
    setCurrentSupervisor,
    handleSaveSchoolSupervisor,
    handleDeleteSchoolSupervisor,
    openAddSupervisorForm,
    PERMISSION_MODULES,
    sidebarItems,
    filteredSidebarItems,
    activeModuleKey,
    isModuleAccessDenied,
    tenantEntitlements,
    SALARY_HEADERS,
    userPermissions,
    employees,
    customLocations,
    bulkPayArchiveYears,
    filteredBulkPayArchives,
    schoolBulkPayArchives,
    isFetchingSchoolBulkPayArchives,
    isExportingSchoolBulkPay,
    lastSavedSchoolBulkPay,
    highlightedSchoolBulkPayId,
    schoolBulkPayArchiveYearFilter,
    schoolBulkPayPreview,
    setSchoolBulkPayPreview,
    fetchSchoolBulkPayArchives,
    handleDownloadSchoolBulkPayArchive,
    handleDeleteSchoolBulkPayArchive,
    handleViewSchoolBulkPayArchive,
    schoolBulkPayArchiveYears,
    filteredSchoolBulkPayArchives,
    filteredAuditLogs,
    activeMonthName,
    activeCalendarYear,
    activeFYRange,
    MONTHS_LIST,
    ledgerUniqueLocations,
    ledgerUniqueSkills,
    ledgerUniqueRoles,
    filteredReportEmployees,
    dashboardStats,
    existingCodes,
    salaryUniqueLocations,
    filteredSalaryEmployees,
    selectedMonthHasMarkedAttendance,
    profileDropdownRef,
    mobileProfileDropdownRef,
    activeSidebarTab,
    setActiveSidebarTab,
    setIsLoggedIn,
    setSessionUser,
    setSessionRole,
    setSessionLocations,
    setSessionPermissions,
    setRolesList,
    setIsFetchingRoles,
    setUsernameInput,
    setPasswordInput,
    setLoginError,
    setLoginView,
    setForgotUsername,
    setForgotError,
    setForgotMessage,
    setIssuedResetToken,
    setResetTokenInput,
    setResetNewPassword,
    setResetConfirmPassword,
    setResetError,
    setResetSuccess,
    setAdminsList,
    setInviteUsername,
    setInvitePassword,
    setInviteRole,
    setInviteLocations,
    setEditingAdminUsername,
    setEditAdminRole,
    setEditAdminLocations,
    setEditAdminDisabled,
    setEditAdminNewPassword,
    setInviteError,
    setInviteSuccess,
    setIsFetchingAdmins,
    setRoleNameInput,
    setRoleDescInput,
    setRolePermsInput,
    setRoleUiInput,
    setRoleError,
    setRoleSuccess,
    setActivePimSubTab,
    setSidebarSearch,
    setIsSidebarCollapsed,
    setIsProfileOpen,
    setIsMobileProfileOpen,
    setAdminProfileInfo,
    setIsFetchingProfile,
    setProfileLoadingError,
    setOldPassword,
    setConfirmNewPassword,
    setChangePasswordError,
    setChangePasswordSuccess,
    setProfileEmail,
    setProfileEmailError,
    setProfileEmailSuccess,
    setRawEmployees,
    setSelectedIds,
    setIsFormOpen,
    setCurrentEmployee,
    setIsLoading,
    setErrorMessage,
    setSuccessMessage,
    setEsicEligibilityLimit,
    setBasicSalaryPercentage,
    setCompanyBranch,
    setRawCustomLocations,
    setLocationCompliance,
    setLocationPtEnabled,
    setIsFetchingLocations,
    setNewLocCompliance,
    setNewLocPtEnabled,
    setCustomRoles,
    setIsFetchingJobRoles,
    setAuditLogsList,
    setIsFetchingAuditLogs,
    setAuditSearch,
    setAuditFilterAdmin,
    setAuditFilterAction,
    setExpandedLogId,
    setBulkPayArchives,
    setIsFetchingBulkPayArchives,
    setIsExportingBulkPay,
    setLastSavedBulkPay,
    setHighlightedBulkPayId,
    setBulkPayArchiveYearFilter,
    setSchoolBulkPayArchives,
    setIsFetchingSchoolBulkPayArchives,
    setIsExportingSchoolBulkPay,
    setLastSavedSchoolBulkPay,
    setHighlightedSchoolBulkPayId,
    setSchoolBulkPayArchiveYearFilter,
    setEditingLocIndex,
    setEditingLocValue,
    setNewLocNameInput,
    setSelectedLocs,
    setLedgerEmployeeId,
    setLedgerType,
    setLedgerAmount,
    setSelectedMonth,
    setLedgerSearchQuery,
    setLedgerSelectedEmployeeIds,
    setLedgerLocationFilters,
    setLedgerSkillFilters,
    setLedgerRoleFilters,
    setIsLedgerLocationDropdownOpen,
    setIsLedgerSkillDropdownOpen,
    setIsLedgerRoleDropdownOpen,
    setTempLedgerEntries,
    setSalarySearchQuery,
    setSalaryLocationFilters,
    setSalaryFilterType,
    setSalaryJoinStartFilter,
    setSalaryJoinEndFilter,
    setSalaryExitStartFilter,
    setSalaryExitEndFilter,
    setSalaryMinSalaryFilter,
    setSalaryMaxSalaryFilter,
    setSalaryMinDailyWageFilter,
    setSalaryMaxDailyWageFilter,
    setSalaryGenderFilter,
    setSalaryMaritalFilter,
    setSalaryEsicFilter,
    setSalarySkillFilters,
    setSalaryRoleFilters,
    setSalaryPaymentStatusFilter,
    setIsSalarySkillDropdownOpen,
    setIsSalaryRoleDropdownOpen,
    setSelectedSalaryEmployeeIds,
    setBirthdaySearchMonth,
    setShowConfetti,
    setSimulatedBirthdayEmpIds,
    setHelplines,
    setIsFetchingHelplines,
    setNewHelplineName,
    setNewHelplinePhone,
    setNewHelplineRole,
    setNewHelplineCategory,
    setNewHelplineLocation,
    setHelplineSearchQuery,
    setHelplineLocationFilters,
    setAttendanceDb,
    setIsFetchingAttendance,
    setAttendanceLocationFilters,
    setAttendanceRoleFilters,
    setAttendanceSkillFilters,
    setIsAttendanceRoleDropdownOpen,
    setIsAttendanceSkillDropdownOpen,
    setBulkWizardRoleFilters,
    setBulkWizardSkillFilters,
    setIsBulkWizardRoleDropdownOpen,
    setIsBulkWizardSkillDropdownOpen,
    setAttendanceSearchQuery,
    setBulkStartDay,
    setBulkEndDay,
    setBulkStatus,
    setBulkWizardStep,
    setIsBulkWizardOpen,
    setAttendanceSubView,
    setAttendanceRecordFilter,
    setBulkSelLocations,
    setBulkSelEmployees,
    setBulkSelMonths,
    setBulkCalendarMonth,
    setBulkSelDates,
    setBulkConfirm1,
    setBulkConfirm2,
    setActiveDirectorySubTab,
    setDirectorySearch,
    setDirectoryLocationFilters,
    setDirectoryGender,
    setActiveDialerContact,
    setActiveDialerStatus,
    setSelectedSalaryColumns,
    setSavedReportTemplates,
    setSavedSalaryTemplates,
    setIsFetchingTemplates,
    setNewReportTemplateName,
    setNewSalaryTemplateName,
    setActiveReportTemplateName,
    setActiveSalaryTemplateName,
    setEditingRoleIndex,
    setEditingRoleValue,
    setNewRoleNameInput,
    setSelectedRoles,
    setSelectedReportColumns,
    setReportLocFilters,
    setReportJoinStartFilter,
    setReportJoinEndFilter,
    setReportExitStartFilter,
    setReportExitEndFilter,
    setReportMinSalaryFilter,
    setReportMaxSalaryFilter,
    setReportGenderFilter,
    setReportMaritalFilter,
    setReportEsicFilter,
    setReportSkillFilters,
    setReportRoleFilters,
    setIsReportLocDropdownOpen,
    setIsSkillDropdownOpen,
    setIsRoleDropdownOpen,
    setReportSearchQuery,
    setSelectedReportEmployeeIds,
    navigate,
    location,
    confirmAction,
  } = useHRMS();
  const salaryStickyContainerRef = useRef<HTMLDivElement | null>(null);
  const attendanceStickyContainerRef = useRef<HTMLDivElement | null>(null);

  const setSalaryStickyContainer = useCallback((node: HTMLDivElement | null) => {
    salaryStickyContainerRef.current = node;
    if (node) {
      node.setAttribute("data-salary-sticky-details", "true");
    }
  }, []);

  const setAttendanceStickyContainer = useCallback((node: HTMLDivElement | null) => {
    attendanceStickyContainerRef.current = node;
    if (node) {
      node.setAttribute("data-attendance-sticky-columns", "true");
    }
  }, []);

  const handleSalaryStickyChange = useCallback((enabled: boolean) => {
    salaryStickyContainerRef.current?.setAttribute("data-salary-sticky-details", enabled ? "true" : "false");
  }, []);

  const handleAttendanceStickyChange = useCallback((enabled: boolean) => {
    attendanceStickyContainerRef.current?.setAttribute("data-attendance-sticky-columns", enabled ? "true" : "false");
  }, []);

  const canEditAdmin = !!userPermissions.admin?.edit;
  const isSuperAdmin =
    String(sessionRole || "").toLowerCase() === "admin" ||
    String(sessionUser || "").toLowerCase() === "admin";
  const canViewSalary = !!userPermissions.salary?.view;
  const canEditSalary = !!userPermissions.salary?.edit;
  const canDeleteSalary = !!userPermissions.salary?.delete;
  const canDeleteSchoolWork = !!userPermissions.schoolWork?.delete;
  const canEditLedger = !!userPermissions.ledger?.edit;
  const canEditAttendance = !!userPermissions.attendance?.edit;
  const canEditDirectory = !!userPermissions.directory?.edit;
  const canDeleteDirectory = !!userPermissions.directory?.delete;
  const [showRecordedLedgerModal, setShowRecordedLedgerModal] = useState(false);
  const [ledgerAutoSaveEnabled, setLedgerAutoSaveEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("hrms_ledger_autosave") === "1";
  });
  const [isLedgerAutoSaving, setIsLedgerAutoSaving] = useState(false);
  const [lastLedgerAutoSaveAt, setLastLedgerAutoSaveAt] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("hrms_ledger_autosave", ledgerAutoSaveEnabled ? "1" : "0");
  }, [ledgerAutoSaveEnabled]);

  useEffect(() => {
    if (!canEditAttendance && (attendanceSubView === "wizard" || attendanceSubView === "pdf-import")) {
      setAttendanceSubView("grid");
    }
  }, [canEditAttendance, attendanceSubView, setAttendanceSubView]);

  const bulkCalendarMonthKey = bulkCalendarMonth || selectedMonth;
  const ledgerDateBounds = useMemo(
    () => getLedgerDateBoundsForMonth(selectedMonth),
    [selectedMonth],
  );
  const hasLedgerAmounts = useCallback((entry: ReturnType<typeof defaultTempLedgerEntry>) => {
    return [
      entry.advance,
      entry.uniform,
      entry.penalty,
      entry.foodPerk,
      entry.accommodationPerk,
      entry.conveyancePerk,
    ].some((value) => Number(value) > 0);
  }, []);
  const handleLedgerAutoSave = useCallback(
    async (employeeId: string) => {
      if (!ledgerAutoSaveEnabled || isLedgerAutoSaving) return;
      const entry = tempLedgerEntries[employeeId];
      if (!entry || !hasLedgerAmounts(entry)) return;
      setIsLedgerAutoSaving(true);
      try {
        const saved = await saveBatchLedgerRecords({
          source: "autosave",
          employeeIds: [employeeId],
        });
        if (saved) {
          setLastLedgerAutoSaveAt(
            new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
      } finally {
        setIsLedgerAutoSaving(false);
      }
    },
    [
      hasLedgerAmounts,
      isLedgerAutoSaving,
      ledgerAutoSaveEnabled,
      saveBatchLedgerRecords,
      tempLedgerEntries,
    ],
  );
  const bulkWizardSelectedEmployees = useMemo(
    () => employees.filter((employee) => bulkSelEmployees.includes(employee.id)),
    [employees, bulkSelEmployees],
  );
  const bulkAttendanceDayMeta = useMemo(() => {
    const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonthKey);
    return getBulkAttendanceDisabledDays(
      bulkWizardSelectedEmployees,
      bulkCalendarMonthKey,
      daysInMonth,
    );
  }, [bulkWizardSelectedEmployees, bulkCalendarMonthKey, getDaysInSelectedMonth]);

  const pickSelectableBulkDates = useCallback(
    (days: number[]) => filterSelectableBulkDays(days, bulkAttendanceDayMeta.disabledDays),
    [bulkAttendanceDayMeta.disabledDays],
  );

  useEffect(() => {
    if (bulkWizardStep !== "dates") return;
    setBulkSelDates((previous) =>
      previous.filter((day) => !bulkAttendanceDayMeta.disabledDays.has(day)),
    );
  }, [bulkWizardStep, bulkAttendanceDayMeta.disabledDays, bulkCalendarMonthKey, bulkSelEmployees, setBulkSelDates]);

  const showSalaryFilter = useCallback(
    (key: string) => isFilterVisible(salaryUiRestrictions, key),
    [salaryUiRestrictions],
  );
  const lockSalaryFilter = useCallback(
    (key: string) => isFilterLocked(salaryUiRestrictions, key),
    [salaryUiRestrictions],
  );
  const allowSalaryColumn = useCallback(
    (column: string) => isColumnAllowed(salaryUiRestrictions, column),
    [salaryUiRestrictions],
  );
  const salaryColumnPickerLocked = !!salaryUiRestrictions?.hideColumnPicker;
  const visibleSalaryColumns = useMemo(
    () => {
      const allowed = clampSelectedColumns(selectedSalaryColumns, salaryUiRestrictions, SALARY_COLUMNS).filter((column) =>
        allowSalaryColumn(column),
      );
      return SALARY_COLUMNS.filter((column) => allowed.includes(column));
    },
    [selectedSalaryColumns, salaryUiRestrictions, allowSalaryColumn],
  );
  const toggleSalaryColumn = useCallback(
    (header: string, checked: boolean) => {
      if (!allowSalaryColumn(header)) return;
      setSelectedSalaryColumns((prev) => {
        const next = checked ? [...prev, header] : prev.filter((item) => item !== header);
        return clampSelectedColumns(next, salaryUiRestrictions, SALARY_COLUMNS);
      });
    },
    [allowSalaryColumn, salaryUiRestrictions, setSelectedSalaryColumns],
  );
  const toggleSalaryColumnGroup = useCallback(
    (groupHeaders: string[], isAllGroupChecked: boolean) => {
      const allowedHeaders = groupHeaders.filter((header) => allowSalaryColumn(header));
      if (allowedHeaders.length === 0) return;
      setSelectedSalaryColumns((prev) => {
        const next = isAllGroupChecked
          ? prev.filter((header) => !allowedHeaders.includes(header))
          : Array.from(new Set([...prev, ...allowedHeaders]));
        return clampSelectedColumns(next, salaryUiRestrictions, SALARY_COLUMNS);
      });
    },
    [allowSalaryColumn, salaryUiRestrictions, setSelectedSalaryColumns],
  );


  return (
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-thin" id="viewport-scroll-shell">
                      <>
                        {/* VIEW: ACTIVE SIDEBAR MODULES MAPPING */}
                        {isModuleAccessDenied ? (
                          <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto shadow-xs text-center space-y-4" id="module-access-denied-view">
                            <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto text-2xl">
                              <Lock size={24} />
                            </div>
                            <div className="space-y-2">
                              <h2 className="text-lg font-extrabold text-slate-800">{activeSidebarTab} access restricted</h2>
                              <p className="text-sm text-slate-500">
                                {tenantEntitlements.isSubscriptionDenied(activeSidebarTab)
                                  ? `This module is not included in your ${tenantEntitlements.entitlements?.planName ?? "current"} plan. Upgrade your subscription to unlock ${activeSidebarTab}.`
                                  : `Your role does not include view permission for the ${activeSidebarTab} module. Contact an administrator if you need access.`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveSidebarTab("Employees")}
                              className="px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg transition cursor-pointer"
                            >
                              Go to Employees
                            </button>
                          </div>
                        ) : activeSidebarTab === "Dashboard" ? (
                          <AdminDashboardPage />
                        ) : activeSidebarTab === "My Info" ? (
                          <div className="max-w-5xl mx-auto space-y-6 animate-fade-in" id="my-info-view-container">
                            {/* Profile hero */}
                            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
                              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,121,26,0.35)_0%,_transparent_55%)]" />
                              <div className="relative p-6 md:p-8">
                                {isFetchingProfile ? (
                                  <div className="flex items-center gap-4 py-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white/10 animate-pulse" />
                                    <div className="space-y-2 flex-1">
                                      <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
                                      <div className="h-3 w-56 bg-white/10 rounded animate-pulse" />
                                    </div>
                                  </div>
                                ) : profileLoadingError ? (
                                  <div className="p-4 bg-rose-500/20 border border-rose-400/30 rounded-xl text-sm text-rose-100">
                                    Could not load profile: {profileLoadingError}
                                  </div>
                                ) : adminProfileInfo ? (
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff791a] to-[#e4640c] flex items-center justify-center text-2xl font-black shadow-lg ring-4 ring-white/10 shrink-0">
                                      {adminProfileInfo.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h2 className="text-xl font-extrabold tracking-tight truncate">{adminProfileInfo.username}</h2>
                                      <p className="text-sm text-slate-300 mt-0.5">Manage your credentials and account security</p>
                                      <div className="flex flex-wrap items-center gap-2 mt-3">
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/10">
                                          <Shield size={11} />
                                          {adminProfileInfo.role === "admin" ? "Super Admin" : adminProfileInfo.role || "Administrator"}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/20">
                                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                          Active Session
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-400">Profile data unavailable.</p>
                                )}
                              </div>
                            </div>

                            {/* Profile tabs */}
                            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                              <button
                                type="button"
                                onClick={() => setMyInfoTab("account")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  myInfoTab === "account"
                                    ? "bg-white text-slate-800 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                              >
                                My Account
                              </button>
                              <button
                                type="button"
                                onClick={() => setMyInfoTab("tour")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                  myInfoTab === "tour"
                                    ? "bg-white text-slate-800 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                              >
                                <Compass size={14} className="text-[#ff791a]" />
                                System Tour
                              </button>
                            </div>

                            {myInfoTab === "tour" ? (
                              <SystemTourSection />
                            ) : adminProfileInfo && !isFetchingProfile && !profileLoadingError ? (
                              <>
                                {/* Quick stats */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invited By</p>
                                    <p className="mt-1 text-sm font-bold text-slate-800 truncate">{adminProfileInfo.invitedBy || "System"}</p>
                                  </div>
                                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Member Since</p>
                                    <p className="mt-1 text-sm font-bold text-slate-800">
                                      {adminProfileInfo.createdAt ? new Date(adminProfileInfo.createdAt).toLocaleDateString() : "—"}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs col-span-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recovery Email</p>
                                    <p className="mt-1 text-sm font-bold text-slate-800 flex items-center gap-1.5 truncate">
                                      <Mail size={14} className="text-[#ff791a] shrink-0" />
                                      {adminProfileInfo.email || "Not configured"}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {/* Recovery email */}
                                  <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
                                      <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                                        <Mail size={16} className="text-[#ff791a]" />
                                        Password Recovery
                                      </h3>
                                      <p className="text-xs text-slate-400 mt-0.5">Used for one-time reset codes on the login page</p>
                                    </div>
                                    <form onSubmit={handleProfileEmailSave} className="p-5 space-y-3">
                                      {profileEmailError && (
                                        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-semibold">
                                          {profileEmailError}
                                        </div>
                                      )}
                                      {profileEmailSuccess && (
                                        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">
                                          {profileEmailSuccess}
                                        </div>
                                      )}
                                      <div>
                                        <label htmlFor="profile-email-field" className="text-[11px] font-bold text-slate-500 block mb-1.5">
                                          Recovery email address
                                        </label>
                                        <input
                                          id="profile-email-field"
                                          type="email"
                                          value={profileEmail}
                                          onChange={(e) => setProfileEmail(e.target.value)}
                                          placeholder="you@company.com"
                                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20 transition"
                                        />
                                      </div>
                                      <button
                                        type="submit"
                                        disabled={isSavingProfileEmail}
                                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                                      >
                                        {isSavingProfileEmail ? "Saving..." : "Save Recovery Email"}
                                      </button>
                                    </form>
                                  </div>

                                  {/* Change password */}
                                  <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
                                      <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                                        <KeyRound size={16} className="text-[#ff791a]" />
                                        Change Password
                                      </h3>
                                      <p className="text-xs text-slate-400 mt-0.5">Update your login credentials securely</p>
                                    </div>
                                    <form onSubmit={handlePasswordChangeSubmit} className="p-5 space-y-3">
                                      {changePasswordError && (
                                        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-semibold animate-shake">
                                          {changePasswordError}
                                        </div>
                                      )}
                                      {changePasswordSuccess && (
                                        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">
                                          {changePasswordSuccess}
                                        </div>
                                      )}
                                      <div>
                                        <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Current password</label>
                                        <PasswordInput
                                          id="old-password"
                                          name="oldPassword"
                                          value={oldPassword}
                                          onChange={(e) => setOldPassword(e.target.value)}
                                          placeholder="Enter current password"
                                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20 transition"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[11px] font-bold text-slate-500 block mb-1.5">New password</label>
                                        <PasswordInput
                                          id="new-password"
                                          name="newPassword"
                                          value={newPassword}
                                          onChange={(e) => setNewPassword(e.target.value)}
                                          placeholder="Enter new password"
                                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20 transition"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Confirm new password</label>
                                        <PasswordInput
                                          id="confirm-new-password"
                                          name="confirmNewPassword"
                                          value={confirmNewPassword}
                                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                                          placeholder="Re-enter new password"
                                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-800 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20 transition"
                                        />
                                      </div>
                                      <button
                                        type="submit"
                                        className="w-full py-2.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-sm shadow-orange-500/10 transition active:scale-[0.98] cursor-pointer"
                                      >
                                        Update Password
                                      </button>
                                    </form>
                                  </div>
                                </div>

                                <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 flex items-start gap-3">
                                  <Lock size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                  <p className="text-xs text-blue-900 leading-relaxed">
                                    Passwords are stored using secure one-way hashing. Sessions expire after 24 hours and all API routes require a valid authenticated session token.
                                  </p>
                                </div>
                              </>
                            ) : null}
                          </div>
                        ) : isAdminModuleTab(activeSidebarTab) ? (
                          <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="admin-module-view">
                            {/* Page header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div>
                                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                  <Shield size={22} className="text-[#ff791a]" />
                                  Role & Access
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">
                                  Manage who can log in, what they can do, and supervisor device rules
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs text-center min-w-[88px]">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admins</p>
                                  <p className="text-lg font-black text-slate-800">{isFetchingAdmins ? "…" : adminsList.length}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs text-center min-w-[88px]">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Roles</p>
                                  <p className="text-lg font-black text-slate-800">{isFetchingRoles ? "…" : rolesList.length}</p>
                                </div>
                              </div>
                            </div>

                            {/* Section tabs */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                              {ROLE_ACCESS_SECTIONS.map((section) => {
                                const TabIcon = section.icon;
                                const isActive = roleAccessSection === section.id;
                                return (
                                  <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => setRoleAccessSection(section.id)}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition cursor-pointer border ${
                                      isActive
                                        ? "bg-white text-slate-900 border-[#ff791a]/40 shadow-sm ring-1 ring-[#ff791a]/20"
                                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-white hover:text-slate-700"
                                    }`}
                                  >
                                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-orange-100 text-[#ff791a]" : "bg-white text-slate-400"}`}>
                                      <TabIcon size={15} />
                                    </span>
                                    {section.label}
                                  </button>
                                );
                              })}
                            </div>

                            {roleAccessSection === "admins" && <AdminAccountsPanel />}

                            {roleAccessSection === "roles" && <RolesPermissionsPanel />}

                            {roleAccessSection === "audit" && (
                            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in text-left" id="audit-trail-viewport">
                          
                              {/* 1. Page Header & Clear Button */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                                <div>
                                  <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                    <FileText size={20} className="text-[#ff791a]" /> Activity Log
                                  </h3>
                                  <p className="text-xs text-slate-400 mt-1">
                                    See who changed what — logins, employee updates, role changes, and exports.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={fetchAuditLogs}
                                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition flex items-center gap-1 cursor-pointer"
                                    title="Reload Audit Logs"
                                  >
                                    <RotateCw size={13} className={isFetchingAuditLogs ? "animate-spin" : ""} /> Refresh Logs
                                  </button>
                              
                                  {canEditAdmin && sessionUser.toLowerCase() === "admin" && (
                                    <button
                                      onClick={openFlushAuditModal}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold text-rose-700 transition flex items-center gap-1 cursor-pointer"
                                      title="Permanently Flush Security Logs"
                                    >
                                      <Trash2 size={13} /> Flush Security Trail
                                    </button>
                                  )}
                                </div>
                              </div>
          
                              {/* 2. Advanced High-End Visual Stats */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Card 1: Total Security Events */}
                                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
                                  <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Total Logged Events</p>
                                    <p className="text-2xl font-black text-slate-800">{auditLogsList.length}</p>
                                    <p className="text-[10px] text-slate-400">Max limit of 2000 active records</p>
                                  </div>
                                  <div className="w-12 h-12 bg-orange-50 text-[#ff791a] rounded-xl flex items-center justify-center font-bold text-lg shadow-xs">
                                    <FileText size={22} />
                                  </div>
                                </div>
          
                                {/* Card 2: Performing Operators */}
                                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
                                  <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Active Performers</p>
                                    <p className="text-2xl font-black text-slate-800">
                                      {new Set(auditLogsList.map(l => l.username || "System")).size}
                                    </p>
                                    <p className="text-[10px] text-slate-400">Authorized administrators & system</p>
                                  </div>
                                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs">
                                    <Users size={22} />
                                  </div>
                                </div>
          
                                {/* Card 3: Mutated Entity Payload Diffs */}
                                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
                                  <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Mutated Operations</p>
                                    <p className="text-2xl font-black text-slate-800">
                                      {auditLogsList.filter(l => l.action !== 'LOGIN_SUCCESS' && l.action !== 'LOGIN_FAILURE').length}
                                    </p>
                                    <p className="text-[10px] text-slate-400">Registry changes with payload diffs</p>
                                  </div>
                                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs">
                                    <Wrench size={22} />
                                  </div>
                                </div>
                              </div>
          
                              {/* 3. Advanced Filtering Control Bar */}
                              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Filter size={14} className="text-[#ff791a]" /> Interactive Filter Dashboard
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={handleExportAuditExcel}
                                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-700 font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer"
                                      title="Download Trail in Green Excel Sheet"
                                    >
                                      <FileSpreadsheet size={13} /> Export to Excel
                                    </button>
                                    <button
                                      onClick={handleExportAuditPDF}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-250 text-rose-700 font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer"
                                      title="Download Trail in High-Fidelity PDF Document"
                                    >
                                      <FileText size={13} /> Export to PDF
                                    </button>
                                  </div>
                                </div>
          
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                  {/* Filter 1: Full Payload Search */}
                                  <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Search Registry Event Logs</label>
                                    <div className="relative">
                                      <input id="audit-search" name="auditSearch"
                                        type="text"
                                        value={auditSearch}
                                        onChange={(e) => setAuditSearch(e.target.value)}
                                        placeholder="e.g. employeeCode, admin, update..."
                                        className="w-full pl-8 pr-3 py-2 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-orange-500 transition"
                                      />
                                      <span className="absolute left-2.5 top-2.5 text-slate-400"><Search size={13} /></span>
                                    </div>
                                  </div>
          
                                  {/* Filter 2: Performing Operator */}
                                  <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Filter Performer</label>
                                    <select id="audit-filter-admin" name="auditFilterAdmin"
                                      value={auditFilterAdmin}
                                      onChange={(e) => setAuditFilterAdmin(e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white focus:outline-none focus:border-orange-500 transition"
                                    >
                                      <option value="">All Administrators</option>
                                      {Array.from(new Set(auditLogsList.map(l => l.username || "System")))
                                        .filter(Boolean)
                                        .map((user: string) => (
                                          <option key={user} value={user}>{user}</option>
                                        ))
                                      }
                                    </select>
                                  </div>
          
                                  {/* Filter 3: Action Type */}
                                  <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Filter Action Category</label>
                                    <select id="audit-filter-action" name="auditFilterAction"
                                      value={auditFilterAction}
                                      onChange={(e) => setAuditFilterAction(e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white focus:outline-none focus:border-orange-500 transition"
                                    >
                                      <option value="">All Security Actions</option>
                                      {Array.from(new Set(auditLogsList.map(l => l.action)))
                                        .filter(Boolean)
                                        .map((act: string) => (
                                          <option key={act} value={act}>{act}</option>
                                        ))
                                      }
                                    </select>
                                  </div>
                                </div>
                              </div>
          
                              {/* 4. Results Database Grid */}
                              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                                <div className="overflow-x-auto">
                                  <table className="w-full table-fixed text-xs text-slate-700 text-left">
                                    <thead className="bg-[#fbfbfb] text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                                      <tr>
                                        <th className="px-4 py-4 font-black w-[72px]">Event ID</th>
                                        <th className="px-4 py-4 font-black w-[120px]">Time</th>
                                        <th className="px-4 py-4 font-black w-[96px]">Performer</th>
                                        <th className="px-4 py-4 font-black w-[128px]">Action</th>
                                        <th className="px-4 py-4 font-black">Task Description</th>
                                        <th className="px-4 py-4 text-center font-black w-[96px]">Details</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                      {isFetchingAuditLogs ? (
                                        <tr>
                                          <td colSpan={6} className="text-center py-10">
                                            <div className="flex flex-col items-center gap-2">
                                              <RotateCw className="animate-spin text-orange-500 shrink-0" size={20} />
                                              <span className="text-xs text-slate-400 font-bold">Querying local secure logs database...</span>
                                            </div>
                                          </td>
                                        </tr>
                                      ) : filteredAuditLogs.length === 0 ? (
                                        <tr>
                                          <td colSpan={6} className="text-center py-10 text-slate-400 font-bold">
                                            No security audit events matched active dashboard filters.
                                          </td>
                                        </tr>
                                      ) : (
                                        groupAuditLogsByDate(filteredAuditLogs).map(({ label, logs }) => (
                                          <React.Fragment key={label}>
                                            <tr className="bg-slate-50/80">
                                              <td
                                                colSpan={6}
                                                className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-y border-slate-200"
                                              >
                                                <span className="inline-flex items-center gap-2">
                                                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff791a]" />
                                                  {label}
                                                  <span className="font-bold normal-case tracking-normal text-slate-400">
                                                    ({logs.length} event{logs.length === 1 ? "" : "s"})
                                                  </span>
                                                </span>
                                              </td>
                                            </tr>
                                            {logs.map((log: any) => {
                                          const isExpanded = expandedLogId === log.id;
                                      
                                          // Dynamic Action Badges Colors
                                          let badgeStyle = "bg-blue-50 text-blue-700 border-blue-100";
                                          const act = log.action || "";
                                          if (act.includes("ADD") || act.includes("IMPORT") || act.includes("INVITE")) {
                                            badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
                                          } else if (act.includes("DELETE") || act.includes("SCRUB") || act.includes("FLUSH")) {
                                            badgeStyle = "bg-rose-50 text-rose-700 border-rose-100";
                                          } else if (act.includes("UPDATE") || act.includes("SAVE") || act.includes("RENAME")) {
                                            badgeStyle = "bg-amber-50 text-amber-700 border-amber-100";
                                          } else if (act.includes("LOGIN") || act.includes("LOGOUT") || act.includes("PASSWORD")) {
                                            badgeStyle = "bg-violet-50 text-violet-700 border-violet-100";
                                          } else if (act.includes("EXPORT") || act.includes("DOWNLOAD")) {
                                            badgeStyle = "bg-cyan-50 text-cyan-700 border-cyan-100";
                                          }
          
                                          return (
                                            <React.Fragment key={log.id}>
                                              <tr className="hover:bg-slate-50/50 transition align-top">
                                                <td className="px-4 py-3 font-mono font-bold text-slate-400 truncate" title={`#${log.id || "N/A"}`}>
                                                  #{log.id || "N/A"}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 whitespace-nowrap tabular-nums">
                                                  {formatAuditLogTime(log.timestamp)}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-800 truncate" title={log.username || "System"}>
                                                  {log.username || "System"}
                                                </td>
                                                <td className="px-4 py-3">
                                                  <span className={`inline-block max-w-full px-2 py-0.5 border text-[10px] rounded-full uppercase font-bold truncate ${badgeStyle}`} title={act}>
                                                    {act}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 min-w-0">
                                                  <p
                                                    className={`text-xs leading-relaxed break-words [overflow-wrap:anywhere] ${
                                                      isExpanded ? "" : "line-clamp-2"
                                                    }`}
                                                    title={log.target || "N/A"}
                                                  >
                                                    {log.target || "N/A"}
                                                  </p>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                  <button
                                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[10px] transition cursor-pointer whitespace-nowrap"
                                                  >
                                                    {isExpanded ? "Collapse" : "View"}
                                                  </button>
                                                </td>
                                              </tr>
          
                                              {isExpanded && (
                                                <tr>
                                                  <td colSpan={6} className="bg-slate-50 px-4 sm:px-6 py-4 border-y border-slate-200">
                                                    <div className="space-y-4 animate-fade-in max-w-full overflow-hidden">
                                                      {log.target && (
                                                        <div>
                                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Full Task Description
                                                          </p>
                                                          <div className="bg-white rounded-lg p-3 border border-slate-200 text-xs text-slate-700 leading-relaxed break-words [overflow-wrap:anywhere]">
                                                            {log.target}
                                                          </div>
                                                        </div>
                                                      )}

                                                      <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Plain-Language Task Breakdown
                                                        </p>
                                                        <div className="bg-white rounded-lg p-4 border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-1 break-words [overflow-wrap:anywhere]">
                                                          {formatAuditLogDetails(act, log.details).map((line, idx) =>
                                                            line ? (
                                                              <p key={idx} className={line.startsWith("  •") ? "pl-3 text-slate-600" : ""}>
                                                                {line}
                                                              </p>
                                                            ) : (
                                                              <div key={idx} className="h-2" />
                                                            )
                                                          )}
                                                        </div>
                                                      </div>

                                                      <div>
                                                        <div className="flex items-center justify-between mb-2 gap-2">
                                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Raw Forensic Payload (JSON)
                                                          </p>
                                                          <span className="text-[9px] font-mono text-slate-400 shrink-0">Machine-readable schema</span>
                                                        </div>
                                                        <div className="bg-[#1e293b] rounded-lg p-4 border border-slate-800 text-slate-100 font-mono text-xs overflow-x-auto shadow-inner max-h-[350px] relative">
                                                          <pre className="text-left text-orange-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                                            {JSON.stringify(log.details, null, 2)}
                                                          </pre>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </td>
                                                </tr>
                                              )}
                                            </React.Fragment>
                                          );
                                            })}
                                          </React.Fragment>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
          
                            </div>
                            )}

                            {roleAccessSection === "devices" && (
                              <BlockedAppsConfigurationPanel readOnly={!userPermissions.admin?.edit} />
                            )}
                          </div>
                          ) : activeSidebarTab === "Salary" ? (
                            /* --- SALARY CALCULATION SHEET & PERK ALLOCATION --- */
                            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="salary-calculations-module-view">
                              {/* 1. Dynamic Premium Advanced Filters Panel */}
                              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6 text-left">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                  <div>
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                      <Filter size={16} className="text-[#f57416]" /> Custom Salary Filters (Advanced)
                                    </h4>
                                    <p className="text-[11px] text-slate-450 mt-0.5">
                                      Configure targeted custom payroll filters, matching employee demographics, statutory status, and month-wise ledger scopes.
                                    </p>
                                  </div>
          
                                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                                    {showSalaryFilter("month") && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">🗓️ Month:</span>
                                      <select id="salary-month-select" name="selectedMonth"
                                        value={MONTHS_LIST.includes(selectedMonth) ? selectedMonth : (MONTHS_LIST[0] || selectedMonth)}
                                        onChange={(e) => setSelectedMonth(normalizeMonthKey(e.target.value))}
                                        disabled={lockSalaryFilter("month")}
                                        className="px-2.5 py-1 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 shadow-sm transition disabled:opacity-60"
                                      >
                                        {MONTHS_LIST.map((m) => (
                                          <option key={m} value={m}>{m}</option>
                                        ))}
                                      </select>
                                    </div>
                                    )}

                                    {showSalaryFilter("filterType") && (
                                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                      {[
                                        { id: "all", label: "All Balances" },
                                        { id: "advances", label: "Advances Only" },
                                        { id: "penalties", label: "Penalties Only" },
                                        { id: "perks", label: "Perks Only" }
                                      ].map((t) => {
                                        const isSel = salaryFilterType === t.id;
                                        return (
                                          <button
                                            key={t.id}
                                            type="button"
                                            disabled={lockSalaryFilter("filterType")}
                                            onClick={() => setSalaryFilterType(t.id as any)}
                                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                              isSel ? "bg-[#ff791a] text-white shadow-sm" : "text-slate-650 hover:text-slate-900"
                                            }`}
                                          >
                                            {t.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    )}
                                  </div>
                                </div>
          
                                {/* Criteria Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
                                  {showSalaryFilter("search") && (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search Employee</label>
                                    <div className="relative">
                                      <input id="salary-search-query" name="salarySearchQuery"
                                        type="text"
                                        value={salarySearchQuery}
                                        onChange={(e) => setSalarySearchQuery(e.target.value)}
                                        disabled={lockSalaryFilter("search")}
                                        placeholder="Search code or name..."
                                        className="w-full pl-8 pr-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-[#f57416] disabled:opacity-60"
                                      />
                                      <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    </div>
                                  </div>
                                  )}

                                  {showSalaryFilter("location") && (
                                  <div className="space-y-1.5">
                                    <SearchableMultiSelect
                                      label="Branch/Work Location"
                                      placeholder="All Locations"
                                      options={salaryUniqueLocations}
                                      selected={salaryLocationFilters}
                                      onChange={setSalaryLocationFilters}
                                      disabled={lockSalaryFilter("location")}
                                      containerId="salary-location-filter"
                                    />
                                  </div>
                                  )}

                                  {showSalaryFilter("joinDate") && (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">PF Joining Date Range</label>
                                    <div className="grid grid-cols-2 gap-1 items-center">
                                      <input id="salary-join-start-filter" name="salaryJoinStartFilter"
                                        type="date"
                                        value={salaryJoinStartFilter}
                                        onChange={(e) => setSalaryJoinStartFilter(e.target.value)}
                                        className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                                      />
                                      <input id="salary-join-end-filter" name="salaryJoinEndFilter"
                                        type="date"
                                        value={salaryJoinEndFilter}
                                        onChange={(e) => setSalaryJoinEndFilter(e.target.value)}
                                        disabled={lockSalaryFilter("joinDate")}
                                        className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416] disabled:opacity-60"
                                      />
                                    </div>
                                  </div>
                                  )}

                                  {showSalaryFilter("exitDate") && (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Exit/Leaving Date Range</label>
                                    <div className="grid grid-cols-2 gap-1 items-center">
                                      <input id="salary-exit-start-filter" name="salaryExitStartFilter"
                                        type="date"
                                        value={salaryExitStartFilter}
                                        onChange={(e) => setSalaryExitStartFilter(e.target.value)}
                                        className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                                      />
                                      <input id="salary-exit-end-filter" name="salaryExitEndFilter"
                                        type="date"
                                        value={salaryExitEndFilter}
                                        onChange={(e) => setSalaryExitEndFilter(e.target.value)}
                                        disabled={lockSalaryFilter("exitDate")}
                                        className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416] disabled:opacity-60"
                                      />
                                    </div>
                                  </div>
                                  )}

                                  {showSalaryFilter("grossSalary") && (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Monthly Gross Salary (Rs.)</label>
                                    <div className="grid grid-cols-2 gap-1 items-center">
                                      <input id="salary-min-salary-filter" name="salaryMinSalaryFilter"
                                        type="number"
                                        min={0}
                                        placeholder="Min"
                                        value={salaryMinSalaryFilter}
                                        onChange={(e) => setSalaryMinSalaryFilter(e.target.value)}
                                        className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                                      />
                                      <input id="salary-max-salary-filter" name="salaryMaxSalaryFilter"
                                        type="number"
                                        min={0}
                                        placeholder="Max"
                                        value={salaryMaxSalaryFilter}
                                        onChange={(e) => setSalaryMaxSalaryFilter(e.target.value)}
                                        className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                                      />
                                    </div>
                                  </div>
                                  )}

                                  {showSalaryFilter("dailyWage") && (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Daily Wage (Rs.)</label>
                                    <div className="grid grid-cols-2 gap-1 items-center">
                                      <input id="salary-min-daily-wage-filter" name="salaryMinDailyWageFilter"
                                        type="number"
                                        min={0}
                                        placeholder="Min"
                                        value={salaryMinDailyWageFilter}
                                        onChange={(e) => setSalaryMinDailyWageFilter(e.target.value)}
                                        className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                                      />
                                      <input id="salary-max-daily-wage-filter" name="salaryMaxDailyWageFilter"
                                        type="number"
                                        min={0}
                                        placeholder="Max"
                                        value={salaryMaxDailyWageFilter}
                                        onChange={(e) => setSalaryMaxDailyWageFilter(e.target.value)}
                                        className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                                      />
                                    </div>
                                  </div>
                                  )}

                                  {showSalaryFilter("gender") && (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gender</label>
                                    <select id="salary-gender-filter" name="salaryGenderFilter"
                                      value={salaryGenderFilter}
                                      onChange={(e) => setSalaryGenderFilter(e.target.value)}
                                      disabled={lockSalaryFilter("gender")}
                                      className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] disabled:opacity-60"
                                    >
                                      <option value="All">All Genders</option>
                                      <option value="Male">Male</option>
                                      <option value="Female">Female</option>
                                      <option value="Other">Other</option>
                                    </select>
                                  </div>
                                  )}

                                  {showSalaryFilter("marital") && (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Marital Status</label>
                                    <select id="salary-marital-filter" name="salaryMaritalFilter"
                                      value={salaryMaritalFilter}
                                      onChange={(e) => setSalaryMaritalFilter(e.target.value)}
                                      disabled={lockSalaryFilter("marital")}
                                      className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] disabled:opacity-60"
                                    >
                                      <option value="All">All Statuses</option>
                                      <option value="Single">Single</option>
                                      <option value="Married">Married</option>
                                      <option value="Divorced">Divorced</option>
                                      <option value="Widowed">Widowed</option>
                                    </select>
                                  </div>
                                  )}

                                  {showSalaryFilter("esic") && (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ESIC Insured Status</label>
                                    <select id="salary-esic-filter" name="salaryEsicFilter"
                                      value={salaryEsicFilter}
                                      onChange={(e) => setSalaryEsicFilter(e.target.value)}
                                      disabled={lockSalaryFilter("esic")}
                                      className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] disabled:opacity-60"
                                    >
                                      <option value="All">All Coverage</option>
                                      <option value="Yes">Yes (Insured)</option>
                                      <option value="No">No (Exempt/Excluded)</option>
                                    </select>
                                  </div>
                                  )}

                                  {showSalaryFilter("skills") && (
                                  <div className="space-y-1.5 relative" id="salary-skill-multiselect-container">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Skill Category</label>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsSalarySkillDropdownOpen(!isSalarySkillDropdownOpen);
                                          setIsSalaryRoleDropdownOpen(false);
                                        }}
                                        className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                                      >
                                        <span className="truncate">
                                          {salarySkillFilters.length === 0 
                                            ? "All Categories" 
                                            : `${salarySkillFilters.length} Selected`}
                                        </span>
                                        <span className="text-[10px] text-slate-400">▼</span>
                                      </button>
                                  
                                      {isSalarySkillDropdownOpen && (
                                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto">
                                          <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                            <span className="text-[10px] text-slate-400 font-bold">Categories</span>
                                            <button
                                              type="button"
                                              onClick={() => setSalarySkillFilters([])}
                                              className="text-[9px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                                            >
                                              Clear All
                                            </button>
                                          </div>
                                          {["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"].map(cat => {
                                            const isChecked = salarySkillFilters.includes(cat);
                                            const toggle = () => {
                                              if (isChecked) {
                                                setSalarySkillFilters(prev => prev.filter(c => c !== cat));
                                              } else {
                                                setSalarySkillFilters(prev => [...prev, cat]);
                                              }
                                            };
                                            return (
                                              <label key={cat} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                                <input id="checkbox-field-5587" name="checkbox_5587"
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={toggle}
                                                  className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                                />
                                                <span className="font-medium">{cat}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  )}

                                  {showSalaryFilter("roles") && (
                                  <div className="space-y-1.5" id="salary-role-multiselect-container">
                                    <SearchableMultiSelect
                                      label="Job Role"
                                      placeholder="All Roles"
                                      options={customRoles}
                                      selected={salaryRoleFilters}
                                      onChange={setSalaryRoleFilters}
                                      containerId="salary-role-filter"
                                    />
                                  </div>
                                  )}

                                  {showSalaryFilter("paymentStatus") && (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Payment Status</label>
                                    <select id="salary-payment-status-filter" name="salaryPaymentStatusFilter"
                                      value={salaryPaymentStatusFilter}
                                      onChange={(e) => setSalaryPaymentStatusFilter(e.target.value as "All" | "Unpaid" | "Paid" | "Hold")}
                                      disabled={lockSalaryFilter("paymentStatus")}
                                      className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] disabled:opacity-60"
                                    >
                                      <option value="All">All Statuses</option>
                                      <option value="Unpaid">Unpaid</option>
                                      <option value="Paid">Paid</option>
                                      <option value="Hold">Hold</option>
                                    </select>
                                  </div>
                                  )}

                                  {/* Action Result / Matched Employees Box */}
                                  <div className="col-span-1 sm:col-span-2 md:col-span-4 flex justify-between items-center bg-[#f57416]/10 border border-[#f57416]/20 rounded-xl p-3 mt-1">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2.5 h-2.5 bg-[#f57416] rounded-full animate-pulse"></span>
                                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Active Criteria Applied</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Matched Personnel</span>
                                      <span className="text-sm font-black text-[#f57416]">{filteredSalaryEmployees.length} records</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
          
                              {/* 2. Summary Dashboard Metrics (Reactive to Active Month & Filters) */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="payroll-overview-bento">
                                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#ff791a] flex items-center justify-center text-lg shadow-xs shrink-0">
                                    💰
                                  </div>
                                  <div className="min-w-0 flex-1 text-left">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Gross Payroll</span>
                                    <span className="text-sm font-extrabold text-slate-800 block whitespace-nowrap tabular-nums mt-0.5">
                                      ₹{filteredSalaryEmployees.reduce((sum, e) => sum + (Number(getSalaryColumnValue(e, "Gross Salary (Monthly)", selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtEnabled)) || 0), 0).toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                </div>
          
                                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-xs shrink-0">
                                    🏦
                                  </div>
                                  <div className="min-w-0 flex-1 text-left">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Net Payable</span>
                                    <span className="text-sm font-extrabold text-emerald-700 block whitespace-nowrap tabular-nums mt-0.5">
                                      ₹{filteredSalaryEmployees.reduce((sum, e) => sum + (Number(getSalaryColumnValue(e, "Net Payable", selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtEnabled)) || 0), 0).toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                </div>
          
                                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center text-lg shadow-xs shrink-0">
                                    📉
                                  </div>
                                  <div className="min-w-0 flex-1 text-left">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Deductions ({selectedMonth})</span>
                                    <span className="text-sm font-extrabold text-rose-700 block whitespace-nowrap tabular-nums mt-0.5">
                                      ₹{filteredSalaryEmployees.reduce((sum, e) => sum + (Number(getSalaryColumnValue(e, "Total Deductions", selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtEnabled)) || 0), 0).toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                </div>
          
                                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shadow-xs shrink-0">
                                    🏢
                                  </div>
                                  <div className="min-w-0 flex-1 text-left">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Employer Liability</span>
                                    <span className="text-sm font-extrabold text-indigo-700 block whitespace-nowrap tabular-nums mt-0.5">
                                      ₹{filteredSalaryEmployees.reduce((sum, e) => {
                                        const erPf = Number(getSalaryColumnValue(e, "Employer PF (13%)", selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtEnabled)) || 0;
                                        const erEsic = Number(getSalaryColumnValue(e, "Employer ESIC (3.25%)", selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtEnabled)) || 0;
                                        return sum + erPf + erEsic;
                                      }, 0).toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                </div>
                              </div>
          
                              {/* 3. Scrollable Payroll Sheet Table & Action Buttons */}
                              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4 text-left">
                                  <div>
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                      Payroll Calculation Sheet — {selectedMonth}
                                    </h4>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      {selectedMonthHasMarkedAttendance
                                        ? `Live computations for employees with attendance marked in ${selectedMonth} (${filteredSalaryEmployees.length} shown). Double-click or select perks to edit values dynamically.`
                                        : `No attendance marked for ${selectedMonth} yet. Mark attendance in the Attendance tab to populate this sheet.`}
                                    </p>
                                    {selectedSalaryEmployeeIds.length > 0 && (
                                      <div className="flex items-center gap-2 mt-1.5 animate-fade-in">
                                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200/50 shadow-2xs">
                                          {selectedSalaryEmployeeIds.length} employee{selectedSalaryEmployeeIds.length > 1 ? 's' : ''} selected
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedSalaryEmployeeIds([])}
                                          className="text-[10px] font-extrabold text-slate-400 hover:text-slate-600 underline cursor-pointer transition uppercase"
                                        >
                                          Clear Selection
                                        </button>
          
                                        <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200/60 pl-3">
                                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Bulk Status:</span>
                                          {canEditSalary && (
                                          <>
                                          <button
                                            type="button"
                                            onClick={() => handleBulkUpdatePaymentStatus("Paid")}
                                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] rounded-md shadow-2xs transition cursor-pointer"
                                          >
                                            Mark Paid
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleBulkUpdatePaymentStatus("Hold")}
                                            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[9px] rounded-md shadow-2xs transition cursor-pointer"
                                          >
                                            Hold Salary
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleBulkUpdatePaymentStatus("Unpaid")}
                                            className="px-2 py-0.5 bg-slate-550 hover:bg-slate-600 text-white font-bold text-[9px] rounded-md shadow-2xs transition cursor-pointer"
                                          >
                                            Mark Unpaid
                                          </button>
                                          </>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const dataToDownload = selectedSalaryEmployeeIds.length > 0
                                          ? filteredSalaryEmployees.filter(emp => selectedSalaryEmployeeIds.includes(emp.id))
                                          : filteredSalaryEmployees;
                                        const headers = [
                                          "Employee Code",
                                          "Employee Name",
                                          "Total Salary",
                                          "Gross Salary (Monthly)",
                                          "Employer PF (13%)",
                                          "Employer ESIC (3.25%)",
                                          "Employee PF (12%)",
                                          "Employee ESIC (0.75%)",
                                          "Professional Tax (PT)",
                                          "Advance Bal. (" + selectedMonth + ")",
                                          "Uniform Bal. (" + selectedMonth + ")",
                                          "Penalty Bal. (" + selectedMonth + ")",
                                          "Total Deductions",
                                          "Net Salary",
                                          "Food Perk",
                                          "Accommodation Perk",
                                          "Conveyance Perk",
                                          "Net Payable",
                                          "Payment Status"
                                        ];
                                        const rows = dataToDownload.map(e => {
                                          const monthData = attendanceDb[selectedMonth] || {};
                                          const empData = monthData[e.id] || {};
                                          const daysInMonth = getDaysInSelectedMonth(selectedMonth);
                                          const presents = countMonthAttendance(
                                            empData,
                                            daysInMonth,
                                            (day) => isEmployeeExitedOnDayStatic(e, selectedMonth, day),
                                            { workingDaysType: e.workingDaysType, monthStr: selectedMonth },
                                          ).presents;

                                          const fullMonthSalary = resolveFullMonthSalary(e, selectedMonth);
                                          const { gross, basic } = computeProratedGrossAndBasic(
                                            e,
                                            presents,
                                            empData,
                                            selectedMonth,
                                          );
          
                                          const isCompliant = isPfEsicCompliant(e, locationCompliance);
                                          const isPtEnabled = isProfessionalTaxApplicable(e, locationPtEnabled);
          
                                          const { employeePf: empPf, employerPf: erPf } = calculatePfAmounts(gross, {
                                            mode: e.pfCalculationMode,
                                            monthlyBasic: basic,
                                            isCompliant,
                                          });
                                          const isEsicCovered = isEmployeeEsicCovered(gross, esicEligibilityLimit, isCompliant, e.esic);
                                          const erEsic = isEsicCovered ? (gross * 0.0325) : 0;
                                          const empEsic = isEsicCovered ? (gross * 0.0075) : 0;
                                          const pt = calculateProfessionalTax(gross, {
                                            isPtEnabled,
                                            gender: e.gender,
                                            month: selectedMonth,
                                          });
                                      
                                          const ledger = e.monthlyLedger?.[selectedMonth];
                                          const adv = ledger ? safeNumber(ledger.advance) : 0;
                                          const pen = ledger ? safeNumber(ledger.penalty) : 0;
                                          const uniform = ledger ? safeNumber(ledger.uniform) : 0;
                                      
                                          const food = ledger ? safeNumber(ledger.foodPerk) : 0;
                                          const acc = ledger ? safeNumber(ledger.accommodationPerk) : 0;
                                          const conv = ledger ? safeNumber(ledger.conveyancePerk) : 0;
                                      
                                          const netSalaryVal = safeNumber(gross) - safeNumber(empPf) - safeNumber(empEsic) - safeNumber(pt);
                                          const totalDeductionsVal = safeNumber(empPf) + safeNumber(empEsic) + safeNumber(pt) + safeNumber(adv) + safeNumber(pen) + safeNumber(uniform);
                                          const netPayableVal = safeNumber(netSalaryVal) - safeNumber(adv) - safeNumber(pen) - safeNumber(uniform) + safeNumber(food) + safeNumber(acc) + safeNumber(conv);
                                          return [
                                            e.employeeCode,
                                            e.nameAsPerAadharColumn || e.nameAsPerAadhar,
                                            fullMonthSalary,
                                            gross,
                                            isCompliant ? Math.round(erPf) : "",
                                            isCompliant ? Math.round(erEsic) : "",
                                            isCompliant ? Math.round(empPf) : "",
                                            isCompliant ? Math.round(empEsic) : "",
                                            isPtEnabled ? pt : "",
                                            adv,
                                            uniform,
                                            pen,
                                            Math.round(totalDeductionsVal),
                                            Math.round(netSalaryVal),
                                            food,
                                            acc,
                                            conv,
                                            presents <= 0 ? 0 : Math.round(Math.max(0, netPayableVal)),
                                            ledger?.paymentStatus || "Unpaid"
                                          ];
                                        });
                                        const csvContent = "data:text/csv;charset=utf-8," 
                                          + [headers.map(h => quoteCSVValue(h)).join(","), ...rows.map(r => r.map(c => quoteCSVValue(c)).join(",")), (() => {
                                            const sumIndices = headers
                                              .map((header, index) => ({ header, index }))
                                              .filter(({ header }) => header !== "Employee Code" && header !== "Employee Name" && header !== "Payment Status")
                                              .map(({ index }) => index);
                                            const totals = sumExportRows(rows, sumIndices);
                                            const grandTotalRow = buildLabeledGrandTotalRow(headers.length, 1, totals);
                                            return grandTotalRow.map(c => quoteCSVValue(c)).join(",");
                                          })()].join("\n");
                                        const encodedUri = encodeURI(csvContent);
                                        const link = document.createElement("a");
                                        link.setAttribute("href", encodedUri);
                                        link.setAttribute("download", `FlexHRM_Salary_${selectedMonth.replace(/\s+/g, '_')}_Sheet_${new Date().toISOString().split('T')[0]}.csv`);
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        triggerSuccess(`Payroll sheet for ${selectedMonth} exported successfully.`);
          
                                        fetch("/api/audit-logs", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            action: "DOWNLOAD_SALARY_CSV",
                                            target: `Salary CSV Sheet: Downloaded payroll calculations CSV sheet for ${selectedMonth} containing details of ${dataToDownload.length} employees.`,
                                            details: { month: selectedMonth, recordCount: dataToDownload.length, format: "CSV" }
                                          })
                                        }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
                                      }}
                                      className="px-3.5 py-1.5 bg-[#f57416] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                                    >
                                      <FileSpreadsheet size={13} className="stroke-[2.5]" /> Export CSV {selectedSalaryEmployeeIds.length > 0 && `(${selectedSalaryEmployeeIds.length})`}
                                    </button>
          
                                    <button
                                      type="button"
                                      disabled={filteredSalaryEmployees.length === 0 || visibleSalaryColumns.length === 0}
                                      onClick={() => {
                                        const dataToDownload = selectedSalaryEmployeeIds.length > 0
                                          ? filteredSalaryEmployees.filter(emp => selectedSalaryEmployeeIds.includes(emp.id))
                                          : filteredSalaryEmployees;
                                        downloadSalaryExcel(dataToDownload, visibleSalaryColumns, salaryLocationFilters, selectedMonth);
                                      }}
                                      className="px-3.5 py-1.5 bg-[#107c41] hover:bg-[#0d6233] disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                                    >
                                      <FileSpreadsheet size={13} className="stroke-[2.5]" /> Export Excel {selectedSalaryEmployeeIds.length > 0 && `(${selectedSalaryEmployeeIds.length})`}
                                    </button>
          
                                    <button
                                      type="button"
                                      disabled={filteredSalaryEmployees.length === 0 || visibleSalaryColumns.length === 0}
                                      onClick={() => {
                                        const dataToDownload = selectedSalaryEmployeeIds.length > 0
                                          ? filteredSalaryEmployees.filter(emp => selectedSalaryEmployeeIds.includes(emp.id))
                                          : filteredSalaryEmployees;
                                        downloadSalaryPDF(dataToDownload, visibleSalaryColumns, salaryLocationFilters, selectedMonth);
                                      }}
                                      className="px-3.5 py-1.5 bg-[#d62222] hover:bg-[#b51c1c] disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                                    >
                                      <FileText size={13} className="stroke-[2.5]" /> Export PDF {selectedSalaryEmployeeIds.length > 0 && `(${selectedSalaryEmployeeIds.length})`}
                                    </button>

                                    {canEditSalary && (
                                    <button
                                      type="button"
                                      disabled={filteredSalaryEmployees.length === 0 || isExportingBulkPay}
                                      onClick={() => {
                                        const dataToDownload = selectedSalaryEmployeeIds.length > 0
                                          ? filteredSalaryEmployees.filter(emp => selectedSalaryEmployeeIds.includes(emp.id))
                                          : filteredSalaryEmployees;
                                        handleExportAxisBulkPay(dataToDownload.map((e) => e.id));
                                      }}
                                      className="px-3.5 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                                      title="Generate, download, and save Axis Bank Bulk Pay file (Excel 97–2003)"
                                    >
                                      {isExportingBulkPay ? (
                                        <><RotateCw size={13} className="stroke-[2.5] animate-spin" /> Saving...</>
                                      ) : (
                                        <><IndianRupee size={13} className="stroke-[2.5]" /> Bulk Pay {selectedSalaryEmployeeIds.length > 0 && `(${selectedSalaryEmployeeIds.length})`}</>
                                      )}
                                    </button>
                                    )}

                                    <button
                                      type="button"
                                      disabled={filteredSalaryEmployees.length === 0}
                                      onClick={() => {
                                        const dataToDownload = selectedSalaryEmployeeIds.length > 0
                                          ? filteredSalaryEmployees.filter(emp => selectedSalaryEmployeeIds.includes(emp.id))
                                          : filteredSalaryEmployees;
                                        downloadPfSalaryExcel(dataToDownload, salaryLocationFilters, selectedMonth);
                                      }}
                                      className="px-3.5 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                                      title="Download PF Salary register in standard PF SAL format (Excel)"
                                    >
                                      <Landmark size={13} className="stroke-[2.5]" /> PF Salary {selectedSalaryEmployeeIds.length > 0 && `(${selectedSalaryEmployeeIds.length})`}
                                    </button>
                                  </div>
                                </div>
          
                                {lastSavedBulkPay && activeSidebarTab === "Salary" && (
                                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
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
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadBulkPayArchive(lastSavedBulkPay.id, lastSavedBulkPay.filename)}
                                        className="px-3 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
                                      >
                                        <Download size={11} />
                                        Re-download
                                        <span className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-black leading-none">
                                          {lastSavedBulkPay.downloadCount ?? 0}
                                        </span>
                                      </button>
                                      {canDeleteSalary && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteBulkPayArchive(lastSavedBulkPay.id)}
                                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[10px] font-bold cursor-pointer"
                                        >
                                          Delete
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setActiveSidebarTab("Saved Bulk Pay")}
                                        className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-[10px] font-bold cursor-pointer"
                                      >
                                        View All
                                      </button>
                                    </div>
                                  </div>
                                )}
          
                                {!salaryColumnPickerLocked && canViewSalary && (
                                <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 space-y-4 text-left animate-fade-in">
                                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/60 pb-3">
                                    <div>
                                      <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Wrench size={13} className="text-[#f57416]" />
                                        {canEditSalary
                                          ? "Configure Calculations Columns & Templates"
                                          : "Visible Columns"}
                                      </h5>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        {canEditSalary
                                          ? "Customize columns displayed in the calculation sheet and export documents. Save layouts as custom templates for future use."
                                          : "Choose which columns to display in the salary sheet. Your role may limit which columns are available."}
                                      </p>
                                    </div>
          
                                    {canEditSalary && (
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-lg shrink-0 max-w-full">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">📋 Template:</span>
                                        <select id="active-salary-template-name" name="activeSalaryTemplateName"
                                          value={activeSalaryTemplateName}
                                          onChange={(e) => handleLoadSalaryTemplate(e.target.value)}
                                          className="px-2 py-0.5 border border-slate-200 bg-white rounded text-[10px] font-bold text-slate-800 focus:outline-none min-w-[130px] max-w-[140px] truncate"
                                        >
                                          <option value="">-- Layout --</option>
                                          {savedSalaryTemplates.map((t: any) => (
                                            <option key={t.name} value={t.name}>{t.name}</option>
                                          ))}
                                        </select>
                                        {activeSalaryTemplateName && canDeleteSalary && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteSalaryTemplate(activeSalaryTemplateName)}
                                            className="text-red-500 hover:text-red-700 font-extrabold text-[9px] hover:bg-red-50 px-1 py-0.5 rounded cursor-pointer transition uppercase"
                                            title="Delete template"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
          
                                      <span className="hidden sm:inline text-slate-350">|</span>
          
                                      <form onSubmit={handleSaveSalaryTemplate} className="flex items-center gap-1">
                                        <input id="new-salary-template-name" name="newSalaryTemplateName"
                                          type="text"
                                          placeholder="Save layout name..."
                                          value={newSalaryTemplateName}
                                          onChange={(e) => setNewSalaryTemplateName(e.target.value)}
                                          className="px-2 py-0.5 border border-slate-200 bg-white rounded text-[10px] font-medium text-slate-700 focus:outline-none focus:border-[#f57416] w-[130px]"
                                        />
                                        <button
                                          type="submit"
                                          disabled={!newSalaryTemplateName.trim()}
                                          className="px-2 py-0.5 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-40 text-white font-extrabold text-[9px] uppercase tracking-wider rounded transition cursor-pointer shrink-0"
                                        >
                                          Save
                                        </button>
                                      </form>
                                    </div>
                                    )}
                                  </div>
          
                                  {/* Dynamic Bento Box Categories */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                                    {[
                                      {
                                        name: "Details",
                                        color: "bg-slate-100/75 text-slate-750 border-slate-200",
                                        headers: ["Employee Code", "Employee Name", "Skill Category", "Job Role", "Present Days", "Payment Status"]
                                      },
                                      {
                                        name: "Gross Pay",
                                        color: "bg-slate-100/75 text-slate-750 border-slate-200",
                                        headers: ["Daily Wage", "Total Salary", "Gross Salary (Monthly)", "Basic Salary"]
                                      },
                                      {
                                        name: "Employer Liability",
                                        color: "bg-blue-50/80 text-blue-700 border-blue-200",
                                        headers: ["Employer PF (13%)", "Employer ESIC (3.25%)"]
                                      },
                                      {
                                        name: "Employee Deductions",
                                        color: "bg-rose-50/80 text-rose-700 border-rose-200",
                                        headers: ["Employee PF (12%)", "Employee ESIC (0.75%)", "Professional Tax (PT)", "Advance Balance", "Uniform Deductions", "Penalty Balance"]
                                      },
                                      {
                                        name: "Total Deductions",
                                        color: "bg-rose-100/60 text-rose-800 border-rose-200",
                                        headers: ["Total Deductions"]
                                      },
                                      {
                                        name: "Net Salary",
                                        color: "bg-amber-50/80 text-amber-700 border-amber-200",
                                        headers: ["Net Salary"]
                                      },
                                      {
                                        name: "Extra Perks",
                                        color: "bg-indigo-50/80 text-indigo-700 border-indigo-200",
                                        headers: ["Food Perk", "Accommodation Perk", "Conveyance Perk"]
                                      },
                                      {
                                        name: "Net Payable",
                                        color: "bg-emerald-50/80 text-emerald-800 border-emerald-250",
                                        headers: ["Net Payable"]
                                      }
                                    ].filter((group) => group.headers.some((header) => allowSalaryColumn(header))).map(group => {
                                      const visibleGroupHeaders: SalaryColumn[] = group.headers.filter(
                                        (header): header is SalaryColumn => allowSalaryColumn(header),
                                      );
                                      const groupCheckedCount = visibleGroupHeaders.filter(h => visibleSalaryColumns.includes(h)).length;
                                      const isAllGroupChecked = groupCheckedCount === visibleGroupHeaders.length && visibleGroupHeaders.length > 0;
                                      const isSomeGroupChecked = groupCheckedCount > 0 && !isAllGroupChecked;
          
                                      return (
                                        <div key={group.name} className="border border-slate-200 rounded-lg overflow-hidden bg-white flex flex-col text-left text-[11px] shadow-2xs">
                                          {/* Group Header Checkbox */}
                                          <div className={`px-2 py-1 border-b border-inherit flex items-center justify-between font-bold ${group.color}`}>
                                            <label className="flex items-center gap-1.5 min-w-0 cursor-pointer select-none w-full">
                                              <input id="checkbox-field-6083" name="checkbox_6083"
                                                type="checkbox"
                                                ref={el => {
                                                  if (el) el.indeterminate = isSomeGroupChecked;
                                                }}
                                                checked={isAllGroupChecked}
                                                onChange={() => toggleSalaryColumnGroup(visibleGroupHeaders, isAllGroupChecked)}
                                                className="w-3 h-3 rounded border-slate-300 text-[#f57416] focus:ring-[#f57416] cursor-pointer"
                                              />
                                              <span className="text-[9px] font-black uppercase tracking-wider truncate">{group.name}</span>
                                            </label>
                                          </div>
          
                                          {/* Group Sub-headers (Children Checkboxes) */}
                                          <div className="p-2 space-y-1 grow bg-white">
                                            {visibleGroupHeaders.map(header => {
                                              const isChecked = visibleSalaryColumns.includes(header);
                                          
                                              // Shorten names for clean fit inside small columns
                                              let displayName: string = header;
                                              if (header === "Skill Category") displayName = "Skill Cat.";
                                              else if (header === "Job Role") displayName = "Role";
                                              else if (header === "Total Salary") displayName = "Total Sal";
                                              else if (header === "Daily Wage") displayName = "Daily Wage";
                                              else if (header === "Gross Salary (Monthly)") displayName = "Gross";
                                              else if (header === "Basic Salary") displayName = "Basic";
                                              else if (header === "Employer PF (13%)") displayName = "PF (13%)";
                                              else if (header === "Employer ESIC (3.25%)") displayName = "ESIC (3.25%)";
                                              else if (header === "Employee PF (12%)") displayName = "PF (12%)";
                                              else if (header === "Employee ESIC (0.75%)") displayName = "ESIC (0.75%)";
                                              else if (header === "Professional Tax (PT)") displayName = "PT";
                                              else if (header === "Advance Balance") displayName = "Advance";
                                              else if (header === "Uniform Deductions") displayName = "Uniform";
                                              else if (header === "Penalty Balance") displayName = "Penalty";
                                              else if (header === "Food Perk") displayName = "Food";
                                              else if (header === "Accommodation Perk") displayName = "Accom.";
                                              else if (header === "Conveyance Perk") displayName = "Conv.";
                                              else if (header === "Payment Status") displayName = "Status";
                                          
                                              return (
                                                <label key={header} className="flex items-start gap-1.5 text-[10px] text-slate-650 hover:text-slate-900 cursor-pointer select-none">
                                                  <input id="checkbox-field-6130" name="checkbox_6130"
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleSalaryColumn(header, !isChecked)}
                                                    className="w-3 h-3 mt-0.5 rounded border-slate-300 text-[#f57416] focus:ring-[#f57416]"
                                                  />
                                                  <span className="font-semibold text-slate-700 leading-tight break-words">{displayName}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                )}

                                {/* Responsive Scrollable Table Container */}
                                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 border-b border-slate-100 bg-white">
                                    <Switch
                                      defaultChecked
                                      onCheckedChange={handleSalaryStickyChange}
                                      aria-label="Pin Employee Details column"
                                    />
                                    <span className="text-[10px] font-medium text-slate-500">Sticky employee details</span>
                                  </div>
                                  <div
                                    ref={setSalaryStickyContainer}
                                    className="overflow-x-auto max-h-[480px] overflow-y-auto"
                                    id="salary-sheet-scroller"
                                  >
                                  <table className="w-max min-w-full text-xs text-left border-collapse bg-white">
                                    <colgroup>
                                      <col className="w-[48px]" />
                                      {(visibleSalaryColumns.includes("Employee Code") || visibleSalaryColumns.includes("Employee Name")) && (
                                        <col className="w-[200px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Skill Category") && (
                                        <col className="w-[120px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Job Role") && (
                                        <col className="w-[120px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Present Days") && (
                                        <col className="w-[85px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Daily Wage") && (
                                        <col className="w-[120px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Total Salary") && (
                                        <col className="w-[140px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Gross Salary (Monthly)") && (
                                        <col className="w-[140px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Basic Salary") && (
                                        <col className="w-[140px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Employer PF (13%)") && (
                                        <col className="w-[130px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Employer ESIC (3.25%)") && (
                                        <col className="w-[130px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Employee PF (12%)") && (
                                        <col className="w-[130px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Employee ESIC (0.75%)") && (
                                        <col className="w-[130px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Professional Tax (PT)") && (
                                        <col className="w-[110px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Advance Balance") && (
                                        <col className="w-[120px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Uniform Deductions") && (
                                        <col className="w-[120px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Penalty Balance") && (
                                        <col className="w-[120px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Total Deductions") && (
                                        <col className="w-[140px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Net Salary") && (
                                        <col className="w-[140px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Food Perk") && (
                                        <col className="w-[115px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Accommodation Perk") && (
                                        <col className="w-[115px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Conveyance Perk") && (
                                        <col className="w-[115px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Net Payable") && (
                                        <col className="w-[140px]" />
                                      )}
                                      {visibleSalaryColumns.includes("Payment Status") && (
                                        <col className="w-[130px]" />
                                      )}
                                    </colgroup>
                                    <thead className="bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-wider select-none border-b border-slate-200">
                                      <tr>
                                        <th rowSpan={2} className="salary-sticky-select sticky top-0 z-30 px-2.5 py-2.5 border-r border-slate-200 bg-slate-100 text-center w-[48px] min-w-[48px] max-w-[48px] align-middle">
                                          <input
                                            id="salary-select-all"
                                            name="salarySelectAll"
                                            type="checkbox"
                                            checked={filteredSalaryEmployees.length > 0 && selectedSalaryEmployeeIds.length === filteredSalaryEmployees.length}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedSalaryEmployeeIds(filteredSalaryEmployees.map(emp => emp.id));
                                              } else {
                                                setSelectedSalaryEmployeeIds([]);
                                              }
                                            }}
                                            className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416] cursor-pointer"
                                            title="Select All Employees"
                                          />
                                        </th>
                                        {(visibleSalaryColumns.includes("Employee Code") || visibleSalaryColumns.includes("Employee Name")) && (
                                          <th className="salary-sticky-details sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 w-[200px] min-w-[200px] max-w-[200px]">Employee Details</th>
                                        )}
                                        {visibleSalaryColumns.includes("Skill Category") && (
                                          <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Skill Category</th>
                                        )}
                                        {visibleSalaryColumns.includes("Job Role") && (
                                          <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Job Role</th>
                                        )}
                                        {visibleSalaryColumns.includes("Present Days") && (
                                          <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Days</th>
                                        )}
                                        {visibleSalaryColumns.includes("Daily Wage") && (
                                          <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Daily Wage</th>
                                        )}
                                        {visibleSalaryColumns.includes("Total Salary") && (
                                          <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Total Salary</th>
                                        )}
                                        {visibleSalaryColumns.includes("Gross Salary (Monthly)") && (
                                          <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Gross Pay</th>
                                        )}
                                        {visibleSalaryColumns.includes("Basic Salary") && (
                                          <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Basic Pay</th>
                                        )}
                                        {(() => {
                                          const count = (["Employer PF (13%)", "Employer ESIC (3.25%)"] as const).filter(
                                            (c) => visibleSalaryColumns.includes(c),
                                          ).length;
                                          return count > 0 ? (
                                            <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-blue-50 text-blue-700 text-center" colSpan={count}>Employer Liability</th>
                                          ) : null;
                                        })()}
                                        {(() => {
                                          const count = (
                                            [
                                              "Employee PF (12%)",
                                              "Employee ESIC (0.75%)",
                                              "Professional Tax (PT)",
                                              "Advance Balance",
                                              "Uniform Deductions",
                                              "Penalty Balance",
                                            ] as const
                                          ).filter((c) => visibleSalaryColumns.includes(c)).length;
                                          return count > 0 ? (
                                            <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-rose-50 text-rose-700 text-center" colSpan={count}>Employee Deductions</th>
                                          ) : null;
                                        })()}
                                        {visibleSalaryColumns.includes("Total Deductions") && (
                                          <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-rose-100 text-rose-800 text-center">Total Deductions</th>
                                        )}
                                        {visibleSalaryColumns.includes("Net Salary") && (
                                          <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-amber-50 text-amber-700 text-center">Net Salary</th>
                                        )}
                                        {(() => {
                                          const count = (["Food Perk", "Accommodation Perk", "Conveyance Perk"] as const).filter(
                                            (c) => visibleSalaryColumns.includes(c),
                                          ).length;
                                          return count > 0 ? (
                                            <th className="sticky top-0 z-20 px-3 py-2.5 border-r border-slate-200 bg-indigo-50 text-indigo-700 text-center" colSpan={count}>Extra Perks</th>
                                          ) : null;
                                        })()}
                                        {visibleSalaryColumns.includes("Net Payable") && (
                                          <th className="sticky top-0 z-20 px-3 py-2.5 bg-emerald-50 text-emerald-800 text-right">Net Payable</th>
                                        )}
                                        {visibleSalaryColumns.includes("Payment Status") && (
                                          <th rowSpan={2} className="sticky top-0 z-30 px-3 py-2.5 border-l border-slate-200 bg-violet-50 text-violet-900 text-center font-bold align-middle">Status</th>
                                        )}
                                      </tr>
                                      <tr className="border-t border-slate-200">
                                        {(visibleSalaryColumns.includes("Employee Code") || visibleSalaryColumns.includes("Employee Name")) && (
                                          <th className="salary-sticky-details sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 font-bold w-[200px] min-w-[200px] max-w-[200px]">Code & Name</th>
                                        )}
                                        {visibleSalaryColumns.includes("Skill Category") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center font-bold">Skill Category</th>
                                        )}
                                        {visibleSalaryColumns.includes("Job Role") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center font-bold">Job Role</th>
                                        )}
                                        {visibleSalaryColumns.includes("Present Days") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center font-bold">Present Days</th>
                                        )}
                                        {visibleSalaryColumns.includes("Daily Wage") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center font-bold">Daily Wage</th>
                                        )}
                                        {visibleSalaryColumns.includes("Total Salary") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center font-bold">Total Salary (Full Month)</th>
                                        )}
                                        {visibleSalaryColumns.includes("Gross Salary (Monthly)") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center font-bold">Gross (Monthly)</th>
                                        )}
                                        {visibleSalaryColumns.includes("Basic Salary") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center font-bold">Basic Salary</th>
                                        )}
                                    
                                        {visibleSalaryColumns.includes("Employer PF (13%)") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-blue-50 text-blue-800">PF</th>
                                        )}
                                        {visibleSalaryColumns.includes("Employer ESIC (3.25%)") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-blue-50 text-blue-800">ESIC</th>
                                        )}
                                    
                                        {visibleSalaryColumns.includes("Employee PF (12%)") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50 text-rose-800">PF</th>
                                        )}
                                        {visibleSalaryColumns.includes("Employee ESIC (0.75%)") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50 text-rose-800">ESIC</th>
                                        )}
                                        {visibleSalaryColumns.includes("Professional Tax (PT)") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50 text-rose-800">PT</th>
                                        )}
                                        {visibleSalaryColumns.includes("Advance Balance") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50 text-rose-800">Adv</th>
                                        )}
                                        {visibleSalaryColumns.includes("Uniform Deductions") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50 text-rose-800">Uniform</th>
                                        )}
                                        {visibleSalaryColumns.includes("Penalty Balance") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50 text-rose-800">Pen</th>
                                        )}
                                    
                                        {visibleSalaryColumns.includes("Total Deductions") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-rose-100 text-rose-900 text-center font-bold">Total Ded.</th>
                                        )}
                                        {visibleSalaryColumns.includes("Net Salary") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-amber-50 text-amber-800 text-center font-bold">Net Salary</th>
                                        )}
                                    
                                        {visibleSalaryColumns.includes("Food Perk") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-indigo-50 text-indigo-800">Food</th>
                                        )}
                                        {visibleSalaryColumns.includes("Accommodation Perk") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-indigo-50 text-indigo-800">Accom</th>
                                        )}
                                        {visibleSalaryColumns.includes("Conveyance Perk") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-indigo-50 text-indigo-800">Conv</th>
                                        )}
                                    
                                        {visibleSalaryColumns.includes("Net Payable") && (
                                          <th className="sticky top-[34px] z-20 px-3 py-2.5 border-r border-slate-200 bg-emerald-50 text-emerald-800 text-right font-black">Net Payable</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150">
                                      {filteredSalaryEmployees.length === 0 ? (
                                        <tr>
                                          <td 
                                            colSpan={
                                              1 +
                                              ((visibleSalaryColumns.includes("Employee Code") || visibleSalaryColumns.includes("Employee Name")) ? 1 : 0) +
                                              ([
                                                "Skill Category",
                                                "Job Role",
                                                "Present Days",
                                                "Daily Wage",
                                                "Total Salary",
                                                "Gross Salary (Monthly)",
                                                "Basic Salary",
                                                "Employer PF (13%)",
                                                "Employer ESIC (3.25%)",
                                                "Employee PF (12%)",
                                                "Employee ESIC (0.75%)",
                                                "Professional Tax (PT)",
                                                "Advance Balance",
                                                "Uniform Deductions",
                                                "Penalty Balance",
                                                "Total Deductions",
                                                "Net Salary",
                                                "Food Perk",
                                                "Accommodation Perk",
                                                "Conveyance Perk",
                                                "Net Payable",
                                                "Payment Status",
                                              ] as const).filter((c) => visibleSalaryColumns.includes(c)).length
                                            } 
                                            className="p-8 text-center text-xs text-slate-400 font-medium"
                                          >
                                            {selectedMonthHasMarkedAttendance
                                              ? "No employee salary data matches the current filters."
                                              : `No attendance has been marked for ${selectedMonth}. Mark employee attendance in the Attendance tab to view salary calculations.`}
                                          </td>
                                        </tr>
                                      ) : (
                                        filteredSalaryEmployees.map((emp) => {
                                          const monthData = attendanceDb[selectedMonth] || {};
                                          const empData = monthData[emp.id] || {};
                                          const daysInMonth = getDaysInSelectedMonth(selectedMonth);
                                          const presents = countMonthAttendance(
                                            empData,
                                            daysInMonth,
                                            (day) => isEmployeeExitedOnDayStatic(emp, selectedMonth, day),
                                            { workingDaysType: emp.workingDaysType, monthStr: selectedMonth },
                                          ).presents;

                                           const fullMonthSalary = resolveFullMonthSalary(emp, selectedMonth);

                                           const { gross, basic } = computeProratedGrossAndBasic(
                                             emp,
                                             presents,
                                             empData,
                                             selectedMonth,
                                           );
          
                                           const isCompliant = isPfEsicCompliant(emp, locationCompliance);
                                           const isPtEnabled = isProfessionalTaxApplicable(emp, locationPtEnabled);
          
                                           const { employeePf: empPf, employerPf: erPf } = calculatePfAmounts(gross, {
                                             mode: emp.pfCalculationMode,
                                             monthlyBasic: basic,
                                             isCompliant,
                                           });
                                           const isEsicCovered = isEmployeeEsicCovered(gross, esicEligibilityLimit, isCompliant, emp.esic);
                                           const erEsic = isEsicCovered ? (gross * 0.0325) : 0;
                                           const ledger = emp.monthlyLedger?.[selectedMonth];
                                           const adv = ledger ? safeNumber(ledger.advance) : 0;
                                           const pen = ledger ? safeNumber(ledger.penalty) : 0;
                                           const uniform = ledger ? safeNumber(ledger.uniform) : 0;
                                       
                                           const food = ledger ? safeNumber(ledger.foodPerk) : 0;
                                           const acc = ledger ? safeNumber(ledger.accommodationPerk) : 0;
                                           const conv = ledger ? safeNumber(ledger.conveyancePerk) : 0;
                                       
                                           const empEsic = isEsicCovered ? (gross * 0.0075) : 0;
                                           const pt = calculateProfessionalTax(gross, {
                                             isPtEnabled,
                                             gender: emp.gender,
                                             month: selectedMonth,
                                           });
                                       
                                           const netSalaryValue = safeNumber(gross) - safeNumber(empPf) - safeNumber(empEsic) - safeNumber(pt);
                                           const totalDeductionsValue = safeNumber(empPf) + safeNumber(empEsic) + safeNumber(pt) + safeNumber(adv) + safeNumber(pen) + safeNumber(uniform);
                                           const netPayableValue = safeNumber(netSalaryValue) - safeNumber(adv) - safeNumber(pen) - safeNumber(uniform) + safeNumber(food) + safeNumber(acc) + safeNumber(conv);
                                      
                                          const isSelected = selectedSalaryEmployeeIds.includes(emp.id);
                                          const salaryStickyRowBg = isSelected ? "bg-orange-50" : "bg-white";
                                      
                                          return (
                                            <tr 
                                              key={emp.id} 
                                              className={`group hover:bg-slate-50/40 transition border-b border-slate-150 align-middle ${
                                                isSelected ? "bg-orange-50/20 hover:bg-orange-50/30" : ""
                                              }`}
                                            >
                                              <td className={`salary-sticky-select ${salaryStickyRowBg} px-2.5 py-2.5 border-r border-slate-150 text-center w-[48px] min-w-[48px] max-w-[48px] align-middle`}>
                                                <input id={`salary-select-${emp.id}`} name={`salarySelect_${emp.id}`}
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => {
                                                    setSelectedSalaryEmployeeIds(prev => 
                                                      prev.includes(emp.id)
                                                        ? prev.filter(id => id !== emp.id)
                                                        : [...prev, emp.id]
                                                    );
                                                  }}
                                                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#f57416] focus:ring-[#f57416] cursor-pointer"
                                                />
                                              </td>
                                              {(visibleSalaryColumns.includes("Employee Code") || visibleSalaryColumns.includes("Employee Name")) && (
                                                <td className={`salary-sticky-details ${salaryStickyRowBg} px-3 py-2.5 border-r border-slate-150 font-bold text-slate-700 text-left truncate w-[200px] min-w-[200px] max-w-[200px]`}>
                                                  {visibleSalaryColumns.includes("Employee Name") && (
                                                    <div className="truncate" title={emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}>{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</div>
                                                  )}
                                                  {visibleSalaryColumns.includes("Employee Code") && (
                                                    <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate" title={`${emp.employeeCode} • ${emp.location || "No Site"}`}>{emp.employeeCode} • {emp.location || "No Site"}</div>
                                                  )}
                                                </td>
                                              )}
          
                                              {visibleSalaryColumns.includes("Skill Category") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums font-medium bg-slate-50/10 truncate" title={emp.skillCategory || "-"}>
                                                  {emp.skillCategory || "-"}
                                                </td>
                                              )}
                                              {visibleSalaryColumns.includes("Job Role") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums font-medium bg-slate-50/10 truncate" title={emp.role || "-"}>
                                                  {emp.role || "-"}
                                                </td>
                                              )}
                                          
                                              {visibleSalaryColumns.includes("Present Days") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums font-semibold text-[#f57416] bg-orange-50/10">
                                                  {presents}
                                                </td>
                                              )}

                                              {visibleSalaryColumns.includes("Daily Wage") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums font-semibold text-slate-700 bg-slate-50/10">
                                                  ₹{resolveEmployeeDailyWage(emp).toLocaleString("en-IN")}
                                                </td>
                                              )}
                                          
                                              {visibleSalaryColumns.includes("Total Salary") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums font-semibold text-slate-700 bg-slate-50/10">₹{fullMonthSalary.toLocaleString("en-IN")}</td>
                                              )}
                                              {visibleSalaryColumns.includes("Gross Salary (Monthly)") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums font-medium">₹{gross.toLocaleString("en-IN")}</td>
                                              )}
                                          
                                              {visibleSalaryColumns.includes("Basic Salary") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums font-medium text-slate-655 bg-slate-50/10">₹{basic.toLocaleString("en-IN")}</td>
                                              )}
                                          
                                              {visibleSalaryColumns.includes("Employer PF (13%)") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-blue-800 bg-blue-50/10 font-semibold">{isCompliant ? `₹${Math.round(erPf).toLocaleString("en-IN")}` : ""}</td>
                                              )}
                                              {visibleSalaryColumns.includes("Employer ESIC (3.25%)") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-blue-800 bg-blue-50/10 font-semibold">{isCompliant ? `₹${Math.round(erEsic).toLocaleString("en-IN")}` : ""}</td>
                                              )}
                                          
                                              {visibleSalaryColumns.includes("Employee PF (12%)") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-rose-800 bg-rose-50/10 font-semibold">{isCompliant ? `₹${Math.round(empPf).toLocaleString("en-IN")}` : ""}</td>
                                              )}
                                              {visibleSalaryColumns.includes("Employee ESIC (0.75%)") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-rose-800 bg-rose-50/10 font-semibold">{isCompliant ? `₹${Math.round(empEsic).toLocaleString("en-IN")}` : ""}</td>
                                              )}
                                              {visibleSalaryColumns.includes("Professional Tax (PT)") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-rose-800 bg-rose-50/10 font-medium">{isPtEnabled ? `₹${pt}` : ""}</td>
                                              )}
                                              {visibleSalaryColumns.includes("Advance Balance") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-rose-900 bg-rose-50/10">
                                                  {adv > 0 ? <span className="font-semibold text-blue-700">₹{adv}</span> : "-"}
                                                </td>
                                              )}
                                              {visibleSalaryColumns.includes("Uniform Deductions") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-rose-900 bg-rose-50/10">
                                                  {uniform > 0 ? <span className="font-semibold text-rose-600">₹{uniform}</span> : "-"}
                                                </td>
                                              )}
                                              {visibleSalaryColumns.includes("Penalty Balance") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-rose-900 bg-rose-50/10">
                                                  {pen > 0 ? <span className="font-semibold text-rose-600">₹{pen}</span> : "-"}
                                                </td>
                                              )}
                                          
                                              {visibleSalaryColumns.includes("Total Deductions") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-rose-900 bg-rose-100/10 font-semibold">
                                                  ₹{Math.round(totalDeductionsValue).toLocaleString("en-IN")}
                                                </td>
                                              )}
                                          
                                              {visibleSalaryColumns.includes("Net Salary") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-amber-800 bg-amber-50/10 font-semibold">
                                                  ₹{Math.round(netSalaryValue).toLocaleString("en-IN")}
                                                </td>
                                              )}
                                          
                                              {visibleSalaryColumns.includes("Food Perk") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-indigo-700 bg-indigo-50/10 font-semibold">
                                                  {food || 0}
                                                </td>
                                              )}
                                              {visibleSalaryColumns.includes("Accommodation Perk") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-indigo-700 bg-indigo-50/10 font-semibold">
                                                  {acc || 0}
                                                </td>
                                              )}
                                              {visibleSalaryColumns.includes("Conveyance Perk") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 text-center whitespace-nowrap tabular-nums text-[#ff791a] bg-indigo-50/10 font-semibold">
                                                  {conv || 0}
                                                </td>
                                              )}
                                          
                                              {visibleSalaryColumns.includes("Net Payable") && (
                                                <td className="px-3 py-2.5 border-r border-slate-150 bg-emerald-50 text-emerald-800 text-right font-black text-xs whitespace-nowrap tabular-nums">
                                                  ₹{(presents <= 0 ? 0 : Math.round(Math.max(0, netPayableValue))).toLocaleString("en-IN")}
                                                </td>
                                              )}
                                              {visibleSalaryColumns.includes("Payment Status") && (
                                                <td className={`px-2 py-1.5 border-l border-r border-slate-150 text-center align-middle bg-violet-50 ${isSelected ? "!bg-orange-50" : ""}`}>
                                                  {canEditSalary ? (
                                                  <select id={`payment-status-${emp.id}`} name={`paymentStatus_${emp.id}`}
                                                    value={ledger?.paymentStatus || "Unpaid"}
                                                    onChange={(e) => handleUpdatePaymentStatus(emp.id, e.target.value as "Unpaid" | "Paid" | "Hold")}
                                                    className={`px-2 py-1 rounded text-xs font-bold focus:outline-none transition border cursor-pointer ${
                                                      (ledger?.paymentStatus || "Unpaid") === "Paid"
                                                        ? "bg-emerald-55 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                                        : (ledger?.paymentStatus || "Unpaid") === "Hold"
                                                        ? "bg-amber-50 border-amber-250 text-amber-700 hover:bg-amber-100"
                                                        : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                                                    }`}
                                                  >
                                                    <option value="Unpaid">Unpaid</option>
                                                    <option value="Paid">Paid</option>
                                                    <option value="Hold">Hold</option>
                                                  </select>
                                                  ) : (
                                                    <span className={paymentStatusBadgeClass(ledger?.paymentStatus || "Unpaid")}>
                                                      {ledger?.paymentStatus || "Unpaid"}
                                                    </span>
                                                  )}
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                            </div>
                          ) : activeSidebarTab === "Saved Bulk Pay" ? (
                            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="saved-bulk-pay-module-view">
                              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                                  <div>
                                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                      <Archive size={20} className="text-[#7c3aed]" /> Saved Bulk Pay Files
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                      Axis Bank bulk pay files archived on the server — includes bank upload rows plus the full salary calculation sheet (all selected columns) for preview and re-download.
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    {bulkPayArchiveYears.length > 0 && (
                                      <select
                                        id="bulk-pay-year-filter"
                                        value={bulkPayArchiveYearFilter}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          setBulkPayArchiveYearFilter(value);
                                          fetchBulkPayArchives(value);
                                        }}
                                        className="px-3 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:border-[#7c3aed] transition"
                                      >
                                        <option value="">All Years</option>
                                        {bulkPayArchiveYears.map((y) => (
                                          <option key={y} value={y}>{y}</option>
                                        ))}
                                      </select>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => fetchBulkPayArchives()}
                                      className="px-3.5 py-1.5 bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                                    >
                                      <RotateCw size={13} /> Refresh
                                    </button>
                                  </div>
                                </div>
          
                                {lastSavedBulkPay && highlightedBulkPayId === lastSavedBulkPay.id && (
                                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                      <p className="text-xs font-black text-violet-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <CheckCircle2 size={14} /> Just Saved
                                      </p>
                                      <p className="text-[11px] text-violet-700 mt-1 font-mono truncate" title={lastSavedBulkPay.filename}>
                                        {lastSavedBulkPay.filename}
                                      </p>
                                      <p className="text-[10px] text-violet-500 mt-0.5">
                                        {lastSavedBulkPay.month} {lastSavedBulkPay.year} · {lastSavedBulkPay.recordCount} records · ₹{Number(lastSavedBulkPay.totalAmount || 0).toLocaleString("en-IN")}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleViewBulkPayArchive(lastSavedBulkPay.id, lastSavedBulkPay.filename)}
                                        className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                      >
                                        <Eye size={11} /> View Excel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadBulkPayArchive(lastSavedBulkPay.id, lastSavedBulkPay.filename)}
                                        className="px-3 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
                                      >
                                        <Download size={11} />
                                        Re-download
                                        <span className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-black leading-none">
                                          {lastSavedBulkPay.downloadCount ?? 0}
                                        </span>
                                      </button>
                                      {canDeleteSalary && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteBulkPayArchive(lastSavedBulkPay.id)}
                                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[10px] font-bold cursor-pointer"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
          
                                {isFetchingBulkPayArchives ? (
                                  <p className="text-sm text-slate-500">Loading saved files...</p>
                                ) : filteredBulkPayArchives.length === 0 ? (
                                  <div className="text-center py-12 space-y-2">
                                    <Archive size={32} className="mx-auto text-slate-300" />
                                    <p className="text-sm text-slate-500 font-semibold">No bulk pay files saved yet</p>
                                    <p className="text-xs text-slate-400">
                                      Export bulk pay from the Salary module to automatically archive the Excel sheet here.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setActiveSidebarTab("Salary")}
                                      className="mt-2 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs rounded-lg cursor-pointer transition"
                                    >
                                      Go to Salary
                                    </button>
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="text-slate-500 uppercase tracking-wide border-b border-slate-200">
                                          <th className="py-2.5 pr-4 font-bold">Saved On</th>
                                          <th className="py-2.5 pr-4 font-bold">Month</th>
                                          <th className="py-2.5 pr-4 font-bold">Year</th>
                                          <th className="py-2.5 pr-4 font-bold">Filename</th>
                                          <th className="py-2.5 pr-4 font-bold">Records</th>
                                          <th className="py-2.5 pr-4 font-bold">Total Amount</th>
                                          <th className="py-2.5 pr-4 font-bold">Exported By</th>
                                          <th className="py-2.5 font-bold">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {filteredBulkPayArchives.map((item: any) => {
                                          const displayMonth = item.year
                                            ? item.month
                                            : parseMonthYear(item.month).month;
                                          const displayYear = item.year || parseMonthYear(item.month).year;
                                          const isHighlighted = highlightedBulkPayId === item.id;
                                          return (
                                            <tr
                                              key={item.id}
                                              className={`border-b border-slate-50 hover:bg-slate-50/70 ${isHighlighted ? "bg-violet-50 ring-1 ring-inset ring-violet-200" : ""}`}
                                            >
                                              <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">
                                                {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                                              </td>
                                              <td className="py-2.5 pr-4 font-semibold text-slate-700">{displayMonth || "—"}</td>
                                              <td className="py-2.5 pr-4 font-semibold text-slate-700">{displayYear || "—"}</td>
                                              <td className="py-2.5 pr-4 max-w-[260px]" title={item.filename}>
                                                <button
                                                  type="button"
                                                  onClick={() => handleViewBulkPayArchive(item.id, item.filename)}
                                                  className="flex items-center gap-1.5 min-w-0 text-left hover:text-[#7c3aed] cursor-pointer group"
                                                  title="Click to preview Excel in browser"
                                                >
                                                  <FileSpreadsheet size={14} className="text-emerald-600 shrink-0 group-hover:text-[#7c3aed]" />
                                                  <span className="truncate font-mono text-[11px] text-slate-700 underline-offset-2 group-hover:underline">{item.filename}</span>
                                                </button>
                                              </td>
                                              <td className="py-2.5 pr-4">{item.recordCount ?? 0}</td>
                                              <td className="py-2.5 pr-4 font-mono">
                                                ₹{Number(item.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </td>
                                              <td className="py-2.5 pr-4">{item.username || "—"}</td>
                                              <td className="py-2.5 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleViewBulkPayArchive(item.id, item.filename)}
                                                    className="px-2.5 py-1 bg-white hover:bg-violet-50 text-violet-700 border border-violet-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                                  >
                                                    <Eye size={11} /> View
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDownloadBulkPayArchive(item.id, item.filename)}
                                                    className="px-2.5 py-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
                                                  >
                                                    <Download size={11} />
                                                    Re-download
                                                    <span className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-black leading-none">
                                                      {item.downloadCount ?? 0}
                                                    </span>
                                                  </button>
                                                  {canDeleteSalary && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeleteBulkPayArchive(item.id)}
                                                      className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold cursor-pointer"
                                                    >
                                                      Delete
                                                    </button>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                         ) : activeSidebarTab === "Advance & Penalty" ? (
                            /* --- ADVANCE & PENALTY LEDGER VIEW --- */
                            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="advance-penalty-module-view">
                              {/* 1. Module Header */}
                              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="text-left">
                                  <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                    <Calculator size={20} className="text-[#ff791a]" /> Monthly Settlement & Penalty Ledger
                                  </h3>
                                  <p className="text-xs text-slate-400 mt-1">
                                    Add multiple dated advances, penalties, and perks per employee each month. Totals are summed automatically from all entries.
                                  </p>
                                </div>
                        
                                {/* Month Selection Sync */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  <span className="text-xs font-bold text-slate-500">Active Month:</span>
                                  <select id="ledger-month-select" name="selectedMonth"
                                    value={MONTHS_LIST.includes(selectedMonth) ? selectedMonth : (MONTHS_LIST[0] || selectedMonth)}
                                    onChange={(e) => setSelectedMonth(normalizeMonthKey(e.target.value))}
                                    className="px-3.5 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:border-orange-500 transition"
                                  >
                                    {MONTHS_LIST.map((m) => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await fetchEmployees({ forceLedger: true });
                                      setShowRecordedLedgerModal(true);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-xs font-bold text-orange-700 hover:bg-orange-100 transition cursor-pointer"
                                  >
                                    View recorded ledger
                                  </button>
                                </div>
                              </div>
      
                              {/* 2. Top Summary metrics computed for the selected Month */}
                              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs text-left">
                                  <span className="text-[9px] text-blue-500 font-bold uppercase tracking-wider block">Advances ({selectedMonth})</span>
                                  <span className="text-base font-extrabold text-blue-800 block mt-0.5">
                                    ₹{sumMonthTotals(employees, selectedMonth, "advance").toLocaleString("en-IN")}
                                  </span>
                                </div>
                                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs text-left">
                                  <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider block">Penalties ({selectedMonth})</span>
                                  <span className="text-base font-extrabold text-rose-800 block mt-0.5">
                                    ₹{sumMonthTotals(employees, selectedMonth, "penalty").toLocaleString("en-IN")}
                                  </span>
                                </div>
                                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs text-left">
                                  <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider block">Food Perks ({selectedMonth})</span>
                                  <span className="text-base font-extrabold text-indigo-800 block mt-0.5">
                                    ₹{sumMonthTotals(employees, selectedMonth, "foodPerk").toLocaleString("en-IN")}
                                  </span>
                                </div>
                                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs text-left">
                                  <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider block">Accom. Perks ({selectedMonth})</span>
                                  <span className="text-base font-extrabold text-indigo-800 block mt-0.5">
                                    ₹{sumMonthTotals(employees, selectedMonth, "accommodationPerk").toLocaleString("en-IN")}
                                  </span>
                                </div>
                                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs text-left col-span-2 lg:col-span-1">
                                  <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider block">Conv. Perks ({selectedMonth})</span>
                                  <span className="text-base font-extrabold text-indigo-800 block mt-0.5">
                                    ₹{sumMonthTotals(employees, selectedMonth, "conveyancePerk").toLocaleString("en-IN")}
                                  </span>
                                </div>
                              </div>
                              {/* 3. Grid split: 2/5 Interactive Search & Checklist and 3/5 Ledger Entry rows */}
                              {canEditLedger && (
                                <>
                                <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] gap-5 min-w-0 items-start">
                                  {/* Left Column: Interactive Employee checklist with search */}
                                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col space-y-4 h-[640px]">
                                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                      1. Select Employees
                                    </h4>
                                    <div className="flex gap-2 text-[10px]">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const matchedIds = employees
                                            .filter(emp => {
                                              if (isEmployeeExitedForMonth(emp, selectedMonth)) return false;
                                              const q = ledgerSearchQuery.toLowerCase().trim();
                                              const matchesSearch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "").toLowerCase().includes(q);
                                              const matchesLocation = ledgerLocationFilters.length === 0 || ledgerLocationFilters.some(f => (emp.location || "").toLowerCase() === f.toLowerCase());
                                              const matchesSkill = employeeMatchesSkillFilters(emp, ledgerSkillFilters);
                                              const matchesRole = ledgerRoleFilters.length === 0 || ledgerRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase());
                                              return matchesSearch && matchesLocation && matchesSkill && matchesRole;
                                            })
                                            .map(e => e.id);
                                          setLedgerSelectedEmployeeIds(prev => Array.from(new Set([...prev, ...matchedIds])));
                                        }}
                                        className="text-orange-600 hover:text-orange-700 font-bold uppercase tracking-wider cursor-pointer"
                                      >
                                        Select All
                                      </button>
                                      <span className="text-slate-350">|</span>
                                      <button
                                        type="button"
                                        onClick={() => setLedgerSelectedEmployeeIds([])}
                                        className="text-slate-500 hover:text-slate-650 font-bold uppercase tracking-wider cursor-pointer"
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  </div>
      
                                  {/* Premium Spacious Dynamic Filters Grid */}
                                  <div className="grid grid-cols-1 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-150 text-[10px] text-left">
                                    {/* Location Filter */}
                                    <div className="space-y-1" id="ledger-location-multiselect-container">
                                      <SearchableMultiSelect
                                        label="Branch/Site"
                                        labelClassName="block text-[8px] font-black uppercase text-slate-400 tracking-wider"
                                        placeholder="All Sites"
                                        options={ledgerUniqueLocations}
                                        selected={ledgerLocationFilters}
                                        onChange={setLedgerLocationFilters}
                                        containerId="ledger-location-filter"
                                        buttonClassName="w-full px-2 py-1.5 border border-slate-250 bg-white rounded text-[10px] font-bold text-slate-700 focus:outline-none focus:border-[#ff791a] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                                      />
                                    </div>
      
                                    {/* Skill Filter */}
                                    <div className="space-y-1 relative" id="ledger-skill-multiselect-container">
                                      <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Skill Category</span>
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setIsLedgerSkillDropdownOpen(!isLedgerSkillDropdownOpen);
                                            setIsLedgerLocationDropdownOpen(false);
                                            setIsLedgerRoleDropdownOpen(false);
                                          }}
                                          className="w-full px-2 py-1.5 border border-slate-250 bg-white rounded text-[10px] font-bold text-slate-700 focus:outline-none focus:border-[#ff791a] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                                        >
                                          <span className="truncate">
                                            {ledgerSkillFilters.length === 0 
                                              ? "All Categories" 
                                              : `${ledgerSkillFilters.length} Selected`}
                                          </span>
                                          <span className="text-[8px] text-slate-400">▼</span>
                                        </button>
                                
                                        {isLedgerSkillDropdownOpen && (
                                          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto">
                                            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                              <span className="text-[9px] text-slate-400 font-bold">Categories</span>
                                              <button
                                                type="button"
                                                onClick={() => setLedgerSkillFilters([])}
                                                className="text-[9px] font-black uppercase text-slate-500 hover:text-[#ff791a] cursor-pointer"
                                              >
                                                Clear All
                                              </button>
                                            </div>
                                            {ledgerUniqueSkills.map(sk => {
                                              const isChecked = ledgerSkillFilters.some(f => f.toLowerCase() === sk.toLowerCase());
                                              const toggle = () => {
                                                if (isChecked) {
                                                  setLedgerSkillFilters(prev => prev.filter(c => c.toLowerCase() !== sk.toLowerCase()));
                                                } else {
                                                  setLedgerSkillFilters(prev => [...prev, sk]);
                                                }
                                              };
                                              return (
                                                <label key={sk} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-[10px] text-slate-700 cursor-pointer select-none">
                                                  <input id="checkbox-field-6820" name="checkbox_6820"
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={toggle}
                                                    className="w-3.5 h-3.5 rounded border-slate-350 text-[#ff791a] focus:ring-[#ff791a]"
                                                  />
                                                  <span className="font-semibold">{sk}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
      
                                    {/* Role Filter */}
                                    <div className="space-y-1" id="ledger-role-multiselect-container">
                                      <SearchableMultiSelect
                                        label="Job Role"
                                        labelClassName="block text-[8px] font-black uppercase text-slate-400 tracking-wider"
                                        placeholder="All Roles"
                                        options={ledgerUniqueRoles}
                                        selected={ledgerRoleFilters}
                                        onChange={setLedgerRoleFilters}
                                        containerId="ledger-role-filter"
                                        buttonClassName="w-full px-2 py-1.5 border border-slate-250 bg-white rounded text-[10px] font-bold text-slate-700 focus:outline-none focus:border-[#ff791a] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                                      />
                                    </div>
                                  </div>
      
                                  {/* Search box for checklist */}
                                  <div className="relative">
                                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    <input id="ledger-search-query" name="ledgerSearchQuery"
                                      type="text"
                                      placeholder="Search by code or name..."
                                      value={ledgerSearchQuery}
                                      onChange={(e) => setLedgerSearchQuery(e.target.value)}
                                      className="w-full pl-8 pr-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                                    />
                                  </div>
      
                                  {/* Employees list checkboxes */}
                                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg p-2 bg-slate-50/30">
                                    {employees.filter(emp => {
                                      if (isEmployeeExitedForMonth(emp, selectedMonth)) return false;
                                      const q = ledgerSearchQuery.toLowerCase().trim();
                                      const matchesSearch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "").toLowerCase().includes(q);
                                      const matchesLocation = ledgerLocationFilters.length === 0 || ledgerLocationFilters.some(f => (emp.location || "").toLowerCase() === f.toLowerCase());
                                      const matchesSkill = employeeMatchesSkillFilters(emp, ledgerSkillFilters);
                                      const matchesRole = ledgerRoleFilters.length === 0 || ledgerRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase());
                                      return matchesSearch && matchesLocation && matchesSkill && matchesRole;
                                    }).length === 0 ? (
                                      <div className="p-8 text-center text-xs text-slate-450">No matching employees found.</div>
                                    ) : (
                                      employees.filter(emp => {
                                        if (isEmployeeExitedForMonth(emp, selectedMonth)) return false;
                                        const q = ledgerSearchQuery.toLowerCase().trim();
                                        const matchesSearch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "").toLowerCase().includes(q);
                                        const matchesLocation = ledgerLocationFilters.length === 0 || ledgerLocationFilters.some(f => (emp.location || "").toLowerCase() === f.toLowerCase());
                                        const matchesSkill = employeeMatchesSkillFilters(emp, ledgerSkillFilters);
                                        const matchesRole = ledgerRoleFilters.length === 0 || ledgerRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase());
                                        return matchesSearch && matchesLocation && matchesSkill && matchesRole;
                                      }).map((emp) => {
                                        const isChecked = ledgerSelectedEmployeeIds.includes(emp.id);
                                        return (
                                          <label key={emp.id} className="flex items-center gap-3 py-2 px-1.5 hover:bg-white rounded-md cursor-pointer transition select-none">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setLedgerSelectedEmployeeIds(prev => [...prev, emp.id]);
                                                } else {
                                                  setLedgerSelectedEmployeeIds(prev => prev.filter(id => id !== emp.id));
                                                }
                                              }}
                                              className="w-3.5 h-3.5 rounded text-[#ff791a] focus:ring-orange-500 accent-orange-500 border-slate-300"
                                            />
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs font-bold text-slate-700 truncate text-left">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</p>
                                              <p className="text-[10px] font-mono text-slate-400 mt-0.5 text-left">{emp.employeeCode} • {emp.location || "No site"}</p>
                                            </div>
                                          </label>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
      
                                {/* Right Column: per-employee row with date and all columns side by side */}
                                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col space-y-4 h-[640px] min-w-0 @container">
                                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center justify-between">
                                    <span>2. Record Monthly Settled Ledger Rows</span>
                                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{ledgerSelectedEmployeeIds.length} Selected</span>
                                  </h4>
      
                                  {ledgerSelectedEmployeeIds.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                                      <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center text-2xl">
                                        ✍️
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-xs font-bold text-slate-600">Settlement Workspace Empty</p>
                                        <p className="text-[11px] text-slate-400 max-w-xs">
                                          Select one or multiple employees from the list on the left to record dated advances, penalties, perks, and reasons for {selectedMonth}.
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <form onSubmit={handleSaveBatchLedgerRecords} className="flex flex-col flex-1 min-h-0 min-w-0">
                                      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 pr-1.5 scrollbar-thin">
                                        {ledgerSelectedEmployeeIds.map((empId) => {
                                          const emp = employees.find((e) => e.id === empId);
                                          if (!emp) return null;
      
                                          const entry = tempLedgerEntries[empId] || defaultTempLedgerEntry(selectedMonth);
                                          const hasPenaltyAmount = Number(entry.penalty) > 0;
      
                                          const updateField = (field: keyof typeof entry, val: string) => {
                                            setTempLedgerEntries((prev) => {
                                              const nextEntry = {
                                                ...(prev[empId] || entry),
                                                [field]: val,
                                              };
                                              if (field === "penalty" && Number(val) <= 0) {
                                                nextEntry.penaltyReason = "";
                                              }
                                              return {
                                                ...prev,
                                                [empId]: nextEntry,
                                              };
                                            });
                                          };
      
                                          return (
                                            <div
                                              key={empId}
                                              className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl space-y-2.5 relative text-left min-w-0"
                                              onBlurCapture={(event) => {
                                                if (!ledgerAutoSaveEnabled) return;
                                                if (!hasLedgerAmounts(entry)) return;
                                                const nextTarget = event.relatedTarget as HTMLElement | null;
                                                if (nextTarget && event.currentTarget.contains(nextTarget)) return;
                                                if (nextTarget?.closest("[data-ledger-manual-save='true']")) return;
                                                if (nextTarget?.closest("[data-ledger-autosave-toggle='true']")) return;
                                                void handleLedgerAutoSave(empId);
                                              }}
                                            >
                                              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    const empName = emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || emp.employeeCode;
                                                    const confirmed = await confirmAction({
                                                      title: "Remove from list",
                                                      message: `Remove ${empName} from the settlement list? Any unsaved amounts in this row will be lost.`,
                                                      confirmLabel: "Remove",
                                                      variant: "danger",
                                                    });
                                                    if (confirmed) {
                                                      setLedgerSelectedEmployeeIds((prev) => prev.filter((id) => id !== empId));
                                                    }
                                                  }}
                                                  className="text-slate-400 hover:text-red-500 font-extrabold text-xs cursor-pointer"
                                                  title="Remove from settlement list"
                                                >
                                                  ✕
                                                </button>
                                              </div>
      
                                              <div className="pr-6 min-w-0">
                                                <span className="text-xs font-black text-slate-800 truncate block">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</span>
                                                <span className="text-[9px] font-mono text-slate-400">({emp.employeeCode})</span>
                                              </div>

                                              <div
                                                className={`grid grid-cols-2 md:grid-cols-3 gap-2 min-w-0 ${
                                                  hasPenaltyAmount
                                                    ? "lg:grid-cols-[minmax(9.25rem,0.95fr)_repeat(3,minmax(0,0.9fr))_minmax(12rem,1.45fr)_repeat(3,minmax(0,0.9fr))]"
                                                    : "lg:grid-cols-[minmax(9.25rem,0.95fr)_repeat(6,minmax(0,0.95fr))]"
                                                }`}
                                              >
                                                <div className="min-w-0">
                                                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">📅 Date</label>
                                                  <input
                                                    id={`ledger-date-${empId}`}
                                                    name={`ledgerDate_${empId}`}
                                                    type="date"
                                                    value={entry.entryDate}
                                                    onChange={(e) => updateField("entryDate", e.target.value)}
                                                    min={ledgerDateBounds.min}
                                                    max={ledgerDateBounds.max}
                                                    className="w-full min-w-[9.25rem] px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-slate-800 tracking-tight focus:outline-none focus:border-orange-400"
                                                  />
                                                </div>
                                                <div className="min-w-0">
                                                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">💰 Advance</label>
                                                  <input
                                                    id={`ledger-advance-${empId}`}
                                                    name={`ledgerAdvance_${empId}`}
                                                    type="number"
                                                    min="0"
                                                    value={entry.advance}
                                                    onChange={(e) => updateField("advance", e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-slate-800 focus:outline-none focus:border-orange-400"
                                                  />
                                                </div>
                                                <div className="min-w-0">
                                                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">👕 Uniform</label>
                                                  <input
                                                    id={`ledger-uniform-${empId}`}
                                                    name={`ledgerUniform_${empId}`}
                                                    type="number"
                                                    min="0"
                                                    value={entry.uniform}
                                                    onChange={(e) => updateField("uniform", e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-[#f57416] focus:outline-none focus:border-orange-400"
                                                  />
                                                </div>
                                                <div className="min-w-0">
                                                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">⚠️ Penalty</label>
                                                  <input
                                                    id={`ledger-penalty-${empId}`}
                                                    name={`ledgerPenalty_${empId}`}
                                                    type="number"
                                                    min="0"
                                                    value={entry.penalty}
                                                    onChange={(e) => updateField("penalty", e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-slate-800 focus:outline-none focus:border-orange-400"
                                                  />
                                                </div>
                                                {hasPenaltyAmount && (
                                                  <div className="min-w-0">
                                                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">📝 Reason</label>
                                                    <input
                                                      id={`ledger-penalty-reason-${empId}`}
                                                      name={`ledgerPenaltyReason_${empId}`}
                                                      type="text"
                                                      value={entry.penaltyReason}
                                                      onChange={(e) => updateField("penaltyReason", e.target.value)}
                                                      required
                                                      placeholder="Penalty reason"
                                                      className="w-full min-w-0 px-2.5 py-1 border border-slate-200 bg-white rounded text-[11px] text-slate-700 transition-all duration-200 focus:outline-none focus:border-orange-400"
                                                    />
                                                  </div>
                                                )}
                                                <div className="min-w-0">
                                                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">🍔 Food</label>
                                                  <input
                                                    id={`ledger-food-${empId}`}
                                                    name={`ledgerFood_${empId}`}
                                                    type="number"
                                                    min="0"
                                                    value={entry.foodPerk}
                                                    onChange={(e) => updateField("foodPerk", e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-indigo-700 focus:outline-none focus:border-orange-400"
                                                  />
                                                </div>
                                                <div className="min-w-0">
                                                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">🏠 Accom.</label>
                                                  <input
                                                    id={`ledger-accom-${empId}`}
                                                    name={`ledgerAccom_${empId}`}
                                                    type="number"
                                                    min="0"
                                                    value={entry.accommodationPerk}
                                                    onChange={(e) => updateField("accommodationPerk", e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-indigo-700 focus:outline-none focus:border-orange-400"
                                                  />
                                                </div>
                                                <div className="min-w-0">
                                                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">🚗 Conv.</label>
                                                  <input
                                                    id={`ledger-conv-${empId}`}
                                                    name={`ledgerConv_${empId}`}
                                                    type="number"
                                                    min="0"
                                                    value={entry.conveyancePerk}
                                                    onChange={(e) => updateField("conveyancePerk", e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-indigo-700 focus:outline-none focus:border-orange-400"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
      
                                      <div className="pt-3 border-t border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            checked={ledgerAutoSaveEnabled}
                                            onCheckedChange={setLedgerAutoSaveEnabled}
                                            aria-label="Toggle ledger auto save"
                                            data-ledger-autosave-toggle="true"
                                            size="md"
                                          />
                                          <div className="leading-tight">
                                            <p className="text-[11px] font-bold text-slate-600">Auto save</p>
                                            <p className="text-[10px] text-slate-400">
                                              {isLedgerAutoSaving
                                                ? "Saving current row..."
                                                : ledgerAutoSaveEnabled
                                                  ? (lastLedgerAutoSaveAt ? `Last saved at ${lastLedgerAutoSaveAt}` : "Saves automatically when you leave a row.")
                                                  : "Manual save only"}
                                            </p>
                                          </div>
                                        </div>
                                        <button
                                          type="submit"
                                          data-ledger-manual-save="true"
                                          className="w-full sm:w-auto sm:min-w-[260px] py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-md transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                                        >
                                          💾 Save Monthly Ledger Rows ({selectedMonth})
                                        </button>
                                      </div>
                                    </form>
                                  )}
                                  </div>
                                </div>
                                </>
                              )}

                              {showRecordedLedgerModal && (
                                <LedgerRecordedOverviewModal
                                  selectedMonth={selectedMonth}
                                  monthsList={MONTHS_LIST}
                                  employees={employees}
                                  onMonthChange={setSelectedMonth}
                                  onClose={() => setShowRecordedLedgerModal(false)}
                                />
                              )}
                            </div>
                          ) : activeSidebarTab === "Birthdays" ? (
                            <BirthdaysTab
                              birthdaySearchMonth={birthdaySearchMonth}
                              setBirthdaySearchMonth={setBirthdaySearchMonth}
                              birthdayTodayList={birthdayTodayList}
                              birthdayMonthList={birthdayMonthList}
                              birthdayTodayLabel={birthdayTodayLabel}
                              isFetchingBirthdays={isFetchingBirthdays}
                              employees={employees}
                              simulatedBirthdayEmpIds={simulatedBirthdayEmpIds}
                              setSimulatedBirthdayEmpIds={setSimulatedBirthdayEmpIds}
                              setShowConfetti={setShowConfetti}
                              triggerSuccess={triggerSuccess}
                            />
                          ) : activeSidebarTab === "Directory" ? (
                            /* --- ENTERPRISE DIRECTORY VIEW --- */
                            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="directory-tab-view">
                              {/* 1. Sub navigation controls & Header */}
                              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
                                <div>
                                  <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                    <Contact size={20} className="text-[#ff791a]" /> HRMS Corporate Contacts Directory
                                  </h3>
                                  <p className="text-xs text-slate-400 mt-1">
                                    Lookup team profiles, department hierarchies, or official client/support desk numbers instantly.
                                  </p>
                                </div>
          
                                {/* Sub tab selectors */}
                                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setActiveDirectorySubTab("employees")}
                                    className={`px-4 py-1.5 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                                      activeDirectorySubTab === "employees"
                                        ? "bg-[#ff791a] text-white shadow-sm"
                                        : "bg-transparent text-slate-600 hover:text-slate-900"
                                    }`}
                                  >
                                    👥 Employee Profiles
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveDirectorySubTab("contacts")}
                                    className={`px-4 py-1.5 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                                      activeDirectorySubTab === "contacts"
                                        ? "bg-[#ff791a] text-white shadow-sm"
                                        : "bg-transparent text-slate-600 hover:text-slate-900"
                                    }`}
                                  >
                                    ☎️ Important Helplines
                                  </button>
                                </div>
                              </div>
          
                              {/* 2. EMPLOYEE PROFILES VIEW */}
                              {activeDirectorySubTab === "employees" ? (
                                <div className="space-y-6 animate-fade-in">
                                  {/* Filters bar for directory */}
                                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                                    {/* Search */}
                                    <div>
                                      <label htmlFor="directory-search" className="directory-field-label">Search Directory</label>
                                      <div className="relative">
                                        <input id="directory-search" name="directorySearch"
                                          type="text"
                                          value={directorySearch}
                                          onChange={(e) => setDirectorySearch(e.target.value)}
                                          placeholder="Search by name, designation, code or phone..."
                                          className="directory-field !pl-8"
                                        />
                                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                      </div>
                                    </div>
          
                                    {/* Location Filter */}
                                    <div>
                                      <SearchableMultiSelect
                                        label="Location / Site"
                                        labelClassName="directory-field-label"
                                        placeholder="All Locations"
                                        options={salaryUniqueLocations}
                                        selected={directoryLocationFilters}
                                        onChange={setDirectoryLocationFilters}
                                        containerId="directory-location-filter"
                                        buttonClassName="directory-field-select w-full text-left flex justify-between items-center cursor-pointer"
                                      />
                                    </div>
          
                                    {/* Gender Filter */}
                                    <div>
                                      <label htmlFor="directory-gender" className="directory-field-label">Gender</label>
                                      <select id="directory-gender" name="directoryGender"
                                        value={directoryGender}
                                        onChange={(e) => setDirectoryGender(e.target.value)}
                                        className="directory-field-select"
                                      >
                                        <option value="">All Genders</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                      </select>
                                    </div>
                                  </div>
          
                                  {/* Employee phone directory */}
                                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {(() => {
                                      const filtered = employees.filter(emp => {
                                        const q = directorySearch.toLowerCase().trim();
                                        if (q) {
                                          const codeMatch = emp.employeeCode.toLowerCase().includes(q);
                                          const nameMatch = (emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "").toLowerCase().includes(q);
                                          const phoneRaw = resolveEmployeePhone(emp);
                                          const phoneMatch =
                                            phoneRaw.toLowerCase().includes(q) ||
                                            formatPhoneDisplay(phoneRaw).toLowerCase().includes(q);
                                          const roleMatch = (emp.role || "").toLowerCase().includes(q);
                                          if (!codeMatch && !nameMatch && !phoneMatch && !roleMatch) return false;
                                        }
                                        if (!matchesMultiSelectFilter(emp.location, directoryLocationFilters)) return false;
                                        if (directoryGender && emp.gender?.toLowerCase() !== directoryGender.toLowerCase()) return false;
                                        return true;
                                      });
          
                                      if (filtered.length === 0) {
                                        return (
                                          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-16 text-center space-y-3">
                                            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center text-2xl mx-auto">
                                              🕵️
                                            </div>
                                            <div>
                                              <p className="text-xs font-bold text-slate-600">No matching employee records found</p>
                                              <p className="text-[11px] text-slate-400">Try modifying your text query or location/gender filter criteria.</p>
                                            </div>
                                          </div>
                                        );
                                      }
          
                                      return filtered.map(emp => {
                                        const name = emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "Unknown";
                                        const phone = resolveEmployeePhone(emp);
                                        const location = emp.location || "Unassigned Site";
                                        const designation = emp.role || emp.employeeCode || "Employee";
          
                                        return (
                                          <DirectoryContactCard
                                            key={emp.id}
                                            name={name}
                                            designation={designation}
                                            location={location}
                                            phone={phone}
                                            badge={emp.employeeCode}
                                            badgeTone="slate"
                                            onCall={(contact) =>
                                              handleCallInitiate(contact.name, contact.phone, contact.designation)
                                            }
                                            onActionSuccess={triggerSuccess}
                                          />
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              ) : (
                                /* 3. IMPORTANT OFFICIAL CONTACTS HELPLINES WITH DYNAMIC LOCATION-MAPPED HELP DESKS */
                                <div className="space-y-6 animate-fade-in" id="helplines-workspace">
                                  {/* Search & location filters */}
                                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                                    <div>
                                      <label htmlFor="helpline-search-query" className="directory-field-label">Search Helplines</label>
                                      <div className="relative">
                                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input id="helpline-search-query" name="helplineSearchQuery"
                                          type="text"
                                          placeholder="Search by name, role or desk..."
                                          value={helplineSearchQuery}
                                          onChange={(e) => setHelplineSearchQuery(e.target.value)}
                                          className="directory-field !pl-8"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <SearchableMultiSelect
                                        label="Work Location"
                                        labelClassName="directory-field-label"
                                        placeholder="All Work Locations"
                                        options={customLocations}
                                        selected={helplineLocationFilters}
                                        onChange={setHelplineLocationFilters}
                                        containerId="helpline-location-filter"
                                        buttonClassName="directory-field-select w-full text-left flex justify-between items-center cursor-pointer"
                                      />
                                    </div>
                                  </div>
          
                                  {/* Quick Onboarding Form for new Helplines */}
                                  {canEditDirectory && (
                                  <form onSubmit={handleAddHelpline} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-left">
                                    <p className="directory-field-label !mb-0">Help Desk Registry</p>
                                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                                      <div className="min-w-0 flex-1">
                                        <label htmlFor="new-helpline-name" className="directory-field-label">Desk Name / Facility</label>
                                        <input id="new-helpline-name" name="newHelplineName"
                                          type="text"
                                          required
                                          placeholder="e.g. Pune Help Desk"
                                          value={newHelplineName}
                                          onChange={(e) => setNewHelplineName(e.target.value)}
                                          className="directory-field"
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <label htmlFor="new-helpline-phone" className="directory-field-label">Official Helpline Phone</label>
                                        <input id="new-helpline-phone" name="newHelplinePhone"
                                          type="text"
                                          required
                                          placeholder="e.g. +91 98765 00000"
                                          value={newHelplinePhone}
                                          onChange={(e) => setNewHelplinePhone(e.target.value)}
                                          className="directory-field font-mono font-bold"
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <label htmlFor="new-helpline-role" className="directory-field-label">Specific Role / Scope</label>
                                        <input id="new-helpline-role" name="newHelplineRole"
                                          type="text"
                                          placeholder="e.g. Network infrastructure"
                                          value={newHelplineRole}
                                          onChange={(e) => setNewHelplineRole(e.target.value)}
                                          className="directory-field"
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <label htmlFor="new-helpline-category" className="directory-field-label">Desk Category</label>
                                        <select id="new-helpline-category" name="newHelplineCategory"
                                          value={newHelplineCategory}
                                          onChange={(e) => setNewHelplineCategory(e.target.value)}
                                          className="directory-field-select"
                                        >
                                          <option value="IT Helpdesk">IT Desk</option>
                                          <option value="Corporate Support">Corporate</option>
                                          <option value="Client Office">Site Office</option>
                                          <option value="Operations Desk">Operations</option>
                                          <option value="⚠️ Emergency Desk">Emergency</option>
                                        </select>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <label htmlFor="new-helpline-location" className="directory-field-label">Branch Location</label>
                                        <select id="new-helpline-location" name="newHelplineLocation"
                                          value={newHelplineLocation}
                                          onChange={(e) => setNewHelplineLocation(e.target.value)}
                                          className="directory-field-select"
                                        >
                                          <option value="All Locations">All Locations</option>
                                          {customLocations.map(loc => (
                                            <option key={loc} value={loc}>{loc}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="w-full shrink-0 md:w-[11.5rem]">
                                        <label className="directory-field-label invisible select-none" aria-hidden="true">&nbsp;</label>
                                        <button
                                          type="submit"
                                          className="directory-field !flex items-center justify-center gap-1 border-[#ff791a] bg-[#ff791a] font-bold text-white shadow-sm transition hover:bg-[#e4640c] cursor-pointer"
                                        >
                                          <Plus size={14} className="stroke-[2.5]" /> Register Helpline
                                        </button>
                                      </div>
                                    </div>
                                  </form>
                                  )}

                                  {/* Helplines phone directory */}
                                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {(() => {
                                      const filtered = helplines.filter(contact => {
                                        const q = helplineSearchQuery.toLowerCase().trim();
                                        if (q) {
                                          const nameMatch = contact.name.toLowerCase().includes(q);
                                          const roleMatch = contact.role.toLowerCase().includes(q);
                                          const catMatch = contact.category.toLowerCase().includes(q);
                                          const phoneMatch =
                                            (contact.phone || "").toLowerCase().includes(q) ||
                                            formatPhoneDisplay(contact.phone).toLowerCase().includes(q);
                                          if (!nameMatch && !roleMatch && !catMatch && !phoneMatch) return false;
                                        }
                                        if (
                                          helplineLocationFilters.length > 0 &&
                                          contact.location !== "All Locations" &&
                                          !matchesMultiSelectFilter(contact.location, helplineLocationFilters)
                                        ) {
                                          return false;
                                        }
                                        return true;
                                      });
          
                                      if (filtered.length === 0) {
                                        return (
                                          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-16 text-center space-y-3">
                                            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center text-2xl mx-auto">
                                              ☎️
                                            </div>
                                            <div>
                                              <p className="text-xs font-bold text-slate-600">No matching helplines found</p>
                                              <p className="text-[11px] text-slate-400">Try modifying your search query or location filter, or register a new helpline above.</p>
                                            </div>
                                          </div>
                                        );
                                      }
          
                                      return filtered.map((contact, idx) => {
                                        const badgeTone = contact.category.includes("Emergency")
                                          ? "rose"
                                          : contact.category.includes("IT")
                                          ? "blue"
                                          : contact.category.includes("Client")
                                          ? "indigo"
                                          : "orange";

                                        return (
                                          <DirectoryContactCard
                                            key={contact._id || contact.name + idx}
                                            name={contact.name}
                                            designation={contact.role || "General Support"}
                                            location={contact.location === "All Locations" ? "All Locations" : contact.location}
                                            phone={contact.phone}
                                            badge={contact.category}
                                            badgeTone={badgeTone}
                                            headerAction={
                                              canDeleteDirectory ? (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteHelpline(contact.name)}
                                                className="rounded-lg p-1.5 text-slate-350 transition hover:bg-rose-50 hover:text-red-500 cursor-pointer"
                                                title={`Delete "${contact.name}"`}
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                              ) : undefined
                                            }
                                            onCall={(entry) =>
                                              handleCallInitiate(entry.name, entry.phone, contact.category)
                                            }
                                            onActionSuccess={triggerSuccess}
                                          />
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : activeSidebarTab === "Attendance" ? (
                            /* --- ENTERPRISE ATTENDANCE WORKSPACE ("TIME" MODULE) --- */
                            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6 animate-fade-in" id="attendance-workspace-panel">
                              {attendanceSubView === "employee" && individualAttendanceEmployeeId ? (
                                (() => {
                                  const markingEmployee = employees.find((e) => e.id === individualAttendanceEmployeeId);
                                  if (!markingEmployee) {
                                    return (
                                      <div className="text-center py-10 text-slate-400 text-sm">
                                        Employee not found.{" "}
                                        <button
                                          type="button"
                                          onClick={closeEmployeeAttendanceMarking}
                                          className="text-[#ff791a] font-bold hover:underline cursor-pointer"
                                        >
                                          Back to grid
                                        </button>
                                      </div>
                                    );
                                  }
                                  return (
                                    <EmployeeAttendanceMarkingView
                                      employee={markingEmployee}
                                      selectedMonth={selectedMonth}
                                      monthsList={MONTHS_LIST}
                                      attendanceDb={attendanceDb}
                                      canEdit={canEditAttendance}
                                      getDaysInMonth={getDaysInSelectedMonth}
                                      onMonthChange={(month) => {
                                        setSelectedMonth(month);
                                        void fetchAttendanceForMonth(month);
                                      }}
                                      onBack={closeEmployeeAttendanceMarking}
                                      onCellChange={handleCellAttendanceChange}
                                      onBulkApply={handleEmployeeBulkAttendanceChange}
                                    />
                                  );
                                })()
                              ) : attendanceSubView === "pdf-import" && canEditAttendance ? (
                                <AttendancePdfUploadWizard
                                  employees={employees}
                                  monthsList={MONTHS_LIST}
                                  defaultMonth={selectedMonth}
                                  canEdit={canEditAttendance}
                                  onBack={() => setAttendanceSubView("grid")}
                                  onApply={handleApplyPdfAttendanceImport}
                                />
                              ) : attendanceSubView === "wizard" && canEditAttendance ? (
                                /* --- NEW SCREEN: INTERACTIVE WIZARD VIEW --- */
                                <div className="space-y-6">
                                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                    <div className="text-left">
                                      <button
                                        type="button"
                                        onClick={() => setAttendanceSubView("grid")}
                                        className="flex items-center gap-1 text-slate-500 hover:text-[#ff791a] text-xs font-bold transition cursor-pointer mb-2"
                                      >
                                        ← Back to Daily Attendance Sheet
                                      </button>
                                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mt-1">
                                        ⚡ Bulk Mark Attendance Wizard
                                      </h4>
                                      <p className="text-[11px] text-slate-455 mt-0.5">
                                        Mark large cohorts as present across multiple worksite locations, cycle months, and custom calendar dates quickly.
                                      </p>
                                    </div>
                                
                                    {/* Navigation tabs styled premium */}
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                                      {[
                                        { id: "employees", label: "1. Select Staff", icon: Users },
                                        { id: "dates", label: "2. Select Dates", icon: Calendar },
                                        { id: "review", label: "3. Review & Submit", icon: CheckCircle }
                                      ].map((stepItem) => {
                                        const Icon = stepItem.icon;
                                        const isDone = (stepItem.id === "employees" && (bulkWizardStep === "dates" || bulkWizardStep === "review")) || (stepItem.id === "dates" && bulkWizardStep === "review");
                                        const isActive = bulkWizardStep === stepItem.id;
                                        return (
                                          <button
                                            key={stepItem.id}
                                            type="button"
                                            onClick={() => {
                                              if (stepItem.id === "employees") setBulkWizardStep("employees");
                                              else if (stepItem.id === "dates" && bulkSelEmployees.length > 0) setBulkWizardStep("dates");
                                              else if (stepItem.id === "review" && bulkSelEmployees.length > 0 && bulkSelDates.length > 0) setBulkWizardStep("review");
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                                              isActive ? "bg-[#ff791a] text-white shadow-xs" : isDone ? "text-emerald-700 bg-emerald-50 border border-emerald-100" : "text-slate-500 hover:bg-slate-100"
                                            }`}
                                          >
                                            <Icon size={14} className={isDone ? "text-emerald-600 animate-bounce" : ""} />
                                            {stepItem.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
          
                                  {bulkWizardStep === "employees" && (
                                        <div className="space-y-5 animate-fade-in">
                                          {/* Grid for Locations & Months */}
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        
                                            {/* 1. Locations Selection Panel */}
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                  🏢 Select Worksite Location(s)
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (bulkSelLocations.length === customLocations.length) {
                                                      setBulkSelLocations([]);
                                                    } else {
                                                      setBulkSelLocations([...customLocations]);
                                                    }
                                                  }}
                                                  className="text-[10px] font-bold text-orange-600 hover:text-orange-850 cursor-pointer"
                                                >
                                                  {bulkSelLocations.length === customLocations.length ? "Deselect All" : "Select All"}
                                                </button>
                                              </div>
                                              <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                                {customLocations.map(loc => {
                                                  const isSel = bulkSelLocations.includes(loc);
                                                  const toggle = () => {
                                                    if (isSel) setBulkSelLocations(prev => prev.filter(x => x !== loc));
                                                    else setBulkSelLocations(prev => [...prev, loc]);
                                                  };
                                                  return (
                                                    <button
                                                      key={loc}
                                                      type="button"
                                                      onClick={toggle}
                                                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer select-none ${
                                                        isSel 
                                                          ? "bg-orange-50 border-orange-200 text-[#e4640c]" 
                                                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                      }`}
                                                    >
                                                      {loc}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
          
                                            {/* 2. Months Selection Panel */}
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                  📅 Select Cycle Month(s)
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (bulkSelMonths.length === MONTHS_LIST.length) {
                                                      setBulkSelMonths([]);
                                                    } else {
                                                      setBulkSelMonths([...MONTHS_LIST]);
                                                    }
                                                  }}
                                                  className="text-[10px] font-bold text-orange-600 hover:text-orange-850 cursor-pointer"
                                                >
                                                  {bulkSelMonths.length === MONTHS_LIST.length ? "Deselect All" : "Select All"}
                                                </button>
                                              </div>
                                              <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                                {MONTHS_LIST.map(m => {
                                                  const isSel = bulkSelMonths.includes(m);
                                                  const toggle = () => {
                                                    if (isSel) setBulkSelMonths(prev => prev.filter(x => x !== m));
                                                    else setBulkSelMonths(prev => [...prev, m]);
                                                  };
                                                  return (
                                                    <button
                                                      key={m}
                                                      type="button"
                                                      onClick={toggle}
                                                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer select-none ${
                                                        isSel 
                                                          ? "bg-orange-50 border-orange-200 text-[#e4640c]" 
                                                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                      }`}
                                                    >
                                                      {m}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
          
                                          </div>
          
                                          {/* 3. Targeted Employees List */}
                                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-slate-200 gap-2 text-left">
                                              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                👥 Targeted Employees ({bulkSelEmployees.length} Selected)
                                              </span>
                                              <div className="flex flex-wrap items-center gap-3">
                                            
                                                {/* Bulk Wizard Role Filter */}
                                                <div className="flex items-center gap-1.5 text-xs" id="bulk-wizard-role-multiselect-container">
                                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Role:</span>
                                                  <SearchableMultiSelect
                                                    placeholder="All Job Roles"
                                                    options={customRoles}
                                                    selected={bulkWizardRoleFilters}
                                                    onChange={setBulkWizardRoleFilters}
                                                    containerId="bulk-wizard-role-filter"
                                                    className="min-w-[150px]"
                                                    buttonClassName="px-2.5 py-1 bg-white border border-slate-250 text-[11px] rounded-lg font-bold focus:outline-none flex justify-between items-center min-w-[130px] hover:bg-slate-50 transition cursor-pointer w-full text-left"
                                                  />
                                                </div>
          
                                                {/* Bulk Wizard Skill Filter */}
                                                <div className="flex items-center gap-1.5 text-xs relative" id="bulk-wizard-skill-multiselect-container">
                                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Skill:</span>
                                                  <div className="relative">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setIsBulkWizardSkillDropdownOpen(!isBulkWizardSkillDropdownOpen);
                                                        setIsBulkWizardRoleDropdownOpen(false);
                                                      }}
                                                      className="px-2.5 py-1 bg-white border border-slate-250 text-[11px] rounded-lg font-bold focus:outline-none flex justify-between items-center min-w-[130px] hover:bg-slate-50 transition cursor-pointer"
                                                    >
                                                      <span className="truncate">
                                                        {bulkWizardSkillFilters.length === 0 
                                                          ? "All Categories" 
                                                          : `${bulkWizardSkillFilters.length} Selected`}
                                                      </span>
                                                      <span className="text-[9px] text-slate-400 ml-1">▼</span>
                                                    </button>
                                                
                                                    {isBulkWizardSkillDropdownOpen && (
                                                      <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto w-44 text-left">
                                                        <div className="flex justify-between items-center border-b border-slate-100 pb-1 mb-1">
                                                          <span className="text-[9px] text-slate-400 font-bold">Categories</span>
                                                          <button
                                                            type="button"
                                                            onClick={() => setBulkWizardSkillFilters([])}
                                                            className="text-[8px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                                                          >
                                                            Clear All
                                                          </button>
                                                        </div>
                                                        {["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"].map(cat => {
                                                          const isChecked = bulkWizardSkillFilters.includes(cat);
                                                          const toggle = () => {
                                                            if (isChecked) {
                                                              setBulkWizardSkillFilters(prev => prev.filter(c => c !== cat));
                                                            } else {
                                                              setBulkWizardSkillFilters(prev => [...prev, cat]);
                                                            }
                                                          };
                                                          return (
                                                            <label key={cat} className="flex items-center gap-2 px-1.5 py-0.5 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                                              <input id="checkbox-field-8097" name="checkbox_8097"
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={toggle}
                                                                className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                                              />
                                                              <span className="font-medium text-[11px]">{cat}</span>
                                                            </label>
                                                          );
                                                        })}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
          
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const matching = employees
                                                      .filter(e => bulkSelLocations.includes(e.location || ""))
                                                      .filter(e => bulkWizardRoleFilters.length === 0 || bulkWizardRoleFilters.some(f => (e.role || "").toLowerCase() === f.toLowerCase()))
                                                      .filter(e => employeeMatchesSkillFilters(e, bulkWizardSkillFilters))
                                                      .map(e => e.id);
                                                    setBulkSelEmployees(matching);
                                                  }}
                                                  className="text-[10px] font-bold text-orange-600 hover:text-orange-850 cursor-pointer"
                                                >
                                                  Select Matching
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setBulkSelEmployees([])}
                                                  className="text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                                                >
                                                  Deselect All
                                                </button>
                                              </div>
                                            </div>
          
                                            {bulkSelLocations.length === 0 ? (
                                              <div className="p-6 text-center text-xs text-slate-400 font-medium">
                                                💡 Please select at least one worksite location above to filter targeted employees.
                                              </div>
                                            ) : (
                                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1 pt-1">
                                                {employees
                                                  .filter(emp => bulkSelLocations.includes(emp.location || ""))
                                                  .filter(emp => bulkWizardRoleFilters.length === 0 || bulkWizardRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase()))
                                                  .filter(emp => employeeMatchesSkillFilters(emp, bulkWizardSkillFilters))
                                                  .map(emp => {
                                                    const isSel = bulkSelEmployees.includes(emp.id);
                                                    const toggle = () => {
                                                      if (isSel) setBulkSelEmployees(prev => prev.filter(id => id !== emp.id));
                                                      else setBulkSelEmployees(prev => [...prev, emp.id]);
                                                    };
                                                    return (
                                                      <div 
                                                        key={emp.id}
                                                        onClick={toggle}
                                                        className={`p-2.5 border rounded-lg flex items-center gap-2 cursor-pointer transition select-none ${
                                                          isSel 
                                                            ? "bg-orange-50/60 border-orange-200" 
                                                            : "bg-white border-slate-200 hover:bg-slate-50/55"
                                                        }`}
                                                      >
                                                        <input id="checkbox-field-8162" name="checkbox_8162"
                                                          type="checkbox"
                                                          checked={isSel}
                                                          onChange={() => {}} // toggled by parent div click
                                                          className="w-3.5 h-3.5 rounded text-[#f57416] focus:ring-[#f57416] shrink-0"
                                                        />
                                                        <div className="min-w-0 text-left">
                                                          <p className="text-xs font-bold text-slate-700 truncate">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</p>
                                                          <p className="text-[10px] font-mono text-slate-400 truncate">{emp.employeeCode} • {emp.location}</p>
                                                        </div>
                                                      </div>
                                                    );
                                                  })
                                                }
                                              </div>
                                            )}
                                          </div>
          
                                          {/* Navigation button for Step 1 */}
                                          <div className="flex justify-end pt-2 border-t border-slate-100">
                                            <button
                                              type="button"
                                              disabled={bulkSelEmployees.length === 0}
                                              onClick={() => setBulkWizardStep("dates")}
                                              className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                                                bulkSelEmployees.length > 0 
                                                  ? "bg-[#ff791a] hover:bg-[#e4640c] text-white" 
                                                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                              }`}
                                            >
                                              Continue to Date Selection →
                                            </button>
                                          </div>
                                        </div>
                                      )}
          
                                      {bulkWizardStep === "dates" && (
                                        <div className="space-y-5 animate-fade-in">
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        
                                            {/* Selection Info */}
                                            <div className="md:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 text-left">
                                              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block pb-1 border-b border-slate-200">
                                                📋 Selection Summary
                                              </span>
                                              <div className="space-y-2 text-xs">
                                                <p className="text-slate-500 font-semibold">Location(s): <strong className="text-slate-800">{bulkSelLocations.join(", ")}</strong></p>
                                                <p className="text-slate-500 font-semibold">Months(s): <strong className="text-slate-800">{bulkSelMonths.join(", ")}</strong></p>
                                                <p className="text-slate-500 font-semibold">Staff Enrolled: <strong className="text-slate-800">{bulkSelEmployees.length} employee(s)</strong></p>
                                                <p className="text-slate-500 font-semibold">Dates Selected: <strong className="text-[#f57416]">{bulkSelDates.length} day(s)</strong></p>
                                              </div>
                                          
                                              <div className="pt-2 border-t border-slate-200 space-y-2">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                                    const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                                                    setBulkSelDates(pickSelectableBulkDates(allDays));
                                                  }}
                                                  className="w-full py-1.5 bg-orange-50 hover:bg-orange-100 text-[#e4640c] border border-orange-100 font-extrabold text-[10.5px] uppercase tracking-wider rounded-lg transition cursor-pointer"
                                                >
                                                  Select All Month Days
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setBulkSelDates([])}
                                                  className="w-full py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-extrabold text-[10.5px] uppercase tracking-wider rounded-lg transition cursor-pointer"
                                                >
                                                  Reset Dates
                                                </button>
                                              </div>
          
                                              {/* Smart range selection presets */}
                                              <div className="pt-2.5 border-t border-slate-200 space-y-2">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                                  ⚡ Smart Presets
                                                </span>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                                      const matching = Array.from({ length: Math.min(15, daysInMonth) }, (_, i) => i + 1);
                                                      setBulkSelDates((previous) =>
                                                        pickSelectableBulkDates([...new Set([...previous, ...matching])].sort((a, b) => a - b)),
                                                      );
                                                    }}
                                                    className="py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                                                  >
                                                    First 15 Days
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                                      const matching = Array.from({ length: daysInMonth - 15 }, (_, i) => i + 16);
                                                      setBulkSelDates((previous) =>
                                                        pickSelectableBulkDates([...new Set([...previous, ...matching])].sort((a, b) => a - b)),
                                                      );
                                                    }}
                                                    className="py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                                                  >
                                                    Last 15 Days
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                                      const matching = Array.from({ length: Math.min(7, daysInMonth) }, (_, i) => i + 1);
                                                      setBulkSelDates((previous) =>
                                                        pickSelectableBulkDates([...new Set([...previous, ...matching])].sort((a, b) => a - b)),
                                                      );
                                                    }}
                                                    className="py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                                                  >
                                                    First Week
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                                      const matching = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((day) => day % 2 !== 0);
                                                      setBulkSelDates(pickSelectableBulkDates(matching));
                                                    }}
                                                    className="py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                                                  >
                                                    Odd Days
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                                      const matching = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((day) => day % 2 === 0);
                                                      setBulkSelDates(pickSelectableBulkDates(matching));
                                                    }}
                                                    className="py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer text-center col-span-2"
                                                  >
                                                    Even Days
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
          
                                            <BulkAttendanceDateCalendar
                                              selectedDates={bulkSelDates}
                                              onSelectedDatesChange={setBulkSelDates}
                                              calendarMonth={bulkCalendarMonth || selectedMonth}
                                              onCalendarMonthChange={setBulkCalendarMonth}
                                              availableMonths={bulkSelMonths}
                                              getDaysInMonth={getDaysInSelectedMonth}
                                              disabledDates={bulkAttendanceDayMeta.disabledDays}
                                            />
          
                                          </div>
          
                                          {/* Bottom navigation footer for Step 2 */}
                                          <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-3 mt-4">
                                            <button
                                              type="button"
                                              onClick={() => setBulkWizardStep("employees")}
                                              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
                                            >
                                              ← Back to Staff Selection
                                            </button>
                                        
                                            <button
                                              type="button"
                                              disabled={bulkSelDates.length === 0}
                                              onClick={() => setBulkWizardStep("review")}
                                              className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                                                bulkSelDates.length > 0 
                                                  ? "bg-[#ff791a] hover:bg-[#e4640c] text-white" 
                                                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                              }`}
                                            >
                                              Continue to Review & Submit →
                                            </button>
                                          </div>
                                        </div>
                                      )}
          
                                      {bulkWizardStep === "review" && (
                                        <div className="space-y-5 animate-fade-in">
                                          {/* Confirmation Grid Details */}
                                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                                            <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-200 text-left">
                                              📝 Verification & Cohort summary
                                            </h5>
          
                                            {/* List of Targeted Months & Staff Names (Collapsible / Badges) */}
                                            <div className="space-y-2 text-xs font-semibold text-slate-755 text-left">
                                              <div>
                                                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px] block mb-1">Target Months:</span>
                                                <div className="flex flex-wrap gap-1">
                                                  {bulkSelMonths.map(m => (
                                                    <span key={m} className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-md font-bold text-[10.5px]">{m}</span>
                                                  ))}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px] block mb-1">Employees ({bulkSelEmployees.length}):</span>
                                                <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto pr-1">
                                                  {employees.filter(e => bulkSelEmployees.includes(e.id)).map(e => (
                                                    <span key={e.id} className="px-2 py-0.5 bg-orange-50 border border-orange-100 text-[#e4640c] rounded-md font-bold text-[10px]">{e.nameAsPerAadharColumn || e.nameAsPerAadhar} ({e.employeeCode})</span>
                                                  ))}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px] block mb-1">Target Days ({bulkSelDates.length}):</span>
                                                <div className="flex flex-wrap gap-0.5">
                                                  {bulkSelDates.sort((a,b)=>a-b).map(d => (
                                                    <span key={d} className="w-5 h-5 flex items-center justify-center bg-slate-200 border border-slate-300 text-slate-700 rounded font-bold text-[10px]">{d}</span>
                                                  ))}
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-1.5">
                                                  Weekly off days (Sun for 26-day, Sat/Sun for 22-day) are marked as WO automatically per employee based on the selected month and salary cycle.
                                                </p>
                                              </div>
                                            </div>
                                          </div>
          
                                          {/* Bottom navigation footer for Step 3 */}
                                          <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-4">
                                            <button
                                              type="button"
                                              onClick={() => setBulkWizardStep("dates")}
                                              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
                                            >
                                              ← Back to Date Selection
                                            </button>
                                        
                                            <button
                                              type="button"
                                              onClick={handleApplyBulkWizardAttendance}
                                              className="px-6 py-2.5 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5 bg-[#ff791a] hover:bg-[#e4640c] text-white scale-105"
                                            >
                                              ⚡ Confirm & Mark Bulk Present
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                /* --- STANDARD DAILY ATTENDANCE GRID SHEET VIEW --- */
                                <>
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                                    <div>
                                      <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5">
                                        <Clock className="text-orange-500" size={18} /> Enterprise Attendance & Worksite Workspace
                                      </h3>
                                      <p className="text-xs text-slate-400 mt-0.5">Track daily staff rosters, assign status codes, and execute bulk presence stamping.</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {canEditAttendance && (
                                      <>
                                      <button
                                        onClick={() => {
                                          setAttendanceSubView("wizard");
                                          setBulkWizardStep("employees");
                                        }}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-[#ff791a] hover:from-orange-600 hover:to-[#e4640c] text-white text-xs font-extrabold rounded-lg transition cursor-pointer shadow-md hover:shadow-lg active:scale-95 animate-pulse-once"
                                      >
                                        <Clock size={13} className="stroke-[2.5]" /> Bulk Mark Attendance
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAttendanceSubView("pdf-import")}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#ff791a] hover:bg-orange-50 text-[#e4640c] text-xs font-extrabold rounded-lg transition cursor-pointer shadow-xs"
                                      >
                                        <ScanLine size={13} className="stroke-[2.5]" /> Mark via PDF Upload
                                      </button>
                                      </>
                                      )}
                                      <button
                                        onClick={() => {
                                          const hideAbsents = promptHideAttendanceAbsentColumn();
                                          downloadAttendanceExcel({ hideAbsents });
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer shadow-xs"
                                      >
                                        <FileSpreadsheet size={13} className="text-green-600" /> Export Excel (Landscape)
                                      </button>
                                      <button
                                        onClick={() => {
                                          const hideAbsents = promptHideAttendanceAbsentColumn();
                                          downloadAttendancePDF({ hideAbsents });
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f57416] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-sm"
                                      >
                                        <FileText size={13} /> Export PDF (Landscape)
                                      </button>
                                      <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={hideAttendanceAbsentColumn}
                                          onChange={(e) => setHideAttendanceAbsentColumn(e.target.checked)}
                                          className="w-3.5 h-3.5 rounded border-slate-300 text-[#f57416] focus:ring-[#f57416]"
                                        />
                                        Hide Total Absent
                                      </label>
                                    </div>
                                  </div>
          
                                  {/* Grid controls: Worksite branch & Search filters */}
                                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
                                    <div className="flex flex-col gap-1 text-left">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Employees</label>
                                      <div className="relative">
                                        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                                        <input id="attendance-search-query" name="attendanceSearchQuery"
                                          type="text"
                                          placeholder="Search by code or name..."
                                          value={attendanceSearchQuery}
                                          onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-250 text-xs rounded-lg text-slate-800 font-semibold focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-1 text-left">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Worksite Branch Location</label>
                                      <SearchableMultiSelect
                                        placeholder="All Corporate Branches"
                                        options={customLocations}
                                        selected={attendanceLocationFilters}
                                        onChange={setAttendanceLocationFilters}
                                        containerId="attendance-location-filter"
                                        buttonClassName="w-full px-3 py-1.5 bg-white border border-slate-250 text-xs rounded-lg text-slate-800 font-bold focus:outline-none text-left flex justify-between items-center hover:bg-slate-50 transition cursor-pointer"
                                      />
                                    </div>
          
                                    {/* Attendance Job Role Filter */}
                                    <div className="flex flex-col gap-1 text-left" id="attendance-role-multiselect-container">
                                      <SearchableMultiSelect
                                        label="Job Role"
                                        labelClassName="text-[10px] font-bold text-slate-400 uppercase tracking-wider block"
                                        placeholder="All Job Roles"
                                        options={customRoles}
                                        selected={attendanceRoleFilters}
                                        onChange={setAttendanceRoleFilters}
                                        containerId="attendance-role-filter"
                                        buttonClassName="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-bold text-slate-800 focus:outline-none text-left flex justify-between items-center hover:bg-slate-50 transition cursor-pointer"
                                      />
                                    </div>
          
                                    {/* Attendance Skill Category Filter */}
                                    <div className="flex flex-col gap-1 text-left relative" id="attendance-skill-multiselect-container">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Skill Category</label>
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setIsAttendanceSkillDropdownOpen(!isAttendanceSkillDropdownOpen);
                                            setIsAttendanceRoleDropdownOpen(false);
                                          }}
                                          className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-bold text-slate-800 focus:outline-none text-left flex justify-between items-center hover:bg-slate-50 transition cursor-pointer"
                                        >
                                          <span className="truncate">
                                            {attendanceSkillFilters.length === 0 
                                              ? "All Categories" 
                                              : `${attendanceSkillFilters.length} Selected`}
                                          </span>
                                          <span className="text-[10px] text-slate-400">▼</span>
                                        </button>
                                    
                                        {isAttendanceSkillDropdownOpen && (
                                          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto w-full text-left">
                                            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                              <span className="text-[10px] text-slate-400 font-bold">Categories</span>
                                              <button
                                                type="button"
                                                onClick={() => setAttendanceSkillFilters([])}
                                                className="text-[9px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                                              >
                                                Clear All
                                              </button>
                                            </div>
                                            {["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"].map(cat => {
                                              const isChecked = attendanceSkillFilters.includes(cat);
                                              const toggle = () => {
                                                if (isChecked) {
                                                  setAttendanceSkillFilters(prev => prev.filter(c => c !== cat));
                                                } else {
                                                  setAttendanceSkillFilters(prev => [...prev, cat]);
                                                }
                                              };
                                              return (
                                                <label key={cat} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                                  <input id="checkbox-field-8681" name="checkbox_8681"
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={toggle}
                                                    className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                                  />
                                                  <span className="font-medium">{cat}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
          
                                    <div className="flex flex-col gap-1 text-left">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Cycle Month</label>
                                      <select id="attendance-month-select" name="selectedMonth"
                                        value={MONTHS_LIST.includes(selectedMonth) ? selectedMonth : (MONTHS_LIST[0] || selectedMonth)}
                                        onChange={(e) => setSelectedMonth(normalizeMonthKey(e.target.value))}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-250 text-xs rounded-lg text-slate-800 font-bold focus:outline-none"
                                      >
                                        {MONTHS_LIST.map(m => (
                                          <option key={m} value={m}>{m}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {attendanceRecordFilter !== "all" && (
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#ff791a]/25 bg-orange-50/80">
                                      <span className="text-xs font-bold text-orange-900">
                                        {attendanceRecordFilter === "absent"
                                          ? `Showing employees with absent days · ${selectedMonth}`
                                          : `Showing present-only employees (no absents) · ${selectedMonth}`}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setAttendanceRecordFilter("all")}
                                        className="text-[10px] font-bold text-[#ff791a] hover:text-[#e4640c] cursor-pointer"
                                      >
                                        Clear filter
                                      </button>
                                    </div>
                                  )}

                                  {/* Interactive Grid Table */}
                              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 border-b border-slate-100">
                                  <Switch
                                    defaultChecked
                                    onCheckedChange={handleAttendanceStickyChange}
                                    aria-label="Pin Emp Code and Employee Name columns"
                                  />
                                  <span className="text-[10px] font-medium text-slate-500">Sticky code & name</span>
                                </div>
                                <div
                                  ref={setAttendanceStickyContainer}
                                  className="overflow-auto max-w-full max-h-[min(70vh,720px)]"
                                >
                                  <table className="w-full text-left border-separate border-spacing-0 min-w-[1200px]">
                                    <thead>
                                      <tr className="text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                                        <th className="sticky top-0 z-30 px-3 py-2 w-12 min-w-[3rem] max-w-[3rem] text-center bg-slate-100 text-slate-500 shadow-[inset_0_-1px_0_0_rgb(226,232,240)]">SR</th>
                                        <th className="attendance-sticky-code sticky top-0 z-30 px-3 py-2 w-28 min-w-[7rem] max-w-[7rem] bg-slate-100 text-slate-500 shadow-[inset_0_-1px_0_0_rgb(226,232,240)]">Emp Code</th>
                                        <th className="attendance-sticky-name sticky top-0 z-30 px-3 py-2 w-48 min-w-[12rem] max-w-[12rem] bg-slate-100 text-slate-500 shadow-[inset_0_-1px_0_0_rgb(226,232,240)]">Employee Name</th>
                                        <th className="sticky top-0 z-30 px-3 py-2 w-36 bg-slate-100 text-slate-500 shadow-[inset_0_-1px_0_0_rgb(226,232,240)]">Worksite Location</th>
                                        {Array.from({ length: getDaysInSelectedMonth(selectedMonth) }, (_, i) => {
                                          const dayNum = i + 1;
                                          const isSunday = getDayOfWeekForMonthDay(selectedMonth, dayNum) === 0;
                                          return (
                                            <th
                                              key={i}
                                              title={isSunday ? `Sunday · ${dayNum}` : `Day ${dayNum}`}
                                              className={`sticky top-0 z-30 px-1 py-2 text-center w-8 font-mono shadow-[inset_0_-1px_0_0_rgb(226,232,240)] ${
                                                isSunday
                                                  ? "bg-red-100 text-red-700 font-black"
                                                  : "bg-slate-100 text-slate-500"
                                              }`}
                                            >
                                              {dayNum}
                                            </th>
                                          );
                                        })}
                                        <th className="sticky top-0 z-30 px-3 py-2 text-center w-16 bg-slate-100 text-slate-500 shadow-[inset_0_-1px_0_0_rgb(226,232,240)]">P</th>
                                        {!hideAttendanceAbsentColumn && (
                                          <th className="sticky top-0 z-30 px-3 py-2 text-center w-16 bg-slate-100 text-slate-500 shadow-[inset_0_-1px_0_0_rgb(226,232,240)]">A</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                      {(() => {
                                        const filtered = employees.filter(emp => {
                                          if (isEmployeeExitedForMonth(emp, selectedMonth)) return false;
                                          const locMatch = matchesMultiSelectFilter(emp.location, attendanceLocationFilters);
                                          const roleMatch = attendanceRoleFilters.length === 0 || attendanceRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase());
                                          const skillMatch = employeeMatchesSkillFilters(emp, attendanceSkillFilters);
                                          const q = attendanceSearchQuery.toLowerCase().trim();
                                          const searchMatch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadhar || "").toLowerCase().includes(q);
                                          if (!(locMatch && searchMatch && roleMatch && skillMatch)) return false;

                                          if (attendanceRecordFilter !== "all") {
                                            const monthData = attendanceDb[selectedMonth] || {};
                                            const empData = monthData[emp.id] || {};
                                            const daysCount = getDaysInSelectedMonth(selectedMonth);
                                            const counts = countMonthAttendance(
                                              empData,
                                              daysCount,
                                              (day) => isEmployeeExitedOnDayStatic(emp, selectedMonth, day),
                                              { workingDaysType: emp.workingDaysType, monthStr: selectedMonth },
                                            );
                                            if (!employeeMatchesAttendanceRecordFilter(counts.presents, counts.absents, attendanceRecordFilter)) {
                                              return false;
                                            }
                                          }
                                          return true;
                                        });
          
                                        if (filtered.length === 0) {
                                          return (
                                            <tr>
                                              <td colSpan={getDaysInSelectedMonth(selectedMonth) + 5 + (hideAttendanceAbsentColumn ? 0 : 1)} className="px-6 py-10 text-center text-slate-400">
                                                {attendanceRecordFilter === "absent"
                                                  ? `No employees with absent days in ${selectedMonth}.`
                                                  : attendanceRecordFilter === "present"
                                                    ? `No present-only employees in ${selectedMonth}.`
                                                    : "No onboarded staff detected under active worksite location or search criteria."}
                                              </td>
                                            </tr>
                                          );
                                        }
          
                                        return filtered.map((emp, index) => {
                                          const monthData = attendanceDb[selectedMonth] || {};
                                          const empData = monthData[emp.id] || {};
                                          const daysCount = getDaysInSelectedMonth(selectedMonth);

                                          const { presents, absents } = countMonthAttendance(
                                            empData,
                                            daysCount,
                                            (day) => isEmployeeExitedOnDayStatic(emp, selectedMonth, day),
                                            { workingDaysType: emp.workingDaysType, monthStr: selectedMonth },
                                          );

                                          const stickyRowBg =
                                            attendanceRecordFilter === "absent" && absents > 0
                                              ? "bg-rose-50 group-hover:bg-rose-100/70"
                                              : "bg-white group-hover:bg-slate-50";

                                          return (
                                            <tr
                                              key={emp.id}
                                              className={`group hover:bg-slate-50/50 ${
                                                attendanceRecordFilter === "absent" && absents > 0 ? "bg-rose-50/40" : ""
                                              }`}
                                            >
                                              <td className="px-3 py-2 w-12 min-w-[3rem] max-w-[3rem] text-center text-slate-400 font-bold">
                                                {index + 1}
                                              </td>
                                              <td className={`attendance-sticky-code ${stickyRowBg} px-3 py-2 w-28 min-w-[7rem] max-w-[7rem] font-mono font-bold`}>
                                                <button
                                                  type="button"
                                                  onClick={() => openEmployeeAttendanceMarking(emp.id)}
                                                  className="text-[#ff791a] hover:text-[#e4640c] hover:underline cursor-pointer transition"
                                                  title="Open individual attendance marking"
                                                >
                                                  {emp.employeeCode}
                                                </button>
                                              </td>
                                              <td className={`attendance-sticky-name ${stickyRowBg} px-3 py-2 w-48 min-w-[12rem] max-w-[12rem] font-semibold`}>
                                                <button
                                                  type="button"
                                                  onClick={() => openEmployeeAttendanceMarking(emp.id)}
                                                  className="text-[#ff791a] hover:text-[#e4640c] hover:underline cursor-pointer transition text-left"
                                                  title="Open individual attendance marking"
                                                >
                                                  {emp.nameAsPerAadhar}
                                                </button>
                                              </td>
                                              <td className="px-3 py-2 text-slate-500 font-medium truncate max-w-[120px]" title={emp.location || "Unassigned"}>
                                                {emp.location || "—"}
                                              </td>
                                              {Array.from({ length: daysCount }, (_, i) => {
                                                const dayNum = i + 1;
                                                const currentStatus = empData[dayNum] || "";
                                                const isExitedToday = isEmployeeExitedOnDayStatic(emp, selectedMonth, dayNum);
                                                const isWeeklyOff = isWeeklyOffDay(emp.workingDaysType, selectedMonth, dayNum);
                                                const isSunday = getDayOfWeekForMonthDay(selectedMonth, dayNum) === 0;
                                                const effectiveStatus = getEffectiveAttendanceStatus(
                                                  emp.workingDaysType,
                                                  selectedMonth,
                                                  dayNum,
                                                  currentStatus,
                                                );
                                                return (
                                                  <td key={i} className={`px-0.5 py-1 text-center ${isSunday ? "bg-red-50/50" : ""}`}>
                                                    {isExitedToday ? (
                                                      <span 
                                                        className="text-[9px] font-bold text-slate-400 select-none bg-slate-100 rounded px-1.5 py-0.5 border border-slate-200"
                                                        title="Exited / Inactive"
                                                      >
                                                        —
                                                      </span>
                                                    ) : isWeeklyOff && currentStatus !== "P" ? (
                                                      canEditAttendance ? (
                                                      <select id={`attendance-${emp.id}-day-${dayNum}`} name={`attendance_${emp.id}_day_${dayNum}`}
                                                        value="WO"
                                                        onChange={(e) => {
                                                          const val = e.target.value;
                                                          if (val === "P") handleCellAttendanceChange(emp.id, dayNum, "P");
                                                        }}
                                                        title="Weekly Off — change to Present if employee worked"
                                                        className="text-[9px] font-black text-center border-0 rounded px-1 py-0.5 focus:ring-0 focus:outline-none cursor-pointer bg-red-100 text-red-800"
                                                      >
                                                        <option value="WO">WO</option>
                                                        <option value="P">P</option>
                                                      </select>
                                                      ) : (
                                                        <span className={attendanceBadgeClass("WO")}>WO</span>
                                                      )
                                                    ) : isWeeklyOff && currentStatus === "P" ? (
                                                      canEditAttendance ? (
                                                      <select id={`attendance-${emp.id}-day-${dayNum}`} name={`attendance_${emp.id}_day_${dayNum}`}
                                                        value="P"
                                                        onChange={(e) => {
                                                          const val = e.target.value;
                                                          handleCellAttendanceChange(emp.id, dayNum, val === "WO" ? "" : val);
                                                        }}
                                                        title="Present on weekly off — change back to WO if needed"
                                                        className="text-[9px] font-black text-center border-0 rounded px-1 py-0.5 focus:ring-0 focus:outline-none cursor-pointer bg-emerald-100 text-emerald-800"
                                                      >
                                                        <option value="WO">WO</option>
                                                        <option value="P">P</option>
                                                      </select>
                                                      ) : (
                                                        <span className={attendanceBadgeClass("P")}>P</span>
                                                      )
                                                    ) : canEditAttendance ? (
                                                      <select id={`attendance-${emp.id}-day-${dayNum}`} name={`attendance_${emp.id}_day_${dayNum}`}
                                                        value={currentStatus}
                                                        onChange={(e) => handleCellAttendanceChange(emp.id, dayNum, e.target.value)}
                                                        className={`text-[9px] font-black text-center border-0 rounded px-1 py-0.5 focus:ring-0 focus:outline-none cursor-pointer ${
                                                          effectiveStatus === "P" ? "bg-emerald-100 text-emerald-800" :
                                                          effectiveStatus === "A" ? "bg-rose-100 text-rose-800" :
                                                          effectiveStatus === "L" ? "bg-amber-100 text-amber-800" :
                                                          effectiveStatus === "H" ? "bg-blue-100 text-blue-800" :
                                                          "bg-slate-100 text-slate-400 font-semibold"
                                                        }`}
                                                      >
                                                        <option value="">—</option>
                                                        <option value="P">P</option>
                                                        <option value="A">A</option>
                                                        <option value="L">L</option>
                                                        <option value="H">H</option>
                                                      </select>
                                                    ) : (
                                                      <span className={attendanceBadgeClass(effectiveStatus || currentStatus || "—")}>
                                                        {effectiveStatus || currentStatus || "—"}
                                                      </span>
                                                    )}
                                                  </td>
                                                );
                                              })}
                                              <td className="px-3 py-2 text-center font-bold text-emerald-600">{presents}</td>
                                              {!hideAttendanceAbsentColumn && (
                                                <td className="px-3 py-2 text-center font-bold text-rose-600">{absents}</td>
                                              )}
                                            </tr>
                                          );
                                        });
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                                </>
                              )}
                            </div>
                          ) : isSchoolWorkTab(activeSidebarTab) ? (
                            <>
                              {activeSidebarTab === "Schools" && (
                                <section className="flex-1 flex flex-col min-h-[400px] bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                                  <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                    <div>
                                      <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                                        <School className="text-[#ff791a]" size={18} />
                                        {isSchoolBulkEditMode ? "Bulk Edit Schools" : "Schools"}
                                      </h2>
                                      <p className="text-xs text-slate-400 mt-0.5">
                                        {isSchoolLoading
                                          ? "Loading..."
                                          : `${schoolDashboardStats.totalCount} schools · ${schoolDashboardStats.totalToilets} toilets · ₹${schoolDashboardStats.totalPartnerPay.toLocaleString("en-IN")} partner pay/mo`}
                                      </p>
                                    </div>
                                    {!isSchoolBulkEditMode && !!userPermissions.schoolWork?.edit && (
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setIsSchoolImporterOpen((open) => !open)}
                                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                                        >
                                          <DownloadCloud size={14} />
                                          {isSchoolImporterOpen ? "Hide Import" : "Import"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (Object.keys(schoolBulkEditDrafts).length > 0) {
                                              const confirmed = await confirmAction({
                                                title: "Exit bulk edit",
                                                message: "Exit bulk edit? Unsaved changes are kept until you discard them.",
                                                confirmLabel: "Exit",
                                                variant: "warning",
                                              });
                                              if (!confirmed) return;
                                            }
                                            setIsSchoolBulkEditMode(true);
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition cursor-pointer"
                                        >
                                          Bulk Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={openAddSchoolForm}
                                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg transition cursor-pointer"
                                        >
                                          <Plus size={14} />
                                          Add School
                                        </button>
                                      </div>
                                    )}
                                    {isSchoolBulkEditMode && !!userPermissions.schoolWork?.edit && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (Object.keys(schoolBulkEditDrafts).length > 0) {
                                            const confirmed = await confirmAction({
                                              title: "Exit bulk edit",
                                              message: "Exit bulk edit? Unsaved changes are kept until you discard them.",
                                              confirmLabel: "Exit",
                                              variant: "warning",
                                            });
                                            if (!confirmed) return;
                                          }
                                          setIsSchoolBulkEditMode(false);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-lg border border-amber-300 transition cursor-pointer"
                                      >
                                        Exit Bulk Edit
                                      </button>
                                    )}
                                  </div>

                                  {isSchoolImporterOpen && !!userPermissions.schoolWork?.edit && !isSchoolBulkEditMode && (
                                    <div className="mb-4">
                                      <SchoolWorkImporter
                                        onImportSuccess={(schools) => {
                                          handleBulkSchoolImport(schools);
                                          setIsSchoolImporterOpen(false);
                                        }}
                                        existingUdiseCodes={existingSchoolUdiseCodes}
                                        districts={schoolDistricts}
                                        blocks={schoolBlocks}
                                      />
                                    </div>
                                  )}

                                  {isSchoolLoading ? (
                                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 font-medium">
                                      <div className="relative w-10 h-10 mb-3 animate-spin">
                                        <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-[#ff791a] border-t-transparent"></div>
                                      </div>
                                      Loading school directory...
                                    </div>
                                  ) : (
                                    <SchoolWorkTable
                                      schools={rawSchoolWorks}
                                      districts={schoolDistricts}
                                      blocks={schoolBlocks}
                                      supervisors={rawSchoolSupervisors}
                                      selectedIds={selectedSchoolIds}
                                      onSelectionChange={setSelectedSchoolIds}
                                      districtFilter={schoolDistrictFilter}
                                      onDistrictFilterChange={setSchoolDistrictFilter}
                                      onEditClick={(school) => {
                                        setCurrentSchool(school);
                                        setIsSchoolFormOpen(true);
                                      }}
                                      onDeleteClick={handleDeleteSchoolWork}
                                      onBulkDelete={handleBulkDeleteSchools}
                                      onExportSelected={handleExportSchoolsSelected}
                                      readOnly={!userPermissions.schoolWork?.edit}
                                      bulkEditMode={isSchoolBulkEditMode}
                                      draftChanges={schoolBulkEditDrafts}
                                      onDraftChange={handleSchoolBulkEditDraftChange}
                                      onDraftChangeMany={handleSchoolBulkEditDraftChangeMany}
                                      onDiscardBulkEdit={handleDiscardSchoolBulkEditDrafts}
                                      onApplyBulkEdit={handleApplySchoolBulkEdit}
                                      isApplyingBulkEdit={isSubmittingSchoolBulkEdit}
                                    />
                                  )}
                                </section>
                              )}

                              {activeSidebarTab === "Monthly Billing" && (
                                <MonthlyInvoiceTab
                                  schools={rawSchoolWorks}
                                  partners={rawSchoolPartners}
                                  districts={schoolDistricts}
                                  blocks={schoolBlocks}
                                  billings={rawSchoolBillings}
                                  selectedMonth={selectedMonth}
                                  monthsList={MONTHS_LIST}
                                  onMonthChange={(month) => setSelectedMonth(normalizeMonthKey(month))}
                                  onGenerate={handleGenerateSchoolBilling}
                                  onDeleteBilling={canDeleteSchoolWork ? handleDeleteSchoolBilling : undefined}
                                  onSaveWorkdays={handleSaveSchoolWorkdays}
                                  onSavePayUpdates={handleSavePartnerPayUpdates}
                                  onSavePartnerDetails={handleSavePartnerPayDetails}
                                  onSavePaymentStatus={handleSavePartnerPaymentStatus}
                                  onRefreshBillings={fetchSchoolBillings}
                                  onExportAxisBulkPay={handleExportSchoolAxisBulkPay}
                                  isExportingBulkPay={isExportingSchoolBulkPay}
                                  lastSavedBulkPay={lastSavedSchoolBulkPay}
                                  onViewSavedBulkPay={() => setActiveSidebarTab("Saved School Bulk Pay")}
                                  readOnly={!userPermissions.schoolWork?.edit}
                                />
                              )}

                              {activeSidebarTab === "Expenses" && (
                                <SchoolExpensesPanel
                                  schools={rawSchoolWorks}
                                  districts={schoolDistricts}
                                  blocks={schoolBlocks}
                                  monthsList={MONTHS_LIST}
                                  monthKey={selectedMonth}
                                  onMonthChange={(month) => setSelectedMonth(normalizeMonthKey(month))}
                                  onAddExpense={handleAddExpenseRecord}
                                  onDeleteExpense={handleDeleteExpenseRecord}
                                  readOnly={!userPermissions.schoolWork?.edit}
                                />
                              )}

                              {activeSidebarTab === "Field Team" && (
                                <FieldTeamPanel
                                  visits={rawSchoolVisits}
                                  requests={rawSupervisorRequests}
                                  commitments={rawCommitmentDiary}
                                  supervisors={rawSchoolSupervisors}
                                  schools={rawSchoolWorks}
                                  onAddSupervisor={openAddSupervisorForm}
                                  onEditSupervisor={(supervisor) => {
                                    setCurrentSupervisor(supervisor);
                                    setIsSupervisorFormOpen(true);
                                  }}
                                  onDeleteSupervisor={handleDeleteSchoolSupervisor}
                                  onUpdateVisitStatus={handleUpdateVisitStatus}
                                  onBulkUpdateVisitStatus={handleBulkUpdateVisitStatus}
                                  onRespondToRequest={handleRespondSupervisorRequest}
                                  onCloseRequest={handleCloseSupervisorRequest}
                                  onResolveEscalation={handleResolveSupervisorEscalation}
                                  onUpdateCommitment={handleUpdateCommitmentDiary}
                                  pendingRequestCount={pendingSupervisorRequestCount}
                                  readOnly={!userPermissions.schoolWork?.edit}
                                  isSuperAdmin={
                                    String(sessionUser || "").toLowerCase() === "admin" ||
                                    String(sessionRole || "").toLowerCase() === "admin"
                                  }
                                  view={fieldTeamView}
                                  onViewChange={setFieldTeamView}
                                />
                              )}

                              {activeSidebarTab === "Saved School Bulk Pay" && (
                                <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="saved-school-bulk-pay-module-view">
                                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                                      <div>
                                        <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                          <Archive size={20} className="text-[#ff791a]" /> Saved School Bulk Pay Files
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                          Axis Bank bulk pay files for partner payments — includes bank upload rows plus the full partner payment sheet for preview and re-download.
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        {schoolBulkPayArchiveYears.length > 0 && (
                                          <select
                                            id="school-bulk-pay-year-filter"
                                            value={schoolBulkPayArchiveYearFilter}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              setSchoolBulkPayArchiveYearFilter(value);
                                              fetchSchoolBulkPayArchives(value);
                                            }}
                                            className="px-3 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:border-[#ff791a] transition"
                                          >
                                            <option value="">All Years</option>
                                            {schoolBulkPayArchiveYears.map((y) => (
                                              <option key={y} value={y}>{y}</option>
                                            ))}
                                          </select>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => fetchSchoolBulkPayArchives()}
                                          className="px-3.5 py-1.5 bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                                        >
                                          <RotateCw size={13} /> Refresh
                                        </button>
                                      </div>
                                    </div>

                                    {lastSavedSchoolBulkPay && highlightedSchoolBulkPayId === lastSavedSchoolBulkPay.id && (
                                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                          <p className="text-xs font-black text-orange-800 uppercase tracking-wider flex items-center gap-1.5">
                                            <CheckCircle2 size={14} /> Just Saved
                                          </p>
                                          <p className="text-[11px] text-orange-700 mt-1 font-mono truncate" title={lastSavedSchoolBulkPay.filename}>
                                            {lastSavedSchoolBulkPay.filename}
                                          </p>
                                          <p className="text-[10px] text-orange-500 mt-0.5">
                                            {lastSavedSchoolBulkPay.month} {lastSavedSchoolBulkPay.year} · {lastSavedSchoolBulkPay.recordCount} records · ₹{Number(lastSavedSchoolBulkPay.totalAmount || 0).toLocaleString("en-IN")}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => handleViewSchoolBulkPayArchive(lastSavedSchoolBulkPay.id, lastSavedSchoolBulkPay.filename)}
                                            className="px-3 py-1.5 bg-white hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                          >
                                            <Eye size={11} /> View Excel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDownloadSchoolBulkPayArchive(lastSavedSchoolBulkPay.id, lastSavedSchoolBulkPay.filename)}
                                            className="px-3 py-1.5 bg-[#ff791a] hover:bg-[#e4640c] text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
                                          >
                                            <Download size={11} />
                                            Re-download
                                            <span className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-black leading-none">
                                              {lastSavedSchoolBulkPay.downloadCount ?? 0}
                                            </span>
                                          </button>
                                          {canDeleteSchoolWork && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteSchoolBulkPayArchive(lastSavedSchoolBulkPay.id)}
                                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[10px] font-bold cursor-pointer"
                                            >
                                              Delete
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {isFetchingSchoolBulkPayArchives ? (
                                      <p className="text-sm text-slate-500">Loading saved files...</p>
                                    ) : filteredSchoolBulkPayArchives.length === 0 ? (
                                      <div className="text-center py-12 space-y-2">
                                        <Archive size={32} className="mx-auto text-slate-300" />
                                        <p className="text-sm text-slate-500 font-semibold">No school bulk pay files saved yet</p>
                                        <p className="text-xs text-slate-400">
                                          Export bulk pay from Monthly Billing → Partner Pay to automatically archive the Excel sheet here.
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => setActiveSidebarTab("Monthly Billing")}
                                          className="mt-2 px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg cursor-pointer transition"
                                        >
                                          Go to Monthly Billing
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                          <thead>
                                            <tr className="text-slate-500 uppercase tracking-wide border-b border-slate-200">
                                              <th className="py-2.5 pr-4 font-bold">Saved On</th>
                                              <th className="py-2.5 pr-4 font-bold">Month</th>
                                              <th className="py-2.5 pr-4 font-bold">Year</th>
                                              <th className="py-2.5 pr-4 font-bold">Filename</th>
                                              <th className="py-2.5 pr-4 font-bold">Records</th>
                                              <th className="py-2.5 pr-4 font-bold">Total Amount</th>
                                              <th className="py-2.5 pr-4 font-bold">Exported By</th>
                                              <th className="py-2.5 font-bold">Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {filteredSchoolBulkPayArchives.map((item: any) => {
                                              const displayMonth = item.year
                                                ? item.month
                                                : parseMonthYear(item.month).month;
                                              const displayYear = item.year || parseMonthYear(item.month).year;
                                              const isHighlighted = highlightedSchoolBulkPayId === item.id;
                                              return (
                                                <tr
                                                  key={item.id}
                                                  className={`border-b border-slate-50 hover:bg-slate-50/70 ${isHighlighted ? "bg-orange-50 ring-1 ring-inset ring-orange-200" : ""}`}
                                                >
                                                  <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                                                  </td>
                                                  <td className="py-2.5 pr-4 font-semibold text-slate-700">{displayMonth || "—"}</td>
                                                  <td className="py-2.5 pr-4 font-semibold text-slate-700">{displayYear || "—"}</td>
                                                  <td className="py-2.5 pr-4 max-w-[260px]" title={item.filename}>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleViewSchoolBulkPayArchive(item.id, item.filename)}
                                                      className="flex items-center gap-1.5 min-w-0 text-left hover:text-[#ff791a] cursor-pointer group"
                                                      title="Click to preview Excel in browser"
                                                    >
                                                      <FileSpreadsheet size={14} className="text-emerald-600 shrink-0 group-hover:text-[#ff791a]" />
                                                      <span className="truncate font-mono text-[11px] text-slate-700 underline-offset-2 group-hover:underline">{item.filename}</span>
                                                    </button>
                                                  </td>
                                                  <td className="py-2.5 pr-4">{item.recordCount ?? 0}</td>
                                                  <td className="py-2.5 pr-4 font-mono">
                                                    ₹{Number(item.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="py-2.5 pr-4">{item.username || "—"}</td>
                                                  <td className="py-2.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                      <button
                                                        type="button"
                                                        onClick={() => handleViewSchoolBulkPayArchive(item.id, item.filename)}
                                                        className="px-2.5 py-1 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                                      >
                                                        <Eye size={11} /> View
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleDownloadSchoolBulkPayArchive(item.id, item.filename)}
                                                        className="px-2.5 py-1 bg-[#ff791a] hover:bg-[#e4640c] text-white rounded text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
                                                      >
                                                        <Download size={11} />
                                                        Re-download
                                                        <span className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-black leading-none">
                                                          {item.downloadCount ?? 0}
                                                        </span>
                                                      </button>
                                                      {canDeleteSchoolWork && (
                                                        <button
                                                          type="button"
                                                          onClick={() => handleDeleteSchoolBulkPayArchive(item.id)}
                                                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold cursor-pointer"
                                                        >
                                                          Delete
                                                        </button>
                                                      )}
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : isBidsTab(activeSidebarTab) ? (
                            <>
                              {activeSidebarTab === "Tenders" && (
                                <TendersPanel
                                  tenders={rawTenders}
                                  readOnly={!userPermissions.bids?.edit}
                                  canManageLockedTenders={isSuperAdmin}
                                  initialDeadlineFilter={tenderDeadlineFilter}
                                  onRefresh={fetchTenders}
                                  onCreate={handleCreateTender}
                                  onUpdate={handleUpdateTender}
                                  onDelete={handleDeleteTender}
                                  onBulkUpdate={handleBulkUpdateTenders}
                                  onBulkDelete={handleBulkDeleteTenders}
                                  onImport={handleImportTenders}
                                />
                              )}

                              {activeSidebarTab === "Contracts" && (
                                <ContractsPanel
                                  contracts={rawContracts}
                                  tenders={rawTenders}
                                  availableLocations={registryLocations}
                                  readOnly={!userPermissions.bids?.edit}
                                  onRefresh={fetchContracts}
                                  onCreate={handleCreateContract}
                                  onUpdate={handleUpdateContract}
                                  onDelete={handleDeleteContract}
                                  onImport={handleImportContracts}
                                />
                              )}
                            </>
                          ) : isRenewalsTab(activeSidebarTab) ? (
                            <>
                              {(() => {
                                const category = RENEWAL_TAB_TO_CATEGORY[activeSidebarTab];
                                const categoryRenewals = rawRenewals.filter((r) => r.category === category);
                                return (
                                  <RenewalsPanel
                                    category={category}
                                    tabLabel={activeSidebarTab}
                                    renewals={categoryRenewals}
                                    readOnly={!userPermissions.renewals?.edit}
                                    initialExpiryFilter={renewalExpiryFilter}
                                    onRefresh={fetchRenewals}
                                    onCreate={handleCreateRenewal}
                                    onUpdate={handleUpdateRenewal}
                                    onDelete={handleDeleteRenewal}
                                    onImport={handleImportRenewals}
                                  />
                                );
                              })()}
                            </>
                          ) : isBgDdTab(activeSidebarTab) ? (
                            <BgDdPanel
                              records={rawBgDdRecords}
                              contracts={rawContracts}
                              readOnly={!userPermissions.bids?.edit}
                              initialExpiryFilter={bgDdExpiryFilter}
                              initialTypeFilter={bgDdTypeFilter}
                              onRefresh={fetchBgDdRecords}
                              onCreate={handleCreateBgDdRecord}
                              onUpdate={handleUpdateBgDdRecord}
                              onDelete={handleDeleteBgDdRecord}
                            />
                          ) : isMonitorTab(activeSidebarTab) ? (
                            <MonitorPanel readOnly={!userPermissions.monitor?.edit} />
                          ) : activeSidebarTab !== "Employees" ? (
                           /* --- OTHER TABS VIEW: Dashboard, Recruitment, Leave, etc. --- */
                           <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-4xl mx-auto shadow-xs text-center space-y-6" id="incoming-tab-view">
                            <div className="w-16 h-16 bg-orange-50 text-[#ff791a] rounded-full flex items-center justify-center mx-auto text-3xl shadow-sm">
                              ⚡
                            </div>
                            <div className="space-y-2">
                              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                                {activeSidebarTab} Module clearance Active
                              </h2>
                              <p className="text-sm text-slate-500 max-w-md mx-auto">
                                You are logged into FlexHRM enterprise as <strong className="text-slate-800">{sessionUser}</strong>. All employee datasets, CSV bulk tools, and exports remain fully loaded in the Employees module.
                              </p>
                            </div>
                            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-150 inline-block text-left text-xs max-w-md w-full">
                              <span className="font-bold text-slate-700 block mb-2 flex items-center gap-1">
                                <Info size={14} className="text-blue-500" /> Executive Metadata Overview
                              </span>
                              <ul className="text-slate-500 space-y-1 font-mono">
                                <li>• Total Employee Records: {employees.length}</li>
                                <li>• Mapped Locations: {dashboardStats.uniqueLocsCount}</li>
                                <li>• Base Branch: {companyBranch}</li>
                              </ul>
                            </div>
                            <div>
                              <button
                                onClick={() => setActiveSidebarTab("Employees")}
                                className="px-5 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg shadow transition cursor-pointer"
                              >
                                Return to Employees Module
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* --- CENTRAL EMPLOYEES MODULE ACTIVE --- */
                          <EmployeesPage />
                        )}
                      </>
                    </div>
  );
}
