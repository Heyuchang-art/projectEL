import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SlideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function SlideDrawer({ isOpen, onClose, title, children }: SlideDrawerProps) {
  // Listen for Escape key to close the drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="slide-drawer-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div 
        className="slide-drawer-content"
        onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside drawer
        style={{
          width: '500px',
          maxWidth: '95vw',
          height: '100%',
          backgroundColor: '#0c0c0c',
          borderLeft: '3px solid #222222',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0px 0px #000000',
          position: 'relative'
        }}
      >
        {/* Drawer Header */}
        <div 
          style={{
            padding: '24px',
            borderBottom: '3px solid #222222',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#000000'
          }}
        >
          <h2 
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 900,
              fontSize: '18px',
              textTransform: 'uppercase',
              letterSpacing: '-0.5px',
              color: '#d1d5db'
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#000000',
              border: '2px solid #ffffff',
              color: '#d1d5db',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              boxShadow: '2px 2px 0px #000000',
              transition: 'all 0.1s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(-1px, -1px)';
              e.currentTarget.style.boxShadow = '3px 3px 0px #000000';
              e.currentTarget.style.borderColor = 'var(--error)';
              e.currentTarget.style.color = 'var(--error)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '2px 2px 0px #000000';
              e.currentTarget.style.borderColor = '#ffffff';
              e.currentTarget.style.color = '#ffffff';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Body */}
        <div 
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            backgroundColor: '#0c0c0c'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
