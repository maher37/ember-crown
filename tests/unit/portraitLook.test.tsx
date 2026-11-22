import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Portrait } from '../../src/ui/Portrait';
import { speciesLook } from '../../src/ui/heroLook';

// Playtest wish (Nov 22): dragonborn look a little like a dragon; dwarves, halflings and
// gnomes are drawn smaller than humans.
const look = {
  skin: '#9a3b2a',
  hair: '#4e3224',
  eyes: '#d8a43a',
  hairStyle: 'short',
  beard: false,
  scar: false,
  cloth: '#7a2e2e',
} as const;

describe('portrait species look', () => {
  it('maps each species to a head shape and height', () => {
    expect(speciesLook('dragonborn')).toEqual({ ears: 'dragon', stature: 'medium' });
    expect(speciesLook('high-elf')).toEqual({ ears: 'elf', stature: 'medium' });
    expect(speciesLook('human')).toEqual({ ears: 'human', stature: 'medium' });
    expect(speciesLook('hill-dwarf').stature).toBe('stocky');
    expect(speciesLook('lightfoot-halfling').stature).toBe('small');
    expect(speciesLook('rock-gnome').stature).toBe('small');
  });

  it('shrinks small heroes and leaves medium ones full size', () => {
    const { container, rerender } = render(
      <Portrait {...look} {...speciesLook('rock-gnome')} label="g" />,
    );
    expect(container.querySelector('[data-stature="small"]')).toHaveAttribute('transform');
    rerender(<Portrait {...look} {...speciesLook('human')} label="h" />);
    expect(container.querySelector('[data-stature="medium"]')).not.toHaveAttribute('transform');
  });

  it('gives dragonborn slit pupils instead of round ones', () => {
    const { container } = render(<Portrait {...look} {...speciesLook('dragonborn')} label="d" />);
    expect(screen.getByRole('img', { name: 'd' })).toBeInTheDocument();
    expect(container.querySelectorAll('ellipse[rx="1.2"]')).toHaveLength(2);
    expect(container.querySelector('circle[r="1.3"]')).toBeNull();
  });
});
