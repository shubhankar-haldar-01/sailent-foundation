import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AdminMedia } from '@/lib/admin/api';

import { ArticleEditor } from '../article-editor';

function media(overrides: Partial<AdminMedia>): AdminMedia {
  return {
    id: 'm1',
    storageKey: 'k1',
    url: '/uploads/a.webp',
    altText: 'Children at a reading camp',
    caption: null,
    mimeType: 'image/webp',
    sizeBytes: 1000,
    width: 800,
    height: 600,
    visibility: 'public',
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  } as AdminMedia;
}

function renderEditor(library: AdminMedia[] = []) {
  return render(
    <form>
      <span id="article-label">Article</span>
      <ArticleEditor
        name="content"
        labelId="article-label"
        initialMarkdown={'# A heading\n\nHello **world**.'}
        media={library}
      />
    </form>,
  );
}

describe('ArticleEditor', () => {
  it('is a labelled text box with a named toolbar, and submits Markdown', async () => {
    const { container } = renderEditor();

    const toolbar = await screen.findByRole('toolbar', { name: 'Formatting' });
    for (const name of [
      'Bold',
      'Italic',
      'Inline code',
      'Link',
      'Bulleted list',
      'Numbered list',
      'Quote',
      'Image from the Media library',
      'Undo',
      'Redo',
    ]) {
      expect(within(toolbar).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(toolbar).getByLabelText('Text style')).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: 'Article' })).toBeInTheDocument();
    // Until somebody edits, the form submits the article exactly as stored.
    const field = container.querySelector<HTMLInputElement>('input[type="hidden"][name="content"]');
    expect(field?.value).toBe('# A heading\n\nHello **world**.');
  });

  it('refuses a javascript: link, and says what it will take', async () => {
    renderEditor();
    const toolbar = await screen.findByRole('toolbar', { name: 'Formatting' });
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Link' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Address'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add link' }));

    expect(await within(dialog).findByText(/Enter a web address/)).toBeInTheDocument();
  });

  it('offers only public images from the Media library', async () => {
    renderEditor([
      media({ id: 'pub', altText: 'A public photograph' }),
      media({ id: 'priv', altText: 'A private scan', visibility: 'private', url: null }),
      media({ id: 'pdf', altText: 'A report', mimeType: 'application/pdf', url: '/uploads/r.pdf' }),
    ]);
    const toolbar = await screen.findByRole('toolbar', { name: 'Formatting' });
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Image from the Media library' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: /Insert: A public photograph/ }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText('A private scan')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('A report')).not.toBeInTheDocument();
  });
});
