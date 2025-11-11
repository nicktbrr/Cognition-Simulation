import React from 'react';
import { Handle, useNodeConnections } from '@xyflow/react';
 
const CustomHandle = (props: any) => {
  const connections = useNodeConnections({
    handleType: props.type,
  });

  // Extract connectionCount from props to avoid passing it to the Handle component
  const { connectionCount, ...handleProps } = props;

  return (
    <Handle
      {...handleProps}
      isConnectable={connectionCount ? connections.length < connectionCount : true}
      style={{
        width: '24px',
        height: '24px',
        background: '#3b82f6',
        border: '3px solid white',
        borderRadius: '50%',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
        cursor: 'pointer',
        ...props.style
      }}
    />
  );
};
 
export default CustomHandle;