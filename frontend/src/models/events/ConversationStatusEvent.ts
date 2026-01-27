import { makeObservable, observable, action } from 'mobx';
import { Event } from './Event';

/**
 * 对话状态事件
 */
export class ConversationStatusEvent extends Event {
  readonly type = 'conversation_status';

  @observable status: string;
  @observable message?: string;

  constructor(data: { id: string; status: string; message?: string }) {
    super(data.id);
    makeObservable(this);
    this.status = data.status;
    this.message = data.message;
  }

  @action
  update(data: Partial<ConversationStatusEvent>) {
    if (data.status) this.status = data.status;
    if (data.message) this.message = data.message;
  }
}
