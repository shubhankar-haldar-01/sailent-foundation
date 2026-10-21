# Page Specification: Admin Console

> **Scope:** `/admin`, `/admin/*`  
> **Inherits:** `design-system/sailent-foundation/MASTER.md`

---

## 1. Visual Style & Shell

- **Surface Identifier:** Declares `[data-surface="admin"]` on the root layout.
- **Surface Properties:**
  - Neutral Hue: Cool slate/blue (`--neutral-hue: 255`).
  - Base Font Size: 14px (`text-body-sm`).
  - Border Radius: `0.375rem` (`rounded-md`).
  - Section Spacing: Dense operational rhythm (16–24px).
  - Headings: Inter for small panel titles and table headers; Manrope retained for primary page titles.

---

## 2. Layout Structure

### 2.1 Navigation & Chrome
- **Collapsible Sidebar:**
  - NGO Brand Mark + Admin badge.
  - Navigation Sections: Campaigns, Programmes, Donations & Receipts, Donors, Volunteers, Events, CMS/Blog, Staff & RBAC, Audit Logs.
  - Active item: Background `--accent-100`, text `--accent-900`, solid indicator border.
- **Top Utility Bar:**
  - Global Search (quick jump to donors, campaigns, receipt numbers).
  - Environment Badge (Dev / Staging / Production).
  - User profile menu with Role tag (Super Admin, Campaign Manager, Auditor).
  - Theme toggle (Light / Dark).

---

## 3. Data Tables & Administrative Workflows

### 3.1 Data Table Design
- **Density:** High density rows (36–40px row height).
- **Header:** Sticky header with column sort indicators, type-safe filtering, and search bar.
- **Cells:** Tabular numerals for monetary figures, counts, and dates.
- **Pagination:** Bottom toolbar showing total records, page size selector, and jump-to-page input.

### 3.2 Security, RBAC & Sensitive Operations
- **Permission Badges:** Clear status indicators for active roles and capabilities.
- **Sensitive Operations (`@Sensitive`):**
  - Prompt requires password/re-authentication within 5 minutes.
  - Destructive or administrative mutations record audit logs immediately (`AuditService.record`).
  - Confirmation modals have high visual urgency with `--destructive` accents.
