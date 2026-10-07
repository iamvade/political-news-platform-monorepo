import { EMBED_SRC_PREFIXES } from '@news/shared/content';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EmbedActivator } from './embed-activator';

function setup(src: string) {
  return render(
    <div>
      <div
        dangerouslySetInnerHTML={{ __html: `<figure class="embed"><button type="button" data-embed-src="${src}" data-embed-title="YouTube">Тоглуулах</button></figure>` }}
      />
      <EmbedActivator allowedPrefixes={EMBED_SRC_PREFIXES} />
    </div>,
  );
}

describe('EmbedActivator', () => {
  it('loads the iframe only after the tap', async () => {
    const { container } = setup('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(container.querySelector('iframe')).toBeNull();

    await userEvent.click(container.querySelector('button')!);

    const iframe = container.querySelector('iframe')!;
    expect(iframe.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1');
    expect(iframe.title).toBe('YouTube');
    expect(container.querySelector('button')).toBeNull();
  });

  it('ignores URLs outside the allowlist', async () => {
    const { container } = setup('https://evil.example/embed');
    await userEvent.click(container.querySelector('button')!);
    expect(container.querySelector('iframe')).toBeNull();
  });
});
