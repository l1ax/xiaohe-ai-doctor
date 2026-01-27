import { makeObservable, observable, action } from 'mobx';
import { Event } from './Event';

/**
 * 工具调用事件
 */
export class ToolCallEvent extends Event {
  readonly type = 'tool_call';

  @observable toolId: string;
  @observable name: string;
  @observable status: 'running' | 'completed' | 'failed';
  @observable input?: Record<string, any>;
  @observable output?: Record<string, any>;
  @observable duration?: number;

  constructor(data: {
    id: string;
    toolId: string;
    name: string;
    status: 'running' | 'completed' | 'failed';
    input?: Record<string, any>;
    output?: Record<string, any>;
    duration?: number;
  }) {
    super(data.id);
    makeObservable(this);
    this.toolId = data.toolId;
    this.name = data.name;
    this.status = data.status;
    this.input = data.input;
    this.output = data.output;
    this.duration = data.duration;
  }

  @action
  update(data: Partial<ToolCallEvent> | { status?: 'running' | 'completed' | 'failed'; output?: Record<string, any>; duration?: number }) {
    if (data.status) this.status = data.status;
    if (data.output !== undefined) this.output = data.output;
    if (data.duration !== undefined) this.duration = data.duration;
  }
}
