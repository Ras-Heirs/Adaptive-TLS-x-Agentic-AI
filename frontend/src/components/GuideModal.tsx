import type { FC } from 'react';
import { Logo } from './Logo';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Navigate the Map',
    text: 'Scroll or use the zoom controls to zoom, and drag the map to pan. Dashed frames mark the camera zones on each approach. Click any vehicle to see its details.',
  },
  {
    title: 'Choose a Scenario',
    text: 'Day, Rush Hour and Night generate traffic automatically; Auto Cycle rotates through all three. Custom turns the generator off, so vehicles only appear from Traffic Injection.',
  },
  {
    title: 'Emergency Vehicles',
    text: 'Add an ambulance or fire truck from Traffic Injection. Once it enters a camera zone, the frontend requests priority from the backend.',
  },
  {
    title: 'Signal Decisions',
    text: 'Camera counts are sent to the agents every 4 seconds (Auto Sync), or manually with Send to Agent. Light colors and durations always come from the backend.',
  },
  {
    title: 'Manual Control & Analytics',
    text: 'Force Green gives one intersection green for 15–90 s and pauses Auto Sync. Below the map, Queue at Cameras, Performance and Phase History can be exported as CSV.',
  },
];

const KEYS: [string, string][] = [
  ['+ / −', 'Zoom'], ['R', 'Reset View'], ['F', 'Fullscreen'], ['B', 'Bounding Boxes'],
  ['H', 'Heatmap'], ['Esc', 'Deselect / Exit'], ['?', 'Open Guide'],
];

export const GuideModal: FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={onClose}>
      <div className="surface modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <Logo size={40} />
          <div>
            <span className="eyebrow">Welcome</span>
            <h3 id="guide-title">Adaptive Traffic Light</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close guide">×</button>
        </div>

        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="step-n">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="keys">
          <span className="eyebrow">Keyboard Shortcuts</span>
          <dl>
            {KEYS.map(([k, v]) => (
              <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>
            ))}
          </dl>
        </div>

        <p className="modal-note">Make sure the backend is running on port 3000 with <code>/api/intersections</code>, <code>/api/logs</code>, <code>/api/sensor</code> and <code>/api/override</code> available.</p>

        <div className="modal-foot">
          <button className="btn btn-gold" onClick={onClose}>Start Simulation</button>
        </div>
      </div>
    </div>
  );
};
