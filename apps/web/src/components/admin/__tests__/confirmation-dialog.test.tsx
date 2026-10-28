import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfirmationDialog, Button } from '@sailent/ui';

describe('ConfirmationDialog', () => {
  it('renders open dialog with title, description, and action buttons', () => {
    render(
      <ConfirmationDialog
        open={true}
        title="Delete this campaign?"
        description="This action cannot be undone."
        confirmLabel="Delete campaign"
        cancelLabel="Keep campaign"
        variant="destructive"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Delete this campaign?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete campaign' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep campaign' })).toBeInTheDocument();
  });

  it('calls onCancel and does not call onConfirm when Cancel is clicked', () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Archive program?"
        description="This will remove the program from public view."
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(handleCancel).toHaveBeenCalledTimes(1);
    expect(handleConfirm).not.toHaveBeenCalled();
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onConfirm when Confirm is clicked', () => {
    const handleConfirm = vi.fn();

    render(
      <ConfirmationDialog
        open={true}
        title="Confirm action"
        description="Proceed with the change."
        confirmLabel="Proceed"
        onConfirm={handleConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Proceed' });
    fireEvent.click(confirmButton);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('handles async onConfirm with loading state and prevents duplicate submission', async () => {
    let resolveAction: () => void;
    const promise = new Promise<void>((resolve) => {
      resolveAction = resolve;
    });
    const handleConfirm = vi.fn(() => promise);

    render(
      <ConfirmationDialog
        open={true}
        title="Deleting item"
        description="Please wait while this item is removed."
        confirmLabel="Delete"
        onConfirm={handleConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Working…')).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();

    // Clicking again should not invoke onConfirm again while pending
    fireEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);

    // Resolve the promise
    resolveAction!();
    await waitFor(() => {
      expect(screen.queryByText('Working…')).not.toBeInTheDocument();
    });
  });

  it('displays error message when action fails or error prop is provided', () => {
    render(
      <ConfirmationDialog
        open={true}
        title="Delete campaign"
        description="Remove this campaign."
        onConfirm={vi.fn()}
        error="Cannot delete campaign with existing donations."
      />,
    );

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent('Cannot delete campaign with existing donations.');
  });

  it('opens via trigger when uncontrolled', () => {
    render(
      <ConfirmationDialog
        trigger={<Button>Open Dialog</Button>}
        title="Triggered Dialog"
        description="Opened via trigger element."
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Dialog' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Triggered Dialog')).toBeInTheDocument();
  });
});
