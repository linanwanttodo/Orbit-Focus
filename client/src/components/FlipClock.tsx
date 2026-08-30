import React, { useEffect, useState } from 'react';

interface FlipClockProps {
  value: string;
  className?: string;
}

interface CardState {
  current: string;
  previous: string;
  flipping: boolean;
}

const FLIP_DURATION = 450;

const FlipCard: React.FC<{ value: string }> = ({ value }) => {
  const [state, setState] = useState<CardState>({
    current: value,
    previous: value,
    flipping: false,
  });

  useEffect(() => {
    setState((prev) => {
      if (prev.current === value) return prev;
      return { current: value, previous: prev.current, flipping: true };
    });
  }, [value]);

  useEffect(() => {
    if (!state.flipping) return;
    const timer = window.setTimeout(() => {
      setState((prev) => ({ ...prev, previous: prev.current, flipping: false }));
    }, FLIP_DURATION);
    return () => window.clearTimeout(timer);
  }, [state.flipping, state.current]);

  const { current, previous, flipping } = state;

  return (
    <div className="flip-clock">
      <div className="half top"><div className="text-wrapper">{current}</div></div>
      <div className="half bottom"><div className="text-wrapper">{flipping ? previous : current}</div></div>
      {/* key 保证连续翻页时动画能重新触发 */}
      <div key={`ft-${current}`} className={`flap-top${flipping ? ' flipping' : ''}`}>
        <div className="text-wrapper">{flipping ? previous : current}</div>
      </div>
      <div key={`fb-${current}`} className={`flap-bottom${flipping ? ' flipping' : ''}`}>
        <div className="text-wrapper">{current}</div>
      </div>
      <div className="divider" />
    </div>
  );
};

const FlipClock: React.FC<FlipClockProps> = ({ value, className = '' }) => {
  // 按冒号拆分成时/分/秒卡片，同时兼容 "MM:SS" 倒计时格式
  const segments = value.split(':');

  return (
    <div
      className={`fc-root ${className}`}
      style={{ '--fc-count': segments.length } as React.CSSProperties}
    >
      {segments.map((seg, i) => (
        <React.Fragment key={`${segments.length}-${i}`}>
          {i > 0 && <div className="fc-colon"><span /><span /></div>}
          <FlipCard value={seg} />
        </React.Fragment>
      ))}
    </div>
  );
};

export default FlipClock;
