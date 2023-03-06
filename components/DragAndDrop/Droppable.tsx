import { CSSProperties, HTMLAttributes } from 'react';
import { useDroppable } from '@dnd-kit/core';

type DroppableProps = { id: string; isOverStyle?: CSSProperties; data?: {} } & HTMLAttributes<HTMLDivElement>;

const Droppable = ({ children, id, isOverStyle, className, data }: DroppableProps) => {
  const { isOver, setNodeRef } = useDroppable({ id, data });

  return (
    <div ref={setNodeRef} style={isOver ? isOverStyle : undefined} className={className}>
      {children}
    </div>
  );
};

export default Droppable;
