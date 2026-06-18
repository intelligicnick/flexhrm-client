import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Users, 
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
  Eye,
  School,
  Compass,
} from "lucide-react";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Employee, EXCEL_ROW_HEADERS, SchoolWork, SCHOOL_EXCEL_ROW_HEADERS } from "../types";
import PasswordInput from "../components/PasswordInput";
import {
  generateCSV,
  getEmployeeHeaderValue,
  normalizeSkillCategory,
  employeeMatchesSkillFilters,
  prorateSalaryByAttendance,
  isEmployeeEsicCovered,
  calculatePfAmounts,
  calculateProfessionalTax,
  quoteCSVValue,
  downloadAxisBulkPayXls,
  saveAxisBulkPayArchive,
  getAxisDebitAccountNo,
  buildAxisBulkPayFilename,
  parseMonthYear,
  parseBulkPayXlsWorkbook,
  getBulkPayPreviewHeaderRowCount,
} from "../utils";
import { formatAuditLogDetails } from "../utils/formatAuditLogDetails";
import CsvImporter from "../components/CsvImporter";
import EmployeeTable from "../components/EmployeeTable";
import EmployeeFormModal from "../components/EmployeeFormModal";
import SchoolWorkFormModal from "../components/SchoolWorkFormModal";
import SchoolSupervisorFormModal from "../components/SchoolSupervisorFormModal";
import { parseApiError } from "../api";
import {
  getCurrentFY, getFinancialYears, MONTH_NAME_LIST, getMonthsForFY,
  getCalendarYearFromFYRange, normalizeMonthKey, safeNumber, getDaysInMonthStatic,
  getCurrentMonthName, getTodayBirthdayLabel, getOrdinalDay, parseDateOfBirth,
  formatEmployeeBirthDate,
} from "../lib/date-helpers";
import { isEmployeeExitedGeneral, isEmployeeExitedOnDayStatic, isEmployeeExitedForMonth } from "../lib/employee-helpers";
import { getSalaryColumnValue } from "../lib/salary-columns";
import { getModuleKey, PERMISSION_MODULES, SidebarItemDef } from "../lib/permissions";
import { tabToPath, pathToTab, DEFAULT_PATH } from "../routes";
import PercentIcon from "../components/ui/PercentIcon";
import DialerOverlay from "../components/ui/DialerOverlay";
import DirectoryContactCard from "../components/DirectoryContactCard";
import { formatPhoneDisplay, phoneToDialString } from "../lib/phone-helpers";
import ConfettiRain from "../components/ui/ConfettiRain";
import ExcelPreviewGrid from "../components/ExcelPreviewGrid";
import BirthdaysTab from "../components/BirthdaysTab";
import { useHRMS } from "../context/HRMSContext";
import ModuleContent from "../pages/ModuleContent";
import NotificationsBell from "../components/NotificationsBell";
import {
  ExtensionIntegrationModal,
  ExtensionProfileMenuItem,
} from "../components/ExtensionIntegration";

export default function DashboardLayout() {
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
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
    inviteError,
    inviteSuccess,
    isFetchingAdmins,
    roleNameInput,
    roleDescInput,
    rolePermsInput,
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
    rawEmployees,
    selectedIds,
    isFormOpen,
    currentEmployee,
    isLoading,
    errorMessage,
    successMessage,
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
    salaryLocationFilter,
    salaryFilterType,
    salaryJoinStartFilter,
    salaryJoinEndFilter,
    salaryExitStartFilter,
    salaryExitEndFilter,
    salaryMinSalaryFilter,
    salaryMaxSalaryFilter,
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
    helplineLocationFilter,
    attendanceDb,
    isFetchingAttendance,
    attendanceLocationFilter,
    attendanceRoleFilters,
    attendanceSkillFilters,
    isAttendanceRoleDropdownOpen,
    isAttendanceSkillDropdownOpen,
    bulkWizardRoleFilters,
    bulkWizardSkillFilters,
    isBulkWizardRoleDropdownOpen,
    isBulkWizardSkillDropdownOpen,
    attendanceSearchQuery,
    bulkStartDay,
    bulkEndDay,
    bulkStatus,
    bulkWizardStep,
    isBulkWizardOpen,
    attendanceSubView,
    bulkSelLocations,
    bulkSelEmployees,
    bulkSelMonths,
    bulkCalendarMonth,
    bulkSelDates,
    bulkConfirm1,
    bulkConfirm2,
    activeDirectorySubTab,
    directorySearch,
    directoryLocation,
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
    handleSaveBatchLedgerRecords,
    handleSaveLedgerRecord,
    handleClearLedgerValue,
    renderClearButtonOrConfirm,
    handleUpdatePerkValue,
    handleUpdatePaymentStatus,
    handleBulkUpdatePaymentStatus,
    handleCallInitiate,
    downloadReportsCSV,
    downloadReportsExcel,
    downloadReportsPDF,
    downloadSalaryExcel,
    downloadSalaryPDF,
    fetchEmployees,
    fetchAdmins,
    fetchAdminProfile,
    handlePasswordChangeSubmit,
    triggerSuccess,
    handleLoginSubmit,
    handleForgotPasswordSubmit,
    handleResetPasswordSubmit,
    openForgotPassword,
    backToSignIn,
    handleInviteAdminSubmit,
    handleUpdateAdminSubmit,
    handleLogout,
    handleSaveRoleSubmit,
    handleDeleteRole,
    handleSaveEmployee,
    handleBulkImport,
    handleDeleteEmployee,
    handleBulkDelete,
    buildAxisBulkPayItems,
    handleExportAxisBulkPay,
    handleExportSelected,
    handlePimSubTabClick,
    navigateToTab,
    setMyInfoTab,
    toggleSidebarGroup,
    expandedSidebarGroups,
    isSchoolFormOpen,
    setIsSchoolFormOpen,
    currentSchool,
    setCurrentSchool,
    handleSaveSchoolWork,
    rawSchoolSupervisors,
    schoolDistricts,
    schoolBlocks,
    isSupervisorFormOpen,
    setIsSupervisorFormOpen,
    currentSupervisor,
    setCurrentSupervisor,
    handleSaveSchoolSupervisor,
    showFlushAuditModal,
    closeFlushAuditModal,
    flushAuditPassword,
    setFlushAuditPassword,
    flushAuditError,
    isFlushingAuditLogs,
    bulkPayPreview,
    setBulkPayPreview,
    schoolBulkPayPreview,
    setSchoolBulkPayPreview,
    handleDownloadSchoolBulkPayArchive,
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
    PERMISSION_MODULES,
    sidebarItems,
    filteredSidebarItems,
    activeModuleKey,
    isModuleAccessDenied,
    SALARY_HEADERS,
    userPermissions,
    employees,
    customLocations,
    bulkPayArchiveYears,
    filteredBulkPayArchives,
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
    setInviteError,
    setInviteSuccess,
    setIsFetchingAdmins,
    setRoleNameInput,
    setRoleDescInput,
    setRolePermsInput,
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
    setSalaryLocationFilter,
    setSalaryFilterType,
    setSalaryJoinStartFilter,
    setSalaryJoinEndFilter,
    setSalaryExitStartFilter,
    setSalaryExitEndFilter,
    setSalaryMinSalaryFilter,
    setSalaryMaxSalaryFilter,
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
    setHelplineLocationFilter,
    setAttendanceDb,
    setIsFetchingAttendance,
    setAttendanceLocationFilter,
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
    setBulkSelLocations,
    setBulkSelEmployees,
    setBulkSelMonths,
    setBulkCalendarMonth,
    setBulkSelDates,
    setBulkConfirm1,
    setBulkConfirm2,
    setActiveDirectorySubTab,
    setDirectorySearch,
    setDirectoryLocation,
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
    adminNotifications,
    adminNotificationUnreadCount,
    isFetchingAdminNotifications,
    fetchAdminNotifications,
    handleMarkAdminNotificationRead,
    handleMarkAllAdminNotificationsRead,
    handleAdminNotificationNavigate,
    navigate,
    location,
  } = useHRMS();
  return (
        <div className="h-screen max-h-screen bg-slate-100/70 text-slate-800 font-sans flex flex-row overflow-hidden" id="management-shell">
              
                  {/* Sidebar Backdrop overlay on mobile viewports */}
                  {!isSidebarCollapsed && (
                    <div 
                      onClick={() => setIsSidebarCollapsed(true)} 
                      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden animate-fade-in"
                      id="sidebar-backdrop"
                    />
                  )}
        
                  {/* 1. LEFT HAND SIDEBAR - Exact OrangeHRM Style */}
                  <aside 
                    className={`bg-white border-r border-slate-200 shrink-0 select-none flex flex-col fixed md:sticky top-0 h-screen transition-all duration-300 z-50 ${
                      isSidebarCollapsed 
                        ? "-translate-x-full md:translate-x-0 md:w-16" 
                        : "translate-x-0 w-64 shadow-xl md:shadow-none"
                    }`} 
                    id="sidebar-container"
                  >
                    {/* Collapse arrow toggle overlay */}
                    <button
                      onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                      className="absolute top-1/2 -right-3 transform -translate-y-1/2 bg-[#ff791a] hover:bg-[#e4640c] text-white rounded-full p-0.5 border border-white cursor-pointer shadow z-40 hidden md:block"
                      id="sidebar-toggle-overlay-btn"
                      title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                      {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
        
                    {/* Sidebar Header branding */}
                    <div className="p-4 border-b border-slate-150 bg-white flex items-center gap-2.5 overflow-hidden" id="sidebar-header">
                      <div className="w-8 h-8 rounded-lg bg-[#ff791a] flex items-center justify-center text-white font-bold text-lg shrink-0 shadow animate-pulse">
                        F
                      </div>
                      {!isSidebarCollapsed && (
                        <div className="text-left leading-none animate-fade-in">
                          <span className="text-slate-800 font-extrabold tracking-tight block">Flex <span className="text-[#ff791a]">HRM</span></span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5 truncate max-w-full">an Intelligic product</span>
                        </div>
                      )}
                    </div>
        
                    {/* Sidebar Options Search Box */}
                    {!isSidebarCollapsed ? (
                      <div className="p-3 border-b border-slate-50" id="sidebar-search-box">
                        <div className="relative">
                          <input id="sidebar-search" name="sidebarSearch"
                            type="text"
                            placeholder="Search..."
                            value={sidebarSearch}
                            onChange={(e) => setSidebarSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 transition"
                          />
                          <span className="absolute left-2.5 top-2 text-slate-400"><Search size={12} /></span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 flex justify-center border-b border-slate-50">
                        <span className="p-2 text-slate-400 bg-slate-50 rounded-full" title="Type to search in full view"><Search size={14} /></span>
                      </div>
                    )}
        
                    {/* Sidebar Links Menu items */}
                    <nav className="p-2 py-3 space-y-1 overflow-y-auto flex-1 scrollbar-thin" id="sidebar-navigation">
                      {filteredSidebarItems.map((item) => {
                        const IconComponent = item.icon;
                        const isGroup = !!item.children?.length;
                        const isGroupExpanded = !!expandedSidebarGroups[item.name];
                        const isGroupActive = isGroup
                          ? item.children!.some((child) => activeSidebarTab === child.tab)
                          : activeSidebarTab === item.name;

                        if (isGroup) {
                          return (
                            <div key={item.name} className="space-y-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSidebarCollapsed) {
                                    navigateToTab(item.children![0].tab);
                                  } else {
                                    toggleSidebarGroup(item.name);
                                  }
                                }}
                                className={`w-full flex items-center text-left px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                                  isGroupActive
                                    ? "bg-orange-50 text-[#ff791a] shadow-xs"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-[#ff791a]"
                                }`}
                                id={`sidebar-tab-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                              >
                                <span className={`shrink-0 ${isGroupActive ? "text-[#ff791a]" : "text-slate-400"}`}>
                                  <IconComponent size={16} />
                                </span>
                                {!isSidebarCollapsed && (
                                  <span className="ml-3 truncate flex-1 flex items-center justify-between animate-fade-in">
                                    <span>{item.name}</span>
                                    <span className="flex items-center gap-1.5">
                                      {item.badge && (
                                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-orange-50 text-orange-600">
                                          {item.badge}
                                        </span>
                                      )}
                                      <ChevronDown
                                        size={12}
                                        className={`transition-transform duration-200 ${isGroupExpanded ? "rotate-180" : ""}`}
                                      />
                                    </span>
                                  </span>
                                )}
                              </button>
                              {!isSidebarCollapsed && isGroupExpanded && (
                                <div className="ml-5 pl-2 border-l border-slate-200 space-y-0.5">
                                  {item.children!.map((child) => {
                                    const isChildSelected = activeSidebarTab === child.tab;
                                    return (
                                      <button
                                        key={child.tab}
                                        type="button"
                                        onClick={() => {
                                          navigateToTab(child.tab);
                                          if (window.innerWidth < 768) {
                                            setIsSidebarCollapsed(true);
                                          }
                                        }}
                                        className={`w-full flex items-center text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                          isChildSelected
                                            ? "bg-[#ff791a] text-white shadow-sm"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-[#ff791a]"
                                        }`}
                                        id={`sidebar-subtab-${child.name.toLowerCase().replace(/\s+/g, "-")}`}
                                      >
                                        <ChevronRight size={10} className={`mr-1 shrink-0 ${isChildSelected ? "text-white" : "text-slate-300"}`} />
                                        {child.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <button
                            key={item.name}
                            onClick={() => {
                              navigateToTab(item.name);
                              triggerSuccess(`Switched module view to: ${item.name}`);
                              if (window.innerWidth < 768) {
                                setIsSidebarCollapsed(true);
                              }
                            }}
                            className={`w-full flex items-center text-left px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                              isGroupActive
                                ? "bg-[#ff791a] text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-50 hover:text-[#ff791a]"
                            }`}
                            id={`sidebar-tab-${item.name.toLowerCase()}`}
                          >
                            <span className={`shrink-0 ${isGroupActive ? "text-white" : "text-slate-400"}`}>
                              <IconComponent size={16} />
                            </span>
                            {!isSidebarCollapsed && (
                              <span className="ml-3 truncate flex-1 flex items-center justify-between animate-fade-in">
                                <span>{item.name}</span>
                                {item.badge && (
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                                    isGroupActive ? "bg-white/20 text-white" : "bg-orange-50 text-orange-600"
                                  }`}>
                                    {item.badge}
                                  </span>
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </nav>
        
                    {/* Sidebar Footer details */}
                    {!isSidebarCollapsed && (
                      <div className="p-3 border-t border-slate-150 bg-slate-50 text-[10px] text-slate-400 text-center space-y-1" id="sidebar-footer">
                        <p className="font-bold">v3.5.24 EE Cloud</p>
                        <p className="truncate">Node Dev Environment Active</p>
                      </div>
                    )}
                  </aside>
        
                  {/* 2. RIGHT HAND MAIN VIEWPORT */}
                  <main className="flex-1 flex flex-col overflow-hidden" id="main-content-layout">
                
                    {/* TOP ORANGE HEADER BAR - OrangeHRM Classic Banner Style */}
                    <header className="bg-gradient-to-r from-[#ff791a] to-[#ff981a] px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between text-white shrink-0 shadow-md sticky top-0 z-40 gap-2.5 md:gap-4" id="main-top-banner">
                      {/* Top row: Hamburger + Title on left, Profile dropdown on right (on mobile) */}
                      <div className="flex items-center justify-between w-full md:w-auto gap-3">
                        <div className="flex items-center gap-2.5">
                          {/* Hamburger button for mobile drawer or trigger toggle (hidden on desktop) */}
                          <button 
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                            className="md:hidden p-1.5 bg-white/10 hover:bg-white/20 rounded text-white mr-1 transition cursor-pointer"
                            id="hamburger-btn"
                          >
                            <Menu size={18} />
                          </button>
                      
                          <div>
                            <span className="text-[8px] uppercase tracking-widest font-black text-orange-100 opacity-90 block">
                              {activeSidebarTab} Module
                            </span>
                            <h1 className="text-sm md:text-lg font-black tracking-tight flex items-center gap-2" id="top-banner-title">
                              {activeSidebarTab === "Employees" ? "Employees" : activeSidebarTab}
                            </h1>
                          </div>
                        </div>
        
                        {/* Mobile Profile Dropdown (visible only on mobile) */}
                        <div className="md:hidden relative shrink-0" ref={mobileProfileDropdownRef}>
                          <button
                            onClick={() => setIsMobileProfileOpen(!isMobileProfileOpen)}
                            className="flex items-center gap-1.5 p-1 px-2.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/15 transition cursor-pointer"
                            id="mobile-top-profile-selector"
                          >
                            <div className="w-6 h-6 rounded-full bg-orange-100 text-[#ff791a] flex items-center justify-center font-bold text-xs ring-2 ring-white/20 shrink-0">
                              {sessionUser.charAt(0).toUpperCase()}
                            </div>
                            <ChevronDown size={10} className={`transition duration-200 ${isMobileProfileOpen ? "rotate-180" : ""}`} />
                          </button>
        
                          {isMobileProfileOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 font-medium animate-fade-in" id="mobile-profile-dropdown-wrapper">
                              <div className="px-4 py-2 border-b border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Access Clearance</p>
                                <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{sessionUser}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setIsMobileProfileOpen(false);
                                  setMyInfoTab("account");
                                  navigateToTab("My Info");
                                  triggerSuccess("Opened administrator account profile.");
                                  setIsSidebarCollapsed(true);
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
                              >
                                <UserCircle size={14} className="text-slate-400" />
                                My Account Profile
                              </button>
                              <button
                                onClick={() => {
                                  triggerSuccess("Opened configuration mappings.");
                                  setIsMobileProfileOpen(false);
                                  navigateToTab("Employees");
                                  setActivePimSubTab("Configuration");
                                  setIsSidebarCollapsed(true);
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
                              >
                                <Settings size={14} className="text-slate-400" />
                                Portal Settings
                              </button>
                              <div className="border-t border-slate-100 my-1"></div>
                              <button
                                onClick={() => {
                                  setIsMobileProfileOpen(false);
                                  setMyInfoTab("tour");
                                  navigateToTab("My Info");
                                  triggerSuccess("Opened system tour guide.");
                                  setIsSidebarCollapsed(true);
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
                              >
                                <Compass size={14} className="text-[#ff791a]" />
                                System Tour
                              </button>
                              <ExtensionProfileMenuItem
                                onClick={() => {
                                  setIsMobileProfileOpen(false);
                                  setIsExtensionModalOpen(true);
                                }}
                              />
                              <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-red-50 text-left text-xs text-rose-600 font-bold transition"
                                id="mobile-logout-dropdown-btn"
                              >
                                <LogOut size={14} className="text-rose-500" />
                                Sign Out / Logout
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
        
                      <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-2.5 border-t border-white/10 pt-2 md:border-t-0 md:pt-0">
                        {/* Universal Month & Year Selectors */}
                        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                          {/* Universal Month Dropdown */}
                          <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/15 px-2.5 py-1 md:px-3 md:py-1.5 transition shrink-0 min-w-[9.5rem] justify-center md:justify-start">
                            <Calendar size={12} className="text-orange-100 shrink-0" />
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-orange-100/90 shrink-0">Month:</span>
                            <select id="active-month-name" name="activeMonthName"
                              value={activeMonthName}
                              onChange={(e) => {
                                const newMonth = e.target.value;
                                const calendarYear = getCalendarYearFromFYRange(newMonth, activeFYRange);
                                setSelectedMonth(`${newMonth} ${calendarYear}`);
                              }}
                              className="min-w-0 flex-1 bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer border-0"
                              title="Select Active Month"
                            >
                              {[
                                "January", "February", "March", "April", "May", "June",
                                "July", "August", "September", "October", "November", "December"
                              ].map(m => (
                                <option key={m} value={m} className="text-slate-800 font-bold">{m}</option>
                              ))}
                            </select>
                          </div>
        
                          {/* Universal Year Dropdown */}
                          <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/15 px-2.5 py-1 md:px-3 md:py-1.5 transition shrink-0 min-w-[8.5rem] justify-center md:justify-start">
                            <Calendar size={12} className="text-orange-100 shrink-0" />
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-orange-100/90 shrink-0">Year:</span>
                            <select id="active-fyrange" name="activeFYRange"
                              value={activeFYRange}
                              onChange={(e) => {
                                const newFYRange = e.target.value;
                                const calendarYear = getCalendarYearFromFYRange(activeMonthName, newFYRange);
                                setSelectedMonth(`${activeMonthName} ${calendarYear}`);
                              }}
                              className="min-w-0 flex-1 bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer border-0"
                              title="Select Active Year"
                            >
                              {["2022-2023", "2023-2024", "2024-2025", "2025-2026", "2026-2027", "2027-2028", "2028-2029", "2029-2030"].map(fy => (
                                <option key={fy} value={fy} className="text-slate-800 font-bold">{fy}</option>
                              ))}
                            </select>
                          </div>
                        </div>
        
                        {/* Desktop Profile Dropdown with Logout (Hidden on mobile) */}
                        <div className="hidden md:flex items-center gap-2">
                          {sessionPermissions?.schoolWork?.view !== false && (
                            <NotificationsBell
                              unreadCount={adminNotificationUnreadCount}
                              notifications={adminNotifications}
                              loading={isFetchingAdminNotifications}
                              onRefresh={fetchAdminNotifications}
                              onMarkRead={handleMarkAdminNotificationRead}
                              onMarkAllRead={handleMarkAllAdminNotificationsRead}
                              onNavigate={handleAdminNotificationNavigate}
                            />
                          )}
                        <div className="relative" ref={profileDropdownRef}>
                          <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-2.5 p-1 px-2.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/15 transition cursor-pointer"
                            id="top-profile-selector"
                          >
                            <div className="w-7 h-7 rounded-full bg-orange-100 text-[#ff791a] flex items-center justify-center font-bold text-xs ring-2 ring-white/20 shrink-0">
                              {sessionUser.charAt(0).toUpperCase()}
                            </div>
                            <span className="hidden md:inline text-xs font-bold font-medium tracking-tight whitespace-nowrap">
                              {sessionUser}
                            </span>
                            <ChevronDown size={12} className={`transition duration-200 ${isProfileOpen ? "rotate-180" : ""}`} />
                          </button>
        
                          {isProfileOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 font-medium animate-fade-in" id="profile-dropdown-wrapper">
                              <div className="px-4 py-2 border-b border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Access Clearance</p>
                                <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{sessionUser}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setIsProfileOpen(false);
                                  setMyInfoTab("account");
                                  navigateToTab("My Info");
                                  triggerSuccess("Opened administrator account profile.");
                                  if (window.innerWidth < 768) {
                                    setIsSidebarCollapsed(true);
                                  }
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
                              >
                                <UserCircle size={14} className="text-slate-400" />
                                My Account Profile
                              </button>
                              <button
                                onClick={() => {
                                  triggerSuccess("Opened configuration mappings.");
                                  setIsProfileOpen(false);
                                  navigateToTab("Employees");
                                  setActivePimSubTab("Configuration");
                                  if (window.innerWidth < 768) {
                                    setIsSidebarCollapsed(true);
                                  }
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
                              >
                                <Settings size={14} className="text-slate-400" />
                                Portal Settings
                              </button>
                              <div className="border-t border-slate-100 my-1"></div>
                              <button
                                onClick={() => {
                                  setIsProfileOpen(false);
                                  setMyInfoTab("tour");
                                  navigateToTab("My Info");
                                  triggerSuccess("Opened system tour guide.");
                                  if (window.innerWidth < 768) {
                                    setIsSidebarCollapsed(true);
                                  }
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
                              >
                                <Compass size={14} className="text-[#ff791a]" />
                                System Tour
                              </button>
                              <ExtensionProfileMenuItem
                                onClick={() => {
                                  setIsProfileOpen(false);
                                  setIsExtensionModalOpen(true);
                                }}
                              />
                              <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-red-50 text-left text-xs text-rose-600 transition font-bold"
                                id="logout-dropdown-btn"
                              >
                                <LogOut size={14} className="text-rose-500" />
                                Sign Out / Logout
                              </button>
                            </div>
                          )}
                        </div>
                        </div>
                      </div>
                    </header>
        
                    {/* 3. Employees SUB-HEADER BAND (Like OrangeHRM: Configuration, Employee List, Add Employee, Reports) */}
                    {activeSidebarTab === "Employees" && (
                      <div className="bg-white border-b border-slate-200 px-6 py-1.5 flex items-center gap-2 shrink-0 overflow-x-auto select-none relative z-30" id="pim-sub-menu-band">
                        {["Configuration", "Employee List", "Add Employee", "Reports"].map((tab) => {
                          const isActive = activePimSubTab === tab;
                          return (
                            <button
                              key={tab}
                              onClick={() => handlePimSubTabClick(tab)}
                              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                isActive 
                                  ? "bg-orange-50 text-[#ff791a] font-extrabold shadow-xs" 
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              }`}
                              id={`pim-subtab-btn-${tab.replace(/\s+/g, "-").toLowerCase()}`}
                            >
                              {tab}
                            </button>
                          );
                        })}
                      </div>
                    )}
        
                    {/* 4. MAIN INNER SCROLLABLE VIEWPORT CONTENT */}
          <ModuleContent />
    
                    {/* Small informative details footer */}
                    <footer className="mt-auto px-6 py-4 bg-white border-t border-slate-200 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 select-none" id="applet-footer">
                      <p>© 2026 Flex HRM, an Intelligic product. All rights reserved. Licensed to {sessionUser}.</p>
                      <p className="flex items-center gap-1 font-mono text-[10px]">
                        🔒 Connected to MongoDB API
                      </p>
                    </footer>
                  </main>
        
                  {isSchoolFormOpen && (
                    <SchoolWorkFormModal
                      school={currentSchool}
                      districts={schoolDistricts}
                      blocks={schoolBlocks}
                      onClose={() => {
                        setIsSchoolFormOpen(false);
                        setCurrentSchool(null);
                      }}
                      onSave={handleSaveSchoolWork}
                    />
                  )}

                  {isSupervisorFormOpen && (
                    <SchoolSupervisorFormModal
                      supervisor={currentSupervisor}
                      blocks={schoolBlocks}
                      onClose={() => {
                        setIsSupervisorFormOpen(false);
                        setCurrentSupervisor(null);
                      }}
                      onSave={handleSaveSchoolSupervisor}
                    />
                  )}

                  {/* Floating Single Onboarding/Edit Modal */}
                  {isFormOpen && (
                    <EmployeeFormModal
                      employee={currentEmployee}
                      availableLocations={registryLocations}
                      availableRoles={registeredJobRoles}
                      basicSalaryPercent={basicSalaryPercentage}
                      esicEligibilityLimit={esicEligibilityLimit}
                      onLocationRegistryUpdate={fetchLocations}
                      onCreateLocation={handleAddLocationFromConfig}
                      onCreateRole={handleAddRoleFromConfig}
                      onClose={() => {
                        setIsFormOpen(false);
                        setCurrentEmployee(null);
                        // If they closed adding tab, reset active sub tab choice
                        if (activePimSubTab === "Add Employee") {
                          setActivePimSubTab("Employee List");
                        }
                      }}
                      onSave={handleSaveEmployee}
                    />
                  )}
        
                  {/* Voice Dialer Simulation Overlay Modal */}
                  {activeDialerContact && (
                    <DialerOverlay
                      contact={activeDialerContact}
                      status={activeDialerStatus}
                      setStatus={setActiveDialerStatus}
                      onClose={() => setActiveDialerContact(null)}
                    />
                  )}

                  {/* Flush Security Audit Trail Confirmation Modal */}
                  {showFlushAuditModal && (
                    <div
                      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 md:p-5"
                      onClick={closeFlushAuditModal}
                    >
                      <div
                        className="bg-white rounded-xl shadow-2xl border border-rose-200 w-full max-w-md animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-rose-100 bg-rose-50 rounded-t-xl">
                          <div className="flex items-center gap-2">
                            <Trash2 size={18} className="text-rose-600 shrink-0" />
                            <h3 className="text-sm font-extrabold text-rose-800">Flush Security Trail</h3>
                          </div>
                          <button
                            type="button"
                            onClick={closeFlushAuditModal}
                            className="p-1.5 rounded hover:bg-rose-100 text-rose-500 cursor-pointer"
                            aria-label="Close"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <form onSubmit={handleFlushAuditLogs} className="p-5 space-y-4">
                          {flushAuditError && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs font-semibold">
                              {flushAuditError}
                            </div>
                          )}
                          <div>
                            <label htmlFor="flush-audit-password" className="text-xs font-bold text-slate-600 block mb-1">
                              Enter password to flush trail
                            </label>
                            <input
                              id="flush-audit-password"
                              name="flushAuditPassword"
                              type="password"
                              autoComplete="off"
                              value={flushAuditPassword}
                              onChange={(e) => setFlushAuditPassword(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-rose-400 focus:outline-none text-xs text-slate-800 transition"
                              disabled={isFlushingAuditLogs}
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={closeFlushAuditModal}
                              disabled={isFlushingAuditLogs}
                              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition cursor-pointer disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isFlushingAuditLogs}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 size={13} />
                              {isFlushingAuditLogs ? "Flushing..." : "Flush Security Trail"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Saved Bulk Pay Excel Preview Modal */}
                  {bulkPayPreview && (
                    <div
                      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 md:p-5"
                      onClick={() => setBulkPayPreview(null)}
                    >
                      <div
                        className="bg-[#f3f3f3] rounded-xl shadow-2xl border border-[#d4d4d4] w-full max-w-[96vw] h-[92vh] flex flex-col animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#d4d4d4] bg-white shrink-0">
                          <div className="min-w-0 flex items-center gap-2">
                            <FileSpreadsheet size={16} className="text-emerald-600 shrink-0" />
                            <p className="text-[11px] text-slate-600 font-mono truncate" title={bulkPayPreview.filename}>
                              {bulkPayPreview.filename}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDownloadBulkPayArchive(bulkPayPreview.id, bulkPayPreview.filename)}
                              className="px-3 py-1.5 bg-[#217346] hover:bg-[#1a5c38] text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Download size={11} /> Download
                            </button>
                            <button
                              type="button"
                              onClick={() => setBulkPayPreview(null)}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                              aria-label="Close preview"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-h-0 p-3 flex flex-col gap-2">
                          {bulkPayPreview.loading ? (
                            <p className="text-sm text-slate-500 text-center py-12">Loading Excel preview...</p>
                          ) : (
                            <>
                              {bulkPayPreview.sheetNames.length > 1 && (
                                <div className="flex flex-wrap items-center gap-1 shrink-0">
                                  {bulkPayPreview.sheetNames.map((sheetName) => (
                                    <button
                                      key={sheetName}
                                      type="button"
                                      onClick={() =>
                                        setBulkPayPreview((prev) =>
                                          prev ? { ...prev, activeSheet: sheetName } : prev
                                        )
                                      }
                                      className={`px-3 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                                        bulkPayPreview.activeSheet === sheetName
                                          ? "bg-[#217346] text-white border-[#217346]"
                                          : "bg-white text-slate-600 border-[#d4d4d4] hover:bg-slate-50"
                                      }`}
                                    >
                                      {sheetName}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="flex-1 min-h-0">
                                <ExcelPreviewGrid
                                  rows={bulkPayPreview.sheets[bulkPayPreview.activeSheet] || []}
                                  headerRowCount={getBulkPayPreviewHeaderRowCount(bulkPayPreview.activeSheet)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Saved School Bulk Pay Excel Preview Modal */}
                  {schoolBulkPayPreview && (
                    <div
                      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 md:p-5"
                      onClick={() => setSchoolBulkPayPreview(null)}
                    >
                      <div
                        className="bg-[#f3f3f3] rounded-xl shadow-2xl border border-[#d4d4d4] w-full max-w-[96vw] h-[92vh] flex flex-col animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#d4d4d4] bg-white shrink-0">
                          <div className="min-w-0 flex items-center gap-2">
                            <FileSpreadsheet size={16} className="text-[#ff791a] shrink-0" />
                            <p className="text-[11px] text-slate-600 font-mono truncate" title={schoolBulkPayPreview.filename}>
                              {schoolBulkPayPreview.filename}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDownloadSchoolBulkPayArchive(schoolBulkPayPreview.id, schoolBulkPayPreview.filename)}
                              className="px-3 py-1.5 bg-[#ff791a] hover:bg-[#e4640c] text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Download size={11} /> Download
                            </button>
                            <button
                              type="button"
                              onClick={() => setSchoolBulkPayPreview(null)}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                              aria-label="Close preview"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-h-0 p-3 flex flex-col gap-2">
                          {schoolBulkPayPreview.loading ? (
                            <p className="text-sm text-slate-500 text-center py-12">Loading Excel preview...</p>
                          ) : (
                            <>
                              {schoolBulkPayPreview.sheetNames.length > 1 && (
                                <div className="flex flex-wrap items-center gap-1 shrink-0">
                                  {schoolBulkPayPreview.sheetNames.map((sheetName) => (
                                    <button
                                      key={sheetName}
                                      type="button"
                                      onClick={() =>
                                        setSchoolBulkPayPreview((prev) =>
                                          prev ? { ...prev, activeSheet: sheetName } : prev
                                        )
                                      }
                                      className={`px-3 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                                        schoolBulkPayPreview.activeSheet === sheetName
                                          ? "bg-[#ff791a] text-white border-[#ff791a]"
                                          : "bg-white text-slate-600 border-[#d4d4d4] hover:bg-slate-50"
                                      }`}
                                    >
                                      {sheetName}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="flex-1 min-h-0">
                                <ExcelPreviewGrid
                                  rows={schoolBulkPayPreview.sheets[schoolBulkPayPreview.activeSheet] || []}
                                  headerRowCount={getBulkPayPreviewHeaderRowCount(schoolBulkPayPreview.activeSheet)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
        
                  {/* Mobile Drawer backdrop overlay */}
                  {!isSidebarCollapsed && (
                    <div 
                      onClick={() => setIsSidebarCollapsed(true)} 
                      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-45 md:hidden transition-all duration-300 animate-fade-in"
                      id="sidebar-backdrop"
                    />
                  )}
        
                  {/* Premium Floating Mobile Bottom Navigation Bar */}
                  <div className="fixed bottom-4 left-4 right-4 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xl flex items-center justify-around z-40 md:hidden animate-slide-up" id="mobile-bottom-nav">
                    {[
                      { name: "Dashboard", label: "Home", icon: LayoutDashboard },
                      { name: "Employees", label: "Staff", icon: Users },
                      { name: "Attendance", label: "Records", icon: Clock },
                      { name: "Salary", label: "Payroll", icon: Coins },
                      { name: "Directory", label: "Contacts", icon: Contact },
                    ].filter((item) => {
                      const key = getModuleKey(item.name);
                      return !key || !!userPermissions[key]?.view;
                    }).map((item) => {
                      const IconComponent = item.icon;
                      const isSelected = activeSidebarTab === item.name;
                      return (
                        <button
                          key={item.name}
                          onClick={() => {
                            navigateToTab(item.name);
                            setIsSidebarCollapsed(true); // Close drawer if open
                            triggerSuccess(`Switched to: ${item.name}`);
                          }}
                          className={`flex flex-col items-center gap-1 transition cursor-pointer select-none ${
                            isSelected ? "text-[#ff791a]" : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          <IconComponent size={20} className={isSelected ? "stroke-[2.5]" : "stroke-[2]"} />
                          <span className="text-[9px] font-extrabold tracking-wide uppercase">{item.label}</span>
                        </button>
                      );
                    })}
                    {/* Menu trigger button */}
                    <button
                      onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                      className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-700 cursor-pointer select-none"
                    >
                      <Menu size={20} />
                      <span className="text-[9px] font-extrabold tracking-wide uppercase">Menu</span>
                    </button>
                  </div>
        
                  {/* Confetti Celebration Overlay */}
                  {showConfetti && <ConfettiRain />}

                  <ExtensionIntegrationModal
                    open={isExtensionModalOpen}
                    onClose={() => setIsExtensionModalOpen(false)}
                    onCopied={triggerSuccess}
                  />
                </div>
  );
}
