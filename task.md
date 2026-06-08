# Task List: Exiting Employees Implementation

- [x] Add `exitDate?: string;` to `src/types.ts`
- [x] Add `exitDate: ""` to initial form state in `src/components/EmployeeFormModal.tsx`
- [x] Render the **Exit / Leaving Date** date input in the Basic tab of `src/components/EmployeeFormModal.tsx`
- [x] Add `statusFilter` state in `src/components/EmployeeTable.tsx`
- [x] Implement robust filtering logic for active/exited/all employees inside `filteredEmployees` useMemo in `src/components/EmployeeTable.tsx`
- [x] Add **Employment Status** filter dropdown in the filter controls of `src/components/EmployeeTable.tsx`
- [x] Support resetting `statusFilter` in `clearFilters` inside `src/components/EmployeeTable.tsx`
- [x] Render **Active Staff** / **Exited / Inactive** header badges in `src/components/EmployeeViewModal.tsx`
- [x] Render **Exit / Leaving Date** detail field in `src/components/EmployeeViewModal.tsx`
- [x] Compile the application with `npm run build` to verify there are no errors
- [x] Manually verify active/exited toggle filters and date setting works perfectly

## 🛡️ Active List Restrictions (Day-After Exit Lock)
- [x] Restrict active presents counting in `getSalaryColumnValue` to only active days (pre-exit)
- [x] Hide prior-month exited staff from `filteredSalaryEmployees` (salary sheet)
- [x] Lock/disable cell inputs and show `"—"` for attendance days post-exit
- [x] Exclude post-exit days from presents/absents count calculations in daily sheet

## 🚫 Post-Exit Month Tab Exclusions
- [x] Hide post-exit-month staff from active Attendance grids (keeping their exit-month worked period active & cell-locked)
- [x] Hide post-exit-month staff from active Advance & Penalty ledger checklist loops (keeping their exit-month worked period active)

## 🧹 Sidebar Cleanup
- [x] Remove **Recruitment**, **My Info**, **Performance**, and **Dashboard** tabs from `sidebarItems` navigation in `App.tsx`

## 📝 Default Blank Attendance
- [x] Change the default attendance status from 'P' to blank/dash ('—')
- [x] Only count days marked as 'P' in presents loops and daily sheets
- [x] Wire blank/dash options to Attendance grids, CSV/PDF exports, and Salary sheets

## 🔐 Hierarchical Role-Based Access Control (RBAC)
- [x] Define `CustomRole` and `RolePermission` types in `src/types.ts`
- [x] Implement persistent roles JSON store (`roles-db.json`) and database helper methods in `server.ts`
- [x] Add `/api/roles` endpoints (CRUD: fetch, save, delete) in `server.ts`
- [x] Upgrade login, quick-login, profile, and invite endpoints to return and bind `role` fields in `server.ts`
- [x] Add `sessionRole` and `rolesList` states in `src/App.tsx` and parse login responses
- [x] Fetch role configuration list dynamically on startup and admin tab load in `src/App.tsx`
- [x] Create the **Role Management Grid/Dashboard** inside the Admin tab in `src/App.tsx`
- [x] Implement the View/Edit checkboxes grid for custom roles definition in `src/App.tsx`
- [x] Add role selection dropdown inside the "Invite New Admin" form in `src/App.tsx`
- [x] Enforce tab hide/views based on `view` permissions in `sidebarItems` mapping
- [x] Enforce read-only locks/disable rules on form buttons, selects, ledgers, salaries, and daily attendance sheets if `edit` permissions are false
- [x] Verify compiling is clean with `npm run build` and test restricted HR logins

## 🛡️ Enterprise Security Audit Trail & Event Logs
- [x] Implement persistent database auditing in `server.ts` with caps at 2000 events
- [x] Integrate log audit triggers on all 14 mutating API routes in `server.ts`
- [x] Create GET and DELETE `/api/audit-logs` endpoints in `server.ts`
- [x] Hook global `window.fetch` inside `App.tsx` to automatically inject the acting administrator header
- [x] Bind new states and data fetch helpers in `App.tsx`
- [x] Register "Audit Logs" tab inside `sidebarItems` and hook dynamic permission filters
- [x] Render highly interactive slate/orange Security Audit dashboard in `App.tsx`
- [x] Implement expandable Inspector payload drawer with raw JSON views
- [x] Build multi-format compliance exports (A4 landscape PDF & custom-styled green Excel sheets)
- [x] Run production build checks to verify 100% clean compilation

## 🔧 Bug Fixes
- [x] Suppress noisy browser extension message errors (`No Listener: tabs:outgoing.message.ready` and message channel closing) by introducing global window event listeners.

## ⚖️ Location & Employee-Level Compliance Calculations
- [x] Add `complianceEnabled` field to the Employee type definition in `types.ts`
- [x] Implement location-level compliance mapping state and persist it to `localStorage`
- [x] Render compliance checkbox option when adding new locations (both in Admin tab and `EmployeeFormModal` inline view)
- [x] Render compliance toggle switch/checkbox for existing locations in the Admin configuration list
- [x] Render compliance toggle checkbox when adding/editing employees in `EmployeeFormModal`
- [x] Update `getSalaryColumnValue` to enforce double-conditional compliance calculations (location AND employee) and return empty strings for PF, ESIC, and PT columns when disabled
- [x] Update UI table cells and calculations to leave PF, ESIC, and PT blank when compliance is disabled
- [x] Update CSV download generation to output blank cells for PF, ESIC, and PT when compliance is disabled
- [x] Display compliance details card in the `EmployeeViewModal` dossier
## 📱 Mobile Responsiveness & Scroll Fixes
- [x] Configure responsive media queries in `src/index.css` to conditionally apply `position: sticky` on the main Employee Registry list only for screen widths >= 1024px (`lg` breakpoint)
- [x] Disable stickiness by forcing `position: static !important` on all viewports < 1024px to ensure the entire row scrolls smoothly left-to-right on mobile/tablet devices
- [x] Verify production build compiles successfully with no style or TS errors


