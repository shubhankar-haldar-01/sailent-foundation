import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DonorCorrectionForm } from '../donor-correction-form';

const mockDonor = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  firstName: 'Aarav',
  lastName: 'Sharma',
  email: 'aarav@example.com',
  taxIdType: 'pan',
  taxIdNumber: null,
  addressLine1: '123 Main Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
};

describe('DonorCorrectionForm - PAN validation', () => {
  it('renders PAN input field with initial empty state', () => {
    render(<DonorCorrectionForm donor={mockDonor} />);

    const panInput = screen.getByLabelText(/PAN \(Permanent Account Number\)/i);
    expect(panInput).toBeInTheDocument();
    expect(panInput).toHaveValue('');
    expect(screen.getByText('0/10')).toBeInTheDocument();
  });

  it('restricts first 5 characters to alphabets and uppercases them', () => {
    render(<DonorCorrectionForm donor={mockDonor} />);

    const panInput = screen.getByLabelText(/PAN \(Permanent Account Number\)/i);

    // Try typing numbers at first position - should be rejected
    fireEvent.change(panInput, { target: { value: '123' } });
    expect(panInput).toHaveValue('');

    // Type lowercase letters - should be converted to uppercase
    fireEvent.change(panInput, { target: { value: 'abcde' } });
    expect(panInput).toHaveValue('ABCDE');
    expect(screen.getByText('5/10')).toBeInTheDocument();
  });

  it('restricts characters 6 to 9 to digits and 10th to alphabet', () => {
    render(<DonorCorrectionForm donor={mockDonor} />);

    const panInput = screen.getByLabelText(/PAN \(Permanent Account Number\)/i);

    // After 5 letters, typing letters should be rejected (digits only)
    fireEvent.change(panInput, { target: { value: 'ABCDEFGH' } });
    expect(panInput).toHaveValue('ABCDE');

    // Entering digits for positions 6-9
    fireEvent.change(panInput, { target: { value: 'ABCDE1234' } });
    expect(panInput).toHaveValue('ABCDE1234');
    expect(screen.getByText('9/10')).toBeInTheDocument();
    expect(screen.getByText('Last character must be a letter')).toBeInTheDocument();

    // Entering a digit for 10th character should be rejected
    fireEvent.change(panInput, { target: { value: 'ABCDE12345' } });
    expect(panInput).toHaveValue('ABCDE1234');

    // Entering a letter for 10th character is valid
    fireEvent.change(panInput, { target: { value: 'abcde1234f' } });
    expect(panInput).toHaveValue('ABCDE1234F');
    expect(screen.getByText('10/10')).toBeInTheDocument();
    expect(screen.getByText(/Valid PAN format/i)).toBeInTheDocument();
  });

  it('caps input at 10 characters', () => {
    render(<DonorCorrectionForm donor={mockDonor} />);

    const panInput = screen.getByLabelText(/PAN \(Permanent Account Number\)/i);

    fireEvent.change(panInput, { target: { value: 'ABCDE1234FXYZ' } });
    expect(panInput).toHaveValue('ABCDE1234F');
  });

  it('disables submit button while PAN is incomplete', () => {
    render(<DonorCorrectionForm donor={mockDonor} />);

    const panInput = screen.getByLabelText(/PAN \(Permanent Account Number\)/i);
    const submitButton = screen.getByRole('button', { name: 'Save correction' });

    // Initially with empty PAN, submit is enabled (PAN is optional)
    expect(submitButton).not.toBeDisabled();

    // With incomplete PAN (e.g. 4 chars), submit is disabled
    fireEvent.change(panInput, { target: { value: 'ABCD' } });
    expect(submitButton).toBeDisabled();

    // With complete valid PAN (10 chars), submit is enabled
    fireEvent.change(panInput, { target: { value: 'ABCDE1234F' } });
    expect(submitButton).not.toBeDisabled();
  });
});
