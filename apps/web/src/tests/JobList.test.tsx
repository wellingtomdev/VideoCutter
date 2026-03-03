import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { JobList } from '../components/jobs/JobList';
import type { Job } from '../types';

const makeJob = (id: string, title: string): Job => ({
  id,
  title,
  status: 'done',
  source: { type: 'youtube', youtubeUrl: `https://youtube.com/watch?v=${id}`, videoId: id },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
});

describe('JobList', () => {
  it('renders a list of jobs', () => {
    const jobs = [makeJob('1', 'Video A'), makeJob('2', 'Video B')];
    const { getByText } = render(
      <JobList jobs={jobs} activeJobId={null} onSelect={vi.fn()} onDelete={vi.fn()} />
    );

    expect(getByText('Video A')).toBeTruthy();
    expect(getByText('Video B')).toBeTruthy();
  });

  it('shows empty state when no jobs', () => {
    const { getByText } = render(
      <JobList jobs={[]} activeJobId={null} onSelect={vi.fn()} onDelete={vi.fn()} />
    );

    expect(getByText(/nenhum trabalho/i)).toBeTruthy();
  });

  it('calls onSelect when a job card is clicked', () => {
    const onSelect = vi.fn();
    const jobs = [makeJob('1', 'Video A')];
    const { getByTestId } = render(
      <JobList jobs={jobs} activeJobId={null} onSelect={onSelect} onDelete={vi.fn()} />
    );

    fireEvent.click(getByTestId('job-card'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });

  it('filters jobs by search query', () => {
    const jobs = [
      makeJob('1', 'React Tutorial'),
      makeJob('2', 'Vue Workshop'),
      makeJob('3', 'React Hooks'),
      makeJob('4', 'Angular Basics'),
    ];
    const { getByPlaceholderText, queryByText } = render(
      <JobList jobs={jobs} activeJobId={null} onSelect={vi.fn()} onDelete={vi.fn()} />
    );

    const searchInput = getByPlaceholderText(/buscar/i);
    fireEvent.change(searchInput, { target: { value: 'react' } });

    expect(queryByText('React Tutorial')).toBeTruthy();
    expect(queryByText('React Hooks')).toBeTruthy();
    expect(queryByText('Vue Workshop')).toBeNull();
    expect(queryByText('Angular Basics')).toBeNull();
  });

  it('does not show search when 3 or fewer jobs', () => {
    const jobs = [makeJob('1', 'A'), makeJob('2', 'B')];
    const { queryByPlaceholderText } = render(
      <JobList jobs={jobs} activeJobId={null} onSelect={vi.fn()} onDelete={vi.fn()} />
    );

    expect(queryByPlaceholderText(/buscar/i)).toBeNull();
  });
});
