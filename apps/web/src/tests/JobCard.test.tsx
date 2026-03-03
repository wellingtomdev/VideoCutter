import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { JobCard } from '../components/jobs/JobCard';
import type { Job } from '../types';

const MOCK_JOB: Job = {
  id: 'job-1',
  title: 'My Video Title',
  status: 'done',
  source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=abc', videoId: 'abc' },
  createdAt: '2025-06-15T14:30:00.000Z',
  updatedAt: '2025-06-15T15:00:00.000Z',
};

describe('JobCard', () => {
  it('renders title, source type, and status', () => {
    const { getByText } = render(
      <JobCard job={MOCK_JOB} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} />
    );

    expect(getByText('My Video Title')).toBeTruthy();
    expect(getByText('YT')).toBeTruthy();
    expect(getByText('Concluido')).toBeTruthy();
  });

  it('displays correct status badge for each status', () => {
    const statuses = [
      { status: 'setup' as const, label: 'Configurando' },
      { status: 'ready' as const, label: 'Pronto' },
      { status: 'preparing' as const, label: 'Preparando' },
      { status: 'cutting' as const, label: 'Cortando' },
      { status: 'done' as const, label: 'Concluido' },
      { status: 'error' as const, label: 'Erro' },
    ];

    for (const { status, label } of statuses) {
      const job = { ...MOCK_JOB, status };
      const { getByText, unmount } = render(
        <JobCard job={job} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} />
      );
      expect(getByText(label)).toBeTruthy();
      unmount();
    }
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    const { getByTestId } = render(
      <JobCard job={MOCK_JOB} isActive={false} onSelect={onSelect} onDelete={vi.fn()} />
    );

    fireEvent.click(getByTestId('job-card'));
    expect(onSelect).toHaveBeenCalledWith('job-1');
  });

  it('shows active styling when isActive is true', () => {
    const { getByTestId } = render(
      <JobCard job={MOCK_JOB} isActive={true} onSelect={vi.fn()} onDelete={vi.fn()} />
    );

    const card = getByTestId('job-card');
    expect(card.className).toContain('border-blue-500');
  });

  it('shows Local source type for local jobs', () => {
    const localJob = { ...MOCK_JOB, source: { type: 'local' as const, path: '/test.mp4' } };
    const { getByText } = render(
      <JobCard job={localJob} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} />
    );

    expect(getByText('Local')).toBeTruthy();
  });
});
