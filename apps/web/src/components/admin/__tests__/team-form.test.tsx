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
import { RESPONSIBILITIES_MAX } from '@/lib/team/roles';

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
    expect(validatePhone('')).toBe('Contact number is mandatory.');
    expect(validatePhone('12345')).toBe(
      'Please enter a valid contact number (at least 10 digits).',
    );
    expect(validatePhone('+91 98765 43210')).toBeNull();
    expect(validatePhone('9876543210')).toBeNull();
  });

  it('validates and formats 12-digit Aadhaar numbers correctly', () => {
    expect(validateAadhaar('')).toBe('Adhar number is mandatory.');
    expect(validateAadhaar('12345')).toBe(
      'Adhar number must be exactly 12 digits (e.g. 1234 5678 9012).',
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

describe('TeamForm (Admin Add/Edit Team member)', () => {
  it('renders every mandatory field with red asterisk indicator', () => {
    render(<TeamForm />);

    // 1. Full name *
    expect(screen.getByText('Full name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Rahul Sharma/i)).toBeInTheDocument();

    // 2. Email *
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. rahul\.sharma@sailent\.org/i)).toBeInTheDocument();

    // 3. Contact number *
    expect(screen.getByText('Contact number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. \+91 98765 43210/i)).toBeInTheDocument();

    // 4. Adhar number *
    expect(screen.getByText('Adhar number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. 1234 5678 9012/i)).toBeInTheDocument();

    // 5. Address *
    expect(screen.getByText('Address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Flat 302/i)).toBeInTheDocument();

    // 6. Type *
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Type/i })).toHaveTextContent(/Team/i);

    // 7. Designation * (automatically 'Team' for staff), Department (optional, staff),
    // Responsibilities (optional, not public).
    expect(screen.getByText('Designation')).toBeInTheDocument();
    const designationDisplay = screen.getByRole('textbox', { name: /Designation/i });
    expect(designationDisplay).toHaveValue('Team');
    expect(designationDisplay).toBeDisabled();
    expect(screen.getByText(/Automatically set to "Team" for team members/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Department/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Responsibilities/i })).toHaveValue('');
    // Both optional, and neither is shown on the public page.
    expect(screen.getAllByText('(optional)')).toHaveLength(2);
    expect(screen.getAllByText(/not shown on the public Team page/i)).toHaveLength(2);
    expect(screen.getByText(`0/${RESPONSIBILITIES_MAX}`)).toBeInTheDocument();

    // 8. Image *
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload photograph/i })).toBeInTheDocument();

    // Submit button
    expect(screen.getByRole('button', { name: /Create Team member/i })).toBeInTheDocument();
  });

  it('triggers in-box validation and displays error messages on empty form submission', () => {
    render(<TeamForm />);

    const submitBtn = screen.getByRole('button', { name: /Create Team member/i });
    fireEvent.click(submitBtn);

    // Verifies in-box validation errors are shown
    expect(screen.getByText('Full name is mandatory.')).toBeInTheDocument();
    expect(screen.getByText('Email is mandatory.')).toBeInTheDocument();
    expect(screen.getByText('Contact number is mandatory.')).toBeInTheDocument();
    expect(screen.getByText('Adhar number is mandatory.')).toBeInTheDocument();
    expect(screen.getByText('Address is mandatory.')).toBeInTheDocument();
    expect(
      screen.getByText('Photograph is mandatory. Please upload an image or provide an image URL.'),
    ).toBeInTheDocument();
    // Department and responsibilities are optional, so empty is not an error.
    expect(screen.queryByText(/department/i, { selector: 'p span' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Responsibilities (are|must)/)).not.toBeInTheDocument();
  });

  it('refuses responsibilities longer than the limit', () => {
    render(<TeamForm />);
    const responsibilities = screen.getByRole('textbox', { name: /Responsibilities/i });
    fireEvent.change(responsibilities, { target: { value: 'x'.repeat(RESPONSIBILITIES_MAX + 1) } });
    fireEvent.blur(responsibilities);
    expect(
      screen.getByText(`Responsibilities must be at most ${RESPONSIBILITIES_MAX} characters.`),
    ).toBeInTheDocument();
  });

  it('does not offer the generated bio or the old "Team" department back as if they were real', () => {
    render(
      <TeamForm
        member={{
          id: 'tm-3',
          name: 'Shibu',
          slug: 'shibu',
          designation: 'Team',
          department: 'Team',
          memberType: 'staff' as const,
          contactNumber: '+91 98765 43210',
          aadharNumber: '9999 8888 7777',
          address: 'Indiranagar, Bengaluru, Karnataka 560038',
          photoUrl: 'https://example.com/shibu.jpg',
          bio: 'Shibu is a dedicated team member at Sailent Foundation.',
          experience: null,
          socialLinks: null,
          emailPublic: 'shibu@sailent.org',
          status: 'published' as const,
          isPublic: true,
          displayOrder: 3,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        }}
      />,
    );

    expect(screen.getByRole('textbox', { name: /Designation/i })).toHaveValue('Team');
    expect(screen.getByRole('textbox', { name: /Responsibilities/i })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /Department/i })).toHaveTextContent(
      'Select department',
    );
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

  it('pre-populates existing member fields and shows Save changes', () => {
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
      bio: 'Runs the learning centres in Gaya.',
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
    // The department and responsibilities the record holds are kept — saving
    // used to overwrite the department with "Team".
    expect(screen.getByRole('combobox', { name: /Department/i })).toHaveTextContent('Programmes');
    expect(screen.getByDisplayValue('Runs the learning centres in Gaya.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save changes/i })).toBeInTheDocument();
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
    // Trustees are not filed under a staff department.
    expect(screen.queryByRole('combobox', { name: /Department/i })).not.toBeInTheDocument();
  });
});
