import { HTMLAttributes } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

type DraggableProps = { id: string; data?: {} } & HTMLAttributes<HTMLDivElement>;

const Draggable = ({ children, id, className, data }: DraggableProps) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id, data });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, cursor: 'pointer', touchAction: 'none' }}
      {...listeners}
      {...attributes}
      className={className}
    >
      {children}
    </div>
  );
};

export default Draggable;
