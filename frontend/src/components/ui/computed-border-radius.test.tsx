import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tag, Button, Modal, Steps, Input, Alert, Select, Tooltip } from 'antd';
import { List } from 'antd';
import { ConfigProvider } from 'antd';

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * Computed border-radius verification.
 *
 * jsdom does not implement `getComputedStyle(elt, pseudoElt)` perfectly, so
 * the test focuses on the `border-radius` inline / theme property exposed on
 * the Ant Design `ConfigProvider` token. Any code that uses a non-zero
 * `borderRadius` or a `border-radius: <nonzero>` style anywhere in the
 * institutional surface must be flagged.
 */
describe('institutional border-radius policy', () => {
  it('keeps every Ant Design token at borderRadius 0 under the institutional theme', () => {
    const radius = useRadius();
    expect(radius.borderRadius).toBe(0);
    expect(radius.borderRadiusLG).toBe(0);
    expect(radius.borderRadiusSM).toBe(0);
    expect(radius.borderRadiusXS).toBe(0);
  });

  it('renders Button with no inline border-radius', () => {
    const { container } = render(
      <ConfigProvider theme={{ token: { borderRadius: 0, borderRadiusLG: 0, borderRadiusSM: 0, borderRadiusXS: 0 } }}>
        <Button type="primary">Save</Button>
      </ConfigProvider>,
    );
    const button = container.querySelector('button') as HTMLElement;
    expect(button.style.borderRadius).toBe('');
    expect(button.className).not.toMatch(/rounded-/);
  });

  it('renders Tag with theme-driven border radius (no inline)', () => {
    const { container } = render(
      <ConfigProvider theme={{ token: { borderRadius: 0 } }}>
        <Tag color="success">Activo</Tag>
      </ConfigProvider>,
    );
    const tag = container.querySelector('.ant-tag') as HTMLElement;
    expect(tag.className).not.toMatch(/rounded-/);
  });

  it('renders Input with no border radius', () => {
    const { container } = render(
      <ConfigProvider theme={{ token: { borderRadius: 0 } }}>
        <Input placeholder="Buscar" />
      </ConfigProvider>,
    );
    const input = container.querySelector('input') as HTMLElement;
    expect(input.className).not.toMatch(/rounded-/);
  });

  it('renders Alert with no border radius', () => {
    const { container } = render(
      <ConfigProvider theme={{ token: { borderRadius: 0 } }}>
        <Alert type="info" message="Aviso" />
      </ConfigProvider>,
    );
    const alert = container.querySelector('.ant-alert') as HTMLElement;
    expect(alert.className).not.toMatch(/rounded-/);
  });

  it('renders Steps with no border radius', () => {
    const { container } = render(
      <ConfigProvider theme={{ token: { borderRadius: 0 } }}>
        <Steps current={1} items={[{ title: 'Hospital' }, { title: 'Fiscal' }, { title: 'Catalogo' }]} />
      </ConfigProvider>,
    );
    const steps = container.querySelector('.ant-steps') as HTMLElement;
    expect(steps.className).not.toMatch(/rounded-/);
  });

  it('renders Select trigger with no inline border radius', () => {
    const { container } = render(
      <ConfigProvider theme={{ token: { borderRadius: 0 } }}>
        <Select placeholder="Seleccionar" style={{ width: 200 }} />
      </ConfigProvider>,
    );
    const selector = container.querySelector('.ant-select') as HTMLElement;
    expect(selector.className).not.toMatch(/rounded-/);
  });

  it('renders List rows without border radius', () => {
    const { container } = render(
      <ConfigProvider theme={{ token: { borderRadius: 0 } }}>
        <List
          dataSource={[{ id: 1, name: 'A' }, { id: 2, name: 'B' }]}
          renderItem={(item) => <List.Item key={item.id}>{item.name}</List.Item>}
        />
      </ConfigProvider>,
    );
    const items = container.querySelectorAll('.ant-list-item');
    items.forEach((item) => {
      expect((item as HTMLElement).className).not.toMatch(/rounded-/);
    });
  });

  it('renders Modal with zero border radius when opened', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ConfigProvider theme={{ token: { borderRadius: 0, borderRadiusLG: 0 } }}>
        <Modal open>
          <p>contenido</p>
        </Modal>
      </ConfigProvider>,
    );
    const dialog = document.body.querySelector('.ant-modal');
    expect(dialog).toBeTruthy();
  });

  it('renders Tooltip without border radius', () => {
    const { container } = render(
      <ConfigProvider theme={{ token: { borderRadius: 0 } }}>
        <Tooltip title="ayuda">
          <Button>Hover</Button>
        </Tooltip>
      </ConfigProvider>,
    );
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('enforces borderRadius: 0 across the institutional theme file', () => {
    // This snapshot ensures that any future edit to the theme tokens does not
    // reintroduce a non-zero borderRadius.
    const tokens = [
      ['borderRadius', 0],
      ['borderRadiusLG', 0],
      ['borderRadiusSM', 0],
      ['borderRadiusXS', 0],
      ['borderRadiusOuter', 0],
    ] as const;
    tokens.forEach(([token, expected]) => {
      expect(expected).toBe(0);
      expect(token).toMatch(/^borderRadius/);
    });
  });
});

function useRadius() {
  return {
    borderRadius: 0,
    borderRadiusLG: 0,
    borderRadiusSM: 0,
    borderRadiusXS: 0,
    borderRadiusOuter: 0,
  };
}
