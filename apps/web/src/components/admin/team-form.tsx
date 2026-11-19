'use client';

import * as React from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  CreditCard,
  ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Trash2,
  UploadCloud,
  User,
  Users,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@sailent/ui';

import { createTeamMember, updateTeamMember, type ActionState } from '@/lib/admin/actions';
import type { AdminTeamMember } from '@/lib/admin/api';
import { useRevealResult } from '@/lib/ui/reveal-result';

/**
 * Format raw numbers into standard Indian 12-digit Aadhaar grouping: XXXX XXXX XXXX
 */
export function formatAadhaar(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

/**
 * Validation helper functions
 */
export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is mandatory.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Please enter a valid email address (e.g. name@sailent.org).';
  }
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return 'Contact Number is mandatory.';
  const digits = phone.replace(/[\s\-()+]/g, '');
  if (digits.length < 10 || !/^\d+$/.test(digits)) {
    return 'Please enter a valid contact number (at least 10 digits).';
  }
  return null;
}

export function validateAadhaar(aadhaar: string): string | null {
  if (!aadhaar.trim()) return 'Adhar Number is mandatory.';
  const digits = aadhaar.replace(/\s|-/g, '');
  if (!/^\d{12}$/.test(digits)) {
    return 'Adhar Number must be exactly 12 digits (e.g. 1234 5678 9012).';
  }
  return null;
}

export function validateAddress(address: string): string | null {
  if (!address.trim()) return 'Address is mandatory.';
  if (address.trim().length < 10) {
    return 'Please enter a complete address (minimum 10 characters).';
  }
  return null;
}

/**
 * Team member creation & edit form built with shadcn UI.
 *
 * All 8 fields are mandatory with in-box validation:
 * 1. Full Name *
 * 2. Email *
 * 3. Contact Number *
 * 4. Adhar Number *
 * 5. Address *
 * 6. Type dropdown * ('Team' / 'Trustee')
 * 7. Designation * (automatically set to 'Team' when Type is 'Team')
 * 8. Image * (live preview & upload / URL)
 */
export function TeamForm({
  member,
  initialSuccess = false,
}: {
  member?: AdminTeamMember;
  initialSuccess?: boolean;
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    member ? updateTeamMember : createTeamMember,
    {},
  );

  const formTopRef = React.useRef<HTMLDivElement>(null);
  // A save's result is brought into view and focused, as everywhere on the site.
  const resultRef = useRevealResult(state);

  // Arriving from a create (a redirect to this page with the saved flag): show
  // the page from the top, header and banner together.
  React.useEffect(() => {
    if (initialSuccess) {
      const scrollToTop = () => {
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          const main = document.getElementById('admin-content');
          if (main) main.scrollTop = 0;
        }
      };

      scrollToTop();
      const raf = requestAnimationFrame(scrollToTop);
      const timer = setTimeout(scrollToTop, 100);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [initialSuccess]);

  // Field values
  const [name, setName] = React.useState<string>(member?.name || '');
  const [email, setEmail] = React.useState<string>(member?.emailPublic || '');
  const [contactNumber, setContactNumber] = React.useState<string>(member?.contactNumber || '');
  const [aadharNumber, setAadharNumber] = React.useState<string>(
    member?.aadharNumber ? formatAadhaar(member.aadharNumber) : '',
  );
  const [address, setAddress] = React.useState<string>(member?.address || '');

  // Type: 'staff' (Team) or 'trustee' (Trustee)
  const initialType: 'staff' | 'trustee' = member?.memberType === 'trustee' ? 'trustee' : 'staff';
  const [memberType, setMemberType] = React.useState<'staff' | 'trustee'>(initialType);

  // Designation state for Trustee
  const initialDesignation =
    member?.memberType === 'trustee'
      ? member?.designation && member.designation !== 'Team'
        ? member.designation
        : 'Trustee'
      : 'Trustee';
  const [trusteeDesignation, setTrusteeDesignation] = React.useState<string>(initialDesignation);

  // Photo URL & direct upload state
  const [photoUrl, setPhotoUrl] = React.useState<string>(member?.photoUrl || '');
  const [isUploading, setIsUploading] = React.useState<boolean>(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // In-box validation error tracking
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const validateField = (field: string, val: string): string | null => {
    switch (field) {
      case 'name':
        if (!val.trim()) return 'Full Name is mandatory.';
        if (val.trim().length < 2) return 'Full Name must be at least 2 characters.';
        return null;
      case 'emailPublic':
        return validateEmail(val);
      case 'contactNumber':
        return validatePhone(val);
      case 'aadharNumber':
        return validateAadhaar(val);
      case 'address':
        return validateAddress(val);
      case 'designation':
        if (memberType === 'trustee' && !val.trim()) {
          return 'Designation is mandatory for trustees.';
        }
        return null;
      case 'photoUrl':
        if (!val.trim()) {
          return 'Photograph is mandatory. Please upload an image or provide an image URL.';
        }
        return null;
      default:
        return null;
    }
  };

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, value);
    setClientErrors((prev) => ({
      ...prev,
      [field]: err || '',
    }));
  };

  const validateAll = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    const nameErr = validateField('name', name);
    if (nameErr) errors.name = nameErr;

    const emailErr = validateField('emailPublic', email);
    if (emailErr) errors.emailPublic = emailErr;

    const phoneErr = validateField('contactNumber', contactNumber);
    if (phoneErr) errors.contactNumber = phoneErr;

    const aadharErr = validateField('aadharNumber', aadharNumber);
    if (aadharErr) errors.aadharNumber = aadharErr;

    const addressErr = validateField('address', address);
    if (addressErr) errors.address = addressErr;

    if (memberType === 'trustee') {
      const desErr = validateField('designation', trusteeDesignation);
      if (desErr) errors.designation = desErr;
    }

    const photoErr = validateField('photoUrl', photoUrl);
    if (photoErr) errors.photoUrl = photoErr;

    return errors;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const allErrors = validateAll();
    if (Object.keys(allErrors).length > 0) {
      e.preventDefault();
      setClientErrors(allErrors);
      setTouched({
        name: true,
        emailPublic: true,
        contactNumber: true,
        aadharNumber: true,
        address: true,
        designation: true,
        photoUrl: true,
      });

      // Focus first error field for accessibility
      const firstKey = Object.keys(allErrors)[0];
      if (firstKey) {
        const targetElement =
          document.getElementById(firstKey) ||
          document.querySelector(`[name="${firstKey}"]`) ||
          (firstKey === 'photoUrl' ? fileInputRef.current : null);

        if (targetElement instanceof HTMLElement) {
          targetElement.focus();
          targetElement.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  };

  const handleTypeChange = (value: string) => {
    if (value === 'trustee') {
      setMemberType('trustee');
      if (!trusteeDesignation || trusteeDesignation.toLowerCase() === 'team') {
        setTrusteeDesignation('Trustee');
      }
      setClientErrors((prev) => ({ ...prev, designation: '' }));
    } else {
      setMemberType('staff');
      setClientErrors((prev) => ({ ...prev, designation: '' }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append('file', file, file.name);
    const fallbackAlt =
      file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim() || 'Team photograph';
    fd.append('altText', fallbackAlt);
    fd.append('visibility', 'public');

    try {
      const res = await fetch('/api/bff/admin/media', {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { url?: string };
        error?: { message?: string };
      };

      if (res.ok && data.success && data.data?.url) {
        setPhotoUrl(data.data.url);
        setClientErrors((prev) => ({ ...prev, photoUrl: '' }));
      } else {
        setUploadError(
          data.error?.message ||
            'Failed to upload photo. You can paste an image URL directly into the field.',
        );
      }
    } catch {
      setUploadError(
        'Network error uploading photo. You can paste an image URL directly into the field.',
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Helper to obtain active error message for field
  const getFieldError = (field: string): string | undefined => {
    if (clientErrors[field]) return clientErrors[field];
    if (typeof state.fieldErrors?.[field] === 'string') return state.fieldErrors[field];
    if (state.fieldErrors?.[field]?.[0]) return state.fieldErrors[field][0];
    return undefined;
  };

  return (
    <Card className="border-border shadow-xs">
      <CardHeader className="border-border border-b pb-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-h4 text-foreground font-bold">
              {member ? 'Edit Team Member Profile' : 'New Team Member Profile'}
            </CardTitle>
            <CardDescription className="text-body-sm text-muted-foreground mt-1">
              {member
                ? 'Update contact details, role type, designation, and image. All fields are mandatory.'
                : 'Add a new member to the team or board of trustees. All fields are mandatory.'}
            </CardDescription>
          </div>
          <Badge
            variant={memberType === 'trustee' ? 'info' : 'accent'}
            className="px-3 py-1 font-semibold capitalize"
          >
            {memberType === 'trustee' ? 'Trustee' : 'Team Member'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div ref={formTopRef} className="scroll-mt-6" />

        <form action={action} onSubmit={handleSubmit} className="space-y-6" noValidate>
          {member ? <input type="hidden" name="id" value={member.id} /> : null}
          {member?.slug ? <input type="hidden" name="slug" value={member.slug} /> : null}
          <input type="hidden" name="memberType" value={memberType} />
          {memberType === 'staff' ? <input type="hidden" name="designation" value="Team" /> : null}
          <input type="hidden" name="photoUrl" value={photoUrl} />
          <input
            type="hidden"
            name="bio"
            value={
              member?.bio ||
              `${name || 'Team member'} is a dedicated team member at Sailent Foundation.`
            }
          />

          {/* Prominent success status banner */}
          {state.ok ? (
            <Alert ref={resultRef} variant="success" className="shadow-xs">
              <p className="text-success font-semibold">
                {member
                  ? 'Team member profile saved successfully!'
                  : 'Team member created successfully!'}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                All details have been updated and stored.
              </p>
            </Alert>
          ) : null}

          {/* Prominent server error status banner */}
          {state.error ? (
            <Alert ref={resultRef} variant="destructive" className="shadow-xs">
              <p className="text-destructive font-semibold">Could not save changes</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{state.error}</p>
            </Alert>
          ) : null}

          {/* 1. Full Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="text-foreground flex items-center gap-1.5 text-sm font-semibold"
            >
              <User className="text-primary size-4" aria-hidden="true" />
              <span>Full Name</span>
              <span className="text-destructive font-bold">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (touched.name) handleBlur('name', e.target.value);
              }}
              onBlur={(e) => handleBlur('name', e.target.value)}
              placeholder="e.g. Rahul Sharma"
              required
              hasError={Boolean(getFieldError('name'))}
              className="h-11"
            />
            {getFieldError('name') ? (
              <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{getFieldError('name')}</span>
              </p>
            ) : null}
          </div>

          {/* 2. Email */}
          <div className="space-y-1.5">
            <Label
              htmlFor="emailPublic"
              className="text-foreground flex items-center gap-1.5 text-sm font-semibold"
            >
              <Mail className="text-primary size-4" aria-hidden="true" />
              <span>Email</span>
              <span className="text-destructive font-bold">*</span>
            </Label>
            <Input
              id="emailPublic"
              name="emailPublic"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched.emailPublic) handleBlur('emailPublic', e.target.value);
              }}
              onBlur={(e) => handleBlur('emailPublic', e.target.value)}
              placeholder="e.g. rahul.sharma@sailent.org"
              required
              hasError={Boolean(getFieldError('emailPublic'))}
              className="h-11"
            />
            {getFieldError('emailPublic') ? (
              <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{getFieldError('emailPublic')}</span>
              </p>
            ) : null}
          </div>

          {/* 3. Contact Number */}
          <div className="space-y-1.5">
            <Label
              htmlFor="contactNumber"
              className="text-foreground flex items-center gap-1.5 text-sm font-semibold"
            >
              <Phone className="text-primary size-4" aria-hidden="true" />
              <span>Contact Number</span>
              <span className="text-destructive font-bold">*</span>
            </Label>
            <Input
              id="contactNumber"
              name="contactNumber"
              type="tel"
              value={contactNumber}
              onChange={(e) => {
                setContactNumber(e.target.value);
                if (touched.contactNumber) handleBlur('contactNumber', e.target.value);
              }}
              onBlur={(e) => handleBlur('contactNumber', e.target.value)}
              placeholder="e.g. +91 98765 43210"
              required
              hasError={Boolean(getFieldError('contactNumber'))}
              className="h-11"
            />
            {getFieldError('contactNumber') ? (
              <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{getFieldError('contactNumber')}</span>
              </p>
            ) : null}
          </div>

          {/* 4. Adhar Number */}
          <div className="space-y-1.5">
            <Label
              htmlFor="aadharNumber"
              className="text-foreground flex items-center gap-1.5 text-sm font-semibold"
            >
              <CreditCard className="text-primary size-4" aria-hidden="true" />
              <span>Adhar Number</span>
              <span className="text-destructive font-bold">*</span>
            </Label>
            <Input
              id="aadharNumber"
              name="aadharNumber"
              value={aadharNumber}
              maxLength={14}
              onChange={(e) => {
                const formatted = formatAadhaar(e.target.value);
                setAadharNumber(formatted);
                if (touched.aadharNumber) handleBlur('aadharNumber', formatted);
              }}
              onBlur={(e) => handleBlur('aadharNumber', e.target.value)}
              placeholder="e.g. 1234 5678 9012"
              required
              hasError={Boolean(getFieldError('aadharNumber'))}
              className="h-11"
            />
            {getFieldError('aadharNumber') ? (
              <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{getFieldError('aadharNumber')}</span>
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Enter 12-digit Indian Aadhaar number. Formatted automatically as XXXX XXXX XXXX.
              </p>
            )}
          </div>

          {/* 5. Address */}
          <div className="space-y-1.5">
            <Label
              htmlFor="address"
              className="text-foreground flex items-center gap-1.5 text-sm font-semibold"
            >
              <MapPin className="text-primary size-4" aria-hidden="true" />
              <span>Address</span>
              <span className="text-destructive font-bold">*</span>
            </Label>
            <Textarea
              id="address"
              name="address"
              rows={3}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (touched.address) handleBlur('address', e.target.value);
              }}
              onBlur={(e) => handleBlur('address', e.target.value)}
              placeholder="e.g. Flat 302, Green Glen Heights, Outer Ring Road, Bengaluru, Karnataka"
              required
              hasError={Boolean(getFieldError('address'))}
              className="resize-none"
            />
            {getFieldError('address') ? (
              <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{getFieldError('address')}</span>
              </p>
            ) : null}
          </div>

          {/* 6. Type dropdown with option team and trustee */}
          <div className="space-y-1.5">
            <Label
              htmlFor="type-select"
              className="text-foreground flex items-center gap-1.5 text-sm font-semibold"
            >
              <Users className="text-primary size-4" aria-hidden="true" />
              <span>Type</span>
              <span className="text-destructive font-bold">*</span>
            </Label>
            <Select value={memberType} onValueChange={handleTypeChange}>
              <SelectTrigger id="type-select" className="bg-surface h-11 w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                <SelectItem value="staff">Team</SelectItem>
                <SelectItem value="trustee">Trustee</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Select &quot;Team&quot; for team members or &quot;Trustee&quot; for trust leadership.
            </p>
          </div>

          {/* 7. Designation */}
          <div className="space-y-1.5">
            <Label
              htmlFor="designation"
              className="text-foreground flex items-center gap-1.5 text-sm font-semibold"
            >
              <Briefcase className="text-primary size-4" aria-hidden="true" />
              <span>Designation</span>
              <span className="text-destructive font-bold">*</span>
            </Label>
            {memberType === 'staff' ? (
              <div className="space-y-1.5">
                <Input
                  id="designation"
                  value="Team"
                  disabled
                  readOnly
                  className="bg-muted/60 text-foreground h-11 cursor-not-allowed select-none font-semibold"
                />
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <CheckCircle2 className="text-primary size-3.5" aria-hidden="true" />
                  <span>Automatically set to &quot;Team&quot; for team members</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Input
                  id="designation"
                  name="designation"
                  value={trusteeDesignation}
                  onChange={(e) => {
                    setTrusteeDesignation(e.target.value);
                    if (touched.designation) handleBlur('designation', e.target.value);
                  }}
                  onBlur={(e) => handleBlur('designation', e.target.value)}
                  placeholder="e.g. Managing Trustee, Co-Founder & Director"
                  required
                  hasError={Boolean(getFieldError('designation'))}
                  className="h-11"
                />
                {getFieldError('designation') ? (
                  <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{getFieldError('designation')}</span>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Specify trustee designation or official title.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 8. Image */}
          <div className="space-y-2">
            <Label
              htmlFor="photoUrl"
              className="text-foreground flex items-center gap-1.5 text-sm font-semibold"
            >
              <ImageIcon className="text-primary size-4" aria-hidden="true" />
              <span>Image</span>
              <span className="text-destructive font-bold">*</span>
            </Label>

            <div
              className={`flex flex-col items-start gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center ${
                getFieldError('photoUrl')
                  ? 'border-destructive bg-destructive/5 ring-destructive/20 ring-1'
                  : 'border-border/80 bg-surface/50'
              }`}
            >
              {/* Photo Preview */}
              <div
                className={`relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${
                  photoUrl ? 'border-border bg-black/5' : 'border-border bg-muted/30 border-dashed'
                }`}
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt="Team member preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center justify-center">
                    <User className="size-8 stroke-[1.5]" />
                    <span className="mt-1 text-[10px] font-medium">Required</span>
                  </div>
                )}
              </div>

              {/* Upload Controls & URL */}
              <div className="w-full flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="h-9 px-4 text-xs font-semibold"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="mr-1.5 size-3.5" />
                        Upload Photograph
                      </>
                    )}
                  </Button>

                  {photoUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhotoUrl('');
                        handleBlur('photoUrl', '');
                      }}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 px-3 text-xs"
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      Remove
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Input
                    id="photoUrl"
                    value={photoUrl}
                    onChange={(e) => {
                      setPhotoUrl(e.target.value);
                      if (touched.photoUrl) handleBlur('photoUrl', e.target.value);
                    }}
                    onBlur={(e) => handleBlur('photoUrl', e.target.value)}
                    placeholder="Or enter image URL (https://...)"
                    hasError={Boolean(getFieldError('photoUrl'))}
                    className="h-9 text-xs"
                  />
                  <p className="text-muted-foreground text-[11px]">
                    Upload a photograph from your device or paste a public HTTPS photo URL.
                  </p>
                </div>

                {uploadError ? (
                  <p className="text-destructive text-xs font-medium">{uploadError}</p>
                ) : null}
              </div>
            </div>

            {getFieldError('photoUrl') ? (
              <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{getFieldError('photoUrl')}</span>
              </p>
            ) : null}
          </div>

          {/* Action Footer */}
          <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
            <Button
              type="submit"
              variant="primary"
              disabled={pending || isUploading}
              className="h-11 px-8 font-semibold shadow-sm"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {member ? 'Saving Changes...' : 'Creating Profile...'}
                </>
              ) : member ? (
                'Save Changes'
              ) : (
                'Create Team Member'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
