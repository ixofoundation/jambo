/**
 * Map-furniture controls for the HERE map, replacing the UNL SDK's
 * `GridControl` ("Choose Grid Size") and `tilesSelectorControl` (vector ⇄
 * satellite). Styling uses literals on purpose: these mirror maplibre's
 * control chrome (29×29 buttons, 4px radius, 2px ring) so they match the zoom
 * controls on the same map, not the app's design tokens — the same deliberate
 * divergence as the recenter button in HereMap.
 */
import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { CellPrecision, getFormattedCellDimensions } from './grid.service';

const PANEL_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  right: '0',
  top: '34px',
  minWidth: '180px',
  maxHeight: '260px',
  overflowY: 'auto',
  background: '#fff',
  color: '#333',
  borderRadius: '4px',
  boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
  zIndex: '3',
  padding: '4px',
};

const applyStyle = (el: HTMLElement, style: Partial<CSSStyleDeclaration>) => {
  Object.assign(el.style, style);
};

const controlButton = (label: string, svgPath: string): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle">${svgPath}</svg>`;
  return button;
};

/**
 * "Choose grid size" — a button in maplibre's control tray opening a list of
 * the ten geohash precisions (with their cell dimensions, like the UNL
 * modal). Selecting one calls `onSelect`; the owner redraws the grid and
 * encodes later clicks at that precision.
 */
export class GridSizeControl implements IControl {
  private container: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private button: HTMLButtonElement | null = null;
  private precision: CellPrecision;
  private readonly onSelect: (precision: CellPrecision) => void;
  private readonly onDocumentClick = (e: MouseEvent) => {
    if (this.container && !this.container.contains(e.target as Node)) {
      this.closePanel();
    }
  };

  constructor(options: { initialPrecision: CellPrecision; onSelect: (precision: CellPrecision) => void }) {
    this.precision = options.initialPrecision;
    this.onSelect = options.onSelect;
  }

  onAdd(_map: MapLibreMap): HTMLElement {
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    container.style.position = 'relative';

    // 3×3 grid glyph
    this.button = controlButton(
      'Choose grid size',
      '<path d="M3 3h18v18H3z"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
    );
    this.button.setAttribute('aria-expanded', 'false');
    this.button.addEventListener('click', () => {
      if (this.panel?.style.display === 'block') this.closePanel();
      else this.openPanel();
    });
    container.appendChild(this.button);

    const panel = document.createElement('div');
    applyStyle(panel, PANEL_STYLE);
    panel.style.display = 'none';
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('aria-label', 'Grid size');
    for (const value of Object.values(CellPrecision)) {
      if (typeof value !== 'number') continue;
      const precision = value as CellPrecision;
      const item = document.createElement('button');
      item.type = 'button';
      item.dataset.precision = String(precision);
      item.textContent = getFormattedCellDimensions(precision);
      applyStyle(item, {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        border: '0',
        borderRadius: '4px',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        fontSize: '13px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      });
      item.addEventListener('click', () => {
        this.precision = precision;
        this.markSelected();
        this.closePanel();
        this.onSelect(precision);
      });
      panel.appendChild(item);
    }
    container.appendChild(panel);
    this.panel = panel;
    this.markSelected();

    document.addEventListener('click', this.onDocumentClick, true);
    this.container = container;
    return container;
  }

  onRemove(): void {
    document.removeEventListener('click', this.onDocumentClick, true);
    this.container?.remove();
    this.container = null;
    this.panel = null;
    this.button = null;
  }

  private openPanel(): void {
    if (!this.panel) return;
    this.panel.style.display = 'block';
    this.button?.setAttribute('aria-expanded', 'true');
  }

  private closePanel(): void {
    if (!this.panel) return;
    this.panel.style.display = 'none';
    this.button?.setAttribute('aria-expanded', 'false');
  }

  private markSelected(): void {
    if (!this.panel) return;
    for (const child of Array.from(this.panel.children)) {
      const el = child as HTMLElement;
      const selected = Number(el.dataset.precision) === this.precision;
      el.style.fontWeight = selected ? '700' : '400';
      el.style.background = selected ? 'rgba(0, 0, 0, 0.06)' : 'transparent';
      el.setAttribute('aria-selected', String(selected));
    }
  }
}

/**
 * Vector ⇄ satellite basemap toggle. The satellite imagery is a raster layer
 * inside the vector style (toggled by visibility), so custom grid/selection
 * layers survive the switch — no `setStyle` teardown.
 */
export class BasemapToggleControl implements IControl {
  private container: HTMLElement | null = null;
  private satellite = false;
  private readonly onToggle: (satellite: boolean) => void;

  constructor(options: { onToggle: (satellite: boolean) => void }) {
    this.onToggle = options.onToggle;
  }

  onAdd(_map: MapLibreMap): HTMLElement {
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    // stacked-layers glyph
    const button = controlButton(
      'Toggle satellite imagery',
      '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    );
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      this.satellite = !this.satellite;
      button.setAttribute('aria-pressed', String(this.satellite));
      this.onToggle(this.satellite);
    });
    container.appendChild(button);
    this.container = container;
    return container;
  }

  onRemove(): void {
    this.container?.remove();
    this.container = null;
  }
}
