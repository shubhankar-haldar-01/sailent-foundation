import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toaster, resetToastsForTests } from '@sailent/ui';

import {
  formatAadhaar,
  TeamForm,
  validateAadhaar,
  validateAddress,
  validateEmail,
  validatePhone,
} from '../team-form';

// Mock server actions
vi.mock('@/lib/admin/actions', () => ({
  createTeamMember: vi.fn(),
  updateTeamMember: vi.fn(),
}));

// Arriving from a create, the form drops the `created` flag with the router (UI feedback, Phase 5).
const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => '/admin/team/member-1/edit',
}));

describe('TeamForm - In-Box Validation Helpers', () => {
  it('validates email addresses correctly', () => {
    expect(validateEmail('')).toBe('Email is mandatory.');
    expect(validateEmail('invalid-email')).toBe(
      'Please enter a valid email address (e.g. name@sailent.org).',
    );
    expect(validateEmail('test@sailent.org')).toBeNull();
  });

  it('validates contact numbers correctly', () => {
    expect(validatePhone('')).toBe('Contact Number is mandatory.');
    expect(validatePhone('12345')).toBe(
      'Please enter a valid contact number (at least 10 digits).',
    );
    expect(validatePhone('+91 98765 43210')).toBeNull();
    expect(validatePhone('9876543210')).toBeNull();
  });

  it('validates and formats 12-digit Aadhaar numbers correctly', () => {
    expect(validateAadhaar('')).toBe('Adhar Number is mandatory.');
    expect(validateAadhaar('12345')).toBe(
      'Adhar Number must be exactly 12 digits (e.g. 1234 5678 9012).',
    );
    expect(validateAadhaar('1234 5678 9012')).toBeNull();
    expect(validateAadhaar('123456789012')).toBeNull();

    expect(formatAadhaar('123456789012')).toBe('1234 5678 9012');
    expect(formatAadhaar('1234')).toBe('1234');
    expect(formatAadhaar('12345678')).toBe('1234 5678');
  });

  it('validates complete address correctly', () => {
    expect(validateAddress('')).toBe('Address is mandatory.');
    expect(validateAddress('Short')).toBe(
      'Please enter a complete address (minimum 10 characters).',
    );
    expect(validateAddress('Flat 302, Green Glen Heights, Bengaluru')).toBeNull();
  });
});

describe('TeamForm (Admin Add/Edit Team Member)', () => {
  it('renders all 8 mandatory fields with red asterisk indicator', () => {
    render(<TeamForm />);

    // 1. Full Name *
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Rahul Sharma/i)).toBeInTheDocument();

    // 2. Email *
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. rahul\.sharma@sailent\.org/i)).toBeInTheDocument();

    // 3. Contact Number *
    expect(screen.getByText('Contact Number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. \+91 98765 43210/i)).toBeInTheDocument();

    // 4. Adhar Number *
    expect(screen.getByText('Adhar Number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. 1234 5678 9012/i)).toBeInTheDocument();

    // 5. Address *
    expect(screen.getByText('Address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Flat 302/i)).toBeInTheDocument();

    // 6. Type *
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent(/Team/i);

    // 7. Designation * (automatically 'Team' by default)
    expect(screen.getByText('Designation')).toBeInTheDocument();
    const designationDisplay = screen.getByRole('textbox', { name: /Designation/i });
    expect(designationDisplay).toBeInTheDocument();
    expect(designationDisplay).toHaveValue('Team');
    expect(designationDisplay).toBeDisabled();
    expect(screen.getByText(/Automatically set to "Team" for team members/i)).toBeInTheDocument();

    // 8. Image *
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload Photograph/i })).toBeInTheDocument();

    // Submit button
    expect(screen.getByRole('button', { name: /Create Team Member/i })).toBeInTheDocument();
  });

  it('triggers in-box validation and displays error messages on empty form submission', () => {
    render(<TeamForm />);

    const submitBtn = screen.getByRole('button', { name: /Create Team Member/i });
    fireEvent.click(submitBtn);

    // Verifies in-box validation errors are shown
    expect(screen.getByText('Full Name is mandatory.')).toBeInTheDocument();
    expect(screen.getByText('Email is mandatory.')).toBeInTheDocument();
    expect(screen.getByText('Contact Number is mandatory.')).toBeInTheDocument();
    expect(screen.getByText('Adhar Number is mandatory.')).toBeInTheDocument();
    expect(screen.getByText('Address is mandatory.')).toBeInTheDocument();
    expect(
      screen.getByText('Photograph is mandatory. Please upload an image or provide an image URL.'),
    ).toBeInTheDocument();
  });

  it('validates and auto-formats Aadhaar number on typing', () => {
    render(<TeamForm />);

    const aadharInput = screen.getByPlaceholderText(/e\.g\. 1234 5678 9012/i);
    fireEvent.change(aadharInput, { target: { value: '123456789012' } });

    // Verifies auto-formatting into blocks of 4 digits
    expect(aadharInput).toHaveValue('1234 5678 9012');
  });

  it('validates email in real-time when blurred', () => {
    render(<TeamForm />);

    const emailInput = screen.getByPlaceholderText(/e\.g\. rahul\.sharma@sailent\.org/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);

    expect(
      screen.getByText('Please enter a valid email address (e.g. name@sailent.org).'),
    ).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: 'valid@sailent.org' } });
    fireEvent.blur(emailInput);
    expect(
      screen.queryByText('Please enter a valid email address (e.g. name@sailent.org).'),
    ).not.toBeInTheDocument();
  });

  it('pre-populates existing member fields and shows Save Changes', () => {
    const existingMember = {
      id: 'tm-1',
      name: 'Priya Verma',
      slug: 'priya-verma',
      designation: 'Team',
      department: 'Programmes',
      memberType: 'staff' as const,
      contactNumber: '+91 98765 43210',
      aadharNumber: '9999 8888 7777',
      address: 'Indiranagar, Bengaluru, Karnataka 560038',
      photoUrl: 'https://example.com/priya.jpg',
      bio: 'Bio text',
      experience: null,
      socialLinks: null,
      emailPublic: 'priya@sailent.org',
      status: 'published' as const,
      isPublic: true,
      displayOrder: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    render(<TeamForm member={existingMember} />);

    expect(screen.getByDisplayValue('Priya Verma')).toBeInTheDocument();
    expect(screen.getByDisplayValue('priya@sailent.org')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+91 98765 43210')).toBeInTheDocument();
    expect(screen.getByDisplayValue('9999 8888 7777')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('Indiranagar, Bengaluru, Karnataka 560038'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    expect(screen.getByAltText(/Team member preview/i)).toHaveAttribute(
      'src',
      'https://example.com/priya.jpg',
    );
  });

  it('scrolls to top when initialSuccess is true (after creation redirect)', () => {
    const scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy;

    render(<TeamForm initialSuccess />);

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('says the member was created with ONE toast on arrival, and drops the flag so a reload does not repeat it', () => {
    resetToastsForTests();
    window.scrollTo = vi.fn();
    replace.mockReset();

    const { rerender } = render(
      <>
        <Toaster />
        <TeamForm initialSuccess />
      </>,
    );
    rerender(
      <>
        <Toaster />
        <TeamForm initialSuccess />
      </>,
    );

    expect(screen.getAllByText('Team member created')).toHaveLength(1);
    expect(replace).toHaveBeenCalledWith('/admin/team/member-1/edit', { scroll: false });
  });

  it('allows custom designation when member is a Trustee and enforces designation validation', () => {
    const trusteeMember = {
      id: 'tm-2',
      name: 'Dr. Ramesh Rao',
      slug: 'dr-ramesh-rao',
      designation: 'Managing Trustee',
      department: 'Trustees',
      memberType: 'trustee' as const,
      contactNumber: '+91 98111 22233',
      aadharNumber: '1111 2222 3333',
      address: 'MG Road, Bengaluru, Karnataka 560001',
      photoUrl: 'https://example.com/ramesh.jpg',
      bio: 'Trustee bio',
      experience: null,
      socialLinks: null,
      emailPublic: 'ramesh@sailent.org',
      status: 'published' as const,
      isPublic: true,
      displayOrder: 2,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    render(<TeamForm member={trusteeMember} />);

    const designationInput = screen.getByDisplayValue('Managing Trustee');
    expect(designationInput).toBeInTheDocument();
    expect(designationInput).not.toBeDisabled();

    fireEvent.change(designationInput, { target: { value: '' } });
    fireEvent.blur(designationInput);

    expect(screen.getByText('Designation is mandatory for trustees.')).toBeInTheDocument();

    fireEvent.change(designationInput, { target: { value: 'Honorary Trustee' } });
    fireEvent.blur(designationInput);
    expect(screen.queryByText('Designation is mandatory for trustees.')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Honorary Trustee')).toBeInTheDocument();
  });
});
