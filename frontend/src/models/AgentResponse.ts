import { makeObservable, observable, action } from 'mobx';
import { ConversationItem } from './ConversationItem';
import { AgentView } from './AgentView';

/**
 * Agent 响应
 */
export class AgentResponse extends ConversationItem {
  readonly role = 'agent' as const;
  @observable view: AgentView;
  @observable isComplete: boolean = false;

  constructor(id: string) {
    super(id);
    makeObservable(this);
    this.view = new AgentView();
  }

  /**
   * 标记响应为完成状态
   */
  @action
  markComplete(): void {
    this.isComplete = true;
    this.view.finalizePendingTools();
  }
}
