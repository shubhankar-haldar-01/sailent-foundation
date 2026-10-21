# Page Specification: Donation Flow & Checkout

> **Scope:** Donation Drawer/Modal, Cart, Razorpay Checkout, and Confirmation  
> **Inherits:** `design-system/sailent-foundation/MASTER.md`

---

## 1. Flow Overview & Architecture

### 1.1 Integrity Rules (Non-Negotiable)
- **Currency:** Indian Rupee (INR) only (`₹`).
- **Money Units:** Always integer paise (`bigint`) across state and network payloads. Never use floats.
- **Server Pricing:** The frontend submits product IDs, quantities, and an optional custom donation amount. All final totals are calculated server-side.
- **Payment Verification:** The frontend never decides that a payment succeeded; verification occurs server-side via Razorpay webhook or server verify route.
- **One-Time Only:** No recurring gifts, mandates, or subscriptions.

---

## 2. Interface Components

### 2.1 Donation Modal / Drawer
- **Trigger:** Clicking "Donate Now" on any campaign card or detail page.
- **Presentation:**
  - Desktop: Centered modal dialog (`max-w-[560px]`, `rounded-2xl`).
  - Mobile: Bottom drawer sheet sliding up, with touch-drag handle.
- **Step 1: Amount Selection:**
  - Preset Quick-Select Pills: ₹500, ₹1,000, ₹2,500, ₹5,000, ₹10,000.
  - Active pill: Border `#EB6A1F`, background `--cta-soft`, text `--accent-950`.
  - Custom Amount Input: Leading Rupee symbol (`₹`), tabular numerals, 44px min height.
- **Step 2: Tangible Product Add-ons (Optional):**
  - Product donation card with product image, quantity stepper (`-` / `+`), unit price, and impact description (e.g., "1 School Kit = ₹750").
- **Step 3: Donor Details:**
  - Full Name, Email, Phone number (10-digit Indian mobile number).
  - No PAN field here: a PAN is collected later, from donors who choose to claim relief.
  - The only tax wording: a receipt by email, and Section 80G relief claimed separately through Form 10BE after the annual filing. No eligibility badge, no "tax exempt" claim, and no refund wording until a policy is published (`AGENTS.md` §10).
- **Step 4: Razorpay Checkout:**
  - Secure payment gateway integration with Razorpay modal (UPI, Cards, Netbanking).
  - Action Button: Navy text on `#EB6A1F` (*Proceed to Pay ₹X,XXX*).

---

## 3. Success State & Receipt

### 3.1 Confirmation Screen
- Success checkmark icon in `--success` (`oklch(0.47 0.13 150)`).
- Large bold headline: "Thank You for Your Contribution!".
- Summary card (`card-standard`):
  - Payment Reference & Order ID.
  - Receipt number (gapless per financial year) — a receipt, not an 80G certificate (`AGENTS.md` §10).
  - Link to the receipt in the Donor Portal (printable; a PDF is not built yet).
  - Option to view donation in Donor Portal.
