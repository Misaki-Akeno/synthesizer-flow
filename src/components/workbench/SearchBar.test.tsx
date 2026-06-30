import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchBar } from './SearchBar';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => new URLSearchParams('auxPanel=chat'),
}));

vi.mock('@/store/projects-store', () => ({
  usePersistStore: () => ({
    currentProject: {
      name: 'Patch Lab',
    },
  }),
}));

describe('SearchBar', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('opens the module browser with the submitted query', () => {
    render(<SearchBar />);

    fireEvent.click(screen.getByText('Patch Lab'));
    fireEvent.change(screen.getByPlaceholderText('搜索模块...'), {
      target: { value: 'oscillator' },
    });
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);

    expect(mockReplace).toHaveBeenCalledWith(
      '?auxPanel=chat&panel=module-browser&moduleSearch=oscillator'
    );
  });

  it('closes the expanded search field on Escape', () => {
    render(<SearchBar />);

    fireEvent.click(screen.getByText('Patch Lab'));
    fireEvent.change(screen.getByPlaceholderText('搜索模块...'), {
      target: { value: 'delay' },
    });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(screen.getByText('Patch Lab')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
