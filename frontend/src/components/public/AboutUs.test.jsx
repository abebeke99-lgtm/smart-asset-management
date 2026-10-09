import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AboutUs from './AboutUs';

let mockLanguage = 'en';

const expectedMission = [
  'Providing quality and accessible higher education.',
  'Promoting research, creativity, and innovation.',
  'Developing knowledgeable, skilled, ethical, and responsible graduates.',
  'Supporting community engagement and sustainable development.',
  'Promoting ethical leadership, professionalism, and academic excellence.'
];

const expectedValues = [
  ['Academic Excellence', 'We are committed to maintaining high academic standards in teaching, learning, and research to ensure quality education and continuous improvement.'],
  ['Integrity', 'We promote honesty, transparency, fairness, and ethical behavior in all academic, administrative, and professional activities.'],
  ['Innovation', 'We encourage creativity, critical thinking, research, and the use of modern technology to develop new ideas and effective solutions to challenges.'],
  ['Community Engagement', 'We work closely with local communities and stakeholders to address community needs, share knowledge, and contribute to social and economic development.'],
  ['Inclusiveness', 'We promote equal opportunities, respect diversity, and create a welcoming learning and working environment where everyone feels valued and respected.'],
  ['Responsibility', 'We encourage accountability, professionalism, environmental awareness, and responsible use of university resources to support sustainable development and serve society.']
];

jest.mock('../../contexts/UiContext', () => ({
  useLanguage: () => ({ language: mockLanguage }),
  useTheme: () => ({ theme: 'light' })
}));

describe('About page', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('starts collapsed and toggles the full university information', () => {
    render(<AboutUs />);

    expect(screen.getByRole('heading', { level: 1, name: 'Mekdela Amba University' })).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'About Us' });
    const content = document.getElementById('about-expandable-content');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('⌄');
    expect(content).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('⌃');
    expect(content).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByRole('heading', { name: 'Vision' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mission' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Core Values' })).toBeInTheDocument();
    expect(screen.getByText('To become a center of excellence in education, research, innovation, and community engagement, contributing meaningfully to national development.')).toBeInTheDocument();
    expect(screen.getByText('Mekdela Amba University is committed to:')).toBeInTheDocument();
    expectedMission.forEach((mission) => expect(screen.getByText(mission)).toBeInTheDocument());
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(expectedValues.map(([title]) => title));
    expectedValues.forEach(([, description]) => expect(screen.getByText(description)).toBeInTheDocument());
    expect(screen.getAllByRole('listitem')).toHaveLength(11);
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('svg')).toBeNull();
    expect(screen.queryByText(/asset management system/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/centralized records|movement and responsibility|verification and care|reporting and oversight/i)).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('⌄');
    expect(content).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders university information in Amharic when selected', () => {
    mockLanguage = 'am';

    render(<AboutUs />);

    expect(screen.getByRole('heading', { level: 1, name: 'መቅደላ አምባ ዩኒቨርሲቲ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ስለ እኛ' }));
    expect(screen.getByRole('heading', { name: 'ራዕይ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ተልዕኮ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ዋና እሴቶች' })).toBeInTheDocument();
  });
});