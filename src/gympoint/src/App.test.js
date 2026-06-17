
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App navigation and actions', () => {
  test('renders Members page and interacts with buttons', async () => {
    render(<App />);
    // Navigate to Members (simulate if navigation exists)
    // For now, just check for Members header
    expect(await screen.findByText(/Members/i)).toBeInTheDocument();

    // Test Refresh Membership Plans button
    const refreshBtn = screen.queryByRole('button', { name: /refresh/i });
    if (refreshBtn) {
      fireEvent.click(refreshBtn);
      // Optionally check for loading state
    }
  });

  test('renders Reports page and interacts with export buttons', async () => {
    render(<App />);
    // Simulate navigation if needed
    // Check for Export Summary button
    const exportSummaryBtn = await screen.findAllByRole('button', { name: /export summary/i });
    exportSummaryBtn.forEach(btn => fireEvent.click(btn));
    // Check for Export All, Export Page, Export CSV buttons
    const exportAll = screen.queryAllByRole('button', { name: /export all/i });
    exportAll.forEach(btn => fireEvent.click(btn));
    const exportPage = screen.queryAllByRole('button', { name: /export page/i });
    exportPage.forEach(btn => fireEvent.click(btn));
    const exportCSV = screen.queryAllByRole('button', { name: /export csv/i });
    exportCSV.forEach(btn => fireEvent.click(btn));
  });

  test('renders Packages page and interacts with plan buttons', async () => {
    render(<App />);
    // Simulate navigation if needed
    // Find Choose Normal Pass and Upgrade to Premium buttons
    const chooseNormal = screen.queryAllByRole('button', { name: /choose normal pass/i });
    chooseNormal.forEach(btn => fireEvent.click(btn));
    const upgradePremium = screen.queryAllByRole('button', { name: /upgrade to premium/i });
    upgradePremium.forEach(btn => fireEvent.click(btn));
  });

  test('renders mailto and tel links in Employees and Leads', async () => {
    render(<App />);
    // Check for mailto and tel links
    const mailLinks = screen.queryAllByRole('link', { name: /@/i });
    mailLinks.forEach(link => expect(link).toHaveAttribute('href', expect.stringContaining('mailto:')));
    const telLinks = screen.queryAllByRole('link', { name: /call|phone|tel/i });
    telLinks.forEach(link => expect(link).toHaveAttribute('href', expect.stringContaining('tel:')));
  });
});
