# Page Specification: Donor Dashboard

> **Scope:** `/donor`, `/donor/donations`, `/donor/receipts`, `/donor/events`  
> **Inherits:** `design-system/sailent-foundation/MASTER.md`

---

## 1. Visual Style & Layout

- **Surface:** Donor Portal (`:root` public warm/tinted theme with focused layout).
- **Navigation:** Top app header with donor avatar, name, and persistent tab bar / sidebar:
  - Overview / Impact
  - My Donations
  - Receipts
  - Event Registrations
  - Volunteer Profile
- **Page Container:** `container-page` with `px-4 sm:px-6 lg:px-8` and `py-8`.

---

## 2. Key Modules & Views

### 2.1 Overview & Impact Metrics
- **Impact Summary Banner:**
  - Total Contribution (`₹X,XXX` in `tabular-nums` bold).
  - Campaigns Supported count.
  - Lives Impacted indicator.
- **Recent Activity Rail:** List of recent donations with campaign photograph, date, amount, and receipt link.

### 2.2 Donation History & Receipts Table
- **Data Table:**
  - Date (DD MMM YYYY).
  - Campaign Name (link to public campaign).
  - Mode (UPI / Card / Netbanking).
  - Amount in INR (right-aligned, tabular figures).
  - Receipt Status: Generated / Superseded.
  - Action: "View receipt" (printable; not an 80G certificate).
- **Fiscal Year Selector:** Filter receipts by FY (e.g. 2025–26, 2026–27) for annual tax filing.

### 2.3 Event & Volunteer Participation
- Cards for registered upcoming NGO events with date, venue badge, and donor ticket reference.
