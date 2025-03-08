import React from 'react';

const ContextMenu = ({ top, left, onAddNode, onClose }) => {
  const menuRef = React.useRef(null);
  
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // 菜单选项配置
  const nodeOptions = [
    { id: 'input', label: '输入节点' },
    { id: 'default', label: '默认节点' },
    { id: 'output', label: '输出节点' },
    { id: 'custom', label: '自定义节点' }
  ];

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'absolute',
        top,
        left,
        backgroundColor: 'white',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        borderRadius: '4px',
        padding: '8px 0',
        zIndex: 1000
      }}
    >
      <div style={{ fontWeight: 'bold', padding: '5px 10px', borderBottom: '1px solid #eee' }}>
        添加节点
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {nodeOptions.map(option => (
          <li
            key={option.id}
            onClick={() => onAddNode(option.id)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={e => { e.target.style.backgroundColor = '#f0f0f0' }}
            onMouseLeave={e => { e.target.style.backgroundColor = 'transparent' }}
          >
            {option.label}
          </li>
        ))}
      </ul>
      <div 
        style={{
          padding: '8px 16px',
          borderTop: '1px solid #eee',
          cursor: 'pointer',
          textAlign: 'center',
          color: '#666'
        }}
        onClick={onClose}
        onMouseEnter={e => { e.target.style.backgroundColor = '#f0f0f0' }}
        onMouseLeave={e => { e.target.style.backgroundColor = 'transparent' }}
      >
        取消
      </div>
    </div>
  );
};

export default ContextMenu;