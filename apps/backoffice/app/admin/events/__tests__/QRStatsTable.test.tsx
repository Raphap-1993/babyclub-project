import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QRStatsTable } from '../components/QRStatsTable';

const mockData = [
  {
    event_id: 'evt1',
    name: 'Fiesta Enero',
    date: '2026-01-15',
    total_qr: 120,
    by_type: { entrada: 100, mesa: 15, cortesia: 5 },
  },
  {
    event_id: 'evt2',
    name: 'Fiesta Febrero',
    date: '2026-02-10',
    total_qr: 80,
    by_type: { entrada: 60, mesa: 18, cortesia: 2 },
  },
];

describe('QRStatsTable', () => {
  it('muestra los eventos y el breakdown de QRs', () => {
    render(<QRStatsTable events={mockData} />);
    expect(screen.getByText('Fiesta Enero')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Fiesta Febrero')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
