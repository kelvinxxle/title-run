import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the TITLE RUN heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /title run/i })).toBeInTheDocument();
  });
});
