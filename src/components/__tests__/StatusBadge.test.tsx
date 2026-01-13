import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge Component', () => {
  it('should render online status correctly', () => {
    render(<StatusBadge status="online" />);
    const badge = screen.getByText(/online/i);
    expect(badge).toBeInTheDocument();
  });

  it('should render offline status correctly', () => {
    render(<StatusBadge status="offline" />);
    const badge = screen.getByText(/offline/i);
    expect(badge).toBeInTheDocument();
  });

  it('should render charging status correctly', () => {
    render(<StatusBadge status="charging" />);
    const badge = screen.getByText(/charging/i);
    expect(badge).toBeInTheDocument();
  });

  it('should apply correct styling for online status', () => {
    const { container } = render(<StatusBadge status="online" />);
    const badge = container.firstChild;
    expect(badge).toHaveClass('bg-emerald-500/10');
  });

  it('should apply correct styling for offline status', () => {
    const { container } = render(<StatusBadge status="offline" />);
    const badge = container.firstChild;
    expect(badge).toHaveClass('bg-zinc-500/10');
  });
});
