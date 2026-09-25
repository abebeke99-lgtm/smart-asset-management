import React from 'react';
import { render, screen } from '@testing-library/react';
import Home from './Home';

describe('Home', () => {
  it('renders the requested homepage gallery images', () => {
    render(<Home />);

    const images = screen.getAllByRole('img');
    const sources = images.map((image) => image.getAttribute('src'));

    expect(images).toHaveLength(3);
    expect(sources).toContain('/uploads/images/imagegs.jpg');
    expect(sources).toContain('/uploads/images/imagefs.jpg');
  });
});
