import React, { useEffect, useState } from 'react';
import './ScrollToTopButton.css';

function ScrollToTopButton({ showAfterPx = 400 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      setVisible(window.scrollY > showAfterPx);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [showAfterPx]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="scroll-to-top-button"
      aria-label="Scroll to top"
      title="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      ↑
    </button>
  );
}

export default ScrollToTopButton;

