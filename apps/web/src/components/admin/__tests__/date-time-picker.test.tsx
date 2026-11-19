import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { DateTimePicker } from '../date-time-picker';

describe('DateTimePicker', () => {
  it('renders placeholder when no value is provided', () => {
    render(<DateTimePicker name="startDate" placeholder="Choose date & time" />);
    expect(screen.getByText('Choose date & time')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('renders formatted date and time in Indian format', () => {
    // 2026-11-20 at 09:30 AM
    render(<DateTimePicker name="startDate" value="2026-11-20T09:30" />);
    expect(screen.getByText(/20 Nov 2026 • 09:30 AM/i)).toBeInTheDocument();
  });

  it('renders hidden input with exact field name and iso value', () => {
    const { container } = render(<DateTimePicker name="endDate" value="2026-11-22T14:45" />);
    const hiddenInput = container.querySelector('input[type="hidden"][name="endDate"]');
    expect(hiddenInput).toBeInTheDocument();
    expect(hiddenInput).toHaveValue('2026-11-22T14:45');
  });

  it('calls onChange with empty string when clear button is clicked', () => {
    const handleChange = vi.fn();
    render(<DateTimePicker name="startDate" value="2026-11-20T09:30" onChange={handleChange} />);

    const clearBtn = screen.getByLabelText(/Clear selected date/i);
    fireEvent.click(clearBtn);
    expect(handleChange).toHaveBeenCalledWith('');
  });

  describe('minutes', () => {
    // jsdom lacks the pointer-capture and scrolling calls Radix Select makes.
    beforeAll(() => {
      Element.prototype.hasPointerCapture ??= () => false;
      Element.prototype.releasePointerCapture ??= () => {};
      Element.prototype.scrollIntoView ??= () => {};
    });

    function openMinutes(trigger: RegExp) {
      fireEvent.click(screen.getByRole('button', { name: trigger }));
      const minute = screen.getAllByRole('combobox')[1]!;
      fireEvent.keyDown(minute, { key: 'ArrowDown' });
      return minute;
    }

    it('offers every minute from 00 to 59', () => {
      render(<DateTimePicker name="startDate" value="2026-11-19T23:00" />);
      openMinutes(/19 Nov 2026/);

      const options = screen.getAllByRole('option').map((option) => option.textContent);
      expect(options).toHaveLength(60);
      expect(options[0]).toBe('00');
      expect(options).toContain('07');
      expect(options[59]).toBe('59');
    });

    it('sets a minute that is not a multiple of five', () => {
      const handleChange = vi.fn();
      render(<DateTimePicker name="startDate" value="2026-11-19T23:00" onChange={handleChange} />);
      openMinutes(/19 Nov 2026/);

      fireEvent.click(screen.getByRole('option', { name: '59' }));
      expect(handleChange).toHaveBeenCalledWith('2026-11-19T23:59');
    });

    it('shows a stored minute as it is, not as 00', () => {
      render(<DateTimePicker name="startDate" value="2026-11-19T10:07" />);
      fireEvent.click(screen.getByRole('button', { name: /19 Nov 2026/ }));

      expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('07');
    });
  });

  it('applies error styling when hasError is true', () => {
    render(<DateTimePicker name="startDate" value="2026-11-20T09:30" hasError={true} />);
    const trigger = screen.getByRole('button', { name: /20 Nov 2026/i });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger.className).toContain('border-destructive');
  });
});
