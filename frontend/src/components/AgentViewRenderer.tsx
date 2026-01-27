import React from 'react';
import { observer } from 'mobx-react-lite';
import { AgentView } from '../models/AgentView';
import { EventRenderer } from './EventRenderer';

interface AgentViewRendererProps {
  view: AgentView;
}

/**
 * Agent 视图渲染器：渲染 AgentView 中的所有事件
 */
export const AgentViewRenderer: React.FC<AgentViewRendererProps> = observer(({ view }) => {
  return (
    <div className="agent-view">
      {view.events.map((event) => (
        <EventRenderer key={event.id} event={event} />
      ))}
    </div>
  );
});
