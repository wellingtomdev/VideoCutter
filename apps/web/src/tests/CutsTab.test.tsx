import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { CutsTab } from '../components/editor/CutsTab';
import type { JobCutEntry } from '../types';

const makeCut = (id: string, overrides?: Partial<JobCutEntry>): JobCutEntry => ({
  id,
  label: `0:15 → 0:45`,
  startMs: 15000,
  endMs: 45000,
  audioOffsetMs: 0,
  output: {
    filePath: `/output/cut-${id}.mp4`,
    durationMs: 30000,
    fileSize: 5242880, // 5 MB
  },
  createdAt: '2025-06-15T14:30:00.000Z',
  ...overrides,
});

describe('CutsTab', () => {
  it('renders a card for each cut', () => {
    const cuts = [makeCut('c1'), makeCut('c2'), makeCut('c3')];
    const { getAllByText } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} />
    );

    expect(getAllByText('0:15 → 0:45')).toHaveLength(3);
  });

  it('displays duration and file size', () => {
    const cuts = [makeCut('c1')];
    const { getByText } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} />
    );

    expect(getByText(/Duração: 0:30/)).toBeTruthy();
    expect(getByText(/Tamanho: 5\.0 MB/)).toBeTruthy();
  });

  it('displays the file name from the path', () => {
    const cuts = [makeCut('c1')];
    const { getByText } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} />
    );

    expect(getByText('cut-c1.mp4')).toBeTruthy();
  });

  it('shows audio offset when non-zero', () => {
    const cuts = [makeCut('c1', { audioOffsetMs: 150 })];
    const { getByText } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} />
    );

    expect(getByText(/Offset: 150ms/)).toBeTruthy();
  });

  it('hides audio offset when zero', () => {
    const cuts = [makeCut('c1', { audioOffsetMs: 0 })];
    const { queryByText } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} />
    );

    expect(queryByText(/Offset:/)).toBeNull();
  });

  it('hides file size when not available', () => {
    const cuts = [makeCut('c1', { output: { filePath: '/out/x.mp4', durationMs: 10000 } })];
    const { queryByText } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} />
    );

    expect(queryByText(/Tamanho:/)).toBeNull();
  });

  it('calls onSelect with the correct cut when "Selecionar" is clicked', () => {
    const onSelect = vi.fn();
    const cut = makeCut('c1');
    const { getByText } = render(
      <CutsTab cuts={[cut]} onSelect={onSelect} />
    );

    fireEvent.click(getByText('Selecionar'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(cut);
  });

  it('calls onSelect when clicking the card itself', () => {
    const onSelect = vi.fn();
    const cut = makeCut('c1');
    const { getByText } = render(
      <CutsTab cuts={[cut]} onSelect={onSelect} />
    );

    fireEvent.click(getByText('0:15 → 0:45'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(cut);
  });

  it('highlights the selected cut', () => {
    const cuts = [makeCut('c1'), makeCut('c2')];
    const { getByText, getAllByText } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} selectedCutId="c1" />
    );

    expect(getByText('Selecionado')).toBeTruthy();
    expect(getAllByText('Selecionar')).toHaveLength(1);
  });

  it('renders the creation date', () => {
    const cuts = [makeCut('c1', { createdAt: '2025-12-25T10:30:00.000Z' })];
    const { container } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} />
    );

    const text = container.textContent ?? '';
    expect(text).toContain('25/12');
  });

  it('handles Windows-style paths in basename', () => {
    const cuts = [makeCut('c1', {
      output: { filePath: 'C:\\Users\\test\\videos\\my-cut.mp4', durationMs: 5000, fileSize: 1024 },
    })];
    const { getByText } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} />
    );

    expect(getByText('my-cut.mp4')).toBeTruthy();
  });

  // ── Delete functionality ──

  it('shows "Excluir" button when onDelete is provided', () => {
    const cuts = [makeCut('c1')];
    const { getByTestId } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} onDelete={vi.fn()} />
    );

    expect(getByTestId('delete-c1')).toBeTruthy();
  });

  it('does NOT show "Excluir" button when onDelete is not provided', () => {
    const cuts = [makeCut('c1')];
    const { queryByTestId } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} />
    );

    expect(queryByTestId('delete-c1')).toBeNull();
  });

  it('shows confirmation buttons when "Excluir" is clicked', () => {
    const cuts = [makeCut('c1')];
    const { getByTestId, getByText } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} onDelete={vi.fn()} />
    );

    fireEvent.click(getByTestId('delete-c1'));

    expect(getByText('Confirmar')).toBeTruthy();
    expect(getByText('Cancelar')).toBeTruthy();
  });

  it('calls onDelete when "Confirmar" is clicked', () => {
    const onDelete = vi.fn();
    const cut = makeCut('c1');
    const { getByTestId } = render(
      <CutsTab cuts={[cut]} onSelect={vi.fn()} onDelete={onDelete} />
    );

    fireEvent.click(getByTestId('delete-c1'));
    fireEvent.click(getByTestId('confirm-delete-c1'));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith(cut);
  });

  it('hides confirmation when "Cancelar" is clicked', () => {
    const onDelete = vi.fn();
    const cuts = [makeCut('c1')];
    const { getByTestId, queryByText } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} onDelete={onDelete} />
    );

    fireEvent.click(getByTestId('delete-c1'));
    expect(queryByText('Confirmar')).toBeTruthy();

    fireEvent.click(getByTestId('cancel-delete-c1'));

    expect(queryByText('Confirmar')).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('does NOT trigger onSelect when clicking delete buttons', () => {
    const onSelect = vi.fn();
    const cuts = [makeCut('c1')];
    const { getByTestId } = render(
      <CutsTab cuts={cuts} onSelect={onSelect} onDelete={vi.fn()} />
    );

    fireEvent.click(getByTestId('delete-c1'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  // ── Download functionality ──

  it('shows "Baixar" button when onDownload is provided', () => {
    const cuts = [makeCut('c1')];
    const { getByTestId } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} onDownload={vi.fn()} />
    );

    expect(getByTestId('download-c1')).toBeTruthy();
  });

  it('does NOT show "Baixar" button when onDownload is not provided', () => {
    const cuts = [makeCut('c1')];
    const { queryByTestId } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} />
    );

    expect(queryByTestId('download-c1')).toBeNull();
  });

  it('calls onDownload with the correct cut when "Baixar" is clicked', () => {
    const onDownload = vi.fn();
    const cut = makeCut('c1');
    const { getByTestId } = render(
      <CutsTab cuts={[cut]} onSelect={vi.fn()} onDownload={onDownload} />
    );

    fireEvent.click(getByTestId('download-c1'));
    expect(onDownload).toHaveBeenCalledOnce();
    expect(onDownload).toHaveBeenCalledWith(cut);
  });

  it('does NOT trigger onSelect when clicking download button', () => {
    const onSelect = vi.fn();
    const cuts = [makeCut('c1')];
    const { getByTestId } = render(
      <CutsTab cuts={cuts} onSelect={onSelect} onDownload={vi.fn()} />
    );

    fireEvent.click(getByTestId('download-c1'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows "Baixar" button for each cut', () => {
    const cuts = [makeCut('c1'), makeCut('c2'), makeCut('c3')];
    const { getByTestId } = render(
      <CutsTab cuts={cuts} onSelect={vi.fn()} onDownload={vi.fn()} />
    );

    expect(getByTestId('download-c1')).toBeTruthy();
    expect(getByTestId('download-c2')).toBeTruthy();
    expect(getByTestId('download-c3')).toBeTruthy();
  });
});
