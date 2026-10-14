import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '@/store/projects-store';
import { AuthProvider } from './AuthProvider';

const { mockUseSession } = vi.hoisted(() => ({ mockUseSession: vi.fn() }));

vi.mock('@/actions/project.actions', () => ({}));

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: mockUseSession,
}));

const setProjectOwner = vi.fn(async (userId: string | null) => {
  useProjectStore.setState({ projectOwnerId: userId });
});

function renderProvider() {
  render(
    <AuthProvider>
      <div>workbench</div>
    </AuthProvider>
  );
}

describe('AuthProvider project ownership', () => {
  beforeEach(() => {
    setProjectOwner.mockClear();
    useProjectStore.setState({
      hasHydratedProjects: true,
      projectOwnerId: 'user-1',
      setProjectOwner,
    });
  });

  it('keeps the cache when the session reports unauthenticated', () => {
    // next-auth v4 把 session 请求失败也报告为未登录
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    renderProvider();

    expect(screen.getByText('workbench')).toBeInTheDocument();
    expect(setProjectOwner).not.toHaveBeenCalled();
  });

  it('switches the owner before rendering for another signed-in account', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-2' } },
      status: 'authenticated',
    });

    let finishSwitch!: () => void;
    setProjectOwner.mockImplementationOnce(
      (userId) =>
        new Promise<void>((resolve) => {
          finishSwitch = () => {
            useProjectStore.setState({ projectOwnerId: userId });
            resolve();
          };
        })
    );

    renderProvider();

    expect(setProjectOwner).toHaveBeenCalledWith('user-2');
    expect(screen.queryByText('workbench')).not.toBeInTheDocument();
    act(() => finishSwitch());
    await waitFor(() =>
      expect(screen.getByText('workbench')).toBeInTheDocument()
    );
  });
});
