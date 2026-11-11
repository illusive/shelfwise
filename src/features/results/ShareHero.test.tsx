import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { indexCatalogue } from '@/domain/catalogue';
import { computeVisitMetrics } from '@/domain/metrics';
import { seedCatalogue } from '@/services/seed/catalogue';
import { facing, matched, response, unknown } from '@/test/fixtures';
import { setLanguage } from '@/i18n/language';
import { ShareHero } from './ShareHero';

const catalogue = indexCatalogue(seedCatalogue);

function metricsFor(shelfMatches: Parameters<typeof facing>[2][], withCooler = true) {
  const base = response();
  const res = response({
    locations: withCooler ? base.locations : base.locations.filter((l) => l.type === 'shelf'),
    images: withCooler ? base.images : base.images.filter((i) => i.locationType === 'shelf'),
    facings: [
      ...shelfMatches.map((m, i) => facing('loc-shelf', 'img-1', m, `s${i}`)),
      ...(withCooler ? [facing('loc-cooler', 'img-3', matched('pepsi-330'), 'c1')] : []),
    ],
  });
  return computeVisitMetrics(res, [], catalogue);
}

describe('ShareHero', () => {
  it('opens on Overall, ordered Overall · Shelves · Coolers', () => {
    const metrics = metricsFor([
      matched('royal-pilsner-6x330'),
      matched('carlsberg-pilsner-6x330'),
    ]);
    render(<ShareHero metrics={metrics} previous={null} clientName="Royal Unibrew" />);
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Overall',
      'Shelves',
      'Coolers',
    ]);
    // 2 client facings (Royal + Pepsi) of 3 shelf + cooler facings.
    expect(screen.getByTestId('sos-value')).toHaveAttribute('data-scope', 'overall');
    expect(screen.getByTestId('sos-value')).toHaveTextContent('67%');
  });

  it('shows the shelf share, facings and first-visit baseline', async () => {
    const metrics = metricsFor([
      matched('royal-pilsner-6x330'),
      matched('carlsberg-pilsner-6x330'),
    ]);
    render(<ShareHero metrics={metrics} previous={null} clientName="Royal Unibrew" />);
    await userEvent.click(screen.getByRole('radio', { name: /Shelves/ }));
    expect(screen.getByTestId('sos-value')).toHaveTextContent('50%');
    expect(screen.getByText('1 of 2 visible facings')).toBeInTheDocument();
    expect(screen.getByText('First visit — baseline')).toBeInTheDocument();
  });

  it('shows a percentage-point change against a comparable visit', async () => {
    const previous = metricsFor([
      matched('royal-pilsner-6x330'),
      matched('carlsberg-pilsner-6x330'),
    ]);
    const current = metricsFor([matched('royal-pilsner-6x330'), matched('royal-classic-6x330')]);
    render(<ShareHero metrics={current} previous={previous} clientName="Royal Unibrew" />);
    await userEvent.click(screen.getByRole('radio', { name: /Shelves/ }));
    expect(screen.getByText('↑ 50 pp')).toBeInTheDocument();
    expect(screen.getByText('vs. last visit')).toBeInTheDocument();
  });

  it('explains an unavailable scope instead of showing a number', async () => {
    const metrics = metricsFor([matched('royal-pilsner-6x330')], false);
    render(<ShareHero metrics={metrics} previous={null} clientName="Royal Unibrew" />);
    await userEvent.click(screen.getByRole('radio', { name: /Coolers/ }));
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.getByText('Not captured in this visit')).toBeInTheDocument();
  });

  it('qualifies a share with many unidentified products', () => {
    const metrics = metricsFor([matched('royal-pilsner-6x330'), unknown(), unknown()]);
    render(<ShareHero metrics={metrics} previous={null} clientName="Royal Unibrew" />);
    expect(screen.getByText(/Many products could not be identified/)).toBeInTheDocument();
  });
});

describe('ShareHero in Danish', () => {
  it('renders Danish labels', () => {
    setLanguage('da');
    const metrics = metricsFor([
      matched('royal-pilsner-6x330'),
      matched('carlsberg-pilsner-6x330'),
    ]);
    render(<ShareHero metrics={metrics} previous={null} clientName="Royal Unibrew" />);
    expect(screen.getByRole('heading', { name: 'Hyldeandel' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Samlet',
      'Hylder',
      'Kølere',
    ]);
    expect(screen.getByText('Første besøg — udgangspunkt')).toBeInTheDocument();
  });
});
