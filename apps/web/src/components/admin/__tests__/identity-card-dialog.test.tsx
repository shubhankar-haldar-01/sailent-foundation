import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createIdCardPdfBlob,
  IdentityCardPreview,
  IssueIdentityCardDialog,
} from '../identity-card-dialog';

describe('IdentityCardPreview', () => {
  const mockCard = {
    id: 'team-12345',
    name: 'Austin Ortiz',
    designation: 'Marketing Manager',
    idNumber: '0000060816',
    dob: '06/08/16',
    email: 'austinortiz@gmail.com',
    phone: '946 385 921',
    companyName: 'SAILENT FOUNDATION',
  };

  it('renders staff name, designation and official sailent-logo accurately without separate text', () => {
    render(<IdentityCardPreview card={mockCard} />);

    expect(screen.getByText('Austin Ortiz')).toBeInTheDocument();
    expect(screen.getByText('MARKETING MANAGER')).toBeInTheDocument();
    expect(screen.queryByText('SAILENT FOUNDATION')).not.toBeInTheDocument();

    const logo = screen.getByAltText('Sailent Foundation');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/images/sailent-logo.png');
  });

  it('renders custom logo when logoUrl is provided', () => {
    render(
      <IdentityCardPreview
        card={{
          ...mockCard,
          logoUrl: 'https://example.com/custom-logo.png',
        }}
      />,
    );

    const logo = screen.getByAltText('Sailent Foundation');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', 'https://example.com/custom-logo.png');
  });

  it('renders all key-value detail pairs', () => {
    render(<IdentityCardPreview card={mockCard} />);

    expect(screen.getByText('ID No')).toBeInTheDocument();
    expect(screen.getByText('0000060816')).toBeInTheDocument();
    expect(screen.getByText('DOB')).toBeInTheDocument();
    expect(screen.getByText('06/08/16')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('austinortiz@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('946 385 921')).toBeInTheDocument();
  });

  it('derives a professional email when none is provided', () => {
    render(
      <IdentityCardPreview
        card={{
          id: 'team-99',
          name: 'Shubhankar Haldar',
          designation: 'Co-founder & Director',
        }}
      />,
    );

    expect(screen.getByText('Shubhankar Haldar')).toBeInTheDocument();
    expect(screen.getByText('CO-FOUNDER & DIRECTOR')).toBeInTheDocument();
    expect(screen.getByAltText('Sailent Foundation')).toBeInTheDocument();
    expect(screen.getByText('shubhankar.haldar@sailent.org')).toBeInTheDocument();
  });
});

describe('IssueIdentityCardDialog', () => {
  const mockCard = {
    id: 'team-99',
    name: 'Shubhankar Haldar',
    designation: 'Operations Director',
    email: 'shubhankar@sailent.local',
    phone: '987 654 321',
  };

  it('opens dialog with preview and download PDF actions when triggered', () => {
    render(<IssueIdentityCardDialog initialData={mockCard} />);

    const triggerBtn = screen.getByRole('button', { name: /id card/i });
    expect(triggerBtn).toBeInTheDocument();

    fireEvent.click(triggerBtn);

    expect(screen.getByText('Official Staff Identity Card')).toBeInTheDocument();
    expect(screen.getByText('Shubhankar Haldar')).toBeInTheDocument();
    expect(screen.getByText('OPERATIONS DIRECTOR')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();
  });
});

describe('createIdCardPdfBlob', () => {
  it('generates an application/pdf Blob with standard CR80 54x85.6mm specifications', async () => {
    const dummyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const blob = createIdCardPdfBlob(dummyJpeg, 638, 1011);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(100);

    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });

    expect(text).toContain('%PDF-1.4');
    expect(text).toContain('MediaBox[0 0 153.0709 242.6457]');
    expect(text).toContain('/Filter/DCTDecode');
  });
});
