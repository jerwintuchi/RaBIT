import { useState } from 'react';
import { ButtonSection } from './sections/ButtonSection';
import { InputSection } from './sections/InputSection';
import { SliderSection } from './sections/SliderSection';
import { CheckboxSection } from './sections/CheckboxSection';
import { DropdownSection } from './sections/DropdownSection';
import { PanelSection } from './sections/PanelSection';
import { ContextMenuSection } from './sections/ContextMenuSection';
import { TooltipSection } from './sections/TooltipSection';
import { ModalDialogSection } from './sections/ModalDialogSection';
import { ProgressBarSection } from './sections/ProgressBarSection';
import { IconSection } from './sections/IconSection';
import styles from './DevHarness.module.css';

const SECTIONS = [
  'Buttons',
  'Input',
  'Slider',
  'Checkbox',
  'Dropdown',
  'Panel',
  'ContextMenu',
  'Tooltip',
  'ModalDialog',
  'ProgressBar',
  'Icons',
] as const;

type Section = (typeof SECTIONS)[number];

const SECTION_MAP: Record<Section, () => JSX.Element> = {
  Buttons: ButtonSection,
  Input: InputSection,
  Slider: SliderSection,
  Checkbox: CheckboxSection,
  Dropdown: DropdownSection,
  Panel: PanelSection,
  ContextMenu: ContextMenuSection,
  Tooltip: TooltipSection,
  ModalDialog: ModalDialogSection,
  ProgressBar: ProgressBarSection,
  Icons: IconSection,
};

export function DevHarness(): JSX.Element {
  const [active, setActive] = useState<Section>('Buttons');
  const ActiveSection = SECTION_MAP[active];

  return (
    <div className={styles.harness}>
      <div className={styles.tabBar}>
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={[styles.tab, s === active ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => setActive(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className={styles.content}>
        <ActiveSection />
      </div>
    </div>
  );
}
